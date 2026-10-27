import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { api, type AskResponse } from "../api.ts";
import { useMe } from "../App.tsx";
import { Disclaimer, ErrorBox, Feedback } from "../components/ui.tsx";

interface Turn {
  question: string;
  answer?: AskResponse;
}

const EXAMPLES = [
  "Wanneer moet mijn tank opnieuw gekeurd worden?",
  "Wat betekent een oranje klever?",
  "Welke documenten moet ik klaarleggen?",
  "Mag ik mijn overvulfluit houden?",
];

export function AskPage() {
  const { me } = useMe();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q: string) => {
    if (q.trim().length < 3) return;
    setBusy(true);
    setError(null);
    const history = turns.filter((t) => t.answer).map((t) => ({ question: t.question, answer: t.answer!.answer_nl }));
    setTurns((ts) => [...ts, { question: q }]);
    setQuestion("");
    try {
      const answer = await api.post<AskResponse>("/ask", { question: q, history });
      setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, answer } : t)));
    } catch (e) {
      setError((e as Error).message);
      setTurns((ts) => ts.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  if (!me.aiEnabled) return <p className="alert alert-info">"Vraag het" is nog niet ingeschakeld op deze installatie.</p>;

  return (
    <div className="stack">
      <h1>Vraag het</h1>
      <p className="muted">
        Antwoorden steunen alleen op de VLAREM-regels in Tankwijzer, uw tankgegevens en uw documenten, met bronvermelding. Weet
        Tankwijzer het niet zeker, dan zegt het dat.
      </p>
      {turns.length === 0 && (
        <div className="chips">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => ask(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="chat">
        {turns.map((t, i) => (
          <div key={i} className="stack-sm">
            <div className="bubble bubble-user">{t.question}</div>
            {t.answer ? (
              <div className="bubble bubble-ai">
                <p>{t.answer.answer_nl}</p>
                {t.answer.citations.length > 0 && (
                  <ul className="citations">
                    {t.answer.citations.map((c) => (
                      <li key={`${c.type}-${c.id}`}>
                        {c.type === "tank" ? <Link to={`/tanks/${c.id}`}>{c.label}</Link> : c.label}
                        {c.type === "rule" && <span className="muted"> ({c.id})</span>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="meta">Regels versie {t.answer.rulesetVersion}</p>
                <Feedback logId={t.answer.logId} />
              </div>
            ) : (
              <div className="bubble bubble-ai muted">Even denken…</div>
            )}
          </div>
        ))}
      </div>
      <ErrorBox message={error} />
      <form className="inline-form" onSubmit={submit}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Stel uw vraag…" maxLength={1000} />
        <button className="btn btn-primary" disabled={busy}>
          Vraag
        </button>
      </form>
      <Disclaimer />
    </div>
  );
}
