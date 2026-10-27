import { useLiveQuery } from 'dexie-react-hooks';
import { askConfirm } from '../lib/confirm';
import { useState } from 'react';
import { db, type PhotoRecord } from '../db/db';
import { repo } from '../db/repository';
import { formatDateTime } from '../lib/format';
import { useObjectUrl } from '../lib/hooks';
import { ItemPicker } from './ItemPicker';
import type { Inspection } from '../domain/schemas';

function Thumb({ photo, onOpen }: { photo: PhotoRecord; onOpen: () => void }) {
  const url = useObjectUrl(photo.blob);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border-2 border-gray-300 bg-gray-100"
      aria-label={`Foto ${photo.fileName} openen`}
    >
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

/** Full-screen photo view with "verplaats naar item" and "verwijder". */
export function PhotoViewer({
  photo,
  inspection,
  onClose,
}: {
  photo: PhotoRecord;
  inspection: Inspection;
  onClose: () => void;
}) {
  const url = useObjectUrl(photo.blob);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal>
      <div className="flex items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate font-semibold">{photo.fileName}</p>
          {photo.takenAt && (
            <p className="text-sm text-white/75">{formatDateTime(photo.takenAt)}</p>
          )}
        </div>
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
          <img src={url} alt={photo.fileName} className="max-h-full max-w-full object-contain" />
        )}
      </div>
      <div className="space-y-2 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-gray-950">
        <ItemPicker
          inspection={inspection}
          label="Koppel aan item"
          value={photo.itemId}
          onChange={(itemId) => void repo.movePhoto(photo.id, itemId)}
        />
        <button
          type="button"
          onClick={() =>
            void askConfirm('Foto verwijderen?').then((ok) => {
              if (!ok) return;
              void repo.deletePhoto(photo.id);
              onClose();
            })
          }
          className="h-14 w-full rounded-xl border-2 border-nok font-semibold text-nok"
        >
          Foto verwijderen
        </button>
      </div>
    </div>
  );
}

/** Horizontal strip of thumbnails for one item (or for the unsorted tray when itemId = null). */
export function PhotoStrip({
  inspection,
  itemId,
}: {
  inspection: Inspection;
  itemId: string | null;
}) {
  const photos = useLiveQuery(
    () =>
      db.photos
        .where('inspectionId')
        .equals(inspection.id)
        .filter((p) => p.itemId === itemId)
        .sortBy('createdAt'),
    [inspection.id, itemId],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const open = photos?.find((p) => p.id === openId);

  if (!photos?.length) return null;
  return (
    <>
      <div className="flex gap-2 overflow-x-auto py-1">
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} onOpen={() => setOpenId(p.id)} />
        ))}
      </div>
      {open && <PhotoViewer photo={open} inspection={inspection} onClose={() => setOpenId(null)} />}
    </>
  );
}
