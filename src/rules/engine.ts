/**
 * Rules engine: evaluates the JSON rules in knowledge/rules against one inspection.
 *
 * Pure functions, no I/O: easy to unit test (see knowledge/rules/rules.test.ts).
 * The engine never changes the inspection. It returns proposals; the inspector decides.
 */
import { Rule, RulesFile, StandardSentencesFile, fillSentence } from '../domain/knowledge';
import type { Inspection, Severity } from '../domain/schemas';
import sentencesJson from '../../knowledge/standard-sentences.json';
import { findBrandNames } from './brands';
import { evaluate } from './conditions';
import { factResolver } from './facts';

/** All rules from knowledge/rules/*.json, validated at load time, in report (section) order. */
export const RULES: Rule[] = Object.entries(
  import.meta.glob<unknown>('../../knowledge/rules/*.json', { eager: true, import: 'default' }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([path, json]) => {
    const parsed = RulesFile.safeParse(json);
    if (!parsed.success) throw new Error(`Ongeldige regels in ${path}: ${parsed.error.message}`);
    return parsed.data.rules;
  })
  .sort((a, b) => Number(a.section.slice(1)) - Number(b.section.slice(1)));

export const STANDARD_SENTENCES = StandardSentencesFile.parse(sentencesJson).sentences;

export interface RuleResult {
  rule: Rule;
  severity: Severity;
  /** Final text: standard sentence verbatim (placeholders filled) or the rule's own text. */
  text: string;
  /** true = text is the inspector's standard sentence; false = rule text (may be a draft). */
  isStandardSentence: boolean;
  items: string[];
  suggestStatus: 'NVT' | null;
}

export function ruleText(rule: Rule, resolve: (path: string) => unknown): string {
  const raw = rule.standard_sentence
    ? (STANDARD_SENTENCES[rule.standard_sentence]?.text_nl ?? '')
    : (rule.text_nl ?? '');
  const values: Record<string, string> = {};
  for (const [key, path] of Object.entries(rule.fill ?? {})) {
    const v = resolve(path);
    if (v !== null && v !== undefined && v !== '') values[key] = String(v);
  }
  return fillSentence(raw, values);
}

function isActiveOn(rule: Rule, datum: string): boolean {
  if (rule.valid_from && datum < rule.valid_from) return false;
  if (rule.valid_until && datum > rule.valid_until) return false;
  return true;
}

/**
 * Evaluate all rules. Only rules whose trigger is definitely true are returned.
 * The rule set targets the BEPO for above-ground tanks; underground tanks get no results
 * until their own rule set exists.
 */
export function evaluateRules(inspection: Inspection, rules: Rule[] = RULES): RuleResult[] {
  if (inspection.tank.placement === 'ondergronds') return [];
  const resolve = factResolver(inspection);
  return rules.flatMap((rule) => {
    if (!isActiveOn(rule, inspection.datum)) return [];
    if (evaluate(rule.trigger, resolve) !== true) return [];
    const text = ruleText(rule, resolve);
    // Independence rule: never propose a text that names a brand.
    if (findBrandNames(text).length > 0) return [];
    return [
      {
        rule,
        severity: rule.severity,
        text,
        isStandardSentence: !!rule.standard_sentence,
        items: rule.items,
        suggestStatus: rule.suggest_status ?? null,
      },
    ];
  });
}

/** NVT proposals for one item, only while the item is still unchecked. */
export function nvtSuggestionsFor(
  inspection: Inspection,
  results: RuleResult[],
  itemId: string,
): RuleResult[] {
  const state = inspection.items[itemId];
  if (state && state.status !== 'NIET_GECONTROLEERD') return [];
  return results.filter((r) => r.suggestStatus === 'NVT' && r.items.includes(itemId));
}

/** Non-NVT results (findings and reminders) that concern one item. */
export function findingsFor(results: RuleResult[], itemId: string): RuleResult[] {
  return results.filter((r) => r.suggestStatus === null && r.items.includes(itemId));
}
