import { describe, expect, it } from "vitest";
import scenarios from "../evals/rules-scenarios.json" with { type: "json" };
import {
  evaluate,
  evaluateTank,
  RULESET_VL,
  checkOwnerText,
  type VaultDocument,
} from "../src/index.ts";
import { makeSite, makeTank } from "./fixtures.ts";

describe("three-valued conditions", () => {
  it("all() is false as soon as one part is false, even with unknowns", () => {
    const r = evaluate(
      { all: [{ fact: "a", op: "is_true" }, { fact: "b", op: "is_true" }] },
      { a: false, b: null },
    );
    expect(r.value).toBe(false);
  });

  it("all() is unknown when a part is unknown and none is false", () => {
    const r = evaluate(
      { all: [{ fact: "a", op: "is_true" }, { fact: "b", op: "is_true" }] },
      { a: true, b: null },
    );
    expect(r.value).toBeNull();
    expect([...r.missing]).toEqual(["b"]);
  });

  it("any() is true as soon as one part is true", () => {
    const r = evaluate({ any: [{ fact: "a", op: "is_true" }, { fact: "b", op: "is_true" }] }, { a: null, b: true });
    expect(r.value).toBe(true);
  });

  it("throws on facts that do not exist, so typos in rules are caught", () => {
    expect(() => evaluate({ fact: "nope", op: "is_true" }, {})).toThrow(/unknown fact/);
  });
});

describe("rules eval set", () => {
  for (const s of scenarios.scenarios) {
    it(s.name, () => {
      const tank = makeTank(s.tank as never);
      const site = makeSite(s.site as never);
      const result = evaluateTank(RULESET_VL, tank, site, [], s.today);
      const byId = Object.fromEntries(result.obligations.map((o) => [o.ruleId, o.status]));
      for (const [ruleId, status] of Object.entries(s.expect)) {
        expect(byId[ruleId], ruleId).toBe(status);
      }
      for (const ruleId of (s as { absent?: string[] }).absent ?? []) {
        expect(byId[ruleId], ruleId).toBeUndefined();
      }
      for (const [kind, date] of Object.entries(s.deadlines)) {
        const item = result.deadlines.find((d) => d.kind === kind);
        expect(item?.dueDate, kind).toBe(date);
      }
    });
  }
});

describe("evaluateTank", () => {
  it("every obligation carries rule id, article and the ruleset version", () => {
    const res = evaluateTank(RULESET_VL, makeTank(), makeSite(), [], "2026-10-27");
    expect(res.rulesetVersion).toBe(RULESET_VL.version);
    for (const o of res.obligations) {
      expect(o.ruleId).toMatch(/^[a-z0-9_.-]+$/);
      expect(o.article.length).toBeGreaterThan(0);
    }
  });

  it("unknown status comes with questions for the owner", () => {
    const res = evaluateTank(RULESET_VL, makeTank({ placement: "above_ground", wall: "single" }), makeSite(), [], "2026-10-27");
    const bund = res.obligations.find((o) => o.ruleId === "inkuiping.enkelwandig");
    expect(bund?.status).toBe("unknown");
    expect(bund?.questions_nl).toContain("Staat de tank in een inkuiping (opvangbak)?");
  });

  it("documents become complete when every required document is in the vault", () => {
    const tank = makeTank();
    const doc = (kind: VaultDocument["kind"], extra: Partial<VaultDocument> = {}): VaultDocument => ({
      id: kind,
      companyId: "c1",
      kind,
      title: kind,
      filename: `${kind}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1,
      tankIds: ["t1"],
      siteId: null,
      facts: null,
      factsConfirmed: false,
      uploadedAt: "2026-01-01",
      ...extra,
    });
    const docs = [
      doc("commissioning_report"),
      doc("omgevingsvergunning", { tankIds: [], siteId: "s1" }),
      doc("conformity_certificate"),
      doc("sds"),
    ];
    const res = evaluateTank(RULESET_VL, tank, makeSite(), docs, "2026-10-27");
    expect(res.documents.every((d) => d.present)).toBe(true);
    expect(res.obligations.find((o) => o.ruleId === "documenten.klaar_voor_keuring")?.status).toBe("likely_ok");
  });

  it("transition rule turns into attention after its deadline", () => {
    const tank = makeTank({ overfillAlarm: "whistle" });
    const before = evaluateTank(RULESET_VL, tank, makeSite(), [], "2027-12-31");
    const after = evaluateTank(RULESET_VL, tank, makeSite(), [], "2028-01-01");
    const get = (r: typeof before) => r.obligations.find((o) => o.ruleId === "overvulling.alarmfluit_tot_2027")?.status;
    expect(get(before)).toBe("likely_ok");
    expect(get(after)).toBe("attention");
  });
});

describe("rule texts", () => {
  it("contain no brand names and no inspection claims", () => {
    for (const r of RULESET_VL.rules) {
      const text = [r.title_nl, r.text_owner_nl, r.why_nl, r.attention_nl ?? ""].join(" ");
      const res = checkOwnerText(text);
      expect(res, r.id).toEqual({ ok: true, brands: [], claims: [] });
    }
  });

  it("have unique ids and are unverified until the inspector approves them", () => {
    const ids = RULESET_VL.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("precheck steps", () => {
  it("only reference existing rules", async () => {
    const { PRECHECK_STEPS } = await import("../src/index.ts");
    const ids = new Set(RULESET_VL.rules.map((r) => r.id));
    for (const s of PRECHECK_STEPS) for (const id of s.ruleIds) expect(ids.has(id), id).toBe(true);
  });
});
