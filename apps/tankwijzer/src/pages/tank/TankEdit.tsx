import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { LABELS_NL, type Site, type Tank } from "@tankwijzer/vlarem-core";
import { api, formatDate } from "../../api.ts";
import { TankForm, type TankDraft } from "../../components/TankForm.tsx";
import { emptyInspection, InspectionFields } from "../../components/InspectionFields.tsx";
import { ErrorBox, Loading, useAsync } from "../../components/ui.tsx";

export function TankEdit({ tank, onSaved }: { tank: Tank; onSaved: () => void }) {
  const navigate = useNavigate();
  const sites = useAsync(() => api.get<Site[]>("/sites"));
  const { id: _id, companyId: _c, createdAt: _cr, updatedAt: _u, ...rest } = tank;
  const [draft, setDraft] = useState<TankDraft>(rest as TankDraft);
  const [inspection, setInspection] = useState(emptyInspection());
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!sites.data) return <Loading />;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.put(`/tanks/${tank.id}`, draft);
      setMsg("Bewaard.");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addInspection = async () => {
    if (!inspection.date) return setError("Vul de datum van de keuring in.");
    try {
      const saved = await api.post<Tank>(`/tanks/${tank.id}/inspections`, { ...inspection, remarks: [], source: "owner" });
      setDraft({ ...draft, inspections: saved.inspections });
      setInspection(emptyInspection());
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async () => {
    if (!confirm(`Tank ${tank.label} en alle bijhorende foto's verwijderen?`)) return;
    await api.del(`/tanks/${tank.id}`);
    navigate("/");
  };

  return (
    <div className="stack">
      <form className="stack" onSubmit={save}>
        <TankForm draft={draft} sites={sites.data} onChange={setDraft} />
        <div className="actions">
          <button className="btn btn-primary">Wijzigingen bewaren</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </form>

      <section className="card stack-sm">
        <h3>Keuringen</h3>
        {draft.inspections.length === 0 && <p className="muted">Nog geen keuringen ingevuld.</p>}
        <ul className="inspections">
          {[...draft.inspections]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((i) => (
              <li key={`${i.date}-${i.type}`}>
                <span className={`sticker sticker-${i.sticker ?? "none"}`} />
                {formatDate(i.date)} — {LABELS_NL.inspectionType[i.type]}
                {i.nextDueDate && <span className="muted"> · volgende: {formatDate(i.nextDueDate)}</span>}
                {i.source === "official_report" && <span className="badge badge-info">uit verslag</span>}
              </li>
            ))}
        </ul>
        <h4>Keuring toevoegen</h4>
        <InspectionFields value={inspection} onChange={setInspection} />
        <button type="button" className="btn" onClick={addInspection}>
          Keuring toevoegen
        </button>
      </section>

      <ErrorBox message={error} />
      <button type="button" className="btn btn-danger" onClick={remove}>
        Tank verwijderen
      </button>
    </div>
  );
}
