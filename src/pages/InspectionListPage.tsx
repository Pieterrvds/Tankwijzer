import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checklistProgress } from '../checklist';
import { Layout } from '../components/Layout';
import { Button, Card, ProgressBar, TextField } from '../components/ui';
import { db } from '../db/db';
import { repo } from '../db/repository';
import { tankLabel, todayIsoDate } from '../domain/factories';
import { VERSLAGNUMMER_PATTERN } from '../domain/schemas';
import { formatDate } from '../lib/format';

function NewInspectionForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [klant, setKlant] = useState('');
  const [plaats, setPlaats] = useState('');
  const [datum, setDatum] = useState(todayIsoDate());
  const [verslagnummer, setVerslagnummer] = useState('');
  const verslagError =
    verslagnummer && !VERSLAGNUMMER_PATTERN.test(verslagnummer)
      ? 'Formaat: bepo.JJ.XXXX (bv. bepo.26.0142)'
      : null;

  async function create() {
    const inspection = await repo.createInspection({
      klant: klant.trim(),
      plaatsVanOnderzoek: plaats.trim(),
      datum,
      verslagnummer: verslagnummer.trim(),
    });
    navigate(`/inspectie/${inspection.id}/gegevens/tank`);
  }

  return (
    <Card className="mb-6 border-brand">
      <h2 className="mb-3 text-xl font-bold">Nieuwe inspectie</h2>
      <TextField label="Klant" value={klant} onChange={setKlant} />
      <TextField label="Plaats van onderzoek" value={plaats} onChange={setPlaats} />
      <TextField label="Datum" type="date" value={datum} onChange={setDatum} />
      <TextField
        label="Verslagnummer (optioneel)"
        value={verslagnummer}
        onChange={setVerslagnummer}
        placeholder="bepo.26.0001"
        error={verslagError}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuleren
        </Button>
        <Button onClick={() => void create()} disabled={!klant.trim() || !datum || !!verslagError}>
          Starten
        </Button>
      </div>
    </Card>
  );
}

export function InspectionListPage() {
  const inspections = useLiveQuery(() => db.inspections.orderBy('updatedAt').reverse().toArray());
  const [creating, setCreating] = useState(false);

  return (
    <Layout
      title="KeurKompas"
      subtitle="Je kompas op het terrein"
      bottom={
        !creating && (
          <Button className="w-full" onClick={() => setCreating(true)}>
            + Nieuwe inspectie
          </Button>
        )
      }
    >
      {creating && <NewInspectionForm onCancel={() => setCreating(false)} />}

      {inspections?.length === 0 && !creating && (
        <Card className="text-center">
          <p className="mb-2 text-lg font-semibold">Nog geen inspecties</p>
          <p className="text-gray-700">
            Start een nieuwe inspectie. Alles wordt op dit toestel bewaard en werkt ook zonder
            netwerk.
          </p>
        </Card>
      )}

      <ul className="space-y-3">
        {inspections?.map((i) => {
          const p = checklistProgress(i);
          return (
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
                  {[i.plaatsVanOnderzoek, tankLabel(i)].filter(Boolean).join(' — ')}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar {...p} />
                  <span className="shrink-0 text-sm font-semibold">
                    {p.done}/{p.total}
                  </span>
                </div>
                {i.status === 'afgesloten' && (
                  <span className="mt-2 inline-block rounded bg-gray-200 px-2 text-sm font-semibold">
                    Afgesloten
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Layout>
  );
}
