import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { z } from "zod";
import { all, run, tx } from "../db.ts";
import { getCompany, listSites, listTanks } from "../repo.ts";
import { parseJson, requireCompany, type AppEnv, type Deps } from "../context.ts";
import { OWNER_COOKIE } from "./auth.ts";

/** GDPR: owners own their data — export everything, or delete everything, in one click. */
export function privacyRoutes(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.get("/export", async (c) => {
    const companyId = requireCompany(c);
    const docs = await all<{ data: string; storage_path: string }>(
      deps.db,
      "SELECT data, storage_path FROM documents WHERE company_id = ?",
      companyId,
    );
    const photos = await all<{
      id: string;
      tank_id: string;
      step: string;
      storage_path: string;
      mime_type: string;
      result: string | null;
      created_at: string;
    }>(deps.db, "SELECT * FROM precheck_photos WHERE company_id = ?", companyId);
    const readB64 = async (p: string) => {
      try {
        return Buffer.from(await deps.storage.read(p)).toString("base64");
      } catch {
        return null;
      }
    };
    const payload = {
      exportedAt: new Date().toISOString(),
      company: await getCompany(deps.db, companyId),
      members: await all(
        deps.db,
        "SELECT u.email, m.role FROM company_members m JOIN owner_users u ON u.id = m.user_id WHERE m.company_id = ?",
        companyId,
      ),
      sites: await listSites(deps.db, companyId),
      tanks: await listTanks(deps.db, companyId),
      documents: await Promise.all(
        docs.map(async (d) => ({ ...JSON.parse(d.data), contentBase64: await readB64(d.storage_path) })),
      ),
      precheckPhotos: await Promise.all(
        photos.map(async (p) => ({
          id: p.id,
          tankId: p.tank_id,
          step: p.step,
          takenAt: p.created_at,
          mimeType: p.mime_type,
          result: p.result ? JSON.parse(p.result) : null,
          contentBase64: await readB64(p.storage_path),
        })),
      ),
      bookings: (
        await all<{ data: string; created_at: string }>(
          deps.db,
          "SELECT data, created_at FROM bookings WHERE company_id = ?",
          companyId,
        )
      ).map((b) => ({ createdAt: b.created_at, ...JSON.parse(b.data) })),
      aiLog: await all(
        deps.db,
        "SELECT feature, input, output, feedback, created_at FROM ai_log WHERE company_id = ?",
        companyId,
      ),
    };
    return c.body(JSON.stringify(payload, null, 2), 200, {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="tankwijzer-export.json"',
    });
  });

  app.delete("/company", async (c) => {
    const companyId = requireCompany(c);
    const company = (await getCompany(deps.db, companyId))!;
    const { confirmName } = await parseJson(c, z.object({ confirmName: z.string() }));
    if (confirmName.trim() !== company.name) {
      return c.json({ error: "Typ de exacte bedrijfsnaam om te bevestigen." }, 400);
    }
    const members = await all<{ user_id: string; email: string }>(
      deps.db,
      "SELECT m.user_id, u.email FROM company_members m JOIN owner_users u ON u.id = m.user_id WHERE m.company_id = ?",
      companyId,
    );
    await tx(deps.db, async (t) => {
      await run(t, "DELETE FROM companies WHERE id = ?", companyId); // cascades to all company data
      for (const m of members) {
        await run(
          t,
          "DELETE FROM owner_users WHERE id = ? AND NOT EXISTS (SELECT 1 FROM company_members WHERE user_id = ?)",
          m.user_id,
          m.user_id,
        );
        await run(t, "DELETE FROM magic_tokens WHERE email = ?", m.email);
      }
    });
    await deps.storage.removeCompany(companyId);
    deleteCookie(c, OWNER_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  return app;
}
