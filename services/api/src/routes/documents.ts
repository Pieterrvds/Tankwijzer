import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { extractDocument, extractionToFacts } from "@tankwijzer/ai";
import {
  DocumentFacts,
  DocumentKind,
  InspectionType,
  VaultDocument,
  checkDocuments,
  type InspectionRecord,
} from "@tankwijzer/vlarem-core";
import { run } from "../db.ts";
import { getDocument, getSite, getTank, listDocuments, listTanks, logAi, newId, saveDocument, saveTank } from "../repo.ts";
import { notFound, parseJson, requireCompany, toBase64, uploadedFile, type AppEnv, type Deps } from "../context.ts";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function documentRoutes(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.get("/documents", (c) => {
    const companyId = requireCompany(c);
    const docs = listDocuments(deps.db, companyId);
    const checklist = listTanks(deps.db, companyId).map((t) => ({
      tankId: t.id,
      label: t.label,
      documents: checkDocuments(t, docs),
    }));
    return c.json({ documents: docs, checklist });
  });

  app.post("/documents", async (c) => {
    const companyId = requireCompany(c);
    const { file, bytes, form } = await uploadedFile(c);
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new HTTPException(415, { message: "Upload een PDF of een foto (JPG, PNG, WEBP)." });
    }
    const tankIds = typeof form.tankIds === "string" && form.tankIds ? form.tankIds.split(",") : [];
    for (const id of tankIds) if (!getTank(deps.db, companyId, id)) throw new HTTPException(400, { message: "Onbekende tank." });
    const siteId = typeof form.siteId === "string" && form.siteId ? form.siteId : null;
    if (siteId && !getSite(deps.db, companyId, siteId)) throw new HTTPException(400, { message: "Onbekende site." });
    const chosenKind = DocumentKind.safeParse(form.kind);

    const id = newId("doc");
    const path = deps.storage.save(companyId, id, bytes);
    let doc = VaultDocument.parse({
      id,
      companyId,
      kind: chosenKind.success ? chosenKind.data : "other",
      title: file.name,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      tankIds,
      siteId,
      uploadedAt: new Date().toISOString(),
    });
    saveDocument(deps.db, doc, path);

    // Extraction is best effort: the upload itself always succeeds.
    let extraction: { status: "done" | "skipped" | "failed"; logId?: string; message?: string } = { status: "skipped" };
    if (deps.ai.enabled) {
      try {
        const e = await extractDocument(deps.ai, { mediaType: file.type, base64: toBase64(bytes) }, file.name);
        doc = VaultDocument.parse({
          ...doc,
          kind: chosenKind.success ? chosenKind.data : e.kind,
          title: e.title || doc.title,
          facts: extractionToFacts(e),
          factsConfirmed: false,
        });
        saveDocument(deps.db, doc);
        const logId = logAi(deps.db, {
          companyId,
          feature: "extract_document",
          input: { documentId: id, filename: file.name, mimeType: file.type },
          output: e,
          model: deps.ai.model,
        });
        extraction = e.readable
          ? { status: "done", logId }
          : { status: "failed", logId, message: "Het document is moeilijk leesbaar. Vul de gegevens zelf aan." };
      } catch (err) {
        console.error("[documents] extraction failed", err);
        extraction = { status: "failed", message: "Gegevens konden niet automatisch gelezen worden. Vul ze zelf aan." };
      }
    }
    return c.json({ document: doc, extraction }, 201);
  });

  app.get("/documents/:id/file", (c) => {
    const companyId = requireCompany(c);
    const found = getDocument(deps.db, companyId, c.req.param("id")) ?? notFound("Document niet gevonden");
    return c.body(new Uint8Array(deps.storage.read(found.storagePath)), 200, {
      "Content-Type": found.doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(found.doc.filename)}"`,
    });
  });

  app.put("/documents/:id", async (c) => {
    const companyId = requireCompany(c);
    const found = getDocument(deps.db, companyId, c.req.param("id")) ?? notFound("Document niet gevonden");
    const body = await parseJson(
      c,
      z.object({
        kind: DocumentKind,
        title: z.string().min(1),
        tankIds: z.array(z.string()),
        siteId: z.string().nullable(),
        facts: DocumentFacts.nullable(),
        factsConfirmed: z.boolean(),
      }),
    );
    for (const id of body.tankIds) if (!getTank(deps.db, companyId, id)) throw new HTTPException(400, { message: "Onbekende tank." });
    if (body.siteId && !getSite(deps.db, companyId, body.siteId)) throw new HTTPException(400, { message: "Onbekende site." });
    const doc = VaultDocument.parse({ ...found.doc, ...body });
    saveDocument(deps.db, doc);
    return c.json(doc);
  });

  app.delete("/documents/:id", (c) => {
    const companyId = requireCompany(c);
    const found = getDocument(deps.db, companyId, c.req.param("id")) ?? notFound("Document niet gevonden");
    deps.storage.remove(found.storagePath);
    run(deps.db, "DELETE FROM documents WHERE company_id = ? AND id = ?", companyId, found.doc.id);
    return c.json({ ok: true });
  });

  /**
   * Import an official inspection report into a tank: updates sticker, dates and open remarks.
   * Only confirmed facts are used, and the record is marked as coming from the official report.
   */
  app.post("/documents/:id/apply-to-tank", async (c) => {
    const companyId = requireCompany(c);
    const found = getDocument(deps.db, companyId, c.req.param("id")) ?? notFound("Document niet gevonden");
    const body = await parseJson(c, z.object({ tankId: z.string(), inspectionType: InspectionType }));
    const tank = getTank(deps.db, companyId, body.tankId) ?? notFound("Tank niet gevonden");
    const { doc } = found;
    if (!["inspection_report", "commissioning_report"].includes(doc.kind)) {
      throw new HTTPException(400, { message: "Alleen keuringsverslagen kunnen verwerkt worden." });
    }
    if (!doc.facts || !doc.factsConfirmed || !doc.facts.documentDate) {
      throw new HTTPException(400, { message: "Bevestig eerst de datum en de klever van het verslag." });
    }
    const record: InspectionRecord = {
      date: doc.facts.documentDate,
      type: body.inspectionType,
      sticker: doc.facts.sticker,
      nextDueDate: doc.facts.nextInspectionDate,
      remarks: doc.facts.openRemarks,
      source: "official_report",
    };
    const inspections = [
      ...tank.inspections.filter((i) => !(i.date === record.date && i.type === record.type)),
      record,
    ];
    const orangeFindings =
      record.sticker === "orange"
        ? [
            ...tank.orangeFindings,
            ...record.remarks
              .filter((r) => !tank.orangeFindings.some((f) => f.text === r))
              .map((text) => ({ id: newId("fnd"), text, resolved: false, proofDocumentIds: [] })),
          ]
        : tank.orangeFindings;
    const saved = saveTank(deps.db, { ...tank, inspections, orangeFindings });
    if (!doc.tankIds.includes(tank.id)) saveDocument(deps.db, { ...doc, tankIds: [...doc.tankIds, tank.id] });
    return c.json(saved);
  });

  return app;
}
