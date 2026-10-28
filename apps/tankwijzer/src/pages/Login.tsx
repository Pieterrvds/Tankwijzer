import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { api } from "../api.ts";
import { ErrorBox } from "../components/ui.tsx";

export function LoginPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("fout") === "link" ? "Deze aanmeldlink is verlopen of al gebruikt. Vraag een nieuwe aan." : null,
  );
  const [busy, setBusy] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    api
      .get<{ testMode: boolean }>("/auth/mode")
      .then((m) => setTestMode(m.testMode))
      .catch(() => setTestMode(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ ok: true; devLink?: string }>("/auth/request-link", { email });
      setSent(true);
      setDevLink(res.devLink ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <img src="/icon.svg" alt="" width={56} height={56} />
        <h1>Tankwijzer</h1>
        <p className="lead">
          Welke regels gelden voor uw opslagtanks, wanneer is de volgende keuring en wat moet u klaarleggen? In gewone taal.
        </p>
        {sent ? (
          <div className="alert alert-ok">
            We hebben een aanmeldlink gestuurd naar <strong>{email}</strong>. Klik op de link in de e-mail om verder te gaan.
            {devLink && (
              <p>
                <small>Ontwikkelmodus: </small>
                <a href={devLink}>meld direct aan</a>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="stack">
            <label className="field">
              <span>E-mailadres</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Even geduld…" : "Stuur mij een aanmeldlink"}
            </button>
            <p className="muted small">Geen wachtwoord nodig. Gratis tot 3 tanks.</p>
          </form>
        )}
        <ErrorBox message={error} />
        {testMode && (
          <p className="alert alert-warn small">
            Testversie: u kunt zich aanmelden zonder e-mailcontrole. Voer geen echte bedrijfsgegevens in.
          </p>
        )}
        <p className="disclaimer">Tankwijzer vervangt geen keuring door een erkend milieudeskundige.</p>
      </div>
    </div>
  );
}
