import { useState, type FormEvent } from "react";
import { api, formatDate, type TankSummary } from "../api.ts";
import { useMe } from "../App.tsx";
import { ErrorBox, Loading, StickerDot, useAsync } from "../components/ui.tsx";

interface Booking {
  id: string;
  createdAt: string;
  tankIds: string[];
  preferredFrom: string;
  preferredTo: string;
  shareDossier: boolean;
  status: string;
}

export function BookingPage() {
  const { me } = useMe();
  const tanks = useAsync(() => api.get<TankSummary[]>("/tanks"));
  const bookings = useAsync(() => api.get<Booking[]>("/bookings"));
  const [selected, setSelected] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(me.user.email);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [share, setShare] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tanks.data || !bookings.data) return <Loading />;

  const send = async (consent: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/bookings", {
        tankIds: selected,
        preferredFrom: from,
        preferredTo: to,
        contact: { name, email, phone: phone || null },
        message,
        shareDossier: share,
        consent,
      });
      setDone(true);
      setConsentOpen(false);
      await bookings.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return setError("Kies minstens één tank.");
    if (share) setConsentOpen(true);
    else void send(false);
  };

  if (done) {
    return (
      <div className="stack">
        <h1>Aanvraag verstuurd</h1>
        <p className="alert alert-ok">
          Uw aanvraag is verstuurd naar de keuringsinstelling. Zij nemen contact met u op om een datum af te spreken. U krijgt een
          bevestiging per e-mail.
        </p>
        <button className="btn" onClick={() => setDone(false)}>
          Nog een aanvraag
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Keuring aanvragen</h1>
      <p className="muted">Gratis en vrijblijvend. Uw aanvraag gaat naar een erkende keuringsinstelling.</p>
      <form className="stack" onSubmit={submit}>
        <fieldset className="card stack-sm">
          <legend>Welke tanks?</legend>
          {tanks.data.length === 0 && <p className="muted">Voeg eerst een tank toe.</p>}
          {tanks.data.map((t) => (
            <label key={t.tank.id} className="check">
              <input
                type="checkbox"
                checked={selected.includes(t.tank.id)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, t.tank.id] : selected.filter((x) => x !== t.tank.id))
                }
              />
              <StickerDot colour={t.latestSticker} /> {t.tank.label}
              {t.nextDeadline?.dueDate && <span className="muted small"> — {t.nextDeadline.title_nl.toLowerCase()} {formatDate(t.nextDeadline.dueDate)}</span>}
            </label>
          ))}
        </fieldset>
        <fieldset className="card grid-2">
          <legend>Wanneer past het?</legend>
          <label className="field">
            <span>Vanaf</span>
            <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>Tot</span>
            <input type="date" required value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </fieldset>
        <fieldset className="card grid-2">
          <legend>Contactpersoon ter plaatse</legend>
          <label className="field">
            <span>Naam</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Telefoon</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="field">
            <span>Bericht (optioneel)</span>
            <input value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
        </fieldset>
        <label className="check card">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          <span>
            <strong>Deel mijn voorbereide dossier</strong> met de keuringsinstelling (tankgegevens, documenten en foto's), zodat de
            milieudeskundige zich kan voorbereiden.
          </span>
        </label>
        <ErrorBox message={error} />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Versturen…" : "Aanvraag versturen"}
        </button>
      </form>

      {consentOpen && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="modal-card stack-sm">
            <h2 id="consent-title">Toestemming om uw dossier te delen</h2>
            <p>U deelt met de keuringsinstelling:</p>
            <ul>
              <li>de gegevens van de gekozen tanks en hun site(s);</li>
              <li>de documenten die aan deze tanks of sites gekoppeld zijn (met de gegevens die u bevestigd hebt);</li>
              <li>de foto's van "Klaar voor de keuring?" (zonder de beoordeling van Tankwijzer).</li>
            </ul>
            <p className="small muted">
              De keuringsinstelling ziet deze gegevens als "volgens exploitant": ze worden ter plaatse gecontroleerd en bepalen het
              resultaat van de keuring niet. De link naar het dossier is 90 dagen geldig.
            </p>
            <div className="actions">
              <button className="btn btn-primary" disabled={busy} onClick={() => send(true)}>
                Ik geef toestemming en verstuur
              </button>
              <button className="btn" onClick={() => setConsentOpen(false)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {bookings.data.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">Eerdere aanvragen</h2>
          <ul className="doc-list">
            {bookings.data.map((b) => (
              <li key={b.id} className="card small">
                {formatDate(b.createdAt)} — {b.tankIds.length} tank(s), periode {formatDate(b.preferredFrom)} tot {formatDate(b.preferredTo)}
                {b.shareDossier && " · dossier gedeeld"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
