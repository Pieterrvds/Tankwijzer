import { describe, expect, it } from 'vitest';
import { RULES } from './engine';
import { reviewState, ruleHash } from './review';

describe('rule review', () => {
  const rule = RULES[0]!;

  it('hash ignores verified_by_user and note, but not content', () => {
    expect(ruleHash({ ...rule, verified_by_user: true, note: 'x' })).toBe(ruleHash(rule));
    expect(ruleHash({ ...rule, article: 'art. 1' })).not.toBe(ruleHash(rule));
  });

  it('a review only counts for the exact rule content it was given for', () => {
    const review = {
      ruleId: rule.id,
      ruleHash: ruleHash(rule),
      verdict: 'akkoord' as const,
      comment: '',
      reviewedAt: '2026-01-01T00:00:00Z',
    };
    expect(reviewState(rule, undefined)).toBe('te_controleren');
    expect(reviewState(rule, review)).toBe('akkoord');
    expect(reviewState({ ...rule, article: 'gewijzigd' }, review)).toBe('te_controleren');
    expect(reviewState({ ...rule, verified_by_user: true }, undefined)).toBe('geverifieerd');
  });
});
