import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AskSheet, NoteSheet } from '../components/Composers';
import { Hints } from '../components/Hints';
import { Layout } from '../components/Layout';
import { PhotoCaptureButton } from '../components/PhotoCapture';
import { SyncBadge } from '../components/SyncBadge';
import { Timeline } from '../components/Timeline';
import { VoiceRecordButton } from '../components/VoiceRecorder';
import { VorigeKeuringCard } from '../components/VorigeKeuringCard';
import { repo } from '../db/repository';
import { tankLabel } from '../domain/factories';
import { askConfirm } from '../lib/confirm';
import { formatDate } from '../lib/format';
import { InspectionNotFound, Loading } from './NotFound';
import { useInspection } from './useInspection';

/**
 * One inspection: the previous report on top, then everything captured today, and the four
 * capture buttons in the thumb zone. No checklist: the assistant sorts everything into the
 * BEPO sections in the background.
 */
export function InspectionPage() {
  const { id, inspection } = useInspection();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<
    { kind: 'note' } | { kind: 'ask'; photoId: string | null } | null
  >(null);

  if (inspection === undefined) return <Loading />;
  if (inspection === null) return <InspectionNotFound />;

  return (
    <Layout
      title={inspection.klant || 'Keuring'}
      subtitle={`${formatDate(inspection.datum)} · ${tankLabel(inspection)}`}
      back="/"
      bottom={
        <div className="grid grid-cols-4 gap-2">
          <PhotoCaptureButton inspectionId={id} />
          <VoiceRecordButton inspectionId={id} />
          <button
            type="button"
            onClick={() => setSheet({ kind: 'note' })}
            className="flex min-h-16 flex-col items-center justify-center rounded-xl bg-brand px-2 font-semibold text-white active:bg-brand-light"
          >
            <span className="text-2xl" aria-hidden>
              ✏️
            </span>
            <span className="text-sm">Notitie</span>
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: 'ask', photoId: null })}
            className="flex min-h-16 flex-col items-center justify-center rounded-xl bg-sky-700 px-2 font-semibold text-white active:bg-sky-800"
          >
            <span className="text-2xl" aria-hidden>
              ❓
            </span>
            <span className="text-sm">Vraag het</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <VorigeKeuringCard inspection={inspection} />
        <Hints inspection={inspection} />
        <SyncBadge inspectionId={id} />
        <Timeline inspection={inspection} onAsk={(photoId) => setSheet({ kind: 'ask', photoId })} />
        <button
          type="button"
          className="min-h-12 w-full rounded-xl text-sm font-semibold text-nok"
          onClick={() =>
            void askConfirm(
              'Deze keuring met alle foto’s en notities van dit toestel verwijderen? (Wat al op OneDrive staat, blijft daar.)',
            ).then(async (ok) => {
              if (!ok) return;
              await repo.deleteInspection(id);
              navigate('/');
            })
          }
        >
          Keuring verwijderen van dit toestel
        </button>
      </div>

      {sheet?.kind === 'note' && <NoteSheet inspectionId={id} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'ask' && (
        <AskSheet inspectionId={id} initialPhotoId={sheet.photoId} onClose={() => setSheet(null)} />
      )}
    </Layout>
  );
}
