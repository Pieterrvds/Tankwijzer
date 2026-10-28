import { describe, expect, it } from 'vitest';
import { evaluate, parseDate, type Condition } from './conditions';

const facts: Record<string, unknown> = {
  a: 1,
  b: 'Kijkglas',
  empty: '',
  none: null,
  list: ['GHS06'],
};
const run = (c: Condition) => evaluate(c, (p) => facts[p]);

describe('three-valued condition evaluation', () => {
  it('compares known values', () => {
    expect(run({ fact: 'a', op: 'lt', value: 2 })).toBe(true);
    expect(run({ fact: 'b', op: 'matches', value: 'kijkglas|vlotter' })).toBe(true);
    expect(run({ fact: 'list', op: 'contains', value: 'GHS06' })).toBe(true);
    expect(run({ fact: 'a', op: 'in', value: [2, 3] })).toBe(false);
  });

  it('is unknown (null) for missing values — never false', () => {
    expect(run({ fact: 'none', op: 'eq', value: 1 })).toBeNull();
    expect(run({ fact: 'empty', op: 'neq', value: 'x' })).toBeNull();
    expect(run({ fact: 'a', op: 'lt', valueFact: 'none' })).toBeNull();
  });

  it('isEmpty / isNotEmpty treat empty as a known answer', () => {
    expect(run({ fact: 'empty', op: 'isEmpty' })).toBe(true);
    expect(run({ fact: 'a', op: 'isNotEmpty' })).toBe(true);
  });

  it('combines with Kleene logic', () => {
    const t: Condition = { fact: 'a', op: 'eq', value: 1 };
    const f: Condition = { fact: 'a', op: 'eq', value: 2 };
    const u: Condition = { fact: 'none', op: 'eq', value: 1 };
    expect(run({ all: [t, u] })).toBeNull();
    expect(run({ all: [f, u] })).toBe(false);
    expect(run({ any: [t, u] })).toBe(true);
    expect(run({ any: [f, u] })).toBeNull();
    expect(run({ not: u })).toBeNull();
    expect(run({ not: f })).toBe(true);
  });

  it('parses Belgian and ISO dates', () => {
    expect(parseDate('1/2/2026')).toBe('2026-02-01');
    expect(parseDate('31.12.2030')).toBe('2030-12-31');
    expect(parseDate('2026-06-15')).toBe('2026-06-15');
    expect(parseDate('onbepaald')).toBeNull();
  });
});
