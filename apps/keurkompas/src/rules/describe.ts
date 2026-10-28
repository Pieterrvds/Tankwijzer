/** Turn rule triggers into readable Dutch, for the review screen and docs/rules.md. */
import type { Condition, Operator } from './conditions';
import { factLabel } from './facts';

const OP_LABEL: Record<Operator, string> = {
  eq: '=',
  neq: '≠',
  in: 'is een van',
  nin: 'is geen van',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  contains: 'bevat',
  matches: 'bevat',
  isEmpty: 'is leeg',
  isNotEmpty: 'is ingevuld',
  dateBefore: 'ligt vóór',
};

function formatValue(v: unknown, op: Operator): string {
  if (v === true) return 'ja';
  if (v === false) return 'nee';
  if (Array.isArray(v)) return v.map((x) => formatValue(x, 'eq')).join(' / ');
  if (typeof v === 'string') {
    if (op === 'matches')
      return v
        .split('|')
        .map((x) => `“${x}”`)
        .join(' of ');
    return `“${v}”`;
  }
  return String(v).replace('.', ',');
}

export function describeCondition(c: Condition, nested = false): string {
  const wrap = (s: string) => (nested ? `(${s})` : s);
  if ('all' in c) return wrap(c.all.map((x) => describeCondition(x, true)).join(' én '));
  if ('any' in c) return wrap(c.any.map((x) => describeCondition(x, true)).join(' of '));
  if ('not' in c) return `niet ${describeCondition(c.not, true)}`;
  const left = factLabel(c.fact);
  if (c.op === 'isEmpty' || c.op === 'isNotEmpty') return `${left} ${OP_LABEL[c.op]}`;
  const right = c.valueFact ? factLabel(c.valueFact) : formatValue(c.value, c.op);
  return `${left} ${OP_LABEL[c.op]} ${right}`;
}
