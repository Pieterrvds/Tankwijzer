import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA, type Db, type Param } from "./db.ts";

/** SQLite built into Node: for local development and tests. */
export function openSqlite(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  sqlite.exec(SCHEMA);

  const db: Db = {
    async all<T>(sql: string, params: Param[]) {
      // all() also runs INSERT/UPDATE/DELETE (and then returns []).
      return sqlite.prepare(sql).all(...params) as T[];
    },
    async transaction<T>(fn: (db: Db) => Promise<T>) {
      sqlite.exec("BEGIN");
      try {
        const out = await fn(db);
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
    async close() {
      sqlite.close();
    },
  };
  return db;
}
