import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { kickQueue } from '../ai/queue';
import { extractReportText } from '../capture/report';
import { Layout } from '../components/Layout';
import { SyncBadge } from '../components/SyncBadge';
import { Button, Card, TextField } from '../components/ui';
import { db } from '../db/db';
import { repo } from '../db/repository';
import { tankLabel, todayIsoDate } from '../domain/factories';
import { VERSLAGNUMMER_PATTERN } from '../domain/schemas';
import { formatDate } from '../lib/format';

function NewInspectionForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [klant, setKlant] = useState('');
  const [plaats, setPlaats] = useState('');
  const [tank, setTank] = useState('');
  const [datum, setDatum] = useState(todayIsoDate());
  const [verslagnummer, setVerslagnummer] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verslagError =
    verslagnummer && !VERSLAGNUMMER_PATTERN.test(verslagnummer)
      ? 'Formaat: bepo.JJ.XXXX (bv. bepo.26.0142)'
      : null;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      // Read the report first, so a bad file does not leave a half-made inspection.
      const text = file ? await extractReportText(file) : null;
      const inspection = await repo.createInspection({
        klant: klant.trim(),
        plaatsVanOnderzoek: plaats.trim(),
        omschrijving: tank.trim(),
        datum,
        verslagnummer: verslagnummer.trim(),
      });
      if (file && text) {
        await repo.setPreviousReport(inspection.id, file.name, text);
        void kickQueue();
      }
      navigate(`/inspectie/${inspection.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis.');
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 border-brand">
      <h2 className="mb-3 text-xl font-bold">Nieuwe keuring</h2>
      <TextField label="Klant" value={klant} onChange={setKlant} />
      <TextField
        label="Tank"
        value={tank}
        onChange={setTank}
        placeholder="bv. Tank 3 — mazout 5 000 l"
      />
      <TextField label="Plaats van onderzoek" value={plaats} onChange={setPlaats} />
      <TextField label="Datum" type="date" value={datum} onChange={setDatum} />
      <TextField
        label="Verslagnummer (optioneel)"
        value={verslagnummer}
        onChange={setVerslagnummer}
        placeholder="bepo.26.0001"
        error={verslagError}
      />
      <label className="mb-3 block">
        <span className="mb-1 block font-semibold">Vorig verslag (PDF of Word, optioneel)</span>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-xl border-2 border-gray-400 p-3 text-base"
        />
      </label>
      {error && <p className="mb-2 font-semibold text-nok">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuleren
        </Button>
        <Button
          onClick={() => void create()}
          disabled={busy || !klant.trim() || !datum || !!verslagError}
        >
          {busy ? 'Bezig…' : 'Starten'}
        </Button>
      </div>
    </Card>
  );
}

export function InspectionListPage() {
  const inspections = useLiveQuery(() => db.inspections.orderBy('updatedAt').reverse().toArray());
  const proposedLessons = useLiveQuery(() =>
    db.lessen.filter((l) => l.status === 'voorgesteld').count(),
  );
  const [creating, setCreating] = useState(false);

  return (
    <Layout
      title="KeurKompas"
      subtitle="Je kompas op het terrein"
      action={
        <Link
          to="/instellingen"
          className="flex h-14 w-14 items-center justify-center text-2xl"
          aria-label="Instellingen"
        >
          ⚙️
        </Link>
      }
      bottom={
        !creating && (
          <Button className="w-full" onClick={() => setCreating(true)}>
            + Nieuwe keuring
          </Button>
        )
      }
    >
      {import.meta.env.VITE_PREVIEW === 'true' && (
        <Card className="mb-4 border-sky-700 bg-sky-50">
          <p className="font-semibold">Voorbeeldversie</p>
          <p className="text-sm">
            Gegevens blijven in deze browser. Vragen gaan naar Claude via deze pagina (je krijgt een
            toestemmingsvraag). Spraakopname en OneDrive werken alleen in de echte app.
          </p>
        </Card>
      )}

      {creating && <NewInspectionForm onCancel={() => setCreating(false)} />}

      {(proposedLessons ?? 0) > 0 && (
        <Link
          to="/lessen"
          className="mb-4 flex min-h-14 items-center justify-between rounded-xl border-2 border-amber-500 bg-amber-50 px-4 font-semibold"
        >
          <span>Lessen nakijken</span>
          <span>{proposedLessons} voorgesteld ›</span>
        </Link>
      )}

      <div className="mb-4">
        <SyncBadge />
      </div>

      {inspections?.length === 0 && !creating && (
        <Card className="text-center">
          <p className="mb-2 text-lg font-semibold">Nog geen keuringen</p>
          <p className="text-gray-700">
            Start een keuring, voeg het vorige verslag toe, en neem foto’s of notities. Stel een
            vraag wanneer je twijfelt.
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {inspections?.map((i) => (
          <li key={i.id}>
            <Link
              to={`/inspectie/${i.id}`}
              className="block rounded-2xl border-2 border-gray-200 bg-white p-4 active:bg-gray-50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-lg font-bold">{i.klant || 'Zonder klant'}</span>
                <span className="shrink-0 text-gray-700">{formatDate(i.datum)}</span>
              </div>
              <p className="truncate text-gray-700">
                {[tankLabel(i), i.plaatsVanOnderzoek].filter(Boolean).join(' — ')}
              </p>
              {i.vorigVerslag?.facts?.klever && (
                <p className="mt-1 text-sm text-gray-700">
                  Vorige klever: {i.vorigVerslag.facts.klever}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
