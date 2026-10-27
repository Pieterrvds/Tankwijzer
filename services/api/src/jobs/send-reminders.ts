/**
 * Daily job: email reminders 3 months and 1 month before each deadline.
 * Run once a day (cron, scheduled container job): `pnpm reminders`.
 */
import { createClaudeClient } from "@tankwijzer/ai";
import { todayIso } from "@tankwijzer/vlarem-core";
import { loadConfig } from "../config.ts";
import { openDb } from "../db.ts";
import { OutboxMailer } from "../mailer.ts";
import { FileStorage } from "../storage.ts";
import { sendReminders } from "../reminders.ts";

const config = loadConfig();
const deps = {
  db: openDb(config.dbPath),
  config,
  mailer: new OutboxMailer(config.outboxDir),
  ai: createClaudeClient({}),
  storage: new FileStorage(config.uploadsDir),
  today: todayIso,
};
const sent = await sendReminders(deps);
console.log(`Herinneringen verstuurd: ${sent}`);
