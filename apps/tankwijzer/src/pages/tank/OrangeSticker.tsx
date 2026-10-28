import { useState } from "react";
import type { OrangeFinding, VaultDocument } from "@tankwijzer/vlarem-core";
import { api, formatDate, type TankDetail } from "../../api.ts";
import { Disclaimer, ErrorBox } from "../../components/ui.tsx";
import { uploadForm } from "../../upload.ts";

export function OrangeSticker({ detail, onChange }: { detail: TankDetail; onChange: () => void }) {
  const { tank, latestSticker, evaluation } = detail;
  const [findings, setFindings] = useState<OrangeFinding[]>(tank.orangeFindings);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deadline = evaluation.deadlines.find((d) => d.kind === "orange_reinspection");

  const save = async (next: OrangeFinding[]) => {
    setError(null);
    try {
      await api.put(`/tanks/${tank.id}/orange-findings`, { findings: next });
      setFindings(next);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const uploadProof = async (finding: OrangeFinding, file: File) => {
    try {
      const form = await uploadForm(file, { kind: "repair_proof", tankIds: tank.id });
      const res = await api.post<{ document: VaultDocument }>("/documents", form);
      await save(findings.map((f) => (f.id === finding.id ? { ...f, proofDocumentIds: [...f.proofDocumentIds, res.document.id] } : f)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stack">
      {latestSticker === "red" ? (
        <div className="alert alert-error">
          <strong>Rode klever: de tank mag niet meer gevuld worden.</strong> De milieudeskundige meldt dit binnen 14 dagen aan de
          overheid. Laat de tank herstellen en opnieuw keuren.
        </div>
      ) : (
        <div className="alert alert-warn">
          <strong>Oranje klever{deadline?.dueDate ? `: herkeuring vóór ${formatDate(deadline.dueDate)}` : ""}.</strong> De tank
          is niet in orde, maar er is geen risico op lekken buiten de tank. U mag hem nog maximaal 6 maanden vullen. Een oranje
          klever wordt maar één keer gegeven voor dezelfde tekortkomingen: zijn ze bij de herkeuring niet hersteld, dan volgt een
          rode klever en mag de tank niet meer gevuld worden.
        </div>
      )}

      <section className="card stack-sm">
        <h3>Wat werd vastgesteld?</h3>
        <p className="muted small">Neem de opmerkingen over uit het keuringsverslag, of verwerk het verslag via de documentenkluis.</p>
        <ul className="findings">
          {findings.map((f) => (
            <li key={f.id} className={f.resolved ? "resolved" : ""}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={f.resolved}
                  onChange={(e) => save(findings.map((x) => (x.id === f.id ? { ...x, resolved: e.target.checked } : x)))}
                />
                {f.text}
              </label>
              <span className="muted small">
                {f.proofDocumentIds.length > 0 ? `${f.proofDocumentIds.length} bewijs(stuk)` : "nog geen bewijs van herstelling"}
              </span>
              <label className="btn btn-small">
                Bewijs toevoegen
                <input hidden type="file" accept="application/pdf,image/*" onChange={(e) => e.target.files?.[0] && uploadProof(f, e.target.files[0])} />
              </label>
              <button type="button" className="link-btn" onClick={() => save(findings.filter((x) => x.id !== f.id))}>
                verwijderen
              </button>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            void save([...findings, { id: `new-${Date.now()}`, text: text.trim(), resolved: false, proofDocumentIds: [] }]);
            setText("");
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Opmerking uit het verslag" />
          <button className="btn">Toevoegen</button>
        </form>
        <ErrorBox message={error} />
      </section>
      <p className="muted small">U krijgt een herinnering 3 maanden en 1 maand vóór de deadline.</p>
      <Disclaimer />
    </div>
  );
}
