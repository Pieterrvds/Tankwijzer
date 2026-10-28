/**
 * Assembles what the assistant gets with a question: the previous report, everything noted
 * during this visit, the attached photos, earlier questions and all lessen.
 */
import type { KeurKompasDB, QuestionRecord } from '../db/db';
import { tankLabel } from '../domain/factories';
import type { AskRequest } from './schemas';

const MAX_EARLIER_QUESTIONS = 5;
/** Only approved lessons are sent; the most recent ones if there are very many. */
const MAX_LESSONS = 200;

/** Base64 (no data: prefix) of a blob; works in the browser and in tests. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function buildAskRequest(
  db: KeurKompasDB,
  question: QuestionRecord,
): Promise<AskRequest> {
  const inspection = await db.inspections.get(question.inspectionId);
  if (!inspection) throw new Error('Keuring niet gevonden');

  const [voice, text, photos, earlier, lessen] = await Promise.all([
    db.voiceNotes.where('inspectionId').equals(inspection.id).sortBy('recordedAt'),
    db.textNotes.where('inspectionId').equals(inspection.id).sortBy('createdAt'),
    db.photos.bulkGet(question.photoIds),
    db.questions.where('inspectionId').equals(inspection.id).sortBy('createdAt'),
    db.lessen
      .orderBy('createdAt')
      .filter((l) => l.status === 'goedgekeurd')
      .toArray(),
  ]);

  const notities = [
    ...voice
      .filter((v) => v.transcription.text)
      .map((v) => ({
        label: v.label,
        tijd: clockTime(v.recordedAt),
        tekst: v.transcription.text,
        at: v.recordedAt,
      })),
    ...text.map((t) => ({
      label: 'notitie',
      tijd: clockTime(t.createdAt),
      tekst: t.text,
      at: t.createdAt,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ at: _at, ...n }) => n);

  const fotos = await Promise.all(
    photos
      .filter((p) => p !== undefined)
      .map(async (p, n) => ({
        label: `foto ${n + 1} (${p.fileName}, ${clockTime(p.takenAt ?? p.createdAt)})`,
        mediaType: 'image/jpeg' as const,
        data: await blobToBase64(p.blob),
      })),
  );

  const eerdereVragen = earlier
    .filter((q) => q.id !== question.id && q.answer && q.createdAt < question.createdAt)
    .slice(-MAX_EARLIER_QUESTIONS)
    .map((q) => ({
      vraag: q.vraag,
      antwoord:
        q.feedback?.verdict === 'fout' && q.feedback.correctie
          ? `(gecorrigeerd door keurder) ${q.feedback.correctie}`
          : q.answer!.antwoord,
    }));

  return {
    vraag: question.vraag,
    bezoek: { klant: inspection.klant, datum: inspection.datum, tank: tankLabel(inspection) },
    vorigVerslag: inspection.vorigVerslag?.text ?? '',
    notities,
    fotos,
    eerdereVragen,
    lessen: lessen
      .slice(-MAX_LESSONS)
      .map(({ vraag, fout_antwoord, correctie }) => ({ vraag, fout_antwoord, correctie })),
  };
}
