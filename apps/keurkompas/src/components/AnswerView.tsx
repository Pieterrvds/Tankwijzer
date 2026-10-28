import { useState } from 'react';
import type { Answer } from '../ai/schemas';
import type { QuestionRecord } from '../db/db';
import { repo } from '../db/repository';
import { kickSync } from '../sync/sync';

const ZEKERHEID: Record<Answer['zekerheid'], { label: string; style: string }> = {
  hoog: { label: 'Zeker', style: 'bg-ok text-white' },
  middel: { label: 'Vrij zeker', style: 'bg-amber-400 text-gray-950' },
  laag: { label: 'Niet zeker', style: 'bg-nok text-white' },
};

const BRON: Record<string, string> = {
  vlarem: 'VLAREM',
  vorig_verslag: 'Vorig verslag',
  regel: 'Regel',
  standaardzin: 'Standaardzin',
  foto: 'Foto',
  notitie: 'Notitie',
  les: 'Les',
};

/** 👍 / 👎 with an optional correction. A correction becomes a proposed lesson. */
function Feedback({ question }: { question: QuestionRecord }) {
  const [correcting, setCorrecting] = useState(false);
  const [text, setText] = useState(question.feedback?.correctie ?? '');
  const verdict = question.feedback?.verdict ?? null;

  const save = (v: 'klopt' | 'fout' | null, correctie = '') =>
    void repo.setFeedback(question.id, v, correctie).then(() => kickSync());

  if (correcting) {
    return (
      <div className="mt-3">
        <label className="block">
          <span className="mb-1 block font-semibold">Wat is juist?</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder="bv. Dit is een vlotter, geen kijkglas."
            className="w-full rounded-xl border-2 border-gray-400 p-3 text-lg"
          />
        </label>
        <p className="mb-2 text-sm text-gray-700">
          Je correctie wordt een voorgestelde les. Ze telt pas mee na goedkeuring bij Lessen.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCorrecting(false)}
            className="min-h-12 rounded-xl border-2 border-gray-900 font-semibold"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => {
              save('fout', text);
              setCorrecting(false);
            }}
            className="min-h-12 rounded-xl bg-brand font-semibold text-white"
          >
            Bewaren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={verdict === 'klopt'}
        onClick={() => save(verdict === 'klopt' ? null : 'klopt')}
        className={`min-h-12 rounded-xl border-2 px-4 font-semibold ${
          verdict === 'klopt' ? 'border-ok bg-ok text-white' : 'border-gray-400'
        }`}
      >
        👍 Klopt
      </button>
      <button
        type="button"
        aria-pressed={verdict === 'fout'}
        onClick={() => setCorrecting(true)}
        className={`min-h-12 rounded-xl border-2 px-4 font-semibold ${
          verdict === 'fout' ? 'border-nok bg-nok text-white' : 'border-gray-400'
        }`}
      >
        👎 Niet juist
      </button>
      {verdict === 'fout' && question.feedback?.correctie && (
        <p className="w-full text-sm">
          <span className="font-semibold">Jouw correctie:</span> {question.feedback.correctie}
        </p>
      )}
    </div>
  );
}

export function AnswerView({ question }: { question: QuestionRecord }) {
  const a = question.answer!;
  const [copied, setCopied] = useState(false);
  const z = ZEKERHEID[a.zekerheid];
  return (
    <div className="mt-2 rounded-xl border-2 border-sky-700 bg-sky-50 p-3">
      <div className="mb-2 flex flex-wrap gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${z.style}`}>
          {z.label}
        </span>
        {a.te_bevestigen && (
          <span className="te-bevestigen rounded px-2 py-0.5 text-xs font-bold">te bevestigen</span>
        )}
        {a.sectie && (
          <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-bold">{a.sectie}</span>
        )}
      </div>
      <p className="text-lg whitespace-pre-wrap">{a.antwoord}</p>

      {a.nakijken.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-semibold">Nakijken:</p>
          <ul className="list-disc pl-6">
            {a.nakijken.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {a.voorstel_tekst && (
        <div className="mt-2 rounded-lg bg-white p-2">
          <p className="text-sm font-semibold">Voorstel {a.voorstel_tekst.soort}:</p>
          <p className="italic">“{a.voorstel_tekst.tekst}”</p>
          <button
            type="button"
            className="mt-1 min-h-10 text-sm font-semibold text-brand underline"
            onClick={() => {
              navigator.clipboard?.writeText(a.voorstel_tekst!.tekst).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? 'Gekopieerd' : 'Kopieer tekst'}
          </button>
        </div>
      )}

      {a.bronnen.length > 0 && (
        <details className="mt-2">
          <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">
            Bronnen ({a.bronnen.length})
          </summary>
          <ul className="space-y-1 text-sm">
            {a.bronnen.map((b, n) => (
              <li key={n}>
                <span className="font-semibold">{BRON[b.bron] ?? b.bron}:</span> {b.referentie}
                {b.citaat && <span className="block text-gray-700 italic">“{b.citaat}”</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Feedback question={question} />
    </div>
  );
}
