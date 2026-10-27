import { useState, type FormEvent } from "react";
import type { TriState } from "@tankwijzer/vlarem-core";
import { api } from "../api.ts";
import { ChoiceGrid, ErrorBox } from "../components/ui.tsx";
import { Pictures } from "../components/pictures.tsx";

export function OnboardingPage({ onDone }: { onDone: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [vat, setVat] = useState("");
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [wpz, setWpz] = useState<TriState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/company", {
        name,
        vatNumber: vat || null,
        site: { name: siteName || "Hoofdsite", address: address || null, inWaterProtectionZone: wpz },
      });
      await onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card stack wide" onSubmit={submit}>
        <h1>Welkom bij Tankwijzer</h1>
        <p className="lead">Eerst even uw bedrijf en de plaats waar uw tanks staan.</p>
        <label className="field">
          <span>Bedrijfsnaam</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Ondernemingsnummer (optioneel)</span>
          <input value={vat} onChange={(e) => setVat(e.target.value)} placeholder="BE0123.456.789" />
        </label>
        <label className="field">
          <span>Naam van de site</span>
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="bv. Hoofdzetel Gent" />
        </label>
        <label className="field">
          <span>Adres (optioneel)</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <ChoiceGrid
          label="Ligt de site in een waterwingebied of beschermingszone?"
          help="Dat staat in uw omgevingsvergunning, of vraag het aan uw gemeente. Weet u het niet? Dan rekenen we voorzichtig."
          value={wpz}
          onChange={setWpz}
          options={[
            { value: "yes", label: "Ja", picture: Pictures.water },
            { value: "no", label: "Nee", picture: Pictures.noBund },
            { value: "unknown", label: "Weet ik niet", picture: Pictures.unknown },
          ]}
        />
        <ErrorBox message={error} />
        <button className="btn btn-primary" disabled={busy}>
          Verder
        </button>
      </form>
    </div>
  );
}
