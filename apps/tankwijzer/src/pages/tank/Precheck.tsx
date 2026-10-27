import { useState } from "react";
import type { PrecheckStep } from "@tankwijzer/vlarem-core";
import { api, formatDate, type PrecheckResult } from "../../api.ts";
import { useMe } from "../../App.tsx";
import { Disclaimer, ErrorBox, Feedback, Loading, StatusBadge, useAsync } from "../../components/ui.tsx";

interface StepState {
  photoId: string;
  takenAt: string;
  result: PrecheckResult | null;
  logId?: string;
}

export function Precheck({ tankId }: { tankId: string }) {
  const { me } = useMe();
  const steps = useAsync(() => api.get<PrecheckStep[]>("/precheck/steps"));
  const state = useAsync(() => api.get<{ steps: Record<string, StepState> }>(`/tanks/${tankId}/precheck`), [tankId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (steps.loading || state.loading || !steps.data || !state.data) return <Loading />;
  if (!me.aiEnabled) {
    return <p className="alert alert-info">De foto-check is nog niet ingeschakeld op deze installatie.</p>;
  }

  const upload = async (step: string, file: File) => {
    setBusy(step);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const res = await api.post<{ logId: string; photoId: string; result: PrecheckResult }>(`/tanks/${tankId}/precheck/${step}`, form);
      state.setData({
        steps: {
          ...state.data!.steps,
          [step]: { photoId: res.photoId, takenAt: new Date().toISOString(), result: res.result, logId: res.logId },
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <p>
        Loop even rond de tank en neem bij elke stap een foto. Tankwijzer wijst op <em>mogelijke</em> aandachtspunten en zegt wat de
        regel vraagt, zodat u ze vóór de keuring kunt laten nakijken.
      </p>
      <ErrorBox message={error} />
      {steps.data.map((s, i) => {
        const st = state.data!.steps[s.id];
        return (
          <section key={s.id} className="card stack-sm">
            <h3>
              {i + 1}. {s.title_nl}
            </h3>
            <p className="muted">{s.instruction_nl}</p>
            <label className="btn">
              {busy === s.id ? "Foto wordt bekeken…" : st ? "Nieuwe foto nemen" : "Foto nemen"}
              <input
                hidden
                type="file"
                accept="image/*"
                capture="environment"
                disabled={busy !== null}
                onChange={(e) => e.target.files?.[0] && upload(s.id, e.target.files[0])}
              />
            </label>
            {st?.result && (
              <div className="stack-sm">
                <div className="precheck-photo">
                  <img src={`/api/precheck-photos/${st.photoId}`} alt={`Foto: ${s.title_nl}`} />
                  <span className="muted small">Genomen op {formatDate(st.takenAt)}</span>
                </div>
                {st.result.photoQuality === "retake" ? (
                  <p className="alert alert-info">{st.result.retakeReason ?? "Neem een betere foto."}</p>
                ) : (
                  <ul className="points">
                    {st.result.points.map((p) => (
                      <li key={p.ruleId}>
                        <StatusBadge status={p.status} />
                        <p>{p.observation_nl}</p>
                        {p.status !== "likely_ok" && (
                          <p className="small">
                            <strong>Wat de regel vraagt:</strong> {p.requirement_nl}
                          </p>
                        )}
                        <p className="meta">{p.article}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {st.logId && <Feedback logId={st.logId} />}
              </div>
            )}
          </section>
        );
      })}
      <Disclaimer />
    </div>
  );
}
