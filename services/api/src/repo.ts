import { randomUUID } from "node:crypto";
import { Company, Site, Tank, VaultDocument, type Plan } from "@tankwijzer/vlarem-core";
import { all, count, get, run, type Db } from "./db.ts";

/**
 * Data access. Every function takes companyId and filters on it: this is the row-level
 * access boundary. Routes never write SQL against owner tables themselves.
 */

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
const nowIso = () => new Date().toISOString();

// Companies -------------------------------------------------------------------

export async function getCompany(db: Db, companyId: string): Promise<Company | null> {
  const row = await get<{ id: string; name: string; vat_number: string | null; plan: string; created_at: string }>(
    db,
    "SELECT * FROM companies WHERE id = ?",
    companyId,
  );
  return row
    ? Company.parse({ id: row.id, name: row.name, vatNumber: row.vat_number, plan: row.plan as Plan, createdAt: row.created_at })
    : null;
}

export async function companyForUser(db: Db, userId: string): Promise<string | null> {
  const row = await get<{ company_id: string }>(
    db,
    "SELECT company_id FROM company_members WHERE user_id = ? ORDER BY created_at, company_id LIMIT 1",
    userId,
  );
  return row?.company_id ?? null;
}

// Sites -----------------------------------------------------------------------

export async function listSites(db: Db, companyId: string): Promise<Site[]> {
  const rows = await all<{ data: string }>(
    db,
    "SELECT data FROM sites WHERE company_id = ? ORDER BY created_at, id",
    companyId,
  );
  return rows.map((r) => Site.parse(JSON.parse(r.data)));
}

export async function getSite(db: Db, companyId: string, id: string): Promise<Site | null> {
  const row = await get<{ data: string }>(db, "SELECT data FROM sites WHERE company_id = ? AND id = ?", companyId, id);
  return row ? Site.parse(JSON.parse(row.data)) : null;
}

export async function saveSite(db: Db, site: Site): Promise<void> {
  const exists = await get(db, "SELECT 1 FROM sites WHERE id = ? AND company_id = ?", site.id, site.companyId);
  if (exists) {
    await run(db, "UPDATE sites SET data = ? WHERE id = ? AND company_id = ?", JSON.stringify(site), site.id, site.companyId);
  } else {
    await run(
      db,
      "INSERT INTO sites (id, company_id, data, created_at) VALUES (?, ?, ?, ?)",
      site.id,
      site.companyId,
      JSON.stringify(site),
      nowIso(),
    );
  }
}

// Tanks -----------------------------------------------------------------------

export async function listTanks(db: Db, companyId: string): Promise<Tank[]> {
  const rows = await all<{ data: string }>(
    db,
    "SELECT data FROM tanks WHERE company_id = ? ORDER BY created_at, id",
    companyId,
  );
  return rows.map((r) => Tank.parse(JSON.parse(r.data)));
}

export function countTanks(db: Db, companyId: string): Promise<number> {
  return count(db, "SELECT COUNT(*) AS n FROM tanks WHERE company_id = ?", companyId);
}

export async function getTank(db: Db, companyId: string, id: string): Promise<Tank | null> {
  const row = await get<{ data: string }>(db, "SELECT data FROM tanks WHERE company_id = ? AND id = ?", companyId, id);
  return row ? Tank.parse(JSON.parse(row.data)) : null;
}

export async function saveTank(db: Db, tank: Tank): Promise<Tank> {
  const now = nowIso();
  const existing = await get(db, "SELECT 1 FROM tanks WHERE id = ? AND company_id = ?", tank.id, tank.companyId);
  const saved = Tank.parse({ ...tank, updatedAt: now, createdAt: tank.createdAt ?? now });
  if (existing) {
    await run(
      db,
      "UPDATE tanks SET data = ?, site_id = ?, updated_at = ? WHERE id = ? AND company_id = ?",
      JSON.stringify(saved),
      saved.siteId,
      now,
      saved.id,
      saved.companyId,
    );
  } else {
    await run(
      db,
      "INSERT INTO tanks (id, company_id, site_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      saved.id,
      saved.companyId,
      saved.siteId,
      JSON.stringify(saved),
      now,
      now,
    );
  }
  return saved;
}

// Documents -------------------------------------------------------------------

export async function listDocuments(db: Db, companyId: string): Promise<VaultDocument[]> {
  const rows = await all<{ data: string }>(
    db,
    "SELECT data FROM documents WHERE company_id = ? ORDER BY created_at DESC, id DESC",
    companyId,
  );
  return rows.map((r) => VaultDocument.parse(JSON.parse(r.data)));
}

export async function getDocument(
  db: Db,
  companyId: string,
  id: string,
): Promise<{ doc: VaultDocument; storagePath: string } | null> {
  const row = await get<{ data: string; storage_path: string }>(
    db,
    "SELECT data, storage_path FROM documents WHERE company_id = ? AND id = ?",
    companyId,
    id,
  );
  return row ? { doc: VaultDocument.parse(JSON.parse(row.data)), storagePath: row.storage_path } : null;
}

export async function saveDocument(db: Db, doc: VaultDocument, storagePath?: string): Promise<void> {
  const exists = await get(db, "SELECT 1 FROM documents WHERE id = ? AND company_id = ?", doc.id, doc.companyId);
  if (exists) {
    await run(db, "UPDATE documents SET data = ? WHERE id = ? AND company_id = ?", JSON.stringify(doc), doc.id, doc.companyId);
  } else {
    await run(
      db,
      "INSERT INTO documents (id, company_id, data, storage_path, created_at) VALUES (?, ?, ?, ?, ?)",
      doc.id,
      doc.companyId,
      JSON.stringify(doc),
      storagePath ?? "",
      nowIso(),
    );
  }
}

// AI log ----------------------------------------------------------------------

export interface AiLogEntry {
  companyId: string;
  feature: "read_photo" | "extract_document" | "precheck" | "ask";
  input: unknown;
  output: unknown;
  model?: string | null;
  rulesetVersion?: string | null;
  guardFlags?: string[];
}

/** Every AI answer is logged with its inputs, so reviewed corrections can feed the shared evals. */
export async function logAi(db: Db, e: AiLogEntry): Promise<string> {
  const id = newId("ai");
  await run(
    db,
    `INSERT INTO ai_log (id, company_id, feature, input, output, model, ruleset_version, guard_flags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    e.companyId,
    e.feature,
    JSON.stringify(e.input),
    JSON.stringify(e.output),
    e.model ?? null,
    e.rulesetVersion ?? null,
    JSON.stringify(e.guardFlags ?? []),
    nowIso(),
  );
  return id;
}
