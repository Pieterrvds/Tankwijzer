import { join, resolve } from "node:path";

export interface Config {
  dataDir: string;
  dbPath: string;
  uploadsDir: string;
  outboxDir: string;
  appUrl: string;
  inspectionBodyEmail: string;
  devMagicLink: boolean;
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
    appUrl: (env.APP_URL ?? "http://localhost:5173").replace(/\/$/, ""),
    inspectionBodyEmail: env.INSPECTION_BODY_EMAIL ?? "planning@example.be",
    devMagicLink: env.DEV_MAGIC_LINK === "1",
    port: Number(env.PORT ?? 8787),
    webDist: env.WEB_DIST ?? null,
  };
}
