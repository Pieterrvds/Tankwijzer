import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import type { InspectionRecord, Site, Tank } from "@tankwijzer/vlarem-core";
import { api } from "../api.ts";
import { useMe } from "../App.tsx";
import { emptyDraft, TankForm, type TankDraft } from "../components/TankForm.tsx";
import { emptyInspection, InspectionFields, type InspectionDraft } from "../components/InspectionFields.tsx";
import { Card, ErrorBox, Feedback, Loading, useAsync } from "../components/ui.tsx";

interface ReadPhotoResponse {
  logId: string;
  reading: { photo_quality: "ok" | "retake"; retake_reason_nl: string | null };
  patch: Partial<TankDraft>;
  inspection: InspectionRecord | null;
  unconfirmedFields: string[];
}

const PHOTO_SLOTS = [
  { hint: "nameplate", title: "Typeplaat", help: "Het metalen plaatje op de tank met fabricagenummer, bouwer, bouwjaar en inhoud." },
  { hint: "sticker", title: "Keuringsklever", help: "De gekleurde klever van de laatste keuring, met de datum van de volgende keuring." },
  { hint: "product_label", title: "Productetiket", help: "Het etiket met de productnaam en de gevarensymbolen." },
] as const;

export function TankNewPage() {
  const { me } = useMe();
  const navigate = useNavigate();
  const sites = useAsync(() => api.get<Site[]>("/sites"));
  const [draft, setDraft] = useState<TankDraft | null>(null);
  const [inspection, setInspection] = useState<InspectionDraft>(emptyInspection());
  const [hasInspection, setHasInspection] = useState(false);
  const [photos, setPhotos] = useState<Record<string, { status: string; logId?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sites.loading || !sites.data) return <Loading />;
  const d = draft ?? emptyDraft(sites.data[0]?.id ?? "");

  const readPhoto = async (hint: string, file: File) => {
    setPhotos((p) => ({ ...p, [hint]: { status: "Foto wordt gelezen…" } }));
    const form = new FormData();
    form.set("file", file);
    form.set("hint", hint);
    try {
      const res = await api.post<ReadPhotoResponse>("/ai/read-photo", form);
      if (res.reading.photo_quality === "retake") {
        setPhotos((p) => ({ ...p, [hint]: { status: res.reading.retake_reason_nl ?? "Neem een nieuwe foto.", logId: res.logId } }));
        return;
      }
      setDraft({
        ...d,
        ...res.patch,
        nameplate: { ...d.nameplate, ...(res.patch.nameplate ?? {}) },
        unconfirmedFields: [...new Set([...d.unconfirmedFields, ...res.unconfirmedFields])],
      });
      if (res.inspection) {
        setInspection({
          date: res.inspection.date,
          type: res.inspection.type,
          sticker: res.inspection.sticker,
          nextDueDate: res.inspection.nextDueDate,
        });
        setHasInspection(true);
      }
      const n = res.unconfirmedFields.length;
      setPhotos((p) => ({
        ...p,
        [hint]: {
          status: n ? `${n} gegeven(s) gelezen. Kijk ze hieronder na.` : "Niets leesbaars gevonden. Vul de gegevens zelf in.",
          logId: res.logId,
        },
      }));
    } catch (e) {
      setPhotos((p) => ({ ...p, [hint]: { status: (e as Error).message } }));
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const inspections =
        hasInspection && inspection.date ? [{ ...inspection, remarks: [], source: "owner" as const }] : [];
      const unconfirmedFields = d.unconfirmedFields.filter((f) => f !== "inspection");
      const tank = await api.post<Tank>("/tanks", { ...d, inspections, unconfirmedFields });
      navigate(`/tanks/${tank.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={save}>
      <h1>Tank toevoegen</h1>

      <Card className="stack-sm">
        <h2>1. Foto's (optioneel)</h2>
        {me.aiEnabled ? (
          <p className="muted">
            Neem een foto; Tankwijzer leest wat het kan. U bevestigt elk gegeven. Wat onleesbaar is, blijft leeg en staat op
            "aan te vullen".
          </p>
        ) : (
          <p className="alert alert-info">Foto's lezen is nog niet ingeschakeld. Vul de gegevens hieronder zelf in.</p>
        )}
        {me.aiEnabled && (
          <div className="photo-slots">
            {PHOTO_SLOTS.map((s) => (
              <label key={s.hint} className="photo-slot">
                <strong>{s.title}</strong>
                <span className="muted small">{s.help}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => e.target.files?.[0] && readPhoto(s.hint, e.target.files[0])}
                />
                {photos[s.hint] && (
                  <span className="small">
                    {photos[s.hint]!.status} {photos[s.hint]!.logId && <Feedback logId={photos[s.hint]!.logId!} />}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </Card>

      <h2>2. Gegevens en vragen</h2>
      <TankForm draft={d} sites={sites.data} onChange={setDraft} />

      <Card className="stack-sm">
        <h2>3. Laatste keuring</h2>
        <label className="check">
          <input type="checkbox" checked={hasInspection} onChange={(e) => setHasInspection(e.target.checked)} />
          De tank werd al gekeurd
        </label>
        {d.unconfirmedFields.includes("inspection") && (
          <span className="suggested">Voorgesteld uit de foto van de klever — kijk na of dit klopt.</span>
        )}
        {hasInspection && <InspectionFields value={inspection} onChange={setInspection} />}
      </Card>

      <ErrorBox message={error} />
      <div className="actions">
        <button className="btn btn-primary" disabled={busy || !d.label}>
          {busy ? "Bewaren…" : "Tank bewaren"}
        </button>
      </div>
    </form>
  );
}
