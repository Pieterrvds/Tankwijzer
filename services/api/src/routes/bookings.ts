import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  IsoDate,
  KeuringsDossier,
  LABELS_NL,
  PROVENANCE_OWNER,
  RULESET_VL,
} from "@tankwijzer/vlarem-core";
import { all, get, run } from "../db.ts";
import { getCompany, getDocument, getTank, listDocuments, listSites, newId } from "../repo.ts";
import { notFound, parseJson, requireCompany, type AppEnv, type Deps } from "../context.ts";
import { hashToken } from "./auth.ts";

const SHARE_TTL_DAYS = 90;

const BookingInput = z
  .object({
    tankIds: z.array(z.string()).min(1, "Kies minstens één tank"),
    preferredFrom: IsoDate,
    preferredTo: IsoDate,
    contact: z.object({
      name: z.string().trim().min(1),
      email: z.email(),
      phone: z.string().trim().nullable().default(null),
    }),
    message: z.string().max(2000).default(""),
    shareDossier: z.boolean(),
    /** Explicit consent from the consent screen; required to share a dossier. */
    consent: z.boolean(),
  })
  .refine((b) => b.preferredFrom <= b.preferredTo, { message: "De periode is ongeldig", path: ["preferredTo"] })
  .refine((b) => !b.shareDossier || b.consent, { message: "Toestemming is nodig om het dossier te delen", path: ["consent"] });

export function bookingRoutes(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.get("/bookings", (c) => {
    const companyId = requireCompany(c);
    return c.json(
      all<{ id: string; data: string; created_at: string }>(
        deps.db,
        "SELECT id, data, created_at FROM bookings WHERE company_id = ? ORDER BY created_at DESC",
        companyId,
      ).map((r) => ({ id: r.id, createdAt: r.created_at, ...JSON.parse(r.data) })),
    );
  });

  app.post("/bookings", async (c) => {
    const companyId = requireCompany(c);
    const body = await parseJson(c, BookingInput);
    const company = getCompany(deps.db, companyId)!;
    const tanks = body.tankIds.map((id) => getTank(deps.db, companyId, id) ?? notFound("Tank niet gevonden"));
    const id = newId("bkg");

    let dossier: KeuringsDossier | null = null;
    let shareToken: string | null = null;
    if (body.shareDossier) {
      const siteIds = new Set(tanks.map((t) => t.siteId));
      const tankIds = new Set(tanks.map((t) => t.id));
      const docs = listDocuments(deps.db, companyId).filter(
        (d) => d.tankIds.some((t) => tankIds.has(t)) || (d.siteId !== null && siteIds.has(d.siteId)),
      );
      const photos = all<{ id: string; tank_id: string; step: string; created_at: string }>(
        deps.db,
        `SELECT id, tank_id, step, created_at FROM precheck_photos WHERE company_id = ? AND tank_id IN (${tanks.map(() => "?").join(",")})`,
        companyId,
        ...tanks.map((t) => t.id),
      );
      shareToken = randomBytes(24).toString("base64url");
      const base = `/api/share/${shareToken}`;
      dossier = KeuringsDossier.parse({
        schemaVersion: 1,
        provenance: PROVENANCE_OWNER,
        createdAt: new Date().toISOString(),
        company: { name: company.name, vatNumber: company.vatNumber },
        contact: body.contact,
        preferredPeriod: { from: body.preferredFrom, to: body.preferredTo },
        sites: listSites(deps.db, companyId).filter((s) => siteIds.has(s.id)),
        tanks: tanks.map(({ unconfirmedFields: _u, ...t }) => t),
        documents: docs.map((d) => ({
          id: d.id,
          kind: d.kind,
          title: d.title,
          filename: d.filename,
          mimeType: d.mimeType,
          facts: d.factsConfirmed ? d.facts : null,
          downloadPath: `${base}/documents/${d.id}`,
        })),
        // Photos only: pre-check conclusions are never sent to the inspector.
        photos: photos.map((p) => ({
          id: p.id,
          tankId: p.tank_id,
          step: p.step,
          takenAt: p.created_at,
          downloadPath: `${base}/photos/${p.id}`,
        })),
        rulesetVersion: RULESET_VL.version,
      });
    }

    const data = {
      tankIds: body.tankIds,
      preferredFrom: body.preferredFrom,
      preferredTo: body.preferredTo,
      contact: body.contact,
      message: body.message,
      shareDossier: body.shareDossier,
      consentAt: body.shareDossier ? new Date().toISOString() : null,
      status: "sent",
      dossier,
    };
    run(
      deps.db,
      "INSERT INTO bookings (id, company_id, data, share_token_hash, share_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      companyId,
      JSON.stringify(data),
      shareToken ? hashToken(shareToken) : null,
      shareToken ? new Date(Date.now() + SHARE_TTL_DAYS * 86400_000).toISOString() : null,
      new Date().toISOString(),
    );

    const tankLines = tanks.map(
      (t) =>
        `- ${t.label}: ${LABELS_NL.placement[t.placement]}, ${LABELS_NL.product[t.product]}, ${t.capacityL ?? "?"} l` +
        ` (fabricagenr. ${t.nameplate.fabricationNumber ?? "?"})`,
    );
    const shareUrl = shareToken ? `${deps.config.appUrl}/api/share/${shareToken}` : null;
    await deps.mailer.send({
      to: deps.config.inspectionBodyEmail,
      subject: `Keuringsaanvraag ${company.name} — ${tanks.length} tank(s)`,
      text: [
        `Nieuwe keuringsaanvraag via Tankwijzer (${id}).`,
        "",
        `Bedrijf: ${company.name}${company.vatNumber ? ` (${company.vatNumber})` : ""}`,
        `Contact: ${body.contact.name}, ${body.contact.email}${body.contact.phone ? `, ${body.contact.phone}` : ""}`,
        `Gewenste periode: ${body.preferredFrom} tot ${body.preferredTo}`,
        "",
        "Tanks (volgens exploitant):",
        ...tankLines,
        "",
        body.message ? `Bericht: ${body.message}\n` : "",
        shareUrl
          ? `De klant deelt een keuringsdossier (geldig ${SHARE_TTL_DAYS} dagen): ${shareUrl}\nAlle gegevens in het dossier zijn "volgens exploitant" en niet geverifieerd.`
          : "De klant deelt geen dossier.",
      ].join("\n"),
      attachments: dossier ? [{ filename: `keuringsdossier-${id}.json`, content: JSON.stringify(dossier, null, 2) }] : [],
    });
    await deps.mailer.send({
      to: body.contact.email,
      subject: "Uw keuringsaanvraag is verstuurd",
      text: `Uw aanvraag voor ${tanks.length} tank(s) is verstuurd naar de keuringsinstelling. Zij nemen contact met u op om een datum af te spreken.\n\nGewenste periode: ${body.preferredFrom} tot ${body.preferredTo}.`,
    });
    return c.json({ id, ...data }, 201);
  });

  return app;
}

/** Public, token-protected access for the inspection body to a shared dossier (read-only). */
export function shareRoutes(deps: Deps) {
  const app = new Hono();

  const load = (token: string) => {
    const row = get<{ company_id: string; data: string; share_expires_at: string | null }>(
      deps.db,
      "SELECT company_id, data, share_expires_at FROM bookings WHERE share_token_hash = ?",
      hashToken(token),
    );
    if (!row || !row.share_expires_at || row.share_expires_at < new Date().toISOString()) {
      throw new HTTPException(404, { message: "Dossier niet gevonden of verlopen." });
    }
    const dossier = JSON.parse(row.data).dossier as KeuringsDossier | null;
    if (!dossier) throw new HTTPException(404, { message: "Geen dossier gedeeld." });
    return { companyId: row.company_id, dossier };
  };

  app.get("/:token", (c) => c.json(load(c.req.param("token")).dossier));

  app.get("/:token/documents/:id", (c) => {
    const { companyId, dossier } = load(c.req.param("token"));
    const id = c.req.param("id");
    if (!dossier.documents.some((d) => d.id === id)) notFound();
    const found = getDocument(deps.db, companyId, id) ?? notFound();
    return c.body(new Uint8Array(deps.storage.read(found.storagePath)), 200, { "Content-Type": found.doc.mimeType });
  });

  app.get("/:token/photos/:id", (c) => {
    const { companyId, dossier } = load(c.req.param("token"));
    const id = c.req.param("id");
    if (!dossier.photos.some((p) => p.id === id)) notFound();
    const row =
      get<{ storage_path: string; mime_type: string }>(
        deps.db,
        "SELECT storage_path, mime_type FROM precheck_photos WHERE company_id = ? AND id = ?",
        companyId,
        id,
      ) ?? notFound();
    return c.body(new Uint8Array(deps.storage.read(row.storage_path)), 200, { "Content-Type": row.mime_type });
  });

  return app;
}
