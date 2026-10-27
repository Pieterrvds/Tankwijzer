import { Link } from "react-router";
import { LABELS_NL } from "@tankwijzer/vlarem-core";
import { api, formatDate, type TankSummary } from "../api.ts";
import { useMe } from "../App.tsx";
import { ErrorBox, Loading, StickerDot, useAsync } from "../components/ui.tsx";

export function TankListPage() {
  const { me } = useMe();
  const { data, error, loading } = useAsync(() => api.get<TankSummary[]>("/tanks"));
  const limits = me.limits;
  const atLimit = !!limits && limits.tankLimit !== null && limits.tankCount >= limits.tankLimit;

  if (loading) return <Loading />;
  const bySite = new Map<string, TankSummary[]>();
  for (const t of data ?? []) {
    const key = t.site?.name ?? "Zonder site";
    bySite.set(key, [...(bySite.get(key) ?? []), t]);
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Mijn tanks</h1>
        {atLimit ? (
          <span className="muted small">Gratis plan: max. {limits?.tankLimit} tanks</span>
        ) : (
          <Link to="/tanks/nieuw" className="btn btn-primary">
            + Tank toevoegen
          </Link>
        )}
      </div>
      <ErrorBox message={error} />
      {data && data.length === 0 && (
        <div className="empty card">
          <h2>Nog geen tanks</h2>
          <p>Voeg uw eerste tank toe. Een foto van de typeplaat en de keuringsklever volstaat om te beginnen.</p>
          <Link to="/tanks/nieuw" className="btn btn-primary">
            Eerste tank toevoegen
          </Link>
        </div>
      )}
      {[...bySite.entries()].map(([site, tanks]) => (
        <section key={site} className="stack-sm">
          {bySite.size > 1 && <h2 className="section-title">{site}</h2>}
          <ul className="tank-list">
            {tanks.map((t) => (
              <li key={t.tank.id}>
                <Link to={`/tanks/${t.tank.id}`} className="tank-row">
                  <StickerDot colour={t.latestSticker} />
                  <div className="tank-main">
                    <strong>{t.tank.label}</strong>
                    <span className="muted small">
                      {LABELS_NL.product[t.tank.product]} · {t.tank.capacityL ? `${t.tank.capacityL.toLocaleString("nl-BE")} l` : "inhoud aan te vullen"} ·{" "}
                      {LABELS_NL.placement[t.tank.placement].toLowerCase()}
                    </span>
                  </div>
                  <div className="tank-next">
                    {t.nextDeadline ? (
                      <>
                        <span className={t.nextDeadline.overdue ? "overdue" : ""}>{formatDate(t.nextDeadline.dueDate)}</span>
                        <span className="muted small">{t.nextDeadline.title_nl}</span>
                      </>
                    ) : (
                      <span className="muted small">Geen datum bekend</span>
                    )}
                  </div>
                  <div className="tank-flags">
                    {t.counts.attention > 0 && <span className="badge badge-warn">{t.counts.attention} aandachtspunt(en)</span>}
                    {t.counts.unknown > 0 && <span className="badge badge-unknown">{t.counts.unknown} onbekend</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
