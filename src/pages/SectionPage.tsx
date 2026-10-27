import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { checklistFor, openNvtSuggestions } from '../checklist';
import { ItemCard } from '../components/ItemCard';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui';
import { repo } from '../db/repository';
import type { Inspection } from '../domain/schemas';
import { InspectionNotFound, Loading } from './NotFound';
import { useInspection } from './useInspection';

/** Show the relevant "vorige keer" value at the top of T8 / T11. */
function previousHint(inspection: Inspection, code: string): string | null {
  const v = inspection.vorigeKeuring;
  if (code === 'T8' && v.lekdetectieType) return `Lekdetectie vorige keer: ${v.lekdetectieType}`;
  if (code === 'T11' && v.overvulsysteemType)
    return `Systeem tegen overvulling vorige keer: ${v.overvulsysteemType}`;
  return null;
}

export function SectionPage() {
  const { code = '' } = useParams();
  const { id, inspection } = useInspection();
  useEffect(() => window.scrollTo(0, 0), [code]);
  if (inspection === undefined) return <Loading />;
  if (inspection === null) return <InspectionNotFound />;

  const sections = checklistFor(inspection).sections;
  const index = sections.findIndex((s) => s.code === code);
  const section = sections[index];
  if (!section) return <InspectionNotFound />;

  const prev = sections[index - 1];
  const next = sections[index + 1];
  const base = `/inspectie/${id}`;
  const suggestions = openNvtSuggestions(inspection, section);
  const hint = previousHint(inspection, section.code);

  return (
    <Layout
      title={`${section.code} ${section.title}`}
      subtitle={inspection.klant}
      back={base}
      bottom={
        <div className="grid grid-cols-2 gap-2">
          {prev ? (
            <Link
              to={`${base}/sectie/${prev.code}`}
              className="flex min-h-14 items-center justify-center rounded-xl border-2 border-gray-900 font-semibold"
            >
              ‹ {prev.code}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={`${base}/sectie/${next.code}`}
              className="flex min-h-14 items-center justify-center rounded-xl bg-brand font-semibold text-white"
            >
              Volgende: {next.code} ›
            </Link>
          ) : (
            <Link
              to={base}
              className="flex min-h-14 items-center justify-center rounded-xl bg-brand font-semibold text-white"
            >
              Klaar ›
            </Link>
          )}
        </div>
      }
    >
      {section.intro && <p className="mb-3 text-gray-700">{section.intro}</p>}

      {section.editsGegevens && (
        <Link
          to={`${base}/gegevens/${section.editsGegevens}`}
          className="mb-4 flex min-h-14 items-center justify-center rounded-xl border-2 border-brand font-semibold text-brand"
        >
          Gegevens bewerken ›
        </Link>
      )}

      {hint && <Card className="mb-4 border-amber-400 bg-amber-50 font-semibold">{hint}</Card>}

      {suggestions.length > 1 && (
        <Card className="mb-4 border-dashed border-nvt bg-gray-50">
          <p className="mb-2">
            <span className="font-semibold">Voorstel:</span> {suggestions.length} items zijn
            waarschijnlijk NVT voor deze tank.
          </p>
          <button
            type="button"
            className="min-h-12 rounded-lg border-2 border-nvt px-4 font-semibold"
            onClick={() =>
              void repo.updateInspection(id, (draft) => {
                for (const { item } of suggestions) {
                  const cur = draft.items[item.id];
                  draft.items[item.id] = {
                    itemId: item.id,
                    beschrijving: cur?.beschrijving ?? '',
                    values: cur?.values ?? {},
                    teBevestigen: cur?.teBevestigen ?? false,
                    status: 'NVT',
                    updatedAt: new Date().toISOString(),
                  };
                }
              })
            }
          >
            Alle {suggestions.length} op NVT zetten
          </button>
        </Card>
      )}

      {section.items.map((item) => (
        <ItemCard key={item.id} inspection={inspection} item={item} />
      ))}
    </Layout>
  );
}
