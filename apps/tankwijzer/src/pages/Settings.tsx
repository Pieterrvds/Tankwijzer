import { useState } from "react";
import { LABELS_NL, type Site, type TriState } from "@tankwijzer/vlarem-core";
import { api } from "../api.ts";
import { useMe } from "../App.tsx";
import { ErrorBox, Loading, useAsync } from "../components/ui.tsx";

function SiteRow({ site, onSaved }: { site: Site; onSaved: () => void }) {
  const [s, setS] = useState(site);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    const { id: _i, companyId: _c, ...body } = s;
    await api.put(`/sites/${site.id}`, body);
    setMsg("Bewaard.");
    onSaved();
  };
  const triSelect = (value: TriState, onChange: (v: TriState) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value as TriState)}>
      {Object.entries(LABELS_NL.tri).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
  return (
    <li className="card grid-2">
      <label className="field">
        <span>Naam</span>
        <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Adres</span>
        <input value={s.address ?? ""} onChange={(e) => setS({ ...s, address: e.target.value || null })} />
      </label>
      <label className="field">
        <span>In waterwingebied of beschermingszone?</span>
        {triSelect(s.inWaterProtectionZone, (v) => setS({ ...s, inWaterProtectionZone: v }))}
      </label>
      <label className="field">
        <span>Koolwaterstofafscheider (KWS) aanwezig?</span>
        {triSelect(s.kwsSeparatorPresent, (v) => setS({ ...s, kwsSeparatorPresent: v }))}
      </label>
      <div className="actions">
        <button className="btn btn-small" onClick={save}>
          Bewaren
        </button>
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </li>
  );
}

export function SettingsPage() {
  const { me, refresh } = useMe();
  const sites = useAsync(() => api.get<Site[]>("/sites"));
  const members = useAsync(() => api.get<{ id: string; email: string; role: string }[]>("/company/members"));
  const [newSite, setNewSite] = useState("");
  const [invite, setInvite] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!sites.data || !members.data) return <Loading />;
  const company = me.company!;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stack">
      <h1>Instellingen</h1>
      <ErrorBox message={error} />
      {msg && <p className="alert alert-ok">{msg}</p>}

      <section className="card stack-sm">
        <h2>{company.name}</h2>
        <p>
          Plan: <strong>{company.plan === "free" ? "Gratis" : "Pro"}</strong>
          {me.limits?.tankLimit !== null && me.limits && (
            <> — {me.limits.tankCount} van {me.limits.tankLimit} tanks gebruikt</>
          )}
        </p>
        {company.plan === "free" && (
          <p className="muted small">
            Het betalend plan voor bedrijven met een tankpark (onbeperkt tanks, meerdere sites, team, e-mailherinneringen) komt
            binnenkort. Keuringsaanvragen blijven altijd gratis.
          </p>
        )}
      </section>

      <section className="stack-sm">
        <h2 className="section-title">Sites</h2>
        <ul className="doc-list">
          {sites.data.map((s) => (
            <SiteRow key={s.id} site={s} onSaved={sites.reload} />
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newSite.trim()) return;
            void run(async () => {
              await api.post("/sites", { name: newSite.trim() });
              setNewSite("");
              await sites.reload();
            }, "Site toegevoegd.");
          }}
        >
          <input value={newSite} onChange={(e) => setNewSite(e.target.value)} placeholder="Naam van een nieuwe site" />
          <button className="btn">Site toevoegen</button>
        </form>
      </section>

      <section className="card stack-sm">
        <h2>Team</h2>
        <ul>
          {members.data.map((m) => (
            <li key={m.id}>
              {m.email} <span className="muted small">({m.role === "admin" ? "beheerder" : "lid"})</span>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.post("/company/members", { email: invite });
              setInvite("");
              await members.reload();
            }, "Uitnodiging verstuurd.");
          }}
        >
          <input type="email" required value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="collega@bedrijf.be" />
          <button className="btn">Uitnodigen</button>
        </form>
      </section>

      <section className="card stack-sm">
        <h2>Uw gegevens</h2>
        <p>U bent eigenaar van uw gegevens. Download alles wat Tankwijzer over uw bedrijf bewaart, of verwijder alles definitief.</p>
        <a className="btn" href="/api/export" download>
          Alles downloaden (JSON)
        </a>
        <details>
          <summary>Alles verwijderen</summary>
          <div className="stack-sm">
            <p className="small">
              Dit verwijdert definitief uw bedrijf, sites, tanks, documenten, foto's en aanvragen. Typ <strong>{company.name}</strong>{" "}
              om te bevestigen.
            </p>
            <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            <button
              className="btn btn-danger"
              disabled={confirmName.trim() !== company.name}
              onClick={() =>
                run(async () => {
                  await api.del("/company", { confirmName });
                  window.location.href = "/login";
                }, "Alles is verwijderd.")
              }
            >
              Definitief verwijderen
            </button>
          </div>
        </details>
      </section>

      <button
        className="btn"
        onClick={async () => {
          await api.post("/auth/logout");
          await refresh();
          window.location.href = "/login";
        }}
      >
        Afmelden
      </button>
    </div>
  );
}
