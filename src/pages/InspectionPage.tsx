import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { checklistFor, checklistProgress, sectionProgress, statusOf } from '../checklist';
import { Layout } from '../components/Layout';
import { PhotoCaptureButton } from '../components/PhotoCapture';
import { Button, Card, ProgressBar, SectionHeading } from '../components/ui';
import { VoiceRecordButton } from '../components/VoiceRecorder';
import { db } from '../db/db';
import { repo } from '../db/repository';
import { tankLabel } from '../domain/factories';
import type { Inspection } from '../domain/schemas';
import { formatDate } from '../lib/format';
import { buildVergeetNiet, closeCheck, type VergeetNiet } from '../rules/vergeet-niet';
import { useMemo } from 'react';
import { InspectionNotFound, Loading } from './NotFound';
import { useInspection } from './useInspection';

function NavTile({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-16 flex-col justify-center rounded-xl border-2 border-gray-300 bg-white px-3 py-2 active:bg-gray-50"
    >
      <span className="font-bold">{title}</span>
      <span className="truncate text-sm text-gray-700">{detail}</span>
    </Link>
  );
}

/** Summary of what is still open; tapping opens the full vergeet-niet page. */
function VergeetNietTile({ to, v, closed }: { to: string; v: VergeetNiet; closed: boolean }) {
  const check = closeCheck(v);
  const parts = [
    v.vorigeOpmerkingen.length && `${v.vorigeOpmerkingen.length} vorige opmerking(en)`,
    v.herinneringen.length && `${v.herinneringen.length} herinnering(en)`,
    v.bevindingen.length && `${v.bevindingen.length} voorgestelde bevinding(en)`,
    v.nvtVoorstellen.length && `${v.nvtVoorstellen.length} NVT-voorstel(len)`,
  ].filter(Boolean);
  return (
    <Link
      to={to}
      className={`mt-4 block rounded-2xl border-2 p-4 active:bg-gray-50 ${
        closed
          ? 'border-ok bg-green-50'
          : check.canClose
            ? 'border-ok'
            : 'border-amber-500 bg-amber-50'
      }`}
    >
      <span className="flex items-center justify-between text-lg font-bold">
        <span>{closed ? '✓ Afgesloten' : 'Vergeet niet'}</span>
        <span aria-hidden>›</span>
      </span>
      <span className="block text-gray-800">
        {closed
          ? 'Tik om te heropenen of na te kijken.'
          : parts.length
            ? parts.join(' · ')
            : check.canClose
              ? 'Alles gecontroleerd — klaar om af te sluiten.'
              : 'Nog items te controleren.'}
      </span>
    </Link>
  );
}

/** "Wat was het vorige keer?" — only shown when something was filled in. */
function VorigeKeuringPanel({ inspection }: { inspection: Inspection }) {
  const v = inspection.vorigeKeuring;
  const open = v.openOpmerkingen.filter((r) => !r.checked);
  const hasData =
    v.lekdetectieType || v.overvulsysteemType || v.stickerkleur || v.openOpmerkingen.length;
  if (!hasData) return null;
  return (
    <Card className="mt-4 border-amber-400 bg-amber-50">
      <h2 className="mb-2 font-bold">Vorige keer{v.datum ? ` (${formatDate(v.datum)})` : ''}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
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
        {v.stickerkleur && (
          <>
            <dt className="text-gray-700">Klever</dt>
            <dd className="font-semibold">{v.stickerkleur}</dd>
          </>
        )}
      </dl>
      {open.length > 0 && (
        <Link
          to={`/inspectie/${inspection.id}/vorige`}
          className="mt-2 block font-semibold text-brand underline"
        >
          {open.length} open opmerking{open.length > 1 ? 'en' : ''} nog na te kijken
        </Link>
      )}
    </Card>
  );
}

export function InspectionPage() {
  const { id, inspection } = useInspection();
  const navigate = useNavigate();
  const unsortedPhotos = useLiveQuery(
    () =>
      db.photos
        .where('inspectionId')
        .equals(id)
        .filter((p) => p.itemId === null)
        .count(),
    [id],
  );
  const unsortedNotes = useLiveQuery(
    () =>
      db.voiceNotes
        .where('inspectionId')
        .equals(id)
        .filter((n) => n.itemId === null)
        .count(),
    [id],
  );

  const vergeetNiet = useMemo(
    () => (inspection ? buildVergeetNiet(inspection) : null),
    [inspection],
  );

  if (inspection === undefined) return <Loading />;
  if (inspection === null) return <InspectionNotFound />;

  const checklist = checklistFor(inspection);
  const progress = checklistProgress(inspection);
  const ondergronds = inspection.tank.placement === 'ondergronds';
  const base = `/inspectie/${id}`;

  return (
    <Layout
      title={inspection.klant || 'Inspectie'}
      subtitle={`${formatDate(inspection.datum)} · ${tankLabel(inspection)}`}
      back="/"
      bottom={
        <div className="grid grid-cols-2 gap-2">
          <PhotoCaptureButton inspectionId={id} itemId={null} label="Snelle foto" />
          <VoiceRecordButton inspectionId={id} itemId={null} />
        </div>
      }
    >
      <div className="flex items-center gap-3">
        <ProgressBar {...progress} />
        <span className="shrink-0 font-semibold">
          {progress.done}/{progress.total} gecontroleerd
        </span>
      </div>

      {ondergronds && (
        <Card className="mt-4 border-amber-500 bg-amber-50">
          <p className="font-semibold">Ondergrondse houder</p>
          <p className="text-sm">
            De checklist voor ondergrondse houders is nog niet uitgewerkt. Je kan wel foto’s,
            spraaknotities en opmerkingen vastleggen.
          </p>
        </Card>
      )}

      <VorigeKeuringPanel inspection={inspection} />

      {vergeetNiet && (
        <VergeetNietTile
          to={`${base}/vergeet-niet`}
          v={vergeetNiet}
          closed={inspection.status === 'afgesloten'}
        />
      )}

      <SectionHeading>Gegevens</SectionHeading>
      <div className="grid grid-cols-2 gap-2">
        <NavTile
          to={`${base}/gegevens/algemeen`}
          title="Algemeen"
          detail={inspection.plaatsVanOnderzoek || 'Klant, plaats, datum'}
        />
        <NavTile to={`${base}/gegevens/tank`} title="Tank" detail={tankLabel(inspection)} />
        <NavTile
          to={`${base}/gegevens/product`}
          title="Product"
          detail={inspection.product.naam || 'Product, vlampunt, GHS'}
        />
        <NavTile to={`${base}/vorige`} title="Vorige keuring" detail="Wat was het vorige keer?" />
      </div>

      {(unsortedPhotos ?? 0) + (unsortedNotes ?? 0) > 0 && (
        <Link
          to={`${base}/fotos`}
          className="mt-3 flex min-h-14 items-center justify-between rounded-xl border-2 border-amber-500 bg-amber-50 px-4 font-semibold"
        >
          <span>Ongesorteerd</span>
          <span>
            {unsortedPhotos ?? 0} foto’s · {unsortedNotes ?? 0} spraaknotities ›
          </span>
        </Link>
      )}

      <SectionHeading>Checklist {checklist.title}</SectionHeading>
      <ul className="space-y-2">
        {checklist.sections.map((s) => {
          const p = sectionProgress(inspection, s);
          const nok = s.items.filter((i) => statusOf(inspection, i.id) === 'NOK').length;
          const complete = p.done === p.total;
          return (
            <li key={s.code}>
              <Link
                to={`${base}/sectie/${s.code}`}
                className={`flex min-h-16 items-center gap-3 rounded-xl border-2 bg-white px-3 active:bg-gray-50 ${
                  complete ? 'border-ok' : 'border-gray-300'
                }`}
              >
                <span className="w-12 shrink-0 text-lg font-bold">{s.code}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{s.title}</span>
                {nok > 0 && (
                  <span className="shrink-0 rounded-full bg-nok px-2 text-sm font-bold text-white">
                    {nok} NOK
                  </span>
                )}
                <span
                  className={`shrink-0 text-sm font-semibold ${complete ? 'text-ok' : 'text-gray-700'}`}
                >
                  {complete ? '✓' : `${p.done}/${p.total}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <SectionHeading>Beheer</SectionHeading>
      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          if (confirm('Deze inspectie met alle foto’s en spraaknotities definitief verwijderen?')) {
            void repo.deleteInspection(id).then(() => navigate('/'));
          }
        }}
      >
        Inspectie verwijderen
      </Button>
    </Layout>
  );
}
