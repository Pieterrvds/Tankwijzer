import pg from "pg";
import { afterAll, describe } from "vitest";
import { SCHEMA } from "../src/db.ts";
import { pgDb } from "../src/db-pg.ts";
import { runApiSuite } from "./api-suite.ts";

/**
 * Same suite on a real Postgres (what Netlify Database runs). Set TEST_PG_URL to run it locally,
 * e.g. postgres://tw:tw@localhost:5432/tankwijzer_test. CI always runs it.
 */
const url = process.env.TEST_PG_URL;

describe.skipIf(!url)("API on Postgres", () => {
  const pools: pg.Pool[] = [];
  afterAll(async () => {
    for (const p of pools) await p.end();
  });

  runApiSuite(async () => {
    const pool = new pg.Pool({ connectionString: url });
    pools.push(pool);
    // Fresh schema for every test, created from the same SQL as the Netlify migration.
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
    await pool.query(SCHEMA);
    return pgDb(pool);
  });
});
