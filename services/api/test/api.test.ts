import { openSqlite } from "../src/db-sqlite.ts";
import { runApiSuite } from "./api-suite.ts";

runApiSuite(async () => openSqlite(":memory:"));
