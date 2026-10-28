import { useState } from "react";
import { Link } from "react-router";
import type { DocumentCheck, Tank } from "@tankwijzer/vlarem-core";
import { api } from "../../api.ts";
import { ErrorBox } from "../../components/ui.tsx";
import { uploadForm } from "../../upload.ts";

export function TankDocuments({ tank, checks, onChange }: { tank: Tank; checks: DocumentCheck[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (kind: string, file: File) => {
    setBusy(kind);
    setError(null);
    try {
      // The permit is a site document; everything else belongs to this tank.
      const form = await uploadForm(
        file,
        kind === "omgevingsvergunning" ? { kind, siteId: tank.siteId } : { kind, tankIds: tank.id },
      );
      await api.post("/documents", form);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const missing = checks.filter((c) => !c.present).length;
  return (
    <div className="stack">
      <p>
        {missing === 0
          ? "Alle documenten die een milieudeskundige meestal vraagt, staan in uw kluis."
          : `Er ontbreken ${missing} document(en). Ontbrekende documenten zijn een vaak voorkomende opmerking in keuringsverslagen.`}
      </p>
      <ErrorBox message={error} />
      <ul className="checklist">
        {checks.map((c) => (
          <li key={c.kind} className={c.present ? "present" : "missing"}>
            <span className="check-icon" aria-hidden="true">
              {c.present ? "✓" : "!"}
            </span>
            <div>
              <strong>{c.label_nl}</strong>
              <p className="muted small">{c.why_nl}</p>
            </div>
            {!c.present && (
              <label className="btn btn-small">
                {busy === c.kind ? "Uploaden…" : "Toevoegen"}
                <input hidden type="file" accept="application/pdf,image/*" onChange={(e) => e.target.files?.[0] && upload(c.kind, e.target.files[0])} />
              </label>
            )}
          </li>
        ))}
      </ul>
      <Link to="/documenten">Naar de documentenkluis</Link>
    </div>
  );
}
