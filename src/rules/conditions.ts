/**
 * The small condition language used in `knowledge/rules/*.json` triggers.
 *
 *   { "all": [ … ] }            every sub-condition is true
 *   { "any": [ … ] }            at least one sub-condition is true
 *   { "not": { … } }            negation
 *   { "fact": "product.vlampuntC", "op": "lt", "value": 55 }
 *   { "fact": "item:T10.capaciteit.values.capaciteit_l", "op": "lt", "valueFact": "tank.inhoudLiter" }
 *
 * Evaluation uses THREE-VALUED logic: a condition on a value that is not known yet
 * (empty field, item not yet checked) is `unknown`, not `false`. A rule only fires when its
 * trigger is definitely `true`. This is how "never invent values" is enforced for rules.
 */
import { z } from 'zod';

export const Operator = z.enum([
  'eq',
  'neq',
  'in',
  'nin',
  'lt',
  'lte',
  'gt',
  'gte',
  /** Array contains the value, or text contains it (case-insensitive). */
  'contains',
  /** Case-insensitive regular expression on text. */
  'matches',
  /** Explicit check for "nothing filled in". The only operators that treat empty as known. */
  'isEmpty',
  'isNotEmpty',
  /** Date comparison; accepts yyyy-mm-dd and dd/mm/jjjj. */
  'dateBefore',
]);
export type Operator = z.infer<typeof Operator>;

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { fact: string; op: Operator; value?: unknown; valueFact?: string };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(Condition).min(1) }).strict(),
    z.object({ any: z.array(Condition).min(1) }).strict(),
    z.object({ not: Condition }).strict(),
    z
      .object({
        fact: z.string().min(1),
        op: Operator,
        value: z.unknown().optional(),
        valueFact: z.string().optional(),
      })
      .strict(),
  ]),
);

/** true / false / unknown. */
export type Tri = boolean | null;

/** Looks up a fact; returns `undefined` or `null` when unknown. */
export type FactResolver = (path: string) => unknown;

export function isUnknown(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Parse yyyy-mm-dd or dd/mm/jjjj (also with - or .) into yyyy-mm-dd, else null. */
export function parseDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

function compare(op: Operator, a: unknown, b: unknown): Tri {
  switch (op) {
    case 'eq':
      return a === b;
    case 'neq':
      return a !== b;
    case 'in':
      return Array.isArray(b) ? b.includes(a) : null;
    case 'nin':
      return Array.isArray(b) ? !b.includes(a) : null;
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const x = typeof a === 'string' ? Number(a.replace(',', '.')) : a;
      const y = typeof b === 'string' ? Number(b.replace(',', '.')) : b;
      if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(x) || Number.isNaN(y))
        return null;
      return op === 'lt' ? x < y : op === 'lte' ? x <= y : op === 'gt' ? x > y : x >= y;
    }
    case 'contains':
      if (Array.isArray(a)) return a.includes(b);
      if (typeof a === 'string' && typeof b === 'string')
        return a.toLowerCase().includes(b.toLowerCase());
      return null;
    case 'matches':
      return typeof a === 'string' && typeof b === 'string' ? new RegExp(b, 'i').test(a) : null;
    case 'dateBefore': {
      const x = parseDate(a);
      const y = parseDate(b);
      return x && y ? x < y : null;
    }
    case 'isEmpty':
    case 'isNotEmpty':
      return null; // handled before compare()
  }
}

export function evaluate(condition: Condition, resolve: FactResolver): Tri {
  if ('all' in condition) {
    const results = condition.all.map((c) => evaluate(c, resolve));
    if (results.includes(false)) return false;
    return results.every((r) => r === true) ? true : null;
  }
  if ('any' in condition) {
    const results = condition.any.map((c) => evaluate(c, resolve));
    if (results.includes(true)) return true;
    return results.every((r) => r === false) ? false : null;
  }
  if ('not' in condition) {
    const r = evaluate(condition.not, resolve);
    return r === null ? null : !r;
  }

  const actual = resolve(condition.fact);
  if (condition.op === 'isEmpty') return isUnknown(actual);
  if (condition.op === 'isNotEmpty') return !isUnknown(actual);
  if (isUnknown(actual)) return null;

  const expected =
    condition.valueFact !== undefined ? resolve(condition.valueFact) : condition.value;
  if (isUnknown(expected)) return null;
  return compare(condition.op, actual, expected);
}

/** All fact paths used in a condition (for validation in tests). */
export function factsUsed(condition: Condition): string[] {
  if ('all' in condition) return condition.all.flatMap(factsUsed);
  if ('any' in condition) return condition.any.flatMap(factsUsed);
  if ('not' in condition) return factsUsed(condition.not);
  return condition.valueFact ? [condition.fact, condition.valueFact] : [condition.fact];
}
