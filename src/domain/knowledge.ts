/**
 * Schemas for the versioned VLAREM knowledge base in /knowledge.
 *
 * - knowledge/standard-sentences.json — exact wording, used verbatim.
 * - knowledge/rules/*.json — deterministic rules evaluated by code (M2).
 */
import { z } from 'zod';
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

/**
 * A deterministic rule (evaluated in M2). The trigger language is defined together with the
 * rules engine; the shape below is fixed now so rules can already be written and reviewed.
 */
export const Rule = z.object({
  id: z.string().regex(/^[a-z0-9_.-]+$/),
  section: SectionCode,
  /** Conditions on tank, product and check data. Format defined in docs/rules.md (M2). */
  trigger: z.unknown(),
  severity: Severity,
  article: z.string().min(1),
  /** Exact wording, or a reference to a standard sentence id. */
  text_nl: z.string().optional(),
  standard_sentence: z.string().optional(),
  valid_from: z.string().nullable(),
  valid_until: z.string().nullable(),
  source: z.string().min(1),
  /** Stays false until the inspector confirms the rule in the review screen. */
  verified_by_user: z.boolean(),
});
export type Rule = z.infer<typeof Rule>;
