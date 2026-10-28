import inkuipingVulpunt from "../../knowledge/rules/inkuiping-vulpunt.json" with { type: "json" };
import keuringenKlevers from "../../knowledge/rules/keuringen-klevers.json" with { type: "json" };
import lekdetectie from "../../knowledge/rules/lekdetectie.json" with { type: "json" };
import levensduur from "../../knowledge/rules/levensduur.json" with { type: "json" };
import ontluchting from "../../knowledge/rules/ontluchting.json" with { type: "json" };
import ontvlambaarheid from "../../knowledge/rules/ontvlambaarheid.json" with { type: "json" };
import overvulling from "../../knowledge/rules/overvulling.json" with { type: "json" };
import zonesIdentificatieDocumenten from "../../knowledge/rules/zones-identificatie-documenten.json" with { type: "json" };
import { RulesFile, toOwnerRule, type OwnerRule, type RuleSet, type VlaremRule } from "./schema.ts";

/**
 * Every rule file in knowledge/rules. A test checks that this list matches the folder,
 * so a new file cannot be forgotten.
 */
export const RULE_FILES: Record<string, unknown> = {
  "inkuiping-vulpunt.json": inkuipingVulpunt,
  "keuringen-klevers.json": keuringenKlevers,
  "lekdetectie.json": lekdetectie,
  "levensduur.json": levensduur,
  "ontluchting.json": ontluchting,
  "ontvlambaarheid.json": ontvlambaarheid,
  "overvulling.json": overvulling,
  "zones-identificatie-documenten.json": zonesIdentificatieDocumenten,
};

/** All shared rules (inspector and owner parts), validated at import so a broken file fails fast. */
export const VLAREM_RULES: VlaremRule[] = Object.entries(RULE_FILES).flatMap(([name, json]) => {
  const parsed = RulesFile.safeParse(json);
  if (!parsed.success) throw new Error(`Ongeldige regels in ${name}: ${parsed.error.message}`);
  return parsed.data.rules;
});

const ids = VLAREM_RULES.map((r) => r.id);
const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
if (duplicate) throw new Error(`Regel-id ${duplicate} komt meer dan één keer voor.`);

/** Owner view for Flanders, evaluated by Tankwijzer. */
export const RULESET_VL: RuleSet = {
  version: "VL-2026.10-seed.2",
  rules_date: "2025-01-01",
  region: "VL",
  rules: VLAREM_RULES.filter((r) => r.region === "VL")
    .map(toOwnerRule)
    .filter((r): r is OwnerRule => r !== null),
};

export function getRuleset(region: RuleSet["region"]): RuleSet {
  if (region === "VL") return RULESET_VL;
  throw new Error(`Geen regels beschikbaar voor regio ${region} (enkel Vlaanderen in v1).`);
}

/** Owner view of one rule, or null when it does not exist or has no owner part. */
export function findRule(id: string): OwnerRule | null {
  return RULESET_VL.rules.find((r) => r.id === id) ?? null;
}
