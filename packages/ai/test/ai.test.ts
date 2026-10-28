import { describe, expect, it, vi } from "vitest";
import { PRECHECK_STEPS, RULESET_VL, NOT_SURE_NL } from "@tankwijzer/vlarem-core";
import {
  AiDisabledError,
  ClaudeClient,
  askQuestion,
  assessPrecheckPhoto,
  createClaudeClient,
  guardOwnerText,
  readingToTankPatch,
  type PhotoReading,
} from "../src/index.ts";

/** A ClaudeClient whose structured() returns a canned answer: tests never call the API. */
function fakeClient(data: unknown): ClaudeClient {
  const c = new ClaudeClient(null);
  vi.spyOn(c, "structured").mockResolvedValue({ data, model: "test", usage: { input: 0, output: 0 } } as never);
  return c;
}

const photo = { mediaType: "image/jpeg", base64: "AAAA" };

describe("client", () => {
  it("is disabled without an API key", async () => {
    const c = createClaudeClient({});
    expect(c.enabled).toBe(false);
    await expect(c.structured({ schema: {} as never, system: "", content: [] })).rejects.toBeInstanceOf(AiDisabledError);
  });
});

describe("photo reading", () => {
  const f = (value: string | null, confidence: "high" | "medium" | "low" = "high") => ({ value, confidence });
  const reading: PhotoReading = {
    photo_quality: "ok",
    retake_reason_nl: null,
    detected: "nameplate",
    fabrication_number: f("AB-123"),
    builder: f("Bouwer NV"),
    build_year: f("1998"),
    standard: f("NBN EN 12285-2", "low"),
    capacity_l: f("5.000 l"),
    product_name: f(null, "low"),
    sticker_colour: f("green"),
    inspection_date: f("2024-03-15"),
    next_inspection_date: f("2027-03-15", "medium"),
  };

  it("keeps confident values and drops low-confidence ones", () => {
    const { patch, inspection, unconfirmedFields } = readingToTankPatch(reading);
    expect(patch.nameplate).toEqual({ fabricationNumber: "AB-123", builder: "Bouwer NV", buildYear: 1998 });
    expect(patch.capacityL).toBe(5000);
    expect(inspection).toMatchObject({ date: "2024-03-15", sticker: "green", nextDueDate: "2027-03-15" });
    expect(unconfirmedFields).toContain("capacityL");
    expect(unconfirmedFields).not.toContain("nameplate.standard");
  });
});

describe("output guard", () => {
  it("redacts brands and replaces conformity claims", () => {
    const g = guardOwnerText("Uw tank is conform. Koop een Afriso-sonde.");
    expect(g.text).not.toMatch(/conform|Afriso/i);
    expect(g.flags.length).toBe(2);
  });
});

describe("pre-check", () => {
  it("drops points for rules that are not part of the step and uses rule text as requirement", async () => {
    const step = PRECHECK_STEPS.find((s) => s.id === "bund")!;
    const ai = fakeClient({
      photo_quality: "ok",
      retake_reason_nl: null,
      points: [
        { rule_id: "inkuiping.enkelwandig", status: "possible_attention", observation_nl: "De inkuiping lijkt kleiner dan de tank." },
        { rule_id: "verzonnen.regel", status: "possible_attention", observation_nl: "x" },
      ],
    });
    const res = await assessPrecheckPhoto(ai, step, photo, "bovengronds, enkelwandig");
    expect(res.points).toHaveLength(1);
    expect(res.points[0]!.requirement_nl).toContain("inkuiping");
    expect(res.guardFlags).toContain("unknown_rule:verzonnen.regel");
  });
});

describe("vraag het", () => {
  const ctx = { ruleset: RULESET_VL, tanks: [{ id: "t1", label: "T1", summary: {} }], documents: [], history: [] };

  it("keeps cited answers", async () => {
    const ai = fakeClient({
      covered_by_sources: true,
      answer_nl: "Een bovengrondse tank krijgt om de 3 jaar een beperkt onderzoek.",
      citations: [{ type: "rule", id: "frequentie.beperkt_bovengronds" }],
    });
    const res = await askQuestion(ai, "Hoe vaak keuren?", ctx);
    expect(res.covered).toBe(true);
    expect(res.citations[0]!.label).toContain("VLAREM");
  });

  it("falls back when citations are invented", async () => {
    const ai = fakeClient({ covered_by_sources: true, answer_nl: "Om de 7 jaar.", citations: [{ type: "rule", id: "bestaat.niet" }] });
    const res = await askQuestion(ai, "Hoe vaak keuren?", ctx);
    expect(res.answer_nl).toBe(NOT_SURE_NL);
    expect(res.covered).toBe(false);
  });
});
