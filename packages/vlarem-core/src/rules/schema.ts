import { z } from "zod";
import { IsoDate, Region } from "../model.ts";

/**
 * Rule format. Rules are data (JSON) so the inspector can review and approve them in one place;
 * both Tankwijzer and KeurKompas read the same file.
 *
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

export const Rule = z
  .object({
    id: z.string().regex(/^[A-Z]{2,3}-[A-Z0-9-]+$/),
    region: Region,
    category: RuleCategory,
    title_nl: z.string(),
    /** Plain-language explanation for owners (Tankwijzer). */
    text_owner_nl: z.string(),
    /** One-line "why" for owners. */
    why_nl: z.string(),
    /** Report wording for inspectors (KeurKompas). Never shown in Tankwijzer. */
    text_inspector_nl: z.string(),
    article: z.string(),
    source: z.string(),
    valid_from: IsoDate,
    valid_until: IsoDate.nullable(),
    /** Set to true only after the inspector approved the rule in the review screen. */
    verified_by_user: z.boolean(),
    applies_when: ConditionSchema,
    /** When present: true → "waarschijnlijk in orde", false → "mogelijk aandachtspunt". */
    ok_when: ConditionSchema.optional(),
    /** Fixed status when the rule applies and has no ok_when. */
    status_when_applies: z.enum(["info", "attention"]).default("info"),
    /** Deadline relevant to this rule (transition rules). */
    deadline: IsoDate.nullable().default(null),
    /** Shown when status is "attention": what the rule asks — never how or with which product. */
    attention_nl: z.string().optional(),
  })
  .strict();
export type Rule = z.infer<typeof Rule>;
export type RuleInput = z.input<typeof Rule>;

export const RuleSet = z.object({
  version: z.string(),
  /** Date of the legal text the rules are based on. */
  rules_date: IsoDate,
  region: Region,
  rules: z.array(Rule),
});
export type RuleSet = z.infer<typeof RuleSet>;
