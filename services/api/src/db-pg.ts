import type { Db, Param } from "./db.ts";

/** The part of a node-postgres Pool we use (Netlify Database exposes one as `getDatabase().pool`). */
export interface PgClient {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}
export interface PgPool extends PgClient {
  connect(): Promise<PgClient & { release(): void }>;
  end(): Promise<void>;
}

/** Rewrites `?` placeholders to Postgres `$1, $2, …` (our SQL never contains a literal `?`). */
export function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function wrap(client: PgClient, pool: PgPool | null): Db {
  const db: Db = {
    async all<T>(sql: string, params: Param[]) {
      const res = await client.query(toPgPlaceholders(sql), params);
      return res.rows as T[];
    },
    async transaction<T>(fn: (db: Db) => Promise<T>) {
      if (!pool) return fn(db); // already inside a transaction
      const conn = await pool.connect();
      try {
        await conn.query("BEGIN");
        const out = await fn(wrap(conn, null));
        await conn.query("COMMIT");
        return out;
      } catch (e) {
        await conn.query("ROLLBACK");
        throw e;
      } finally {
        conn.release();
      }
    },
    async close() {
      await pool?.end();
    },
  };
  return db;
}

/** Postgres via a node-postgres compatible pool. The schema is applied by migrations, not here. */
export function pgDb(pool: PgPool): Db {
  return wrap(pool, pool);
}
