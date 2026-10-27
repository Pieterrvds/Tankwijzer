import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { checklistFor, findItem } from '../checklist';
import { Layout } from '../components/Layout';
import { RuleNotice } from '../components/RuleNotice';
import { Button, Card, SectionHeading } from '../components/ui';
import { repo } from '../db/repository';
import { buildVergeetNiet, closeCheck } from '../rules/vergeet-niet';
import { useReviewStateOf } from '../rules/useRules';
import { InspectionNotFound, Loading } from './NotFound';
import { useInspection } from './useInspection';

function ItemLink({ base, itemId, label }: { base: string; itemId: string; label: string }) {
  const code = itemId.split('.')[0];
  return (
    <Link
      to={`${base}/sectie/${code}#${itemId}`}
      className="flex min-h-12 items-center rounded-lg px-2 font-semibold text-brand underline active:bg-gray-100"
    >
      {label}
    </Link>
  );
}

/**
 * "Vergeet-niet": everything still open for this inspection, in the order an inspector would
 * walk through it, plus the close-inspection check at the bottom.
 */
export function VergeetNietPage() {
  const { id, inspection } = useInspection();
  const reviewOf = useReviewStateOf();
  const v = useMemo(() => (inspection ? buildVergeetNiet(inspection) : null), [inspection]);

  if (inspection === undefined) return <Loading />;
  if (inspection === null || !v) return <InspectionNotFound />;

  const base = `/inspectie/${id}`;
  const check = closeCheck(v);
  const closed = inspection.status === 'afgesloten';

  return (
    <Layout title="Vergeet niet" subtitle={inspection.klant} back={base}>
      {v.vorigeOpmerkingen.length > 0 && (
        <>
          <SectionHeading>Open opmerkingen vorige keuring</SectionHeading>
          <ul className="space-y-2">
            {v.vorigeOpmerkingen.map((r) => (
              <li key={r.id}>
                <Card className="border-amber-400 bg-amber-50">
                  {r.volgendeKeuring && (
                    <p className="mb-1 text-sm font-bold">Deze keuring is “de volgende keuring”.</p>
                  )}
                  <p className="whitespace-pre-wrap">{r.text}</p>
                  <Link
                    to={`${base}/vorige`}
                    className="mt-1 block font-semibold text-brand underline"
                  >
                    Afvinken bij Vorige keuring ›
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {v.herinneringen.length > 0 && (
        <>
          <SectionHeading>Herinneringen voor deze tank</SectionHeading>
          <div className="space-y-2">
            {v.herinneringen.map((r) => (
              <RuleNotice key={r.rule.id} result={r} review={reviewOf(r)}>
                <div className="mt-1 flex flex-wrap">
                  {r.items.map((itemId) => (
                    <ItemLink
                      key={itemId}
                      base={base}
                      itemId={itemId}
                      label={`${itemId.split('.')[0]} · ${findItem(checklistFor(inspection), itemId)?.label ?? itemId}`}
                    />
                  ))}
                </div>
              </RuleNotice>
            ))}
          </div>
        </>
      )}

      {v.bevindingen.length > 0 && (
        <>
          <SectionHeading>Voorgestelde bevindingen (uit de regels)</SectionHeading>
          <p className="mb-2 text-sm text-gray-700">
            Voorstellen voor het resultaat (T20). Overnemen in het rapport volgt in een volgende
            stap; jij beslist.
          </p>
          <div className="space-y-2">
            {v.bevindingen.map((r) => (
              <RuleNotice key={r.rule.id} result={r} review={reviewOf(r)} />
            ))}
          </div>
        </>
      )}

      {v.nokZonderBeschrijving.length > 0 && (
        <>
          <SectionHeading>NOK zonder beschrijving</SectionHeading>
          <Card>
            {v.nokZonderBeschrijving.map((i) => (
              <ItemLink key={i.id} base={base} itemId={i.id} label={`${i.section} · ${i.label}`} />
            ))}
          </Card>
        </>
      )}

      {v.nvtVoorstellen.length > 0 && (
        <>
          <SectionHeading>Waarschijnlijk NVT ({v.nvtVoorstellen.length})</SectionHeading>
          <Card>
            {v.nvtVoorstellen.map(({ item }) => (
              <ItemLink
                key={item.id}
                base={base}
                itemId={item.id}
                label={`${item.section} · ${item.label}`}
              />
            ))}
          </Card>
        </>
      )}

      {v.nietGecontroleerd.length > 0 && (
        <>
          <SectionHeading>Nog niet gecontroleerd</SectionHeading>
          <div className="space-y-2">
            {v.nietGecontroleerd.map((s) => (
              <Card key={s.code}>
                <Link to={`${base}/sectie/${s.code}`} className="mb-1 block font-bold">
                  {s.code} {s.title} ›
                </Link>
                <ul className="list-disc pl-6 text-gray-800">
                  {s.items.map((i) => (
                    <li key={i.id}>{i.label}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}

      {v.teBevestigen.length > 0 && (
        <>
          <SectionHeading>Te bevestigen</SectionHeading>
          <Card>
            {v.teBevestigen.map((i) => (
              <ItemLink key={i.id} base={base} itemId={i.id} label={`${i.section} · ${i.label}`} />
            ))}
          </Card>
        </>
      )}

      <SectionHeading>Inspectie afsluiten</SectionHeading>
      {closed ? (
        <Card className="border-ok">
          <p className="mb-3 font-semibold">Deze inspectie is afgesloten.</p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void repo.setInspectionStatus(id, 'open')}
          >
            Heropenen
          </Button>
        </Card>
      ) : (
        <Card className={check.canClose ? 'border-ok' : 'border-nok'}>
          {check.blockers.length > 0 && (
            <>
              <p className="mb-1 font-bold text-nok">Nog niet klaar om af te sluiten:</p>
              <ul className="mb-3 list-disc pl-6">
                {check.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </>
          )}
          {check.warnings.length > 0 && (
            <>
              <p className="mb-1 font-semibold">Let op:</p>
              <ul className="mb-3 list-disc pl-6">
                {check.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
          {check.canClose && check.warnings.length === 0 && (
            <p className="mb-3 font-semibold text-ok">Alles is gecontroleerd.</p>
          )}
          <Button
            className="w-full"
            disabled={!check.canClose}
            onClick={() => void repo.setInspectionStatus(id, 'afgesloten')}
          >
            Inspectie afsluiten
          </Button>
        </Card>
      )}
    </Layout>
  );
}
