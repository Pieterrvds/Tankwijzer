/**
 * Running the API on Netlify: one Netlify Function serves /api/*, a scheduled function sends the
 * daily reminders (see netlify/functions at the repository root).
 *
 * - Database: Netlify Database (Postgres). The schema is applied by Netlify from
 *   netlify/database/migrations on every deploy.
 * - Files: Netlify Blobs, store "uploads".
 * - Email: Brevo when BREVO_API_KEY is set; otherwise nothing is sent (see DEV_MAGIC_LINK).
 * - Uploads: Netlify Functions accept about 4.5 MB of binary data, so the limit is 4 MB;
 *   the web app shrinks photos before uploading.
 */
import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";
import { createClaudeClient } from "@tankwijzer/ai";
import { todayIso } from "@tankwijzer/vlarem-core";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import type { Deps } from "./context.ts";
import { pgDb, type PgPool } from "./db-pg.ts";
import { mailerFromEnv } from "./mailer.ts";
import { sendReminders } from "./reminders.ts";
import { BlobStorage, type BlobStore } from "./storage.ts";

function netlifyDeps(env: Record<string, string | undefined>): Deps {
  const config = loadConfig({ ...env, MAX_UPLOAD_MB: env.MAX_UPLOAD_MB ?? "4" });
  return {
    db: pgDb(getDatabase().pool as unknown as PgPool),
    config,
    mailer: mailerFromEnv(env, config.mailFrom),
    ai: createClaudeClient(env),
    storage: new BlobStorage(getStore({ name: "uploads", consistency: "strong" }) as unknown as BlobStore),
    today: todayIso,
  };
}

let app: ReturnType<typeof createApp> | null = null;

/** Handler for the /api/* Netlify Function. Dependencies are created once per function instance. */
export function handleApiRequest(req: Request): Response | Promise<Response> {
  try {
    app ??= createApp(netlifyDeps(process.env));
  } catch (e) {
    // Typically: Netlify Database is not set up yet for this site.
    console.error("[netlify] API kon niet starten:", e);
    return Response.json(
      { error: "Tankwijzer is nog niet volledig ingesteld (database). Probeer later opnieuw." },
      { status: 503 },
    );
  }
  return app.fetch(req);
}

/** Handler for the daily scheduled function. */
export async function runDailyReminders(): Promise<number> {
  const env = process.env;
  // No incoming request here: use the configured URL, or the site URL Netlify provides.
  const deps = netlifyDeps({ ...env, APP_URL: env.APP_URL ?? env.URL });
  const sent = await sendReminders(deps);
  console.log(`Herinneringen verstuurd: ${sent}`);
  return sent;
}
