import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { FREE_PLAN_TANK_LIMIT, Site, SiteInput } from "@tankwijzer/vlarem-core";
import { all, count, get, run, tx } from "../db.ts";
import { countTanks, getCompany, getSite, listSites, newId, saveSite } from "../repo.ts";
import { appUrl, notFound, parseJson, requireCompany, type AppEnv, type Deps } from "../context.ts";
import { createMagicLink } from "./auth.ts";

export function companyRoutes(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.get("/me", async (c) => {
    const owner = c.get("owner");
    const company = owner.companyId ? await getCompany(deps.db, owner.companyId) : null;
    return c.json({
      user: { id: owner.userId, email: owner.email },
      company,
      limits: company
        ? {
            plan: company.plan,
            tankLimit: company.plan === "free" ? FREE_PLAN_TANK_LIMIT : null,
            tankCount: await countTanks(deps.db, company.id),
          }
        : null,
      aiEnabled: deps.ai.enabled,
      testMode: deps.config.devMagicLink,
      uploadLimitBytes: deps.config.maxUploadBytes,
    });
  });

  app.post("/company", async (c) => {
    const owner = c.get("owner");
    if (owner.companyId) throw new HTTPException(409, { message: "U hebt al een bedrijf." });
    const body = await parseJson(
      c,
      z.object({
        name: z.string().trim().min(1),
        vatNumber: z.string().trim().nullable().optional(),
        site: SiteInput,
      }),
    );
    const companyId = newId("cmp");
    const now = new Date().toISOString();
    await tx(deps.db, async (t) => {
      await run(
        t,
        "INSERT INTO companies (id, name, vat_number, plan, created_at) VALUES (?, ?, ?, 'free', ?)",
        companyId,
        body.name,
        body.vatNumber ?? null,
        now,
      );
      await run(
        t,
        "INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?, ?, 'admin', ?)",
        companyId,
        owner.userId,
        now,
      );
      await saveSite(t, Site.parse({ ...body.site, id: newId("site"), companyId }));
    });
    return c.json({ company: await getCompany(deps.db, companyId) }, 201);
  });

  // Team ----------------------------------------------------------------------

  app.get("/company/members", async (c) => {
    const companyId = requireCompany(c);
    return c.json(
      await all(
        deps.db,
        `SELECT u.id, u.email, m.role FROM company_members m JOIN owner_users u ON u.id = m.user_id
         WHERE m.company_id = ? ORDER BY m.created_at, u.email`,
        companyId,
      ),
    );
  });

  app.post("/company/members", async (c) => {
    const companyId = requireCompany(c);
    const { email } = await parseJson(c, z.object({ email: z.email() }));
    const normalized = email.trim().toLowerCase();
    const now = new Date().toISOString();
    let user = await get<{ id: string }>(deps.db, "SELECT id FROM owner_users WHERE email = ?", normalized);
    if (!user) {
      user = { id: newId("usr") };
      await run(deps.db, "INSERT INTO owner_users (id, email, created_at) VALUES (?, ?, ?)", user.id, normalized, now);
    }
    const other = await get(deps.db, "SELECT 1 FROM company_members WHERE user_id = ? AND company_id != ?", user.id, companyId);
    if (other) throw new HTTPException(409, { message: "Deze gebruiker hoort al bij een ander bedrijf." });
    await run(
      deps.db,
      "INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?, ?, 'member', ?) ON CONFLICT DO NOTHING",
      companyId,
      user.id,
      now,
    );
    const company = (await getCompany(deps.db, companyId))!;
    const link = await createMagicLink(deps, appUrl(c, deps), normalized);
    await deps.mailer.send({
      to: normalized,
      subject: `U bent uitgenodigd voor ${company.name} op Tankwijzer`,
      text: `${c.get("owner").email} heeft u toegevoegd aan ${company.name} op Tankwijzer.\n\nMeld u aan via deze link:\n${link}`,
    });
    return c.json({ ok: true }, 201);
  });

  // Sites ---------------------------------------------------------------------

  app.get("/sites", async (c) => c.json(await listSites(deps.db, requireCompany(c))));

  app.post("/sites", async (c) => {
    const companyId = requireCompany(c);
    const body = await parseJson(c, SiteInput);
    const site = Site.parse({ ...body, id: newId("site"), companyId });
    await saveSite(deps.db, site);
    return c.json(site, 201);
  });

  app.put("/sites/:id", async (c) => {
    const companyId = requireCompany(c);
    const existing = (await getSite(deps.db, companyId, c.req.param("id"))) ?? notFound("Site niet gevonden");
    const body = await parseJson(c, SiteInput);
    const site = Site.parse({ ...body, id: existing.id, companyId });
    await saveSite(deps.db, site);
    return c.json(site);
  });

  app.delete("/sites/:id", async (c) => {
    const companyId = requireCompany(c);
    const id = c.req.param("id");
    if (!(await getSite(deps.db, companyId, id))) notFound("Site niet gevonden");
    const tanks = await count(deps.db, "SELECT COUNT(*) AS n FROM tanks WHERE company_id = ? AND site_id = ?", companyId, id);
    if (tanks > 0) throw new HTTPException(409, { message: "Verwijder of verplaats eerst de tanks van deze site." });
    await run(deps.db, "DELETE FROM sites WHERE company_id = ? AND id = ?", companyId, id);
    return c.json({ ok: true });
  });

  return app;
}
