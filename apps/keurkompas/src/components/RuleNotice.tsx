import type { ReactNode } from 'react';
import type { Severity } from '../domain/schemas';
import type { RuleResult } from '../rules/engine';
import type { ReviewState } from '../rules/review';

const SEVERITY_LABEL: Record<Severity, string> = {
  tekortkoming: 'Tekortkoming',
  opmerking: 'Opmerking',
  informatie: 'Informatie',
  herinnering: 'Herinnering',
};

const SEVERITY_STYLE: Record<Severity, string> = {
  tekortkoming: 'border-nok bg-red-50',
  opmerking: 'border-amber-500 bg-amber-50',
  informatie: 'border-sky-700 bg-sky-50',
  herinnering: 'border-gray-500 bg-gray-50',
};

const CHIP_STYLE: Record<Severity, string> = {
  tekortkoming: 'bg-nok text-white',
  opmerking: 'bg-amber-500 text-gray-950',
  informatie: 'bg-sky-700 text-white',
  herinnering: 'bg-gray-600 text-white',
};

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${CHIP_STYLE[severity]}`}>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function ReviewChip({ state }: { state: ReviewState }) {
  if (state === 'geverifieerd' || state === 'akkoord') return null;
  return (
    <span className="rounded border border-gray-500 px-2 py-0.5 text-xs font-semibold text-gray-700">
      {state === 'niet_akkoord' ? 'regel afgekeurd' : 'regel niet nagekeken'}
    </span>
  );
}

/**
 * One rule result: what, why (article) and where it comes from. Display only —
 * accepting findings into T20 is milestone M6.
 */
export function RuleNotice({
  result,
  review,
  children,
}: {
  result: RuleResult;
  review: ReviewState;
  children?: ReactNode;
}) {
  const { rule } = result;
  return (
    <div className={`rounded-xl border-2 border-dashed p-3 ${SEVERITY_STYLE[result.severity]}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <SeverityChip severity={result.suggestStatus ? 'herinnering' : result.severity} />
        {result.suggestStatus && <span className="text-sm font-bold">Voorstel: NVT</span>}
        <ReviewChip state={review} />
      </div>
      <p className={review === 'niet_akkoord' ? 'text-gray-500 line-through' : ''}>{result.text}</p>
      <p className="mt-1 text-xs text-gray-700">
        {rule.article === 'te bevestigen' ? (
          <span className="te-bevestigen px-1">artikel te bevestigen</span>
        ) : (
          rule.article
        )}
        {' · '}
        {result.isStandardSentence ? 'standaardzin' : 'tekst regel'} · {rule.source}
      </p>
      {children}
    </div>
  );
}
