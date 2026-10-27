import type { Site, Tank, VaultDocument } from "../model.ts";
import { deriveFacts, FACT_QUESTIONS_NL, type Facts, type FactValue } from "../facts.ts";
import { computeDeadlines, type DeadlineItem } from "../deadlines.ts";
import { checkDocuments, type DocumentCheck } from "../documents.ts";
import type { Condition, Rule, RuleSet } from "./schema.ts";

/** Kleene three-valued logic: true, false or unknown (null). */
type Tri = boolean | null;

interface EvalResult {
  value: Tri;
  /** Facts that were unknown and could have changed the outcome. */
  missing: Set<string>;
}

function compare(op: string, actual: FactValue, expected: unknown): Tri {
  if (actual === null) return null;
  switch (op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && (expected as unknown[]).includes(actual);
    case "is_true":
      return actual === true;
    case "is_false":
      return actual === false;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      // Works for numbers and ISO dates (lexicographic order equals chronological order).
      if (typeof actual !== typeof expected) return null;
      const a = actual as number | string;
      const b = expected as number | string;
      if (op === "gt") return a > b;
      if (op === "gte") return a >= b;
      if (op === "lt") return a < b;
      return a <= b;
    }
    default:
      throw new Error(`Unknown operator ${op}`);
  }
}

export function evaluate(cond: Condition, facts: Facts): EvalResult {
  if ("all" in cond) {
    const parts = cond.all.map((c) => evaluate(c, facts));
    if (parts.some((p) => p.value === false)) return { value: false, missing: new Set() };
    const missing = new Set(parts.flatMap((p) => [...p.missing]));
    return { value: parts.every((p) => p.value === true) ? true : null, missing };
  }
  if ("any" in cond) {
    const parts = cond.any.map((c) => evaluate(c, facts));
    if (parts.some((p) => p.value === true)) return { value: true, missing: new Set() };
    const missing = new Set(parts.flatMap((p) => [...p.missing]));
    return { value: parts.every((p) => p.value === false) ? false : null, missing };
  }
  if ("not" in cond) {
    const inner = evaluate(cond.not, facts);
    return { value: inner.value === null ? null : !inner.value, missing: inner.missing };
  }
  const actual = facts[cond.fact];
  if (actual === undefined) throw new Error(`Rule refers to unknown fact "${cond.fact}"`);
  const value = compare(cond.op, actual, cond.value);
  return { value, missing: value === null ? new Set([cond.fact]) : new Set() };
}

export type ObligationStatus = "likely_ok" | "attention" | "unknown" | "info";

export const STATUS_LABELS_NL: Record<ObligationStatus, string> = {
  likely_ok: "waarschijnlijk in orde",
  attention: "mogelijk aandachtspunt",
  unknown: "onbekend — foto of info nodig",
  info: "ter info",
};

export interface Obligation {
  ruleId: string;
  category: Rule["category"];
  title_nl: string;
  text_nl: string;
  why_nl: string;
  article: string;
  source: string;
  verified_by_user: boolean;
  status: ObligationStatus;
  /** Shown for status "attention": what the rule asks. */
  attention_nl: string | null;
  /** Questions that would resolve an "unknown" status. */
  questions_nl: string[];
  /** true when it is not even certain the rule applies (missing info). */
  maybeApplies: boolean;
  deadline: string | null;
}

export interface TankEvaluation {
  rulesetVersion: string;
  rulesDate: string;
  evaluatedOn: string;
  obligations: Obligation[];
  deadlines: DeadlineItem[];
  documents: DocumentCheck[];
}

function isValidOn(rule: Rule, today: string): boolean {
  if (rule.valid_from > today) return false;
  // Transition rules stay visible after their deadline so the owner sees the period lapsed.
  if (rule.category === "transition") return true;
  return rule.valid_until === null || today <= rule.valid_until;
}

export function buildFacts(
  tank: Tank,
  site: Site | null,
  docs: VaultDocument[],
  today: string,
): { facts: Facts; deadlines: DeadlineItem[]; documents: DocumentCheck[] } {
  const facts = deriveFacts(tank, site, today);
  const deadlines = computeDeadlines(tank, site, today);
  const limited = deadlines.find((d) => d.kind === "limited");
  const general = deadlines.find((d) => d.kind === "general");
  facts.limited_overdue = limited?.dueDate ? limited.overdue : null;
  facts.general_overdue = general?.dueDate ? general.overdue : null;
  const documents = checkDocuments(tank, docs);
  facts.documents_complete = documents.every((d) => d.present);
  return { facts, deadlines, documents };
}

export function evaluateRule(rule: Rule, facts: Facts): Obligation | null {
  const applies = evaluate(rule.applies_when, facts);
  if (applies.value === false) return null;

  let status: ObligationStatus;
  const missing = new Set(applies.missing);
  if (applies.value === null) {
    status = "unknown";
  } else if (rule.ok_when) {
    const ok = evaluate(rule.ok_when, facts);
    ok.missing.forEach((m) => missing.add(m));
    status = ok.value === true ? "likely_ok" : ok.value === false ? "attention" : "unknown";
  } else {
    status = rule.status_when_applies;
  }

  const questions = [...new Set([...missing].map((f) => FACT_QUESTIONS_NL[f] ?? f))];
  return {
    ruleId: rule.id,
    category: rule.category,
    title_nl: rule.title_nl,
    text_nl: rule.text_owner_nl,
    why_nl: rule.why_nl,
    article: rule.article,
    source: rule.source,
    verified_by_user: rule.verified_by_user,
    status,
    attention_nl: status === "attention" ? (rule.attention_nl ?? null) : null,
    questions_nl: status === "unknown" ? questions : [],
    maybeApplies: applies.value === null,
    deadline: rule.deadline,
  };
}

const STATUS_ORDER: Record<ObligationStatus, number> = { attention: 0, unknown: 1, likely_ok: 2, info: 3 };

/** "Wat geldt voor mijn tank?" — every claim carries a rule id, article and ruleset version. */
export function evaluateTank(
  ruleset: RuleSet,
  tank: Tank,
  site: Site | null,
  docs: VaultDocument[],
  today: string,
): TankEvaluation {
  const { facts, deadlines, documents } = buildFacts(tank, site, docs, today);
  const obligations = ruleset.rules
    .filter((r) => r.region === tank.region && isValidOn(r, today))
    .map((r) => evaluateRule(r, facts))
    .filter((o): o is Obligation => o !== null)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return {
    rulesetVersion: ruleset.version,
    rulesDate: ruleset.rules_date,
    evaluatedOn: today,
    obligations,
    deadlines,
    documents,
  };
}
