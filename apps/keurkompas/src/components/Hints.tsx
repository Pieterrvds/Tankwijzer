import { useMemo } from 'react';
import { repo } from '../db/repository';
import type { Inspection } from '../domain/schemas';
import { evaluateRules } from '../rules/engine';

/**
 * Gentle "vergeet niet" hints from the rules, based on what the previous report says (e.g.
 * "vorige keer alarmfluit: volstaat tot 31/12/2027"). Never a gate: each can be dismissed.
 */
export function Hints({ inspection }: { inspection: Inspection }) {
  const hints = useMemo(
    () =>
      evaluateRules(inspection).filter(
        (r) => !r.suggestStatus && !inspection.verborgenHints.includes(r.rule.id),
      ),
    [inspection],
  );
  if (hints.length === 0) return null;
  return (
    <section aria-label="Tips" className="space-y-2">
      {hints.map((h) => (
        <div
          key={h.rule.id}
          className="flex items-start gap-2 rounded-xl border-2 border-sky-700 bg-sky-50 p-3"
        >
          <span aria-hidden className="text-xl">
            💡
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{h.rule.title_nl}</p>
            <p className="text-sm">{h.text}</p>
            <p className="text-xs text-gray-700">
              {h.rule.section} ·{' '}
              {h.rule.article === 'te bevestigen' ? 'artikel te bevestigen' : h.rule.article}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void repo.dismissHint(inspection.id, h.rule.id)}
            className="h-12 w-12 shrink-0 rounded-lg font-bold"
            aria-label="Tip verbergen"
          >
            ✕
          </button>
        </div>
      ))}
    </section>
  );
}
