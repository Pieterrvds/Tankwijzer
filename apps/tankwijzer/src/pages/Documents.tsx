import { useState } from "react";
import { DOCUMENT_KIND_LABELS_NL, type DocumentFacts, type DocumentKind, type Site, type VaultDocument } from "@tankwijzer/vlarem-core";
import { api, formatDate, type DocumentsResponse, type TankSummary } from "../api.ts";
import { ErrorBox, Loading, useAsync } from "../components/ui.tsx";
import { uploadForm } from "../upload.ts";

const emptyFacts = (): DocumentFacts => ({
  permitNumber: null,
  documentDate: null,
  product: null,
  quantity: null,
  sticker: null,
  nextInspectionDate: null,
  openRemarks: [],
  specialConditions: [],
  fabricationNumber: null,
});

function DocumentEditor({
  doc,
  tanks,
  sites,
  onDone,
}: {
  doc: VaultDocument;
  tanks: TankSummary[];
  sites: Site[];
  onDone: () => void;
}) {
  const [d, setD] = useState({ ...doc, facts: doc.facts ?? emptyFacts() });
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const f = d.facts;
  const setFacts = (patch: Partial<DocumentFacts>) => setD({ ...d, facts: { ...f, ...patch } });
  const isReport = d.kind === "inspection_report" || d.kind === "commissioning_report";

  const save = async (confirm: boolean) => {
    setError(null);
    try {
      await api.put(`/documents/${doc.id}`, {
        kind: d.kind,
        title: d.title,
        tankIds: d.tankIds,
        siteId: d.siteId,
        facts: d.facts,
        factsConfirmed: confirm || d.factsConfirmed,
      });
      setD({ ...d, factsConfirmed: confirm || d.factsConfirmed });
      setMsg("Bewaard.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const apply = async (tankId: string) => {
    setError(null);
    try {
      await save(true);
      await api.post(`/documents/${doc.id}/apply-to-tank`, {
        tankId,
        inspectionType: d.kind === "commissioning_report" ? "commissioning" : "limited",
      });
      setMsg("Keuring, klever en opmerkingen zijn bijgewerkt in de tank.");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="doc-editor stack-sm">
      {!d.factsConfirmed && doc.facts && (
        <p className="suggested">Deze gegevens werden automatisch gelezen. Kijk ze na en bevestig.</p>
      )}
      <div className="grid-2">
        <label className="field">
          <span>Soort document</span>
          <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as DocumentKind })}>
            {Object.entries(DOCUMENT_KIND_LABELS_NL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Titel</span>
          <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </label>
        <label className="field">
          <span>Datum van het document</span>
          <input type="date" value={f.documentDate ?? ""} onChange={(e) => setFacts({ documentDate: e.target.value || null })} />
        </label>
        {d.kind === "omgevingsvergunning" && (
          <label className="field">
            <span>Vergunningsnummer</span>
            <input value={f.permitNumber ?? ""} onChange={(e) => setFacts({ permitNumber: e.target.value || null })} />
          </label>
        )}
        {isReport && (
          <>
            <label className="field">
              <span>Klever</span>
              <select value={f.sticker ?? ""} onChange={(e) => setFacts({ sticker: (e.target.value || null) as DocumentFacts["sticker"] })}>
                <option value="">Onbekend</option>
                <option value="green">Groen</option>
                <option value="orange">Oranje</option>
                <option value="red">Rood</option>
              </select>
            </label>
            <label className="field">
              <span>Volgende keuring</span>
              <input
                type="date"
                value={f.nextInspectionDate ?? ""}
                onChange={(e) => setFacts({ nextInspectionDate: e.target.value || null })}
              />
            </label>
          </>
        )}
        {(d.kind === "sds" || d.kind === "omgevingsvergunning") && (
          <label className="field">
            <span>Product</span>
            <input value={f.product ?? ""} onChange={(e) => setFacts({ product: e.target.value || null })} />
          </label>
        )}
      </div>
      {isReport && (
        <label className="field">
          <span>Openstaande opmerkingen (één per lijn)</span>
          <textarea
            rows={3}
            value={f.openRemarks.join("\n")}
            onChange={(e) => setFacts({ openRemarks: e.target.value.split("\n").filter((l) => l.trim()) })}
          />
        </label>
      )}
      {f.specialConditions.length > 0 && (
        <div className="small">
          <strong>Bijzondere voorwaarden:</strong>
          <ul>
            {f.specialConditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <fieldset className="stack-sm">
        <legend>Hoort bij</legend>
        <div className="chips">
          {tanks.map((t) => (
            <label key={t.tank.id} className="check chip">
              <input
                type="checkbox"
                checked={d.tankIds.includes(t.tank.id)}
                onChange={(e) =>
                  setD({ ...d, tankIds: e.target.checked ? [...d.tankIds, t.tank.id] : d.tankIds.filter((x) => x !== t.tank.id) })
                }
              />
              {t.tank.label}
            </label>
          ))}
        </div>
        <label className="field">
          <span>Site (voor documenten van de hele site, zoals de vergunning)</span>
          <select value={d.siteId ?? ""} onChange={(e) => setD({ ...d, siteId: e.target.value || null })}>
            <option value="">—</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => save(true)}>
          Gegevens bevestigen
        </button>
        {isReport &&
          d.tankIds.map((id) => (
            <button key={id} type="button" className="btn" onClick={() => apply(id)}>
              Verwerk in tank {tanks.find((t) => t.tank.id === id)?.tank.label}
            </button>
          ))}
        {msg && <span className="muted">{msg}</span>}
      </div>
      <ErrorBox message={error} />
    </div>
  );
}

export function DocumentsPage() {
  const docs = useAsync(() => api.get<DocumentsResponse>("/documents"));
  const tanks = useAsync(() => api.get<TankSummary[]>("/tanks"));
  const sites = useAsync(() => api.get<Site[]>("/sites"));
  const [kind, setKind] = useState<DocumentKind | "">("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!docs.data || !tanks.data || !sites.data) return docs.error ? <ErrorBox message={docs.error} /> : <Loading />;

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const form = await uploadForm(file, kind ? { kind } : {});
      const res = await api.post<{ document: VaultDocument; extraction: { status: string; message?: string } }>("/documents", form);
      setNotice(
        res.extraction.status === "done"
          ? "Document opgeladen en gelezen. Kijk de gegevens na en koppel het aan een tank of site."
          : (res.extraction.message ?? "Document opgeladen. Vul de gegevens aan en koppel het aan een tank of site."),
      );
      setOpen(res.document.id);
      await docs.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Dit document verwijderen?")) return;
    await api.del(`/documents/${id}`);
    await docs.reload();
  };

  return (
    <div className="stack">
      <h1>Documentenkluis</h1>
      <p className="muted">
        Leg hier de documenten klaar die een milieudeskundige vraagt. Ontbrekende documenten zijn een vaak voorkomende opmerking
        in keuringsverslagen.
      </p>

      <section className="card stack-sm">
        <h2>Document toevoegen</h2>
        <div className="inline-form">
          <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind | "")}>
            <option value="">Soort: laat Tankwijzer raden</option>
            {Object.entries(DOCUMENT_KIND_LABELS_NL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <label className="btn btn-primary">
            {busy ? "Uploaden en lezen…" : "Kies PDF of foto"}
            <input hidden type="file" accept="application/pdf,image/*" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
        {notice && <p className="alert alert-ok">{notice}</p>}
        <ErrorBox message={error} />
      </section>

      {docs.data.checklist.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">Wat ontbreekt er?</h2>
          <div className="checklist-grid">
            {docs.data.checklist.map((c) => (
              <div key={c.tankId} className="card">
                <h3>{c.label}</h3>
                <ul className="checklist compact">
                  {c.documents.map((d) => (
                    <li key={d.kind} className={d.present ? "present" : "missing"}>
                      <span className="check-icon">{d.present ? "✓" : "!"}</span> {d.label_nl}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="stack-sm">
        <h2 className="section-title">Mijn documenten ({docs.data.documents.length})</h2>
        <ul className="doc-list">
          {docs.data.documents.map((d) => (
            <li key={d.id} className="card">
              <div className="doc-row">
                <div>
                  <strong>{d.title}</strong>
                  <p className="muted small">
                    {DOCUMENT_KIND_LABELS_NL[d.kind]} · opgeladen {formatDate(d.uploadedAt)}
                    {d.facts?.documentDate && ` · datum ${formatDate(d.facts.documentDate)}`}
                    {!d.factsConfirmed && d.facts && " · nog na te kijken"}
                  </p>
                </div>
                <div className="actions">
                  <a className="btn btn-small" href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer">
                    Openen
                  </a>
                  <button type="button" className="btn btn-small" onClick={() => setOpen(open === d.id ? null : d.id)}>
                    {open === d.id ? "Sluiten" : "Gegevens"}
                  </button>
                  <button type="button" className="link-btn" onClick={() => remove(d.id)}>
                    verwijderen
                  </button>
                </div>
              </div>
              {open === d.id && <DocumentEditor doc={d} tanks={tanks.data!} sites={sites.data!} onDone={docs.reload} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
