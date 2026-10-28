import { describe, expect, it } from 'vitest';
import { formatDate, formatDecimal, parseDecimal, parseInteger } from './format';

describe('parseDecimal', () => {
  it('accepts Belgian comma and dot decimals', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal('13.3')).toBe(13.3);
    expect(parseDecimal(' 55 ')).toBe(55);
    expect(parseDecimal('-20')).toBe(-20);
  });

  it('returns null for empty or invalid input instead of guessing', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
    expect(parseDecimal('1,')).toBeNull();
  });

  it('round-trips with formatDecimal', () => {
    expect(formatDecimal(1.5)).toBe('1,5');
    expect(formatDecimal(null)).toBe('');
  });
});

describe('parseInteger', () => {
  it('rejects decimals', () => {
    expect(parseInteger('1998')).toBe(1998);
    expect(parseInteger('1998,5')).toBeNull();
  });
});

describe('formatDate', () => {
  it('formats ISO dates the report way', () => {
    expect(formatDate('2026-03-07')).toBe('07/03/2026');
  });
});
