import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ClaudeClient } from "@tankwijzer/ai";
import { createApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import type { Db } from "../src/db.ts";
import { OutboxMailer } from "../src/mailer.ts";
import { FileStorage } from "../src/storage.ts";
import { sendReminders } from "../src/reminders.ts";
import type { Deps } from "../src/context.ts";

/**
 * The API test suite, run once per database driver (api.test.ts: SQLite, api.pg.test.ts: Postgres),
 * so the SQL works the same locally and on Netlify Database.
 */
export function runApiSuite(makeDb: () => Promise<Db>) {
  const tmp = mkdtempSync(join(tmpdir(), "tw-api-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  const APP_URL = "http://localhost:5173";
  let deps: Deps;
  let mailer: OutboxMailer;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    mailer = new OutboxMailer(null);
    deps = {
      db: await makeDb(),
      config: { ...loadConfig({ APP_URL, DEV_MAGIC_LINK: "1", DATA_DIR: tmp }) },
      mailer,
      ai: new ClaudeClient(null),
      storage: new FileStorage(join(tmp, `uploads-${Math.random()}`)),
      today: () => "2026-10-27",
    };
    app = createApp(deps);
  });

  async function login(email: string): Promise<string> {
    const res = await app.request("/api/auth/request-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const { devLink } = (await res.json()) as { devLink: string };
    const verify = await app.request(devLink.replace(APP_URL, ""));
    expect(verify.status).toBe(302);
    const cookie = verify.headers.get("set-cookie")!;
    return cookie.split(";")[0]!;
  }

  function client(cookie: string) {
    const call = async (method: string, path: string, body?: unknown) => {
      const res = await app.request(`/api${path}`, {
        method,
        headers: { cookie, ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) },
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });
      const type = res.headers.get("content-type") ?? "";
      return { status: res.status, body: type.includes("json") ? ((await res.json()) as any) : await res.text() };
    };
    return {
      get: (p: string) => call("GET", p),
      post: (p: string, b?: unknown) => call("POST", p, b ?? {}),
      put: (p: string, b: unknown) => call("PUT", p, b),
      del: (p: string, b?: unknown) => call("DELETE", p, b),
    };
  }

  async function onboard(email: string, name = "Garage Peeters") {
    const api = client(await login(email));
    const res = await api.post("/company", { name, site: { name: "Hoofdsite", inWaterProtectionZone: "no" } });
    expect(res.status).toBe(201);
    const sites = await api.get("/sites");
    return { api, siteId: sites.body[0].id as string };
  }

  describe("auth", () => {
    it("rejects requests without a session", async () => {
      const res = await app.request("/api/tanks");
      expect(res.status).toBe(401);
    });

    it("magic links work once", async () => {
      const res = await app.request("/api/auth/request-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.be" }),
      });
      const { devLink } = (await res.json()) as { devLink: string };
      expect((await app.request(devLink.replace(APP_URL, ""))).headers.get("location")).toBe(`${APP_URL}/`);
      expect((await app.request(devLink.replace(APP_URL, ""))).headers.get("location")).toContain("fout=link");
      expect(mailer.sent[0]!.text).toContain("/api/auth/verify?token=");
    });

    it("blocks cross-site state changes", async () => {
      const res = await app.request("/api/auth/request-link", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example" },
        body: JSON.stringify({ email: "a@b.be" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("tank register, rules and planning", () => {
    it("creates a tank and explains what applies", async () => {
      const { api, siteId } = await onboard("eigenaar@garage.be");
      const created = await api.post("/tanks", {
        siteId,
        label: "T1",
        placement: "above_ground",
        wall: "single",
        product: "heating_oil",
        capacityL: 5000,
        inBund: "no",
        inspections: [{ date: "2024-03-15", type: "limited", sticker: "green" }],
      });
      expect(created.status).toBe(201);

      const detail = await api.get(`/tanks/${created.body.id}`);
      const bund = detail.body.evaluation.obligations.find((o: any) => o.ruleId === "inkuiping.enkelwandig");
      expect(bund.status).toBe("attention");
      expect(detail.body.evaluation.rulesetVersion).toMatch(/^VL-/);
      expect(detail.body.nextDeadline.dueDate).toBe("2027-03-15");

      const ics = await api.get("/planning.ics");
      expect(ics.body).toContain("DTSTART;VALUE=DATE:20270315");
    });

    it("enforces the free plan limit of 3 tanks", async () => {
      const { api, siteId } = await onboard("klein@bedrijf.be");
      for (let i = 1; i <= 3; i++) expect((await api.post("/tanks", { siteId, label: `T${i}` })).status).toBe(201);
      expect((await api.post("/tanks", { siteId, label: "T4" })).status).toBe(402);
    });

    it("keeps companies apart (row-level access)", async () => {
      const a = await onboard("a@bedrijf-a.be", "Bedrijf A");
      const b = await onboard("b@bedrijf-b.be", "Bedrijf B");
      const tank = await a.api.post("/tanks", { siteId: a.siteId, label: "A1" });
      expect((await b.api.get(`/tanks/${tank.body.id}`)).status).toBe(404);
      expect((await b.api.get("/tanks")).body).toHaveLength(0);
      // B cannot attach a tank to A's site either.
      expect((await b.api.post("/tanks", { siteId: a.siteId, label: "X" })).status).toBe(400);
    });

    it("sends each reminder once", async () => {
      const { api, siteId } = await onboard("herinner@bedrijf.be");
      await api.post("/tanks", {
        siteId,
        label: "T1",
        placement: "above_ground",
        inspections: [{ date: "2024-01-01", type: "limited", sticker: "green" }],
      });
      deps.today = () => "2026-10-15"; // ≤ 3 months before 2027-01-01
      expect(await sendReminders(deps)).toBe(1);
      expect(await sendReminders(deps)).toBe(0);
      expect(mailer.sent.at(-1)!.subject).toContain("deadline");
    });
  });

  describe("documents, booking and dossier", () => {
    it("uploads documents, applies an official report and shares a dossier", async () => {
      const { api, siteId } = await onboard("dossier@bedrijf.be");
      const tank = (await api.post("/tanks", { siteId, label: "T1", placement: "above_ground", product: "diesel" })).body;

      const form = new FormData();
      form.set("file", new File([new Uint8Array([37, 80, 68, 70])], "verslag.pdf", { type: "application/pdf" }));
      form.set("kind", "inspection_report");
      form.set("tankIds", tank.id);
      const up = await api.post("/documents", form);
      expect(up.status).toBe(201);
      expect(up.body.extraction.status).toBe("skipped"); // AI off in tests

      const doc = up.body.document;
      await api.put(`/documents/${doc.id}`, {
        kind: "inspection_report",
        title: "Keuringsverslag 2026",
        tankIds: [tank.id],
        siteId: null,
        facts: { documentDate: "2026-09-01", sticker: "orange", openRemarks: ["Identificatie aan vulplaats ontbreekt"] },
        factsConfirmed: true,
      });
      const applied = await api.post(`/documents/${doc.id}/apply-to-tank`, { tankId: tank.id, inspectionType: "limited" });
      expect(applied.status).toBe(200);
      expect(applied.body.orangeFindings[0].text).toBe("Identificatie aan vulplaats ontbreekt");
      const planning = await api.get("/planning");
      expect(planning.body.items.find((i: any) => i.kind === "orange_reinspection").dueDate).toBe("2027-03-01");

      const checklist = (await api.get("/documents")).body.checklist[0].documents;
      expect(checklist.find((d: any) => d.kind === "inspection_report").present).toBe(true);
      expect(checklist.find((d: any) => d.kind === "sds").present).toBe(false);

      // Sharing without consent is refused.
      const base = {
        tankIds: [tank.id],
        preferredFrom: "2026-11-01",
        preferredTo: "2026-12-15",
        contact: { name: "Jan", email: "jan@bedrijf.be" },
        shareDossier: true,
      };
      expect((await api.post("/bookings", { ...base, consent: false })).status).toBe(400);
      const booking = await api.post("/bookings", { ...base, consent: true });
      expect(booking.status).toBe(201);
      expect(booking.body.dossier.provenance).toBe("volgens exploitant");
      const toBody = mailer.sent.find((m) => m.to === deps.config.inspectionBodyEmail)!;
      const shareUrl = toBody.text.match(/(\/api\/share\/[\w-]+)/)![1]!;
      const shared = await app.request(shareUrl);
      expect(shared.status).toBe(200);
      const dossier = (await shared.json()) as any;
      expect(dossier.tanks[0].label).toBe("T1");
      expect((await app.request(`${shareUrl}/documents/${doc.id}`)).status).toBe(200);
      expect((await app.request(`${shareUrl}/documents/nope`)).status).toBe(404);
    });
  });

  describe("privacy", () => {
    it("exports and deletes everything", async () => {
      const { api, siteId } = await onboard("weg@bedrijf.be", "Weg BV");
      await api.post("/tanks", { siteId, label: "T1" });
      const exp = await api.get("/export");
      expect(exp.body.tanks).toHaveLength(1);
      expect((await api.del("/company", { confirmName: "Verkeerd" })).status).toBe(400);
      expect((await api.del("/company", { confirmName: "Weg BV" })).status).toBe(200);
      expect((await api.get("/tanks")).status).toBe(401);
    });
  });
}
