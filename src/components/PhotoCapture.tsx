import { useRef, useState } from 'react';
import { processPhoto } from '../capture/photo';
import { repo } from '../db/repository';

interface Props {
  inspectionId: string;
  /** null = add to the "ongesorteerd" tray. */
  itemId: string | null;
  label?: string;
  className?: string;
}

/**
 * Camera button. Uses a plain file input with `capture="environment"`: on phones this opens
 * the rear camera directly, works offline, and needs no camera permission handling.
 */
export function PhotoCaptureButton({
  inspectionId,
  itemId,
  label = 'Foto',
  className = '',
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const photo = await processPhoto(file);
        await repo.addPhoto({ inspectionId, itemId, ...photo });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Foto kon niet bewaard worden');
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
        className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-gray-900 bg-white px-4 text-lg font-semibold active:bg-gray-100 disabled:opacity-50 ${className}`}
      >
        <span aria-hidden>📷</span> {busy ? 'Bewaren…' : label}
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
    </>
  );
}
