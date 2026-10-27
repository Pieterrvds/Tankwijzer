/**
 * Which files belong in OneDrive for an inspection, and which still need uploading.
 * Pure: the sync loop compares this plan with what was uploaded before (syncState).
 *
 *   <root>/<JJJJMMDD>_<klant>_<tanknr>/
 *     photos/T10_inkuiping_01.jpg …
 *     notes.md            grouped per T-section
 *     transcripts/VN_01.txt
 *     audio/VN_01.m4a     (optional, setting)
 *     inspection.json     structured data for the office workflow
 *   <root>/_lessen/lessen.json   approved lessons
 */
import type { LessonRecord, VoiceNoteRecord } from '../db/db';
import { audioExtension } from '../capture/audio';
import { formatDateTime } from '../lib/format';
import { renderNotesMd, SECTION_TITLES, type NotesInput } from './notes-md';

export interface PlannedFile {
  path: string;
  /** Changes when the content changes; same hash = already uploaded. */
  hash: string;
  load: () => Blob;
}

/** FNV-1a: small, fast, good enough to notice that a text changed. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** OneDrive does not allow \ / : * ? " < > | # % in names; underscores separate the parts. */
export function safeName(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|#%]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.]+|[\s.]+$/g, '')
      .slice(0, 80) || 'zonder-naam'
  );
}

export function inspectionFolder(root: string, i: NotesInput['inspection']): string {
  const datum = i.datum.replace(/-/g, '');
  const tanknr = i.tank.internTanknr || i.omschrijving || 'tank';
  return `${safeName(root)}/${[datum, i.klant || 'klant', tanknr].map(safeName).join('_')}`;
}

export function audioFileName(note: VoiceNoteRecord): string {
  return `${note.label}.${audioExtension(note.mimeType)}`;
}

function text(path: string, content: string, type: string): PlannedFile {
  return { path, hash: hashText(content), load: () => new Blob([content], { type }) };
}

/** Structured data for the desktop workflow. No timestamps of its own, so the hash is stable. */
export function inspectionJson(input: NotesInput): string {
  const { inspection, photos, voiceNotes, textNotes, questions } = input;
  const { text: _fullText, ...vorigVerslag } = inspection.vorigVerslag ?? { text: '' };
  return JSON.stringify(
    {
      schemaVersion: inspection.schemaVersion,
      inspection: { ...inspection, vorigVerslag: inspection.vorigVerslag ? vorigVerslag : null },
      photos: photos.map((p) => ({
        fileName: p.fileName,
        sectie: p.sectie ?? null,
        omschrijving: p.omschrijving ?? '',
        takenAt: p.takenAt,
      })),
      voiceNotes: voiceNotes.map((n) => ({
        label: n.label,
        recordedAt: n.recordedAt,
        durationMs: n.durationMs,
        sectie: n.sectie ?? null,
        transcript: n.transcription.text,
      })),
      textNotes: textNotes.map((t) => ({
        createdAt: t.createdAt,
        sectie: t.sectie ?? null,
        text: t.text,
      })),
      questions: questions.map((q) => ({
        createdAt: q.createdAt,
        vraag: q.vraag,
        photos: q.photoIds.map((id) => photos.find((p) => p.id === id)?.fileName ?? null),
        answer: q.answer,
        feedback: q.feedback,
      })),
    },
    null,
    2,
  );
}

export function planInspection(
  root: string,
  input: NotesInput,
  uploadAudio: boolean,
): PlannedFile[] {
  const folder = inspectionFolder(root, input.inspection);
  const files: PlannedFile[] = input.photos.map((p) => ({
    path: `${folder}/photos/${p.fileName}`,
    // The photo itself never changes; a new name (after sorting) is a new path.
    hash: p.id,
    load: () => p.blob,
  }));
  for (const n of input.voiceNotes) {
    if (uploadAudio)
      files.push({ path: `${folder}/audio/${audioFileName(n)}`, hash: n.id, load: () => n.blob });
    if (n.transcription.text) {
      const sectie = n.sectie
        ? `${n.sectie} ${SECTION_TITLES[n.sectie] ?? ''}`.trim()
        : 'niet ingedeeld';
      const body = `${n.label} — ${formatDateTime(n.recordedAt)} — ${sectie}\n\n${n.transcription.text}\n`;
      files.push(text(`${folder}/transcripts/${n.label}.txt`, body, 'text/plain'));
    }
  }
  files.push(text(`${folder}/notes.md`, renderNotesMd(input), 'text/markdown'));
  files.push(text(`${folder}/inspection.json`, inspectionJson(input), 'application/json'));
  return files;
}

/** Approved lessons, to be added to knowledge/lessons.md and the evals (shared across inspections). */
export function planLessons(root: string, all: LessonRecord[]): PlannedFile | null {
  const lessen = all.filter((l) => l.status === 'goedgekeurd');
  if (lessen.length === 0) return null;
  const json = JSON.stringify(
    lessen.map(({ vraag, fout_antwoord, correctie, answer, createdAt, decidedAt }) => ({
      vraag,
      fout_antwoord,
      correctie,
      bronnen: answer.bronnen,
      createdAt,
      decidedAt,
    })),
    null,
    2,
  );
  return text(`${safeName(root)}/_lessen/lessen.json`, json, 'application/json');
}
