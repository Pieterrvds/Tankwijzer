import { Link } from "react-router";
import type { DeadlineItem } from "@tankwijzer/vlarem-core";
import { api, formatDate } from "../api.ts";
import { DEADLINE_KIND_LABELS } from "../labels.ts";
import { Disclaimer, ErrorBox, Loading, useAsync } from "../components/ui.tsx";

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

export function PlanningPage() {
  const { data, error, loading } = useAsync(() =>
    api.get<{ items: DeadlineItem[]; tankLabels: Record<string, string> }>("/planning"),
  );
  if (loading) return <Loading />;
  if (!data) return <ErrorBox message={error} />;

  const dated = data.items.filter((i) => i.dueDate);
  const undated = data.items.filter((i) => !i.dueDate);
  const overdue = dated.filter((i) => i.overdue);
  const upcoming = dated.filter((i) => !i.overdue);
  const byMonth = new Map<string, DeadlineItem[]>();
  for (const i of upcoming) {
    const [y, m] = i.dueDate!.split("-");
    const key = `${MONTHS[Number(m) - 1]} ${y}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), i]);
  }

  const Row = ({ i }: { i: DeadlineItem }) => (
    <li className={i.overdue ? "overdue-row" : ""}>
      <div className="deadline-date">{formatDate(i.dueDate)}</div>
      <div>
        <Link to={`/tanks/${i.tankId}/planning`}>
          <strong>{data.tankLabels[i.tankId]}</strong>
        </Link>{" "}
        — {i.title_nl}
        <span className="badge badge-info">{DEADLINE_KIND_LABELS[i.kind]}</span>
        <p className="muted small">{i.basis_nl}</p>
      </div>
    </li>
  );

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Planning</h1>
        <a className="btn" href="/api/planning.ics" download>
          In mijn agenda (.ics)
        </a>
      </div>
      <p className="muted">
        Het .ics-bestand bevat herinneringen 3 maanden en 1 maand vooraf. U krijgt dezelfde herinneringen ook per e-mail.
      </p>
      {data.items.length === 0 && <p className="muted">Nog geen deadlines. Voeg een tank toe met de datum van de laatste keuring.</p>}
      {overdue.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title overdue">Over tijd</h2>
          <ul className="deadlines">{overdue.map((i) => <Row key={i.id} i={i} />)}</ul>
        </section>
      )}
      {[...byMonth.entries()].map(([month, items]) => (
        <section key={month} className="stack-sm">
          <h2 className="section-title">{month}</h2>
          <ul className="deadlines">{items.map((i) => <Row key={i.id} i={i} />)}</ul>
        </section>
      ))}
      {undated.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">Datum nog onbekend</h2>
          <ul className="deadlines">{undated.map((i) => <Row key={i.id} i={i} />)}</ul>
        </section>
      )}
      <Disclaimer />
    </div>
  );
}
