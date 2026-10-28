import { useRef, useState } from 'react';
import { kickQueue } from '../ai/queue';
import { processPhoto } from '../capture/photo';
import { repo } from '../db/repository';
import { kickSync } from '../sync/sync';

/**
 * Camera button. A plain file input with `capture="environment"`: on phones this opens the rear
 * camera directly, works offline, and needs no camera permission handling.
 */
export function PhotoCaptureButton({
  inspectionId,
  label = 'Foto',
  className = '',
}: {
  inspectionId: string;
  label?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await repo.addPhoto({ inspectionId, ...(await processPhoto(file)) });
      }
      kickSync();
      void kickQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Foto kon niet bewaard worden');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex min-h-16 w-full flex-col items-center justify-center rounded-xl bg-brand px-2 font-semibold text-white active:bg-brand-light disabled:opacity-50"
      >
        <span className="text-2xl" aria-hidden>
          📷
        </span>
        <span className="text-sm">{busy ? 'Bewaren…' : label}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
      {error && <p className="mt-1 text-sm font-semibold text-nok">{error}</p>}
    </div>
  );
}
