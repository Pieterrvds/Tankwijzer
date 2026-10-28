/**
 * notes.md — the file that lands on the PC next to the photos. Grouped per BEPO section (as
 * sorted by the assistant or the inspector), so writing the report follows the same order.
 * Contains all text and transcribed voice notes, and the answers the inspector kept (👍) or
 * corrected (👎 + correction).
 */
import { BEPO_BOVENGRONDS } from '../checklist/bepo-bovengronds';
import type { PhotoRecord, QuestionRecord, TextNoteRecord, VoiceNoteRecord } from '../db/db';
import { tankLabel } from '../domain/factories';
import type { Inspection } from '../domain/schemas';
import { formatDate } from '../lib/format';
import { clockTime } from '../ai/context';
import { formatDuration } from '../capture/audio';

export interface NotesInput {
  inspection: Inspection;
  photos: PhotoRecord[];
  voiceNotes: VoiceNoteRecord[];
  textNotes: TextNoteRecord[];
  questions: QuestionRecord[];
}

export const SECTION_TITLES: Record<string, string> = {
  ...Object.fromEntries(BEPO_BOVENGRONDS.sections.map((s) => [s.code, s.title])),
  T20: 'Resultaat',
};
const SECTION_ORDER = [...BEPO_BOVENGRONDS.sections.map((s) => s.code), 'T20'];

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function questionLines(q: QuestionRecord, photos: PhotoRecord[]): string[] {
  const lines = [`- ${clockTime(q.createdAt)} **Vraag:** ${oneLine(q.vraag)}`];
  const names = q.photoIds.map((id) => photos.find((p) => p.id === id)?.fileName).filter(Boolean);
  if (names.length) lines.push(`  - Foto's: ${names.join(', ')}`);
  const a = q.answer;
  if (q.feedback?.verdict === 'klopt' && a) {
    lines.push(`  - **Antwoord (bewaard ✔):** ${oneLine(a.antwoord)}`);
    lines.push(`  - Zekerheid: ${a.zekerheid}${a.te_bevestigen ? ', te bevestigen' : ''}`);
    for (const b of a.bronnen)
      lines.push(
        `  - Bron: ${b.bron} — ${b.referentie}${b.citaat ? ` — “${oneLine(b.citaat)}”` : ''}`,
      );
    if (a.voorstel_tekst)
      lines.push(`  - Voorstel ${a.voorstel_tekst.soort}: “${oneLine(a.voorstel_tekst.tekst)}”`);
  } else if (q.feedback?.verdict === 'fout') {
    lines.push(
      `  - **Antwoord was niet juist.** ${q.feedback.correctie ? `Correctie keurder: ${oneLine(q.feedback.correctie)}` : ''}`.trimEnd(),
    );
  } else {
    lines.push('  - _(antwoord niet bewaard)_');
  }
  return lines;
}

export function renderNotesMd({
  inspection: i,
  photos,
  voiceNotes,
  textNotes,
  questions,
}: NotesInput): string {
  const out: string[] = [];
  out.push(`# ${i.klant || 'Keuring'} — ${tankLabel(i)}`, '');
  out.push(`- Datum: ${formatDate(i.datum)}`);
  if (i.plaatsVanOnderzoek) out.push(`- Plaats: ${i.plaatsVanOnderzoek}`);
  if (i.verslagnummer) out.push(`- Verslagnummer: ${i.verslagnummer}`);
  out.push('');

  const facts = i.vorigVerslag?.facts;
  const v = i.vorigeKeuring;
  if (facts || v.openOpmerkingen.length) {
    out.push('## Vorige keuring', '');
    if (facts) out.push(facts.samenvatting, '');
    if (v.lekdetectieType) out.push(`- Lekdetectie: ${v.lekdetectieType}`);
    if (v.overvulsysteemType) out.push(`- Systeem tegen overvulling: ${v.overvulsysteemType}`);
    if (v.stickerkleur) out.push(`- Klever: ${v.stickerkleur}`);
    for (const r of v.openOpmerkingen) out.push(`- [${r.checked ? 'x' : ' '}] ${r.text}`);
    out.push('');
  }

  type Entry = { at: string; sectie: string | null; lines: string[] };
  const entries: Entry[] = [
    ...photos.map((p) => ({
      at: p.takenAt ?? p.createdAt,
      sectie: p.sectie ?? null,
      lines: [
        `- ${clockTime(p.takenAt ?? p.createdAt)} Foto [${p.fileName}](photos/${p.fileName})${p.omschrijving ? ` — ${p.omschrijving}` : ''}`,
      ],
    })),
    ...voiceNotes.map((n) => ({
      at: n.recordedAt,
      sectie: n.sectie ?? null,
      lines: [
        `- ${clockTime(n.recordedAt)} Spraak ${n.label} (${formatDuration(n.durationMs)}): ${
          n.transcription.text ? `“${oneLine(n.transcription.text)}”` : '_(nog geen transcriptie)_'
        }`,
      ],
    })),
    ...textNotes.map((t) => ({
      at: t.createdAt,
      sectie: t.sectie ?? null,
      lines: [`- ${clockTime(t.createdAt)} Notitie: “${oneLine(t.text)}”`],
    })),
    ...questions.map((q) => ({
      at: q.createdAt,
      sectie: q.answer?.sectie ?? null,
      lines: questionLines(q, photos),
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const known = (s: string | null) => (s && SECTION_ORDER.includes(s) ? s : null);
  for (const code of [...SECTION_ORDER, null]) {
    const group = entries.filter((e) => known(e.sectie) === code);
    if (group.length === 0) continue;
    out.push(code ? `## ${code} ${SECTION_TITLES[code]}` : '## Niet ingedeeld', '');
    for (const e of group) out.push(...e.lines);
    out.push('');
  }
  if (entries.length === 0) out.push('_Nog niets vastgelegd._', '');
  return out.join('\n').trimEnd() + '\n';
}
