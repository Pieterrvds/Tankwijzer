/**
 * Database access, independent of the database engine.
 *
 * - Locally and in tests: SQLite built into Node (./db-sqlite.ts), no setup needed.
 * - On Netlify: Postgres from Netlify Database (./db-pg.ts).
 *
 * Domain objects are stored as JSON validated by the shared Zod schemas; every table that holds
 * owner data carries company_id and every query filters on it (row-level access per company).
 * SQL is written once, in the common subset of SQLite and Postgres, with `?` placeholders.
 * Inspector data (KeurKompas) will live in its own tables with its own sessions; no owner route
 * reads them.
 */

export type Param = string | number | null;
export type Row = Record<string, unknown>;

export interface Db {
  all<T = Row>(sql: string, params: Param[]): Promise<T[]>;
  /** Runs `fn` in one transaction; `fn` gets a Db bound to that transaction. */
  transaction<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function all<T = Row>(db: Db, sql: string, ...params: Param[]): Promise<T[]> {
  return db.all<T>(sql, params);
}

export async function get<T = Row>(db: Db, sql: string, ...params: Param[]): Promise<T | undefined> {
  return (await db.all<T>(sql, params))[0];
}

export async function run(db: Db, sql: string, ...params: Param[]): Promise<void> {
  await db.all(sql, params);
}

export function tx<T>(db: Db, fn: (db: Db) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

/** COUNT(*) comes back as a number in SQLite and as a string in Postgres. */
export async function count(db: Db, sql: string, ...params: Param[]): Promise<number> {
  const row = await get<{ n: number | string }>(db, sql, ...params);
  return Number(row?.n ?? 0);
}

/**
 * The schema, valid in both SQLite and Postgres. On Netlify it is applied by Netlify Database
 * from netlify/database/migrations (a test checks that the first migration matches this text).
 */
export const SCHEMA = `CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vat_number TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS owner_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS company_members (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES owner_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  PRIMARY KEY (company_id, user_id)
);
CREATE TABLE IF NOT EXISTS owner_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES owner_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS magic_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tanks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS precheck_photos (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tank_id TEXT NOT NULL,
  step TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  share_token_hash TEXT,
  share_expires_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  app TEXT NOT NULL DEFAULT 'tankwijzer',
  feature TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  model TEXT,
  ruleset_version TEXT,
  guard_flags TEXT NOT NULL DEFAULT '[]',
  feedback INTEGER,
  feedback_note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reminders_sent (
  key TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tanks_company ON tanks(company_id);
CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_precheck_tank ON precheck_photos(company_id, tank_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON company_members(user_id);
`;
