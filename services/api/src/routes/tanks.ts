import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  FREE_PLAN_TANK_LIMIT,
  InspectionRecord,
  OrangeFinding,
  Tank,
  TankInput,
  deadlinesToIcs,
  evaluateTank,
  getRuleset,
  latestInspection,
  nextDeadline,
  type Site,
  type VaultDocument,
} from "@tankwijzer/vlarem-core";
import { all, run, tx } from "../db.ts";
import { countTanks, getCompany, getSite, getTank, listDocuments, listSites, listTanks, newId, saveTank } from "../repo.ts";
import { notFound, parseJson, requireCompany, type AppEnv, type Deps } from "../context.ts";

export function evaluate(deps: Deps, tank: Tank, sites: Site[], docs: VaultDocument[]) {
  const site = sites.find((s) => s.id === tank.siteId) ?? null;
  return evaluateTank(getRuleset(tank.region), tank, site, docs, deps.today());
}

export function tankSummary(deps: Deps, tank: Tank, sites: Site[], docs: VaultDocument[]) {
  const ev = evaluate(deps, tank, sites, docs);
  const latest = latestInspection(tank);
  return {
    tank,
    site: sites.find((s) => s.id === tank.siteId) ?? null,
    latestSticker: latest?.sticker ?? null,
    nextDeadline: nextDeadline(ev.deadlines),
    counts: {
      attention: ev.obligations.filter((o) => o.status === "attention").length,
      unknown: ev.obligations.filter((o) => o.status === "unknown").length,
      missingDocuments: ev.documents.filter((d) => !d.present).length,
    },
  };
}

export function tankRoutes(deps: Deps) {
  const app = new Hono<AppEnv>();

  const load = async (companyId: string, id: string) =>
    (await getTank(deps.db, companyId, id)) ?? notFound("Tank niet gevonden");
  const assertSite = async (companyId: string, siteId: string) => {
    if (!(await getSite(deps.db, companyId, siteId))) throw new HTTPException(400, { message: "Onbekende site." });
  };
  const context = async (companyId: string) => ({
    sites: await listSites(deps.db, companyId),
    docs: await listDocuments(deps.db, companyId),
  });

  app.get("/tanks", async (c) => {
    const companyId = requireCompany(c);
    const { sites, docs } = await context(companyId);
    const tanks = await listTanks(deps.db, companyId);
    return c.json(tanks.map((t) => tankSummary(deps, t, sites, docs)));
  });

  app.post("/tanks", async (c) => {
    const companyId = requireCompany(c);
    const company = (await getCompany(deps.db, companyId))!;
    if (company.plan === "free" && (await countTanks(deps.db, companyId)) >= FREE_PLAN_TANK_LIMIT) {
      throw new HTTPException(402, {
        message: `Het gratis plan is beperkt tot ${FREE_PLAN_TANK_LIMIT} tanks. Het betalend plan voor tankparken komt binnenkort.`,
      });
    }
    const body = await parseJson(c, TankInput);
    await assertSite(companyId, body.siteId);
    const tank = await saveTank(deps.db, Tank.parse({ ...body, id: newId("tank"), companyId }));
    return c.json(tank, 201);
  });

  app.get("/tanks/:id", async (c) => {
    const companyId = requireCompany(c);
    const tank = await load(companyId, c.req.param("id"));
    const { sites, docs } = await context(companyId);
    return c.json({ ...tankSummary(deps, tank, sites, docs), evaluation: evaluate(deps, tank, sites, docs) });
  });

  app.put("/tanks/:id", async (c) => {
    const companyId = requireCompany(c);
    const existing = await load(companyId, c.req.param("id"));
    const body = await parseJson(c, TankInput);
    await assertSite(companyId, body.siteId);
    const tank = await saveTank(deps.db, Tank.parse({ ...body, id: existing.id, companyId, createdAt: existing.createdAt }));
    return c.json(tank);
  });

  app.delete("/tanks/:id", async (c) => {
    const companyId = requireCompany(c);
    const tank = await load(companyId, c.req.param("id"));
    const photos = await all<{ storage_path: string }>(
      deps.db,
      "SELECT storage_path FROM precheck_photos WHERE company_id = ? AND tank_id = ?",
      companyId,
      tank.id,
    );
    await tx(deps.db, async (t) => {
      await run(t, "DELETE FROM tanks WHERE company_id = ? AND id = ?", companyId, tank.id);
      await run(t, "DELETE FROM precheck_photos WHERE company_id = ? AND tank_id = ?", companyId, tank.id);
    });
    for (const p of photos) await deps.storage.remove(p.storage_path);
    return c.json({ ok: true });
  });

  app.post("/tanks/:id/inspections", async (c) => {
    const companyId = requireCompany(c);
    const tank = await load(companyId, c.req.param("id"));
    const record = await parseJson(c, InspectionRecord);
    const saved = await saveTank(deps.db, { ...tank, inspections: [...tank.inspections, record] });
    return c.json(saved, 201);
  });

  app.put("/tanks/:id/orange-findings", async (c) => {
    const companyId = requireCompany(c);
    const tank = await load(companyId, c.req.param("id"));
    const body = await parseJson(c, z.object({ findings: z.array(OrangeFinding.extend({ id: z.string().optional() })) }));
    const findings = body.findings.map((f) => ({ ...f, id: f.id ?? newId("fnd") }));
    return c.json(await saveTank(deps.db, { ...tank, orangeFindings: findings }));
  });

  // Planning --------------------------------------------------------------------

  const allDeadlines = async (companyId: string) => {
    const { sites, docs } = await context(companyId);
    const tanks = await listTanks(deps.db, companyId);
    const labels: Record<string, string> = {};
    const items = tanks.flatMap((t) => {
      const site = sites.find((s) => s.id === t.siteId);
      labels[t.id] = site ? `${t.label} (${site.name})` : t.label;
      return evaluate(deps, t, sites, docs).deadlines;
    });
    items.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
    return { items, labels };
  };

  app.get("/planning", async (c) => {
    const { items, labels } = await allDeadlines(requireCompany(c));
    return c.json({ items, tankLabels: labels });
  });

  app.get("/planning.ics", async (c) => {
    const companyId = requireCompany(c);
    const { items, labels } = await allDeadlines(companyId);
    const company = (await getCompany(deps.db, companyId))!;
    const ics = deadlinesToIcs(items, {
      calendarName: `Tankwijzer — ${company.name}`,
      tankLabels: labels,
      now: new Date().toISOString(),
    });
    return c.body(ics, 200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tankwijzer-planning.ics"',
    });
  });

  return app;
}
