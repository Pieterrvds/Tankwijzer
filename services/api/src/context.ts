import type { ClaudeClient } from "@tankwijzer/ai";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodType, z } from "zod";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import type { Mailer } from "./mailer.ts";
import type { Storage } from "./storage.ts";

export interface Deps {
  db: Db;
  config: Config;
  mailer: Mailer;
  ai: ClaudeClient;
  storage: Storage;
  /** Today's date (YYYY-MM-DD); injectable for tests. */
  today: () => string;
}

export interface OwnerSession {
  userId: string;
  email: string;
  companyId: string | null;
}

export type AppEnv = {
  Variables: {
    owner: OwnerSession;
  };
};

/** The owner's company, or 409 when onboarding is not finished yet. */
export function requireCompany(c: Context<AppEnv>): string {
  const companyId = c.get("owner").companyId;
  if (!companyId) throw new HTTPException(409, { message: "Maak eerst uw bedrijf aan." });
  return companyId;
}

export async function parseJson<S extends ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Ongeldige JSON." });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HTTPException(400, { message: `Ongeldige invoer: ${first?.path.join(".") ?? ""} ${first?.message ?? ""}`.trim() });
  }
  return parsed.data;
}

export function notFound(what = "Niet gevonden"): never {
  throw new HTTPException(404, { message: what });
}

/** Public address of the app: configured APP_URL, or the address this request came in on. */
export function appUrl(c: Context, deps: Deps): string {
  return deps.config.appUrl ?? new URL(c.req.url).origin;
}

/** Reads one uploaded file from a multipart form. */
export async function uploadedFile(
  c: Context,
  deps: Deps,
  field = "file",
): Promise<{ file: File; bytes: Uint8Array; form: Record<string, string | File> }> {
  const form = (await c.req.parseBody()) as Record<string, string | File>;
  const file = form[field];
  if (!(file instanceof File)) throw new HTTPException(400, { message: "Geen bestand ontvangen." });
  const max = deps.config.maxUploadBytes;
  if (file.size > max) {
    throw new HTTPException(413, { message: `Bestand is te groot (max. ${Math.floor(max / 1024 / 1024)} MB).` });
  }
  return { file, bytes: new Uint8Array(await file.arrayBuffer()), form };
}

export const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
