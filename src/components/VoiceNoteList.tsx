import { useLiveQuery } from 'dexie-react-hooks';
import { askConfirm } from '../lib/confirm';
import { formatDuration } from '../capture/audio';
import { db, type VoiceNoteRecord } from '../db/db';
import { repo } from '../db/repository';
import type { Inspection } from '../domain/schemas';
import { formatDateTime } from '../lib/format';
import { useObjectUrl } from '../lib/hooks';
import { ItemPicker } from './ItemPicker';

const TRANSCRIPTION_LABEL: Record<VoiceNoteRecord['transcription']['status'], string> = {
  wachtend: 'Wacht op transcriptie (zodra online)',
  bezig: 'Transcriptie bezig…',
  klaar: 'Getranscribeerd',
  mislukt: 'Transcriptie mislukt',
};

function VoiceNote({
  note,
  inspection,
  showPicker,
}: {
  note: VoiceNoteRecord;
  inspection: Inspection;
  showPicker: boolean;
}) {
  const url = useObjectUrl(note.blob);
  return (
    <li className="rounded-xl border-2 border-gray-200 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {note.label} · {formatDuration(note.durationMs)}
        </span>
        <span className="text-sm text-gray-600">{formatDateTime(note.recordedAt)}</span>
      </div>
      {url && <audio controls src={url} className="w-full" preload="metadata" />}
      {note.transcription.text ? (
        <p className="mt-2 whitespace-pre-wrap">{note.transcription.text}</p>
      ) : (
        <p className="mt-2 text-sm text-gray-600">
          {TRANSCRIPTION_LABEL[note.transcription.status]}
        </p>
      )}
      {showPicker && (
        <div className="mt-2">
          <ItemPicker
            inspection={inspection}
            label="Koppel aan item"
            value={note.itemId}
            onChange={(itemId) => void repo.updateVoiceNote(note.id, { itemId })}
          />
        </div>
      )}
      <button
        type="button"
        onClick={() =>
          void askConfirm(`${note.label} verwijderen?`).then((ok) => {
            if (ok) void repo.deleteVoiceNote(note.id);
          })
        }
        className="mt-2 min-h-12 rounded-lg px-3 font-semibold text-nok"
      >
        Verwijderen
      </button>
    </li>
  );
}

/** Voice notes for one item, or the unassigned ones when itemId = null. */
export function VoiceNoteList({
  inspection,
  itemId,
}: {
  inspection: Inspection;
  itemId: string | null;
}) {
  const notes = useLiveQuery(
    () =>
      db.voiceNotes
        .where('inspectionId')
        .equals(inspection.id)
        .filter((n) => n.itemId === itemId)
        .sortBy('recordedAt'),
    [inspection.id, itemId],
  );
  if (!notes?.length) return null;
  return (
    <ul className="mt-2 space-y-2">
      {notes.map((n) => (
        <VoiceNote key={n.id} note={n} inspection={inspection} showPicker={itemId === null} />
      ))}
    </ul>
  );
}
