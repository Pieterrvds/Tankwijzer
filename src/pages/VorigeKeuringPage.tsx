import { useState } from 'react';
import { askConfirm } from '../lib/confirm';
import { Layout } from '../components/Layout';
import { Button, Card, ChoiceField, SectionHeading, TextArea, TextField } from '../components/ui';
import { repo } from '../db/repository';
import { newId, splitRemarks } from '../domain/factories';
import type { Inspection, PreviousInspection } from '../domain/schemas';
import { useAutosave } from '../lib/hooks';
import { InspectionNotFound, Loading } from './NotFound';
import { useInspection } from './useInspection';

type Fields = Omit<PreviousInspection, 'openOpmerkingen'>;

function VorigeKeuringForm({ inspection }: { inspection: Inspection }) {
  const { openOpmerkingen, ...initial } = inspection.vorigeKeuring;
  const [form, setForm] = useState<Fields>(initial);
  const [paste, setPaste] = useState('');
  useAutosave(form, (f) =>
    repo.updateInspection(inspection.id, (d) => {
      d.vorigeKeuring = { ...d.vorigeKeuring, ...f };
    }),
  );
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setForm((cur) => ({ ...cur, [k]: v }));

  const updateRemarks = (
    change: (r: PreviousInspection['openOpmerkingen']) => PreviousInspection['openOpmerkingen'],
  ) =>
    repo.updateInspection(inspection.id, (d) => {
      d.vorigeKeuring.openOpmerkingen = change(d.vorigeKeuring.openOpmerkingen);
    });

  return (
    <>
      <p className="mb-4 text-gray-700">
        Neem de kerngegevens over uit het vorige verslag. Open opmerkingen (bv. “tegen volgende
        keuring …”) worden herinneringen: <strong>deze keuring is die volgende keuring</strong>.
      </p>
      <TextField
        label="Datum vorige keuring"
        type="date"
        value={form.datum}
        onChange={(v) => set('datum', v)}
      />
      <TextField
        label="Verslagnummer vorige keuring"
        value={form.verslagnummer}
        onChange={(v) => set('verslagnummer', v)}
      />
      <TextField
        label="Type lekdetectie"
        value={form.lekdetectieType}
        onChange={(v) => set('lekdetectieType', v)}
        placeholder="bv. kijkglas, vacuüm, …"
      />
      <TextField
        label="Type systeem tegen overvulling"
        value={form.overvulsysteemType}
        onChange={(v) => set('overvulsysteemType', v)}
        placeholder="bv. alarmfluit, overvulbeveiliging, …"
      />
      <ChoiceField
        label="Kleur klever"
        value={form.stickerkleur}
        onChange={(v) => set('stickerkleur', v)}
        options={[
          { value: 'groen', label: 'Groen' },
          { value: 'oranje', label: 'Oranje' },
          { value: 'rood', label: 'Rood' },
        ]}
      />
      <TextArea
        label="Andere notities"
        value={form.notities}
        onChange={(v) => set('notities', v)}
      />

      <SectionHeading>Open opmerkingen</SectionHeading>
      {openOpmerkingen.length === 0 && <p className="mb-3 text-gray-700">Nog geen opmerkingen.</p>}
      <ul className="mb-4 space-y-2">
        {openOpmerkingen.map((r) => (
          <li key={r.id}>
            <Card className={r.checked ? 'border-ok' : 'border-amber-400'}>
              <p className="mb-2 whitespace-pre-wrap">{r.text}</p>
              <div className="flex flex-wrap gap-2">
                <label className="flex min-h-12 flex-1 items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    className="h-7 w-7"
                    checked={r.checked}
                    onChange={(e) =>
                      void updateRemarks((all) =>
                        all.map((x) => (x.id === r.id ? { ...x, checked: e.target.checked } : x)),
                      )
                    }
                  />
                  Nagekeken
                </label>
                <button
                  type="button"
                  className="min-h-12 px-3 font-semibold text-nok"
                  onClick={() =>
                    void askConfirm('Opmerking verwijderen?').then((ok) => {
                      if (ok) void updateRemarks((all) => all.filter((x) => x.id !== r.id));
                    })
                  }
                >
                  Verwijderen
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <TextArea
        label="Opmerkingen plakken (één per lijn)"
        value={paste}
        onChange={setPaste}
        rows={4}
      />
      <Button
        className="w-full"
        disabled={splitRemarks(paste).length === 0}
        onClick={() => {
          const added = splitRemarks(paste).map((text) => ({ id: newId(), text, checked: false }));
          void updateRemarks((all) => [...all, ...added]).then(() => setPaste(''));
        }}
      >
        Toevoegen
      </Button>
    </>
  );
}

export function VorigeKeuringPage() {
  const { id, inspection } = useInspection();
  if (inspection === undefined) return <Loading />;
  if (inspection === null) return <InspectionNotFound />;
  return (
    <Layout title="Vorige keuring" subtitle={inspection.klant} back={`/inspectie/${id}`}>
      <VorigeKeuringForm inspection={inspection} />
    </Layout>
  );
}
