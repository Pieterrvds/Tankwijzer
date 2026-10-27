/**
 * Rule review ("Regels nakijken"): the inspector confirms or rejects each rule in the app.
 * Reviews are stored on the device (IndexedDB) and tied to a hash of the rule's content:
 * when a rule changes, its old review no longer counts and it must be checked again.
 */
import type { Rule } from '../domain/knowledge';

export interface RuleReview {
  ruleId: string;
  ruleHash: string;
  verdict: 'akkoord' | 'niet_akkoord';
  comment: string;
  reviewedAt: string;
}

/** Deterministic JSON (sorted keys) so the hash does not depend on key order. */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** FNV-1a hash of the rule content, ignoring `verified_by_user` and `note`. */
export function ruleHash(rule: Rule): string {
  const { verified_by_user: _v, note: _n, ...content } = rule;
  let h = 0x811c9dc5;
  for (const ch of stableStringify(content)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export type ReviewState = 'geverifieerd' | 'akkoord' | 'niet_akkoord' | 'te_controleren';

export function reviewState(rule: Rule, review: RuleReview | undefined): ReviewState {
  if (rule.verified_by_user) return 'geverifieerd';
  if (!review || review.ruleHash !== ruleHash(rule)) return 'te_controleren';
  return review.verdict;
}
