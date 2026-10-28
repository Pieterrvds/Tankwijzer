import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sentences from "../knowledge/standard-sentences.json" with { type: "json" };
import { RULE_FILES, RULESET_VL, VLAREM_RULES, articleLabel, findBrandMentions } from "../src/index.ts";

const sentenceTexts = sentences.sentences as Record<string, { text_nl: string }>;

describe("shared knowledge", () => {
  it("loads every rule file in knowledge/rules", () => {
    const onDisk = readdirSync(new URL("../knowledge/rules", import.meta.url)).filter((f) => f.endsWith(".json"));
    expect(Object.keys(RULE_FILES).sort()).toEqual(onDisk.sort());
  });

  it("every standard_sentence reference exists", () => {
    for (const r of VLAREM_RULES) {
      if (r.inspector?.standard_sentence) expect(sentenceTexts[r.inspector.standard_sentence], r.id).toBeDefined();
    }
  });

  it("no brand names in any text, for either app", () => {
    for (const r of VLAREM_RULES) {
      const texts = [r.title_nl, r.inspector?.text_inspector_nl, r.owner?.title_nl, r.owner?.text_owner_nl, r.owner?.why_nl, r.owner?.attention_nl];
      expect(findBrandMentions(texts.filter(Boolean).join(" ")), r.id).toEqual([]);
    }
    for (const [id, s] of Object.entries(sentenceTexts)) expect(findBrandMentions(s.text_nl), id).toEqual([]);
  });

  it("keeps inspector and owner parts of overlapping rules together", () => {
    const both = VLAREM_RULES.filter((r) => r.inspector && r.owner).map((r) => r.id);
    expect(both).toContain("overvulling.alarmfluit_tot_2027");
    expect(both).toContain("inkuiping.enkelwandig");
    // Owner view only contains rules with an owner part.
    expect(RULESET_VL.rules.every((r) => VLAREM_RULES.find((v) => v.id === r.id)?.owner)).toBe(true);
  });

  it("shows articles to owners with their source", () => {
    expect(articleLabel("te bevestigen")).toBe("VLAREM II — artikel te bevestigen");
    expect(articleLabel("bijlage 5.17.7")).toBe("VLAREM II, bijlage 5.17.7");
  });
});
