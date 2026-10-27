import { CATEGORY_LABELS } from "../../labels.ts";
import type { Obligation, TankEvaluation } from "@tankwijzer/vlarem-core";
import { formatDate } from "../../api.ts";
import { Disclaimer, StatusBadge } from "../../components/ui.tsx";

function ObligationCard({ o }: { o: Obligation }) {
  return (
    <article className={`obligation obligation-${o.status}`}>
      <header>
        <h3>{o.title_nl}</h3>
        <StatusBadge status={o.status} />
      </header>
      <p>{o.text_nl}</p>
      <p className="why">
        <strong>Waarom?</strong> {o.why_nl}
      </p>
      {o.attention_nl && <p className="attention">{o.attention_nl}</p>}
      {o.questions_nl.length > 0 && (
        <div className="questions">
          <strong>{o.maybeApplies ? "Om te weten of dit geldt:" : "Om dit te beoordelen:"}</strong>
          <ul>
            {o.questions_nl.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      <footer className="meta">
        {o.article} · {CATEGORY_LABELS[o.category]}
        {o.deadline && <> · deadline {formatDate(o.deadline)}</>}
        {!o.verified_by_user && <span className="unverified"> · nog niet nagekeken door een milieudeskundige</span>}
      </footer>
    </article>
  );
}

export function Obligations({ evaluation }: { evaluation: TankEvaluation }) {
  const attention = evaluation.obligations.filter((o) => o.status === "attention");
  const unknown = evaluation.obligations.filter((o) => o.status === "unknown");
  const rest = evaluation.obligations.filter((o) => o.status === "likely_ok" || o.status === "info");
  return (
    <div className="stack">
      <p className="muted small">
        Gebaseerd op regels versie {evaluation.rulesetVersion} (regelgeving van {formatDate(evaluation.rulesDate)}), berekend op{" "}
        {formatDate(evaluation.evaluatedOn)}.
      </p>
      {attention.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">Mogelijke aandachtspunten ({attention.length})</h2>
          {attention.map((o) => (
            <ObligationCard key={o.ruleId} o={o} />
          ))}
        </section>
      )}
      {unknown.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">Info nodig ({unknown.length})</h2>
          {unknown.map((o) => (
            <ObligationCard key={o.ruleId} o={o} />
          ))}
        </section>
      )}
      {rest.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">Waarschijnlijk in orde en ter info ({rest.length})</h2>
          {rest.map((o) => (
            <ObligationCard key={o.ruleId} o={o} />
          ))}
        </section>
      )}
      <Disclaimer />
    </div>
  );
}
