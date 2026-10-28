import { Link } from 'react-router-dom';
import { useSyncStatus } from '../sync/sync';

/** OneDrive state for one inspection (or overall), with a link to the settings when needed. */
export function SyncBadge({ inspectionId }: { inspectionId?: string }) {
  const status = useSyncStatus();
  if (status.state === 'uit') {
    return import.meta.env.VITE_PREVIEW === 'true' ? null : (
      <Link to="/instellingen" className="block rounded-xl bg-gray-100 p-3 text-sm font-semibold">
        OneDrive is nog niet ingesteld. Foto’s en notities blijven op dit toestel. Instellen ›
      </Link>
    );
  }
  const pending = inspectionId
    ? (status.pending[inspectionId] ?? 0)
    : Object.values(status.pending).reduce((a, b) => a + b, 0);
  const text =
    status.state === 'aanmelden'
      ? status.message
      : pending > 0
        ? `${pending} bestand${pending === 1 ? '' : 'en'} nog naar OneDrive${status.state === 'bezig' ? ' — bezig…' : ` — ${status.message}`}`
        : '✓ Alles staat op OneDrive';
  const style =
    status.state === 'aanmelden' || status.state === 'fout'
      ? 'bg-red-50 text-nok'
      : pending > 0
        ? 'bg-amber-50 text-gray-950'
        : 'bg-green-50 text-ok';
  return status.state === 'aanmelden' ? (
    <Link to="/instellingen" className={`block rounded-xl p-3 text-sm font-semibold ${style}`}>
      {text} ›
    </Link>
  ) : (
    <p className={`rounded-xl p-3 text-sm font-semibold ${style}`}>{text}</p>
  );
}
