/**
 * Schemas for the versioned VLAREM knowledge base in /knowledge.
 *
 * - knowledge/standard-sentences.json — exact wording, used verbatim.
 * - knowledge/rules/*.json — deterministic rules evaluated by code (M2).
 */
import { z } from 'zod';
import { Condition } from '../rules/conditions';
import { SectionCode, Severity } from './schemas';

export const StandardSentence = z.object({
  /** Default category in T20. null = not yet confirmed by the inspector. */
  severity: Severity.exclude(['herinnering']).nullable(),
  section: SectionCode,
  text_nl: z.string().min(1),
});
export type StandardSentence = z.infer<typeof StandardSentence>;

export const StandardSentencesFile = z.object({
  $comment: z.string().optional(),
  version: z.number().int(),
  sentences: z.record(z.string().regex(/^[a-z0-9_]+$/), StandardSentence),
});

/** Fill [placeholders] in a standard sentence. Unknown placeholders are left visible on purpose. */
export function fillSentence(text: string, values: Record<string, string>): string {
  return text.replace(/\[([^\]]+)\]/g, (match, key: string) => values[key] ?? match);
}

/** Fact path used to fill a [placeholder] in a rule text, e.g. { "datum": "derived.eindeLevensduurThermoplast" }. */
const FillMap = z.record(z.string(), z.string());

/**
 * A deterministic rule from knowledge/rules/*.json, evaluated by src/rules/engine.ts.
 * See knowledge/rules/README.md for the trigger language and conventions.
 */
export const Rule = z
  .object({
    id: z.string().regex(/^[a-z0-9_.-]+$/),
    /** Short Dutch title for lists and the review screen. */
    title_nl: z.string().min(1),
    section: SectionCode,
    trigger: Condition,
    severity: Severity,
    /** Article reference. "te bevestigen" when the guidelines did not give one: never guessed. */
    article: z.string().min(1),
    /** Exact wording. Use either text_nl or standard_sentence, not both. */
    text_nl: z.string().min(1).optional(),
    /** Id in knowledge/standard-sentences.json — then the sentence is used verbatim. */
    standard_sentence: z.string().optional(),
    fill: FillMap.optional(),
    /** Check items this rule is about (navigation, NOK ↔ finding link, NVT proposals). */
    items: z.array(z.string()).min(1),
    /** Propose this status for the linked items while they are unchecked (inspector confirms). */
    suggest_status: z.literal('NVT').optional(),
    /** Inspection date range in which the rule applies (yyyy-mm-dd, inclusive). */
    valid_from: z.string().nullable(),
    valid_until: z.string().nullable(),
    source: z.string().min(1),
    /** Stays false until the inspector confirms the rule in the review screen. */
    verified_by_user: z.boolean(),
    /** Developer/inspector note, e.g. what still needs confirming. Not shown in findings. */
    note: z.string().optional(),
  })
  .strict()
  .refine((r) => (r.text_nl === undefined) !== (r.standard_sentence === undefined), {
    message: 'Use exactly one of text_nl or standard_sentence',
  });
export type Rule = z.infer<typeof Rule>;

export const RulesFile = z.object({
  $comment: z.string().optional(),
  rules: z.array(Rule).min(1),
});
