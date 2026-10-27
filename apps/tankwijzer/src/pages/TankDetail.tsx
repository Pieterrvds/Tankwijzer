import { NavLink, Route, Routes, useParams } from "react-router";
import { LABELS_NL } from "@tankwijzer/vlarem-core";
import { api, formatDate, type TankDetail } from "../api.ts";
import { ErrorBox, Loading, StickerDot, useAsync } from "../components/ui.tsx";
import { Obligations } from "./tank/Obligations.tsx";
import { TankPlanning } from "./tank/TankPlanning.tsx";
import { Precheck } from "./tank/Precheck.tsx";
import { TankDocuments } from "./tank/TankDocuments.tsx";
import { OrangeSticker } from "./tank/OrangeSticker.tsx";
import { TankEdit } from "./tank/TankEdit.tsx";

export function TankDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.get<TankDetail>(`/tanks/${id}`), [id]);

  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox message={error ?? "Tank niet gevonden"} />;
  const { tank, latestSticker, nextDeadline } = data;
  const base = `/tanks/${tank.id}`;
  const showOrange = latestSticker === "orange" || latestSticker === "red" || tank.orangeFindings.length > 0;

  return (
    <div className="stack">
      <div className="tank-head">
        <StickerDot colour={latestSticker} />
        <div>
          <h1>{tank.label}</h1>
          <p className="muted">
            {data.site?.name} · {LABELS_NL.product[tank.product]} ·{" "}
            {tank.capacityL ? `${tank.capacityL.toLocaleString("nl-BE")} l` : "inhoud aan te vullen"}
          </p>
        </div>
        {nextDeadline && (
          <div className="tank-head-next">
            <span className="muted small">{nextDeadline.title_nl}</span>
            <strong className={nextDeadline.overdue ? "overdue" : ""}>{formatDate(nextDeadline.dueDate)}</strong>
          </div>
        )}
      </div>
      {tank.unconfirmedFields.length > 0 && (
        <div className="alert alert-info">
          Sommige gegevens komen uit een foto en zijn nog niet bevestigd. Kijk ze na onder <NavLink to={`${base}/gegevens`}>Gegevens</NavLink>.
        </div>
      )}
      <nav className="tabs">
        <NavLink to={base} end>Wat geldt?</NavLink>
        <NavLink to={`${base}/planning`}>Planning</NavLink>
        <NavLink to={`${base}/keuring`}>Klaar voor de keuring?</NavLink>
        <NavLink to={`${base}/documenten`}>Documenten</NavLink>
        {showOrange && (
          <NavLink to={`${base}/oranje`}>{latestSticker === "red" ? "Rode klever" : "Oranje klever"}</NavLink>
        )}
        <NavLink to={`${base}/gegevens`}>Gegevens</NavLink>
      </nav>
      <Routes>
        <Route index element={<Obligations evaluation={data.evaluation} />} />
        <Route path="planning" element={<TankPlanning evaluation={data.evaluation} />} />
        <Route path="keuring" element={<Precheck tankId={tank.id} />} />
        <Route path="documenten" element={<TankDocuments tank={tank} checks={data.evaluation.documents} onChange={reload} />} />
        <Route path="oranje" element={<OrangeSticker detail={data} onChange={reload} />} />
        <Route path="gegevens" element={<TankEdit tank={tank} onSaved={reload} />} />
      </Routes>
    </div>
  );
}
