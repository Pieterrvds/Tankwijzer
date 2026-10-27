import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { isAssistantConfigured, kickQueue } from '../ai/queue';
import { formatDuration } from '../capture/audio';
import {
  db,
  type PhotoRecord,
  type QuestionRecord,
  type TextNoteRecord,
  type VoiceNoteRecord,
} from '../db/db';
import { repo } from '../db/repository';
import type { Inspection } from '../domain/schemas';
import { askConfirm } from '../lib/confirm';
import { formatDateTime } from '../lib/format';
import { useObjectUrl } from '../lib/hooks';
import { inspectionFolder } from '../sync/plan';
import { kickSync } from '../sync/sync';
import { AnswerView } from './AnswerView';
import { SectionChip } from './SectionChip';

/** Per item: is it on OneDrive yet? Photos by their own file; notes via notes.md. */
function useSyncInfo(inspection: Inspection) {
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const rows = useLiveQuery(
    () => db.syncState.where('inspectionId').equals(inspection.id).toArray(),
    [inspection.id],
  );
  return useMemo(() => {
    if (!settings?.oneDriveClientId || !rows) return null;
    const folder = inspectionFolder(settings.oneDriveFolder, inspection);
    const byPath = new Map(rows.map((r) => [r.path, r]));
    const notesAt = byPath.get(`${folder}/notes.md`)?.uploadedAt ?? '';
    return {
      photo: (p: PhotoRecord) => byPath.get(`${folder}/photos/${p.fileName}`)?.hash === p.id,
      note: (changedAt: string) => notesAt >= changedAt,
    };
  }, [settings, rows, inspection]);
}

function SyncTick({ synced }: { synced: boolean | null }) {
  if (synced === null) return null;
  return synced ? (
    <span className="text-sm font-semibold text-ok" title="Staat op OneDrive">
      ✓ gesynchroniseerd
    </span>
  ) : (
    <span className="text-sm text-gray-600" title="Wordt geüpload zodra er netwerk is">
      ⇡ wacht
    </span>
  );
}

function CardShell({
  time,
  kind,
  children,
  footer,
}: {
  time: string;
  kind: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <li className="rounded-2xl border-2 border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-sm text-gray-700">
        <span className="font-semibold text-gray-950">{kind}</span>
        <span>{formatDateTime(time)}</span>
      </div>
      {children}
      {footer && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">{footer}</div>
      )}
    </li>
  );
}

function PhotoViewer({ photo, onClose }: { photo: PhotoRecord; onClose: () => void }) {
  const url = useObjectUrl(photo.blob);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal>
      <div className="flex items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 truncate px-2 font-semibold">{photo.fileName}</p>
        <button
          type="button"
          onClick={onClose}
          className="h-14 rounded-xl bg-white px-5 text-lg font-semibold text-gray-950"
        >
          Sluiten
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {url && (
          <img
            src={url}
            alt={photo.omschrijving || photo.fileName}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  synced,
  onAsk,
}: {
  photo: PhotoRecord;
  synced: boolean | null;
  onAsk: (photoId: string) => void;
}) {
  const url = useObjectUrl(photo.blob);
  const [open, setOpen] = useState(false);
  return (
    <CardShell
      time={photo.takenAt ?? photo.createdAt}
      kind="📷 Foto"
      footer={
        <>
          <SectionChip
            tag={photo}
            onChange={(sectie) =>
              void repo
                .tagPhoto(photo.id, {
                  tagStatus: 'handmatig',
                  sectie,
                  omschrijving: photo.omschrijving ?? '',
                })
                .then(kickSync)
            }
          />
          <SyncTick synced={synced} />
        </>
      }
    >
      <button
        type="button"
        className="block w-full overflow-hidden rounded-xl bg-gray-100"
        onClick={() => setOpen(true)}
      >
        {url && (
          <img
            src={url}
            alt={photo.omschrijving || photo.fileName}
            className="max-h-72 w-full object-cover"
          />
        )}
      </button>
      <p className="mt-1 text-sm text-gray-700">
        {photo.omschrijving ? `${photo.omschrijving} · ` : ''}
        {photo.fileName}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onAsk(photo.id)}
          className="min-h-12 rounded-xl border-2 border-brand font-semibold text-brand"
        >
          Vraag het over deze foto
        </button>
        <button
          type="button"
          onClick={() =>
            void askConfirm('Foto verwijderen?').then((ok) => {
              if (ok) void repo.deletePhoto(photo.id);
            })
          }
          className="min-h-12 rounded-xl border-2 border-gray-300 font-semibold text-nok"
        >
          Verwijderen
        </button>
      </div>
      {open && <PhotoViewer photo={photo} onClose={() => setOpen(false)} />}
    </CardShell>
  );
}

const TRANSCRIPT_STATE: Record<VoiceNoteRecord['transcription']['status'], string> = {
  wachtend: 'Wordt uitgeschreven zodra er netwerk is…',
  bezig: 'Wordt uitgeschreven…',
  klaar: '',
  mislukt: 'Uitschrijven mislukt.',
};

function VoiceCard({ note, synced }: { note: VoiceNoteRecord; synced: boolean | null }) {
  const url = useObjectUrl(note.blob);
  return (
    <CardShell
      time={note.recordedAt}
      kind={`🎤 Spraak ${note.label} · ${formatDuration(note.durationMs)}`}
      footer={
        <>
          <SectionChip
            tag={note}
            onChange={(sectie) =>
              void repo
                .tagVoiceNote(note.id, {
                  tagStatus: 'handmatig',
                  sectie,
                  omschrijving: note.omschrijving ?? '',
                })
                .then(kickSync)
            }
          />
          <SyncTick synced={synced} />
        </>
      }
    >
      {url && <audio controls src={url} className="w-full" preload="metadata" />}
      {note.transcription.text ? (
        <p className="mt-2 whitespace-pre-wrap">{note.transcription.text}</p>
      ) : (
        <p className="mt-2 text-sm text-gray-700">{TRANSCRIPT_STATE[note.transcription.status]}</p>
      )}
      {note.transcription.status === 'mislukt' && (
        <button
          type="button"
          className="mt-1 min-h-10 font-semibold text-brand underline"
          onClick={() =>
            void repo
              .updateVoiceNote(note.id, {
                transcription: { ...note.transcription, status: 'wachtend' },
              })
              .then(kickQueue)
          }
        >
          Opnieuw proberen
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          void askConfirm(`${note.label} verwijderen?`).then((ok) => {
            if (ok) void repo.deleteVoiceNote(note.id);
          })
        }
        className="mt-1 min-h-10 text-sm font-semibold text-nok"
      >
        Verwijderen
      </button>
    </CardShell>
  );
}

function TextCard({ note, synced }: { note: TextNoteRecord; synced: boolean | null }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  return (
    <CardShell
      time={note.createdAt}
      kind="✏️ Notitie"
      footer={
        <>
          <SectionChip
            tag={note}
            onChange={(sectie) =>
              void repo
                .tagTextNote(note.id, {
                  tagStatus: 'handmatig',
                  sectie,
                  omschrijving: note.omschrijving ?? '',
                })
                .then(kickSync)
            }
          />
          <SyncTick synced={synced} />
        </>
      }
    >
      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border-2 border-gray-400 p-3 text-lg"
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              className="min-h-12 rounded-xl border-2 border-gray-300 font-semibold text-nok"
              onClick={() =>
                void askConfirm('Notitie verwijderen?').then((ok) => {
                  if (ok) void repo.deleteTextNote(note.id);
                })
              }
            >
              Verwijder
            </button>
            <button
              type="button"
              className="min-h-12 rounded-xl border-2 border-gray-900 font-semibold"
              onClick={() => setEditing(false)}
            >
              Annuleer
            </button>
            <button
              type="button"
              disabled={!text.trim()}
              className="min-h-12 rounded-xl bg-brand font-semibold text-white disabled:opacity-40"
              onClick={() =>
                void repo
                  .updateTextNote(note.id, text)
                  .then(() => (setEditing(false), kickSync(), kickQueue()))
              }
            >
              Bewaar
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="block w-full text-left text-lg whitespace-pre-wrap"
          onClick={() => setEditing(true)}
        >
          {note.text}
        </button>
      )}
    </CardShell>
  );
}

function WaitingText({ status, error }: { status: 'wachtend' | 'bezig'; error: string | null }) {
  const settings = useLiveQuery(() => repo.getSettings(), []);
  if (status === 'bezig') return <>De assistent denkt na…</>;
  if (settings && !isAssistantConfigured(settings))
    return <>De assistent is nog niet verbonden (Instellingen).</>;
  return (
    <>
      {navigator.onLine
        ? 'In de wachtrij…'
        : 'Geen netwerk: je krijgt het antwoord zodra er bereik is.'}
      {error ? ` (${error})` : ''}
    </>
  );
}

function QuestionCard({
  question,
  photos,
  synced,
}: {
  question: QuestionRecord;
  photos: PhotoRecord[];
  synced: boolean | null;
}) {
  const attached = question.photoIds
    .map((id) => photos.find((p) => p.id === id))
    .filter((p) => p !== undefined);
  return (
    <CardShell time={question.createdAt} kind="❓ Vraag het" footer={<SyncTick synced={synced} />}>
      <p className="text-lg font-semibold whitespace-pre-wrap">{question.vraag}</p>
      {attached.length > 0 && (
        <p className="text-sm text-gray-700">
          Met foto: {attached.map((p) => p.fileName).join(', ')}
        </p>
      )}
      {question.status === 'klaar' && question.answer && <AnswerView question={question} />}
      {(question.status === 'wachtend' || question.status === 'bezig') && (
        <p className="mt-2 rounded-xl bg-gray-100 p-3 text-gray-800">
          <WaitingText status={question.status} error={question.error} />
        </p>
      )}
      {question.status === 'mislukt' && (
        <div className="mt-2 rounded-xl bg-red-50 p-3">
          <p className="font-semibold text-nok">{question.error ?? 'Geen antwoord.'}</p>
          <button
            type="button"
            className="mt-1 min-h-10 font-semibold text-brand underline"
            onClick={() => void repo.setQuestionStatus(question.id, 'wachtend').then(kickQueue)}
          >
            Opnieuw vragen
          </button>
        </div>
      )}
    </CardShell>
  );
}

/** Everything captured during this inspection, newest first. */
export function Timeline({
  inspection,
  onAsk,
}: {
  inspection: Inspection;
  onAsk: (photoId: string) => void;
}) {
  const id = inspection.id;
  const photos = useLiveQuery(() => db.photos.where('inspectionId').equals(id).toArray(), [id]);
  const voice = useLiveQuery(() => db.voiceNotes.where('inspectionId').equals(id).toArray(), [id]);
  const text = useLiveQuery(() => db.textNotes.where('inspectionId').equals(id).toArray(), [id]);
  const questions = useLiveQuery(
    () => db.questions.where('inspectionId').equals(id).toArray(),
    [id],
  );
  const sync = useSyncInfo(inspection);

  if (!photos || !voice || !text || !questions) return null;
  const items = [
    ...photos.map((p) => ({
      at: p.createdAt,
      key: p.id,
      node: <PhotoCard key={p.id} photo={p} synced={sync ? sync.photo(p) : null} onAsk={onAsk} />,
    })),
    ...voice.map((n) => ({
      at: n.recordedAt,
      key: n.id,
      node: (
        <VoiceCard
          key={n.id}
          note={n}
          synced={sync ? sync.note(n.transcription.updatedAt ?? n.recordedAt) : null}
        />
      ),
    })),
    ...text.map((t) => ({
      at: t.createdAt,
      key: t.id,
      node: <TextCard key={t.id} note={t} synced={sync ? sync.note(t.createdAt) : null} />,
    })),
    ...questions.map((q) => ({
      at: q.createdAt,
      key: q.id,
      node: (
        <QuestionCard
          key={q.id}
          question={q}
          photos={photos}
          synced={sync ? sync.note(q.feedback?.at ?? q.answeredAt ?? q.createdAt) : null}
        />
      ),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-300 p-6 text-center text-gray-700">
        <p className="font-semibold text-gray-950">Nog niets vastgelegd</p>
        <p>Neem een foto, spreek een notitie in of stel een vraag met de knoppen onderaan.</p>
      </div>
    );
  }
  return <ul className="space-y-3">{items.map((i) => i.node)}</ul>;
}
