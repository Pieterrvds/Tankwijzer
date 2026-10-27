import type { TankEvaluation } from "@tankwijzer/vlarem-core";
import { formatDate } from "../../api.ts";
import { DEADLINE_KIND_LABELS } from "../../labels.ts";
import { Disclaimer } from "../../components/ui.tsx";

export function TankPlanning({ evaluation }: { evaluation: TankEvaluation }) {
  return (
    <div className="stack">
      {evaluation.deadlines.length === 0 && <p className="muted">Geen deadlines bekend. Vul de plaatsing en de laatste keuring in.</p>}
      <ul className="deadlines">
        {evaluation.deadlines.map((d) => (
          <li key={d.id} className={d.overdue ? "overdue-row" : ""}>
            <div className="deadline-date">{d.dueDate ? formatDate(d.dueDate) : "?"}</div>
            <div>
              <strong>{d.title_nl}</strong>
              <span className="badge badge-info">{DEADLINE_KIND_LABELS[d.kind]}</span>
              {d.overdue && <span className="badge badge-warn">over tijd</span>}
              <p className="muted small">{d.basis_nl}</p>
            </div>
          </li>
        ))}
      </ul>
      <a className="btn" href="/api/planning.ics" download>
        Alle deadlines in mijn agenda (.ics)
      </a>
      <Disclaimer />
    </div>
  );
}
