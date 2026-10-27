import rulesVl from "./rules.vl.json" with { type: "json" };
import { RuleSet } from "./schema.ts";

/** Validated Flemish ruleset. Parsing at import time makes a broken rules file fail fast. */
export const RULESET_VL: RuleSet = RuleSet.parse(rulesVl);

export function getRuleset(region: RuleSet["region"]): RuleSet {
  if (region === "VL") return RULESET_VL;
  throw new Error(`Geen regels beschikbaar voor regio ${region} (enkel Vlaanderen in v1).`);
}

export function findRule(id: string) {
  return RULESET_VL.rules.find((r) => r.id === id) ?? null;
}
