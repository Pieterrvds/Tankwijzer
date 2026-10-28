import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  AiDisabledError,
  AiOutputError,
  askQuestion,
  assessPrecheckPhoto,
  readTankPhoto,
  readingToTankPatch,
} from "@tankwijzer/ai";
import { DISCLAIMER_NL, LABELS_NL, PRECHECK_STEPS, getRuleset, RULESET_VL } from "@tankwijzer/vlarem-core";
import { all, get, run } from "../db.ts";
import { getTank, listDocuments, listSites, listTanks, logAi, newId } from "../repo.ts";
import { notFound, parseJson, requireCompany, toBase64, uploadedFile, type AppEnv, type Deps } from "../context.ts";
import { evaluate } from "./tanks.ts";

/** Maps AI failures to clear Dutch messages; AI being off is not an error for the owner. */
export async function withAi<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AiDisabledError) throw new HTTPException(503, { message: e.message });
    if (e instanceof AiOutputError) throw new HTTPException(422, { message: e.message });
    console.error("[ai]", e);
    throw new HTTPException(502, { message: "De AI-dienst is tijdelijk niet bereikbaar. Probeer later opnieuw." });
  }
}

export function aiRoutes(deps: Deps) {
  const app = new Hono<AppEnv>();

  // Tank register: read nameplate / sticker / product label from a photo.
  app.post("/ai/read-photo", async (c) => {
    const companyId = requireCompany(c);
    const { file, bytes, form } = await uploadedFile(c, deps);
    const hint = typeof form.hint === "string" ? form.hint : undefined;
    const reading = await withAi(() => readTankPhoto(deps.ai, { mediaType: file.type, base64: toBase64(bytes) }, hint));
    const patch = readingToTankPatch(reading);
    const logId = await logAi(deps.db, {
      companyId,
      feature: "read_photo",
      input: { filename: file.name, mimeType: file.type, size: file.size, hint },
      output: reading,
      model: deps.ai.model,
    });
    return c.json({ logId, reading, ...patch });
  });

  // Klaar voor de keuring? -------------------------------------------------------

  app.get("/precheck/steps", (c) => c.json(PRECHECK_STEPS));

  app.get("/tanks/:id/precheck", async (c) => {
    const companyId = requireCompany(c);
    const tank = (await getTank(deps.db, companyId, c.req.param("id"))) ?? notFound("Tank niet gevonden");
    const rows = await all<{ id: string; step: string; result: string | null; created_at: string }>(
      deps.db,
      "SELECT id, step, result, created_at FROM precheck_photos WHERE company_id = ? AND tank_id = ? ORDER BY created_at DESC",
      companyId,
      tank.id,
    );
    const latestPerStep = new Map<string, unknown>();
    for (const r of rows) {
      if (!latestPerStep.has(r.step)) {
        latestPerStep.set(r.step, { photoId: r.id, takenAt: r.created_at, result: r.result ? JSON.parse(r.result) : null });
      }
    }
    return c.json({ disclaimer: DISCLAIMER_NL, steps: Object.fromEntries(latestPerStep) });
  });

  app.post("/tanks/:id/precheck/:step", async (c) => {
    const companyId = requireCompany(c);
    const tank = (await getTank(deps.db, companyId, c.req.param("id"))) ?? notFound("Tank niet gevonden");
    const step = PRECHECK_STEPS.find((s) => s.id === c.req.param("step")) ?? notFound("Onbekende stap");
    const { file, bytes } = await uploadedFile(c, deps);

    const summary = [
      LABELS_NL.placement[tank.placement],
      LABELS_NL.wall[tank.wall],
      LABELS_NL.material[tank.material],
      LABELS_NL.product[tank.product],
      tank.capacityL ? `${tank.capacityL} liter` : "inhoud onbekend",
    ].join(", ");
    const result = await withAi(() =>
      assessPrecheckPhoto(deps.ai, step, { mediaType: file.type, base64: toBase64(bytes) }, summary),
    );
    const id = newId("pho");
    const path = await deps.storage.save(companyId, id, bytes);
    await run(
      deps.db,
      "INSERT INTO precheck_photos (id, company_id, tank_id, step, storage_path, mime_type, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      companyId,
      tank.id,
      step.id,
      path,
      file.type,
      JSON.stringify(result),
      new Date().toISOString(),
    );
    const logId = await logAi(deps.db, {
      companyId,
      feature: "precheck",
      input: { tankId: tank.id, step: step.id, photoId: id, summary },
      output: result,
      model: deps.ai.model,
      rulesetVersion: RULESET_VL.version,
      guardFlags: result.guardFlags,
    });
    return c.json({ logId, photoId: id, disclaimer: DISCLAIMER_NL, rulesetVersion: RULESET_VL.version, result });
  });

  app.get("/precheck-photos/:id", async (c) => {
    const companyId = requireCompany(c);
    const row =
      (await get<{ storage_path: string; mime_type: string }>(
        deps.db,
        "SELECT storage_path, mime_type FROM precheck_photos WHERE company_id = ? AND id = ?",
        companyId,
        c.req.param("id"),
      )) ?? notFound();
    return c.body(new Uint8Array(await deps.storage.read(row.storage_path)), 200, { "Content-Type": row.mime_type });
  });

  // Vraag het ----------------------------------------------------------------------

  app.post("/ask", async (c) => {
    const companyId = requireCompany(c);
    const body = await parseJson(
      c,
      z.object({
        question: z.string().trim().min(3).max(1000),
        history: z.array(z.object({ question: z.string(), answer: z.string() })).max(10).default([]),
      }),
    );
    const sites = await listSites(deps.db, companyId);
    const docs = await listDocuments(deps.db, companyId);
    const tanks = (await listTanks(deps.db, companyId)).map((t) => {
      const ev = evaluate(deps, t, sites, docs);
      return {
        id: t.id,
        label: t.label,
        summary: {
          gegevens_volgens_exploitant: { ...t, unconfirmedFields: undefined },
          site: sites.find((s) => s.id === t.siteId) ?? null,
          verplichtingen: ev.obligations.map((o) => ({ regel: o.ruleId, status: o.status })),
          deadlines: ev.deadlines.map((d) => ({ wat: d.title_nl, datum: d.dueDate, regel: d.ruleId })),
          documenten: ev.documents.map((d) => ({ soort: d.label_nl, aanwezig: d.present })),
        },
      };
    });
    const documents = docs.map((d) => ({ id: d.id, title: d.title, kind: d.kind, facts: d.facts }));
    const ruleset = getRuleset("VL");
    const result = await withAi(() => askQuestion(deps.ai, body.question, { ruleset, tanks, documents, history: body.history }));
    const logId = await logAi(deps.db, {
      companyId,
      feature: "ask",
      input: { question: body.question, historyLength: body.history.length },
      output: result,
      model: deps.ai.model,
      rulesetVersion: result.rulesetVersion,
      guardFlags: result.guardFlags,
    });
    return c.json({ logId, disclaimer: DISCLAIMER_NL, ...result });
  });

  // 👍/👎 feedback on any AI answer, for the shared lessons/evals flow.
  app.post("/ai/feedback", async (c) => {
    const companyId = requireCompany(c);
    const body = await parseJson(
      c,
      z.object({ logId: z.string(), rating: z.union([z.literal(1), z.literal(-1)]), note: z.string().max(2000).optional() }),
    );
    if (!(await get(deps.db, "SELECT 1 FROM ai_log WHERE id = ? AND company_id = ?", body.logId, companyId))) notFound();
    await run(
      deps.db,
      "UPDATE ai_log SET feedback = ?, feedback_note = ? WHERE id = ? AND company_id = ?",
      body.rating,
      body.note ?? null,
      body.logId,
      companyId,
    );
    return c.json({ ok: true });
  });

  return app;
}
