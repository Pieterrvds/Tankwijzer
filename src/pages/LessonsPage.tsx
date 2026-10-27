import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/ui';
import { db, type LessonRecord } from '../db/db';
import { repo } from '../db/repository';
import { askConfirm } from '../lib/confirm';
import { formatDateTime } from '../lib/format';
import { kickSync } from '../sync/sync';

const STATUS: Record<LessonRecord['status'], { label: string; style: string }> = {
  voorgesteld: { label: 'Voorgesteld', style: 'border-amber-500' },
  goedgekeurd: { label: '✅ Goedgekeurd — telt mee', style: 'border-ok' },
  afgewezen: { label: 'Afgewezen', style: 'border-gray-300 opacity-70' },
};

function LessonCard({ lesson }: { lesson: LessonRecord }) {
  const [correctie, setCorrectie] = useState(lesson.correctie);
  const decide = (status: LessonRecord['status']) =>
    void repo
      .updateLesson(lesson.id, correctie)
      .then(() => repo.decideLesson(lesson.id, status))
      .then(kickSync);
  return (
    <Card className={STATUS[lesson.status].style}>
      <p className="mb-1 text-sm text-gray-700">
        {formatDateTime(lesson.createdAt)} · {STATUS[lesson.status].label}
      </p>
      <p className="font-semibold">Vraag: {lesson.vraag}</p>
      <p className="mt-1 text-gray-700">
        <span className="font-semibold">Antwoord was:</span> {lesson.fout_antwoord}
      </p>
      <label className="mt-2 block">
        <span className="mb-1 block font-semibold">
          Correctie (wat de assistent moet onthouden)
        </span>
        <textarea
          value={correctie}
          onChange={(e) => setCorrectie(e.target.value)}
          rows={3}
          className="w-full rounded-xl border-2 border-gray-400 p-3 text-lg"
        />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {lesson.status !== 'goedgekeurd' ? (
          <button
            type="button"
            disabled={!correctie.trim()}
            onClick={() => decide('goedgekeurd')}
            className="min-h-12 rounded-xl bg-brand font-semibold text-white disabled:opacity-40"
          >
            Goedkeuren
          </button>
        ) : (
          <button
            type="button"
            onClick={() => decide('voorgesteld')}
            className="min-h-12 rounded-xl border-2 border-gray-900 font-semibold"
          >
            Intrekken
          </button>
        )}
        {lesson.status !== 'afgewezen' ? (
          <button
            type="button"
            onClick={() => decide('afgewezen')}
            className="min-h-12 rounded-xl border-2 border-gray-400 font-semibold"
          >
            Afwijzen
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              void askConfirm('Les definitief verwijderen?').then((ok) => {
                if (ok) void repo.deleteLesson(lesson.id);
              })
            }
            className="min-h-12 rounded-xl border-2 border-gray-300 font-semibold text-nok"
          >
            Verwijderen
          </button>
        )}
      </div>
    </Card>
  );
}

/**
 * The safe learning loop: corrections from 👎 answers are proposals. Only approved lessons are
 * sent to the assistant, and they are synced to OneDrive (_lessen/lessen.json) so they can be
 * added permanently to knowledge/lessons.md and the evals.
 */
export function LessonsPage() {
  const lessons = useLiveQuery(() => db.lessen.orderBy('createdAt').reverse().toArray(), []);
  const order = { voorgesteld: 0, goedgekeurd: 1, afgewezen: 2 };
  return (
    <Layout title="Lessen" subtitle="Correcties van de assistent" back="/instellingen">
      <p className="mb-3 text-gray-700">
        Wanneer je een antwoord als “niet juist” markeert met een correctie, komt die hier. Pas na
        goedkeuring houdt de assistent er rekening mee.
      </p>
      {lessons?.length === 0 && <Card>Nog geen lessen.</Card>}
      <div className="space-y-3">
        {[...(lessons ?? [])]
          .sort((a, b) => order[a.status] - order[b.status])
          .map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
      </div>
    </Layout>
  );
}
