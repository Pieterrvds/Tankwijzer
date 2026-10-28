import { join, resolve } from "node:path";

export interface Config {
  dataDir: string;
  dbPath: string;
  uploadsDir: string;
  outboxDir: string;
  /** Public URL of the web app; null = use the address of the incoming request. */
  appUrl: string | null;
  inspectionBodyEmail: string;
  /**
   * Test mode: the login link is shown on screen instead of only being emailed.
   * Anyone can then log in as any email address — never use it with real customer data.
   */
  devMagicLink: boolean;
  /** Largest accepted upload. Netlify Functions accept about 4.5 MB of binary data. */
  maxUploadBytes: number;
  /** Sender for outgoing email, e.g. "Tankwijzer <noreply@uwdomein.be>". */
  mailFrom: string;
  port: number;
  /** Folder with the built web app, served in production. */
  webDist: string | null;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const dataDir = resolve(env.DATA_DIR ?? ".data");
  return {
    dataDir,
    dbPath: join(dataDir, "tankwijzer.db"),
    uploadsDir: join(dataDir, "uploads"),
    outboxDir: join(dataDir, "outbox"),
    appUrl: env.APP_URL ? env.APP_URL.replace(/\/$/, "") : null,
    inspectionBodyEmail: env.INSPECTION_BODY_EMAIL ?? "planning@example.be",
    devMagicLink: env.DEV_MAGIC_LINK === "1",
    maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 15) * 1024 * 1024,
    mailFrom: env.MAIL_FROM ?? "Tankwijzer <noreply@example.be>",
    port: Number(env.PORT ?? 8787),
    webDist: env.WEB_DIST ?? null,
  };
}
