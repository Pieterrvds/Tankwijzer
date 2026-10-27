import { createHash, randomBytes } from "node:crypto";
import { Hono, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { get, run } from "../db.ts";
import { companyForUser, newId } from "../repo.ts";
import { parseJson, type AppEnv, type Deps } from "../context.ts";

/**
 * Owner auth realm: passwordless email magic links, httpOnly session cookie.
 * Inspectors (KeurKompas) use a different cookie and different session table, so an owner
 * session can never be used on inspector routes and vice versa.
 */

export const OWNER_COOKIE = "tw_session";
const MAGIC_TTL_MIN = 15;
const SESSION_TTL_DAYS = 30;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

export function createMagicLink(deps: Deps, email: string): string {
  const token = newToken();
  const now = new Date();
  run(
    deps.db,
    "INSERT INTO magic_tokens (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)",
    hashToken(token),
    email,
    new Date(now.getTime() + MAGIC_TTL_MIN * 60_000).toISOString(),
    now.toISOString(),
  );
  return `${deps.config.appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

export function ownerAuth(deps: Deps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getCookie(c, OWNER_COOKIE);
    if (!token) throw new HTTPException(401, { message: "Niet aangemeld." });
    const row = get<{ user_id: string; email: string; expires_at: string }>(
      deps.db,
      `SELECT s.user_id, u.email, s.expires_at FROM owner_sessions s
       JOIN owner_users u ON u.id = s.user_id WHERE s.token_hash = ?`,
      hashToken(token),
    );
    if (!row || row.expires_at < new Date().toISOString()) {
      throw new HTTPException(401, { message: "Sessie verlopen. Meld u opnieuw aan." });
    }
    c.set("owner", { userId: row.user_id, email: row.email, companyId: companyForUser(deps.db, row.user_id) });
    await next();
  };
}

export function authRoutes(deps: Deps) {
  const app = new Hono<AppEnv>();
  const secure = deps.config.appUrl.startsWith("https://");

  app.post("/request-link", async (c) => {
    const { email } = await parseJson(c, z.object({ email: z.email() }));
    const normalized = email.trim().toLowerCase();
    const recent = get<{ n: number }>(
      deps.db,
      "SELECT COUNT(*) AS n FROM magic_tokens WHERE email = ? AND created_at > ?",
      normalized,
      new Date(Date.now() - 3600_000).toISOString(),
    );
    if ((recent?.n ?? 0) >= 5) throw new HTTPException(429, { message: "Te veel aanvragen. Probeer later opnieuw." });

    const link = createMagicLink(deps, normalized);
    await deps.mailer.send({
      to: normalized,
      subject: "Uw aanmeldlink voor Tankwijzer",
      text: `Klik op deze link om u aan te melden bij Tankwijzer (geldig ${MAGIC_TTL_MIN} minuten):\n\n${link}\n\nHebt u dit niet aangevraagd? Dan mag u deze e-mail negeren.`,
    });
    return c.json({ ok: true, ...(deps.config.devMagicLink ? { devLink: link } : {}) });
  });

  app.get("/verify", (c) => {
    const token = c.req.query("token") ?? "";
    const row = get<{ email: string; expires_at: string; used_at: string | null }>(
      deps.db,
      "SELECT email, expires_at, used_at FROM magic_tokens WHERE token_hash = ?",
      hashToken(token),
    );
    if (!row || row.used_at || row.expires_at < new Date().toISOString()) {
      return c.redirect(`${deps.config.appUrl}/login?fout=link`);
    }
    run(deps.db, "UPDATE magic_tokens SET used_at = ? WHERE token_hash = ?", new Date().toISOString(), hashToken(token));

    let user = get<{ id: string }>(deps.db, "SELECT id FROM owner_users WHERE email = ?", row.email);
    if (!user) {
      user = { id: newId("usr") };
      run(deps.db, "INSERT INTO owner_users (id, email, created_at) VALUES (?, ?, ?)", user.id, row.email, new Date().toISOString());
    }
    const session = newToken();
    const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
    run(
      deps.db,
      "INSERT INTO owner_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
      hashToken(session),
      user.id,
      expires.toISOString(),
    );
    setCookie(c, OWNER_COOKIE, session, { httpOnly: true, sameSite: "Lax", secure, path: "/", expires });
    return c.redirect(`${deps.config.appUrl}/`);
  });

  app.post("/logout", (c) => {
    const token = getCookie(c, OWNER_COOKIE);
    if (token) run(deps.db, "DELETE FROM owner_sessions WHERE token_hash = ?", hashToken(token));
    deleteCookie(c, OWNER_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  return app;
}
