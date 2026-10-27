import { useState } from 'react';
import type { ItemDefinition } from '../checklist';
import { statusOf } from '../checklist';
import { repo } from '../db/repository';
import type { Inspection, ItemStatus } from '../domain/schemas';
import { useAutosave } from '../lib/hooks';
import { PhotoCaptureButton } from './PhotoCapture';
import { PhotoStrip } from './PhotoStrip';
import { ChoiceField } from './ui';
import { VoiceNoteList } from './VoiceNoteList';
import { VoiceRecordButton } from './VoiceRecorder';

const STATUS_STYLE: Record<Exclude<ItemStatus, 'NIET_GECONTROLEERD'>, string> = {
  OK: 'border-ok bg-ok text-white',
  NOK: 'border-nok bg-nok text-white',
  NVT: 'border-nvt bg-nvt text-white',
};

const CARD_BORDER: Record<ItemStatus, string> = {
  OK: 'border-ok',
  NOK: 'border-nok',
  NVT: 'border-nvt',
  NIET_GECONTROLEERD: 'border-gray-300',
};

/** OK / NOK / NVT. Tapping the active status again resets it to "nog niet gecontroleerd". */
function StatusButtons({
  value,
  onChange,
}: {
  value: ItemStatus;
  onChange: (s: ItemStatus) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Status">
      {(['OK', 'NOK', 'NVT'] as const).map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? 'NIET_GECONTROLEERD' : s)}
            className={`h-16 rounded-xl border-2 text-xl font-bold ${
              active ? STATUS_STYLE[s] : 'border-gray-400 bg-white text-gray-950 active:bg-gray-100'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

export function ItemCard({ inspection, item }: { inspection: Inspection; item: ItemDefinition }) {
  const state = inspection.items[item.id];
  const status = statusOf(inspection, item.id);
  const nvtReason = status === 'NIET_GECONTROLEERD' ? item.suggestNvt?.(inspection) : null;

  // Text is edited locally and autosaved, so typing never waits for IndexedDB.
  const [beschrijving, setBeschrijving] = useState(state?.beschrijving ?? '');
  const [values, setValues] = useState<Record<string, string>>(state?.values ?? {});
  useAutosave(beschrijving, (b) => repo.updateItem(inspection.id, item.id, { beschrijving: b }));
  useAutosave(values, (v) => repo.updateItem(inspection.id, item.id, { values: v }));

  const [expanded, setExpanded] = useState(false);
  const teBevestigen = state?.teBevestigen ?? false;

  return (
    <article
      id={item.id}
      className={`mb-4 rounded-2xl border-l-8 border-2 bg-white p-4 ${CARD_BORDER[status]}`}
    >
      <header className="mb-3">
        <h3 className="text-lg leading-snug font-bold">{item.label}</h3>
        {item.hint && <p className="text-base text-gray-700">{item.hint}</p>}
      </header>

      {nvtReason && (
        <div className="mb-3 rounded-xl border-2 border-dashed border-nvt bg-gray-50 p-3">
          <p className="text-sm">
            <span className="font-semibold">Voorstel: NVT.</span> {nvtReason}
          </p>
          <button
            type="button"
            onClick={() => void repo.updateItem(inspection.id, item.id, { status: 'NVT' })}
            className="mt-2 min-h-12 rounded-lg border-2 border-nvt px-4 font-semibold"
          >
            NVT overnemen
          </button>
        </div>
      )}

      <StatusButtons
        value={status}
        onChange={(s) => void repo.updateItem(inspection.id, item.id, { status: s })}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <PhotoCaptureButton inspectionId={inspection.id} itemId={item.id} />
        <VoiceRecordButton inspectionId={inspection.id} itemId={item.id} />
      </div>
      <PhotoStrip inspection={inspection} itemId={item.id} />
      <VoiceNoteList inspection={inspection} itemId={item.id} />

      {!expanded && (beschrijving || Object.values(values).some(Boolean) || teBevestigen) && (
        <p className={`mt-3 whitespace-pre-wrap ${teBevestigen ? 'te-bevestigen' : ''}`}>
          {[
            ...(item.fields ?? [])
              .filter((f) => values[f.key])
              .map((f) => `${f.label}: ${values[f.key]}`),
            beschrijving,
          ]
            .filter(Boolean)
            .join(' · ') || 'Te bevestigen'}
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 min-h-12 w-full rounded-xl bg-gray-100 px-3 text-left font-semibold"
        aria-expanded={expanded}
      >
        {expanded ? '▾ Minder' : '▸ Beschrijving en gegevens'}
      </button>

      {expanded && (
        <div className="mt-3">
          {item.fields?.map((f) =>
            f.kind === 'choice' ? (
              <ChoiceField
                key={f.key}
                label={f.label}
                options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
                value={values[f.key] || null}
                onChange={(v) => setValues((cur) => ({ ...cur, [f.key]: v ?? '' }))}
              />
            ) : (
              <label key={f.key} className="mb-3 block">
                <span className="mb-1 block font-semibold">{f.label}</span>
                <input
                  value={values[f.key] ?? ''}
                  inputMode={f.inputMode}
                  onChange={(e) => setValues((cur) => ({ ...cur, [f.key]: e.target.value }))}
                  className="h-14 w-full rounded-xl border-2 border-gray-400 px-3 text-lg"
                />
              </label>
            ),
          )}
          <label className="mb-3 block">
            <span className="mb-1 block font-semibold">Beschrijving</span>
            <textarea
              value={beschrijving}
              onChange={(e) => setBeschrijving(e.target.value)}
              rows={3}
              placeholder={status === 'OK' ? 'Leeg laten als alles OK is' : ''}
              className={`w-full rounded-xl border-2 border-gray-400 p-3 text-lg ${
                teBevestigen ? 'te-bevestigen' : ''
              }`}
            />
          </label>
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input
              type="checkbox"
              checked={teBevestigen}
              onChange={(e) =>
                void repo.updateItem(inspection.id, item.id, { teBevestigen: e.target.checked })
              }
              className="h-7 w-7"
            />
            <span className={teBevestigen ? 'te-bevestigen px-1' : ''}>Te bevestigen</span>
          </label>
        </div>
      )}
    </article>
  );
}
