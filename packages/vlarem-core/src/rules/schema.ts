import { z } from "zod";
import { IsoDate, Region } from "../model.ts";

/**
 * Rule format. Rules are data (JSON in packages/vlarem-core/knowledge/rules) so the inspector can
 * review and approve them in one place; KeurKompas and Tankwijzer read the same files.
 *
 * Owner conditions (applies_when / ok_when) are evaluated by the engine in ./engine.ts.
 * Conditions use three-valued logic: a condition on an unknown fact evaluates to "unknown",
 * which surfaces as "onbekend — foto of info nodig" rather than a guess.
 */

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | {
      fact: string;
      op: "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte" | "is_true" | "is_false";
      value?: string | number | boolean | (string | number)[];
    };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema) }).strict(),
    z.object({ any: z.array(ConditionSchema) }).strict(),
    z.object({ not: ConditionSchema }).strict(),
    z
      .object({
        fact: z.string(),
        op: z.enum(["eq", "neq", "in", "gt", "gte", "lt", "lte", "is_true", "is_false"]),
        value: z
          .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
          .optional(),
      })
      .strict(),
  ]),
);

export const RuleCategory = z.enum([
  "frequency",
  "sticker",
  "construction",
  "equipment",
  "identification",
  "transition",
  "documents",
]);
export type RuleCategory = z.infer<typeof RuleCategory>;

/** KeurKompas severities (report categories); "herinnering" is a reminder that is never exported. */
export const InspectorSeverity = z.enum(["tekortkoming", "opmerking", "informatie", "herinnering"]);

/**
 * Inspector part (KeurKompas): BEPO section, trigger on checklist facts and report wording.
 * The trigger language belongs to KeurKompas and is validated there (apps/keurkompas/src/rules).
 */
export const InspectorPart = z
  .object({
    section: z.string().regex(/^T\d+$/),
    trigger: z.unknown(),
    severity: InspectorSeverity,
    /** Own wording, shown as "voorstel KeurKompas" until confirmed. */
    text_inspector_nl: z.string().min(1).optional(),
    /** Id in knowledge/standard-sentences.json — then that sentence is used verbatim. */
    standard_sentence: z.string().optional(),
    fill: z.record(z.string(), z.string()).optional(),
    items: z.array(z.string()).min(1),
    suggest_status: z.literal("NVT").optional(),
  })
  .strict()
  .refine((p) => (p.text_inspector_nl === undefined) !== (p.standard_sentence === undefined), {
    message: "Use exactly one of text_inspector_nl or standard_sentence",
  });
export type InspectorPart = z.infer<typeof InspectorPart>;

/** Owner part (Tankwijzer): plain-language explanation and conditions on the owner's tank facts. */
export const OwnerPart = z
  .object({
    category: RuleCategory,
    /** Owner-friendly title (the shared title_nl is written for inspectors). */
    title_nl: z.string().min(1),
    text_owner_nl: z.string().min(1),
    /** One-line "why" for owners. */
    why_nl: z.string().min(1),
    applies_when: ConditionSchema,
    /** When present: true → "waarschijnlijk in orde", false → "mogelijk aandachtspunt". */
    ok_when: ConditionSchema.optional(),
    /** Fixed status when the rule applies and has no ok_when. */
    status_when_applies: z.enum(["info", "attention"]).default("info"),
    /** Shown when status is "attention": what the rule asks — never how or with which product. */
    attention_nl: z.string().optional(),
    /** Deadline relevant to this rule (transition rules). */
    deadline: IsoDate.nullable().default(null),
  })
  .strict();
export type OwnerPart = z.infer<typeof OwnerPart>;

/**
 * One VLAREM rule, shared by both apps. The legal metadata lives here once, so fixing an article
 * or approving a rule updates KeurKompas and Tankwijzer together.
 */
export const VlaremRule = z
  .object({
    id: z.string().regex(/^[a-z0-9_.-]+$/),
    /** Short title for lists and the inspector's review screen. */
    title_nl: z.string().min(1),
    region: Region,
    /** Article reference. "te bevestigen" when not known: never guessed. */
    article: z.string().min(1),
    source: z.string().min(1),
    /** Date range in which the rule applies (inclusive); null = open. */
    valid_from: IsoDate.nullable(),
    valid_until: IsoDate.nullable(),
    /** Stays false until the inspector confirms the rule (KeurKompas "Regels nakijken"). */
    verified_by_user: z.boolean(),
    /** Developer/inspector note, e.g. what still needs confirming. */
    note: z.string().optional(),
    inspector: InspectorPart.optional(),
    owner: OwnerPart.optional(),
  })
  .strict()
  .refine((r) => r.inspector !== undefined || r.owner !== undefined, {
    message: "A rule needs an inspector part, an owner part, or both",
  });
export type VlaremRule = z.infer<typeof VlaremRule>;

export const RulesFile = z.object({
  $comment: z.string().optional(),
  rules: z.array(VlaremRule).min(1),
});

/** Owner view of a rule, as evaluated by the Tankwijzer engine. */
export interface OwnerRule extends OwnerPart {
  id: string;
  region: VlaremRule["region"];
  article: string;
  source: string;
  valid_from: string | null;
  valid_until: string | null;
  verified_by_user: boolean;
}

export interface RuleSet {
  version: string;
  /** Date of the legal text the rules are based on. */
  rules_date: string;
  region: VlaremRule["region"];
  rules: OwnerRule[];
}

export function toOwnerRule(r: VlaremRule): OwnerRule | null {
  if (!r.owner) return null;
  return {
    ...r.owner,
    id: r.id,
    region: r.region,
    article: r.article,
    source: r.source,
    valid_from: r.valid_from,
    valid_until: r.valid_until,
    verified_by_user: r.verified_by_user,
  };
}

/** How an article is shown to owners. */
export function articleLabel(article: string): string {
  if (article === "te bevestigen") return "VLAREM II — artikel te bevestigen";
  if (/omzendbrief/i.test(article)) return article.charAt(0).toUpperCase() + article.slice(1);
  return `VLAREM II, ${article}`;
}
