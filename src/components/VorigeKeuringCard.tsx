import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { isAssistantConfigured, kickQueue } from '../ai/queue';
import { extractReportText } from '../capture/report';
import { repo } from '../db/repository';
import type { Inspection } from '../domain/schemas';
import { formatDate } from '../lib/format';
import { kickSync } from '../sync/sync';

const KLEVER: Record<string, string> = {
  groen: 'bg-ok text-white',
  oranje: 'bg-amber-500 text-gray-950',
  rood: 'bg-nok text-white',
};

/** Pick a PDF/Word file; the text is read on the phone, the assistant reads it when online. */
export function ReportPicker({ inspectionId, label }: { inspectionId: string; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await extractReportText(file);
      if (text.trim().length < 50)
        throw new Error('Er staat (bijna) geen tekst in dit bestand. Is het een scan?');
      await repo.setPreviousReport(inspectionId, file.name, text);
      void kickQueue();
      kickSync();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bestand kon niet gelezen worden.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="min-h-14 w-full rounded-xl border-2 border-brand px-4 font-semibold text-brand disabled:opacity-50"
      >
        {busy ? 'Verslag lezen…' : label}
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-sm font-semibold text-nok">{error}</p>}
    </>
  );
}

/** "Vorige keuring": what the previous report said, at the top of the inspection. */
export function VorigeKeuringCard({ inspection }: { inspection: Inspection }) {
  const report = inspection.vorigVerslag;
  const v = inspection.vorigeKeuring;
  const [open, setOpen] = useState(false);
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const configured = isAssistantConfigured(settings);

  if (!report) {
    return (
      <section className="rounded-2xl border-2 border-dashed border-gray-300 p-4">
        <h2 className="mb-1 text-lg font-bold">Vorige keuring</h2>
        <p className="mb-3 text-gray-700">
          Voeg het vorige verslag toe (PDF of Word). De assistent leest het en gebruikt het bij elke
          vraag.
        </p>
        <ReportPicker inspectionId={inspection.id} label="Vorig verslag toevoegen" />
      </section>
    );
  }

  const facts = report.facts;
  return (
    <section className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Vorige keuring</h2>
        {v.stickerkleur && (
          <span
            className={`rounded px-2 py-0.5 text-sm font-bold uppercase ${KLEVER[v.stickerkleur]}`}
          >
            {v.stickerkleur}
          </span>
        )}
        {v.datum && <span className="text-gray-800">{formatDate(v.datum)}</span>}
      </div>

      {report.status === 'wachtend' && !configured && (
        <Link to="/instellingen" className="mb-2 block font-semibold text-brand underline">
          Verbind de assistent (Instellingen) om “{report.fileName}” te laten lezen.
        </Link>
      )}
      {report.status !== 'klaar' && (report.status !== 'wachtend' || configured) && (
        <p className="mb-2 text-gray-800">
          {report.status === 'mislukt'
            ? `Lezen mislukt: ${report.error ?? 'onbekende fout'}`
            : report.status === 'bezig'
              ? 'De assistent leest het verslag…'
              : `“${report.fileName}” wordt gelezen zodra er netwerk is. Vragen kunnen al gesteld worden.`}
        </p>
      )}
      {report.status === 'mislukt' && (
        <button
          type="button"
          className="mb-2 min-h-10 font-semibold text-brand underline"
          onClick={() =>
            void repo.setPreviousReportStatus(inspection.id, 'wachtend').then(kickQueue)
          }
        >
          Opnieuw proberen
        </button>
      )}

      {facts && (
        <>
          <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {v.lekdetectieType && (
              <>
                <dt className="text-gray-700">Lekdetectie</dt>
                <dd className="font-semibold">{v.lekdetectieType}</dd>
              </>
            )}
            {v.overvulsysteemType && (
              <>
                <dt className="text-gray-700">Overvulling</dt>
                <dd className="font-semibold">{v.overvulsysteemType}</dd>
              </>
            )}
            {facts.peilmeter && (
              <>
                <dt className="text-gray-700">Peilmeter</dt>
                <dd className="font-semibold">{facts.peilmeter}</dd>
              </>
            )}
            {inspection.product.naam && (
              <>
                <dt className="text-gray-700">Product</dt>
                <dd className="font-semibold">{inspection.product.naam}</dd>
              </>
            )}
          </dl>
          <button
            type="button"
            className="min-h-10 font-semibold text-brand underline"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Samenvatting verbergen' : 'Samenvatting tonen'}
          </button>
          {open && <p className="mt-1 whitespace-pre-wrap">{facts.samenvatting}</p>}
        </>
      )}

      {v.openOpmerkingen.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 font-semibold">
            Aandachtspunten ({v.openOpmerkingen.filter((r) => !r.checked).length} open)
          </p>
          <ul className="space-y-1">
            {v.openOpmerkingen.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-12 items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-7 w-7 shrink-0"
                    checked={r.checked}
                    onChange={(e) =>
                      void repo
                        .setRemarkChecked(inspection.id, r.id, e.target.checked)
                        .then(kickSync)
                    }
                  />
                  <span className={r.checked ? 'text-gray-500 line-through' : ''}>
                    {r.text}
                    {/volgende keuring/i.test(r.text) && !r.checked && (
                      <span className="ml-1 rounded bg-amber-300 px-1 text-xs font-bold">
                        deze keuring
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <ReportPicker inspectionId={inspection.id} label="Ander verslag kiezen" />
      </div>
    </section>
  );
}
