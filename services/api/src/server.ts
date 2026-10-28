import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createClaudeClient } from "@tankwijzer/ai";
import { todayIso } from "@tankwijzer/vlarem-core";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { openSqlite } from "./db-sqlite.ts";
import { OutboxMailer } from "./mailer.ts";
import { FileStorage } from "./storage.ts";

const config = loadConfig();
const ai = createClaudeClient();
const app = createApp({
  db: openSqlite(config.dbPath),
  config,
  mailer: new OutboxMailer(config.outboxDir),
  ai,
  storage: new FileStorage(config.uploadsDir),
  today: todayIso,
});

// Production: serve the built web app (single-page app with client-side routing).
const webDist = resolve(config.webDist ?? join(import.meta.dirname, "../../../apps/tankwijzer/dist"));
if (existsSync(join(webDist, "index.html"))) {
  const indexHtml = readFileSync(join(webDist, "index.html"), "utf8");
  app.use("/*", serveStatic({ root: webDist }));
  app.get("*", (c) => (c.req.path.startsWith("/api/") ? c.notFound() : c.html(indexHtml)));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Tankwijzer API on http://localhost:${info.port} (AI ${ai.enabled ? "aan" : "uit — geen ANTHROPIC_API_KEY"})`);
});
