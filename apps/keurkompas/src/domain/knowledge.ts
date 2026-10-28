/**
 * Schemas for the shared VLAREM knowledge base in packages/vlarem-core/knowledge
 * (imported as `@vlarem-knowledge/…`), shared with Tankwijzer:
 *
 * - standard-sentences.json — exact wording, used verbatim.
 * - rules/*.json — one rule per obligation, with an `inspector` part (evaluated here) and/or an
 *   `owner` part (Tankwijzer's plain explanation). Legal metadata (article, source, validity,
 *   verified_by_user) is stored once for both apps.
 */
import { z } from 'zod/v4';
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

/** The owner (Tankwijzer) wording of a rule, for the inspector's review. */
const OwnerSummary = z
  .object({ title_nl: z.string().min(1), text_nl: z.string().min(1), why_nl: z.string().min(1) })
  .strict();
export type OwnerSummary = z.infer<typeof OwnerSummary>;

/**
 * A deterministic rule from the shared rules files, evaluated by src/rules/engine.ts.
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
    /** Tankwijzer's explanation of the same rule, shown in the review so the inspector approves both. */
    owner: OwnerSummary.optional(),
  })
  .strict()
  .refine((r) => (r.text_nl === undefined) !== (r.standard_sentence === undefined), {
    message: 'Use exactly one of text_nl or standard_sentence',
  });
export type Rule = z.infer<typeof Rule>;

/** A rule that only exists for owners (e.g. inspection frequency); reviewed here, used by Tankwijzer. */
export interface OwnerOnlyRule {
  id: string;
  title_nl: string;
  article: string;
  source: string;
  valid_from: string | null;
  valid_until: string | null;
  verified_by_user: boolean;
  note?: string;
  owner: OwnerSummary;
}

/**
 * One rule as stored in the shared files. Only the fields KeurKompas uses are checked here;
 * the full format is validated by packages/vlarem-core.
 */
const SharedRule = z.object({
  id: z.string(),
  title_nl: z.string(),
  article: z.string(),
  source: z.string(),
  valid_from: z.string().nullable(),
  valid_until: z.string().nullable(),
  verified_by_user: z.boolean(),
  note: z.string().optional(),
  inspector: z
    .object({
      section: z.string(),
      trigger: z.unknown(),
      severity: z.string(),
      text_inspector_nl: z.string().optional(),
      standard_sentence: z.string().optional(),
      fill: z.record(z.string(), z.string()).optional(),
      items: z.array(z.string()),
      suggest_status: z.string().optional(),
    })
    .optional(),
  owner: z
    .object({ title_nl: z.string(), text_owner_nl: z.string(), why_nl: z.string() })
    .loose()
    .optional(),
});

export const SharedRulesFile = z.object({
  $comment: z.string().optional(),
  rules: z.array(SharedRule).min(1),
});

/**
 * Splits shared rules into KeurKompas rules (with an inspector part) and owner-only rules.
 * Optional fields are only copied when present, so an inspector-only rule maps to exactly the
 * same object as before the merge and keeps its review hash.
 */
export function splitSharedRules(file: z.infer<typeof SharedRulesFile>): {
  inspector: Rule[];
  ownerOnly: OwnerOnlyRule[];
} {
  const inspector: Rule[] = [];
  const ownerOnly: OwnerOnlyRule[] = [];
  for (const r of file.rules) {
    const owner = r.owner
      ? { title_nl: r.owner.title_nl, text_nl: r.owner.text_owner_nl, why_nl: r.owner.why_nl }
      : undefined;
    const common = {
      id: r.id,
      title_nl: r.title_nl,
      article: r.article,
      source: r.source,
      valid_from: r.valid_from,
      valid_until: r.valid_until,
      verified_by_user: r.verified_by_user,
      ...(r.note !== undefined && { note: r.note }),
    };
    if (r.inspector) {
      const p = r.inspector;
      inspector.push(
        Rule.parse({
          ...common,
          section: p.section,
          trigger: p.trigger,
          severity: p.severity,
          ...(p.text_inspector_nl !== undefined && { text_nl: p.text_inspector_nl }),
          ...(p.standard_sentence !== undefined && { standard_sentence: p.standard_sentence }),
          ...(p.fill !== undefined && { fill: p.fill }),
          items: p.items,
          ...(p.suggest_status !== undefined && { suggest_status: p.suggest_status }),
          ...(owner && { owner }),
        }),
      );
    } else if (owner) {
      ownerOnly.push({ ...common, owner });
    }
  }
  return { inspector, ownerOnly };
}
