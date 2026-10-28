import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { kickQueue } from '../ai/queue';
import { db, type PhotoRecord } from '../db/db';
import { repo } from '../db/repository';
import { useObjectUrl } from '../lib/hooks';
import { kickSync } from '../sync/sync';
import { Sheet } from './Sheet';

/** Max photos per question (the server accepts 5). */
const MAX_PHOTOS = 4;

export function NoteSheet({
  inspectionId,
  onClose,
}: {
  inspectionId: string;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <Sheet title="Notitie" onClose={onClose}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        autoFocus
        placeholder="Typ, of tik op de microfoon van je toetsenbord om te dicteren."
        className="w-full rounded-xl border-2 border-gray-400 p-3 text-lg"
      />
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() =>
          void repo.addTextNote(inspectionId, text).then(() => {
            kickSync();
            void kickQueue();
            onClose();
          })
        }
        className="mt-3 min-h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-40"
      >
        Bewaren
      </button>
    </Sheet>
  );
}

function PhotoToggle({
  photo,
  selected,
  onToggle,
}: {
  photo: PhotoRecord;
  selected: boolean;
  onToggle: () => void;
}) {
  const url = useObjectUrl(photo.blob);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-4 ${selected ? 'border-brand' : 'border-transparent'}`}
    >
      {url && <img src={url} alt={photo.fileName} className="h-full w-full object-cover" />}
      {selected && (
        <span className="absolute top-1 right-1 rounded-full bg-brand px-2 text-sm font-bold text-white">
          ✓
        </span>
      )}
    </button>
  );
}

/**
 * "Vraag het": a question, optionally with photos of this inspection. Stored first and answered
 * when there is network, so it also works in a basement.
 */
export function AskSheet({
  inspectionId,
  initialPhotoId,
  onClose,
}: {
  inspectionId: string;
  initialPhotoId: string | null;
  onClose: () => void;
}) {
  const [vraag, setVraag] = useState('');
  const photos = useLiveQuery(
    () => db.photos.where('inspectionId').equals(inspectionId).reverse().sortBy('createdAt'),
    [inspectionId],
  );
  // Default: the photo it was asked from, else the latest photo if taken in the last 5 minutes.
  const [selected, setSelected] = useState<string[] | null>(
    initialPhotoId ? [initialPhotoId] : null,
  );
  const recent =
    photos?.[0] && Date.now() - Date.parse(photos[0].createdAt) < 5 * 60_000 ? [photos[0].id] : [];
  const chosen = selected ?? recent;

  const toggle = (id: string) =>
    setSelected(
      chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id].slice(-MAX_PHOTOS),
    );

  return (
    <Sheet title="Vraag het" onClose={onClose}>
      <textarea
        value={vraag}
        onChange={(e) => setVraag(e.target.value)}
        rows={3}
        autoFocus
        placeholder="bv. Is dit kijkglas nog toegelaten? Wat zei het vorige verslag over de overvulbeveiliging?"
        className="w-full rounded-xl border-2 border-gray-400 p-3 text-lg"
      />
      {photos && photos.length > 0 && (
        <>
          <p className="mt-3 mb-1 font-semibold">
            Foto meesturen ({chosen.length}/{MAX_PHOTOS})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.slice(0, 20).map((p) => (
              <PhotoToggle
                key={p.id}
                photo={p}
                selected={chosen.includes(p.id)}
                onToggle={() => toggle(p.id)}
              />
            ))}
          </div>
        </>
      )}
      <p className="mt-2 text-sm text-gray-700">
        De assistent gebruikt het vorige verslag, je notities van vandaag, VLAREM en de goedgekeurde
        lessen.
      </p>
      <button
        type="button"
        disabled={!vraag.trim()}
        onClick={() =>
          void repo.addQuestion(inspectionId, vraag, chosen).then(() => {
            void kickQueue();
            kickSync();
            onClose();
          })
        }
        className="mt-3 min-h-14 w-full rounded-xl bg-brand text-lg font-semibold text-white disabled:opacity-40"
      >
        Vraag stellen
      </button>
    </Sheet>
  );
}
