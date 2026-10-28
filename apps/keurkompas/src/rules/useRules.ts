import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import type { Inspection } from '../domain/schemas';
import { evaluateRules, type RuleResult } from './engine';
import { reviewState, type ReviewState, type RuleReview } from './review';

/** Rule results for an inspection, recomputed whenever the inspection changes. */
export function useRuleResults(inspection: Inspection | null | undefined): RuleResult[] {
  return useMemo(() => (inspection ? evaluateRules(inspection) : []), [inspection]);
}

/** The inspector's reviews, keyed by rule id (live from IndexedDB). */
export function useRuleReviews(): Map<string, RuleReview> {
  const reviews = useLiveQuery(() => db.ruleReviews.toArray(), []);
  return useMemo(() => new Map((reviews ?? []).map((r) => [r.ruleId, r])), [reviews]);
}

export function useReviewStateOf(): (result: RuleResult) => ReviewState {
  const reviews = useRuleReviews();
  return (result) => reviewState(result.rule, reviews.get(result.rule.id));
}
