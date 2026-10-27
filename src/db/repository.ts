/**
 * All writes go through these functions, so validation and bookkeeping (updatedAt,
 * file names) happen in one place. UI components read with `useLiveQuery`.
 */
import { photoFileName } from '../checklist';
import { emptyItemState, newId, newInspection, nowIso } from '../domain/factories';
import { Inspection, type CheckItemState } from '../domain/schemas';
import type { RuleReview } from '../rules/review';
import type { Answer, PreviousReportFacts } from '../ai/schemas';
import { applyFacts } from '../ai/apply-facts';
import {
  db as defaultDb,
  type KeurKompasDB,
  type PhotoRecord,
  type Tag,
  type QuestionRecord,
  type SettingsRecord,
  type TextNoteRecord,
  type VoiceNoteRecord,
} from './db';

export const DEFAULT_SETTINGS: SettingsRecord = {
  id: 'settings',
  serverUrl: import.meta.env.VITE_API_URL ?? '',
  appToken: '',
  oneDriveClientId: import.meta.env.VITE_MS_CLIENT_ID ?? '',
  oneDriveFolder: 'KeurKompas',
  uploadAudio: true,
};

export function createRepository(db: KeurKompasDB) {
  async function getInspection(id: string): Promise<Inspection> {
    const inspection = await db.inspections.get(id);
    if (!inspection) throw new Error(`Inspectie ${id} niet gevonden`);
    return inspection;
  }

  /** Apply a change and save. The result is validated so corrupt data never reaches the DB. */
  async function updateInspection(
    id: string,
    change: (draft: Inspection) => Inspection | void,
  ): Promise<Inspection> {
    return db.transaction('rw', db.inspections, async () => {
      const current = await getInspection(id);
      const draft = structuredClone(current);
      const next = change(draft) ?? draft;
      next.updatedAt = nowIso();
      const valid = Inspection.parse(next);
      await db.inspections.put(valid);
      return valid;
    });
  }

  async function createInspection(
    fields: Parameters<typeof newInspection>[0] = {},
  ): Promise<Inspection> {
    const inspection = Inspection.parse(newInspection(fields));
    await db.inspections.add(inspection);
    return inspection;
  }

  async function deleteInspection(id: string): Promise<void> {
    const tables = [
      db.inspections,
      db.photos,
      db.voiceNotes,
      db.suggestions,
      db.textNotes,
      db.questions,
      db.syncState,
    ];
    await db.transaction('rw', tables, () =>
      Promise.all([
        db.inspections.delete(id),
        db.photos.where('inspectionId').equals(id).delete(),
        db.voiceNotes.where('inspectionId').equals(id).delete(),
        db.suggestions.where('inspectionId').equals(id).delete(),
        db.textNotes.where('inspectionId').equals(id).delete(),
        db.questions.where('inspectionId').equals(id).delete(),
        db.syncState.where('inspectionId').equals(id).delete(),
      ]),
    );
  }

  async function updateItem(
    inspectionId: string,
    itemId: string,
    patch: Partial<Omit<CheckItemState, 'itemId' | 'updatedAt'>>,
  ): Promise<Inspection> {
    return updateInspection(inspectionId, (draft) => {
      const current = draft.items[itemId] ?? emptyItemState(itemId);
      draft.items[itemId] = { ...current, ...patch, itemId, updatedAt: nowIso() };
    });
  }

  /** Next free file name for a photo in this section (T10_inkuiping_01.jpg, _02, …). */
  async function nextPhotoFileName(inspectionId: string, sectie: string | null): Promise<string> {
    const existing = new Set(
      (await db.photos.where('inspectionId').equals(inspectionId).toArray()).map((p) => p.fileName),
    );
    let n = 1;
    while (existing.has(photoFileName(sectie, n))) n++;
    return photoFileName(sectie, n);
  }

  async function addPhoto(
    photo: Pick<PhotoRecord, 'inspectionId' | 'blob' | 'width' | 'height' | 'takenAt'>,
  ): Promise<PhotoRecord> {
    const record: PhotoRecord = {
      ...photo,
      id: newId(),
      createdAt: nowIso(),
      fileName: await nextPhotoFileName(photo.inspectionId, null),
      tagStatus: 'wachtend',
      sectie: null,
      omschrijving: '',
    };
    await db.photos.add(record);
    return record;
  }

  /**
   * Sort a photo into a section (by the assistant, or by hand) and rename it to match.
   * A manual choice is never overwritten by the assistant.
   */
  async function tagPhoto(id: string, tag: Required<Tag>): Promise<void> {
    await db.transaction('rw', db.photos, async () => {
      const photo = await db.photos.get(id);
      if (!photo) return;
      if (photo.tagStatus === 'handmatig' && tag.tagStatus !== 'handmatig') return;
      const fileName =
        (photo.sectie ?? null) === tag.sectie
          ? photo.fileName
          : await nextPhotoFileName(photo.inspectionId, tag.sectie);
      await db.photos.update(id, { ...tag, fileName });
    });
  }

  async function deletePhoto(photoId: string): Promise<void> {
    await db.photos.delete(photoId);
  }

  async function addVoiceNote(
    note: Pick<VoiceNoteRecord, 'inspectionId' | 'blob' | 'mimeType' | 'durationMs'>,
  ): Promise<VoiceNoteRecord> {
    const count = await db.voiceNotes.where('inspectionId').equals(note.inspectionId).count();
    const record: VoiceNoteRecord = {
      ...note,
      id: newId(),
      label: `VN_${String(count + 1).padStart(2, '0')}`,
      recordedAt: nowIso(),
      // Transcribed and sorted later, when online. Until then the note waits in the queue.
      transcription: { status: 'wachtend', text: '', provider: null, updatedAt: null },
      tagStatus: 'wachtend',
      sectie: null,
      omschrijving: '',
    };
    await db.voiceNotes.add(record);
    return record;
  }

  async function updateVoiceNote(
    id: string,
    patch: Partial<Pick<VoiceNoteRecord, 'transcription'>>,
  ): Promise<void> {
    await db.voiceNotes.update(id, patch);
  }

  async function tagVoiceNote(id: string, tag: Required<Tag>): Promise<void> {
    const note = await db.voiceNotes.get(id);
    if (!note || (note.tagStatus === 'handmatig' && tag.tagStatus !== 'handmatig')) return;
    await db.voiceNotes.update(id, tag);
  }

  async function deleteVoiceNote(id: string): Promise<void> {
    await db.voiceNotes.delete(id);
  }

  async function setInspectionStatus(id: string, status: Inspection['status']): Promise<void> {
    await updateInspection(id, (d) => {
      d.status = status;
    });
  }

  async function saveRuleReview(review: RuleReview): Promise<void> {
    await db.ruleReviews.put(review);
  }

  async function deleteRuleReview(ruleId: string): Promise<void> {
    await db.ruleReviews.delete(ruleId);
  }

  // --- Previous report -------------------------------------------------------

  /** Store the text extracted on the device; the assistant reads it when online. */
  async function setPreviousReport(inspectionId: string, fileName: string, text: string) {
    return updateInspection(inspectionId, (d) => {
      d.vorigVerslag = {
        fileName,
        text,
        importedAt: nowIso(),
        status: 'wachtend',
        facts: null,
        error: null,
      };
    });
  }

  async function setPreviousReportStatus(
    inspectionId: string,
    status: 'wachtend' | 'bezig' | 'mislukt',
    error: string | null = null,
  ) {
    return updateInspection(inspectionId, (d) => {
      if (d.vorigVerslag) d.vorigVerslag = { ...d.vorigVerslag, status, error };
    });
  }

  async function setPreviousReportFacts(inspectionId: string, facts: PreviousReportFacts) {
    return updateInspection(inspectionId, (d) => {
      if (!d.vorigVerslag) return;
      d.vorigVerslag = { ...d.vorigVerslag, status: 'klaar', facts, error: null };
      applyFacts(d, facts);
    });
  }

  async function setRemarkChecked(inspectionId: string, remarkId: string, checked: boolean) {
    return updateInspection(inspectionId, (d) => {
      d.vorigeKeuring.openOpmerkingen = d.vorigeKeuring.openOpmerkingen.map((r) =>
        r.id === remarkId ? { ...r, checked } : r,
      );
    });
  }

  async function dismissHint(inspectionId: string, ruleId: string) {
    return updateInspection(inspectionId, (d) => {
      if (!d.verborgenHints.includes(ruleId)) d.verborgenHints.push(ruleId);
    });
  }

  // --- Text notes -------------------------------------------------------------

  async function addTextNote(inspectionId: string, text: string): Promise<TextNoteRecord> {
    const record: TextNoteRecord = {
      id: newId(),
      inspectionId,
      text: text.trim(),
      createdAt: nowIso(),
      tagStatus: 'wachtend',
      sectie: null,
      omschrijving: '',
    };
    await db.textNotes.add(record);
    return record;
  }

  async function updateTextNote(id: string, text: string) {
    const note = await db.textNotes.get(id);
    // Edited text gets sorted again, unless the inspector chose the section.
    await db.textNotes.update(id, {
      text: text.trim(),
      ...(note?.tagStatus === 'handmatig' ? {} : { tagStatus: 'wachtend' as const }),
    });
  }

  async function tagTextNote(id: string, tag: Required<Tag>): Promise<void> {
    const note = await db.textNotes.get(id);
    if (!note || (note.tagStatus === 'handmatig' && tag.tagStatus !== 'handmatig')) return;
    await db.textNotes.update(id, tag);
  }

  async function deleteTextNote(id: string) {
    await db.textNotes.delete(id);
  }

  // --- Questions and feedback -------------------------------------------------

  async function addQuestion(
    inspectionId: string,
    vraag: string,
    photoIds: string[],
  ): Promise<QuestionRecord> {
    const record: QuestionRecord = {
      id: newId(),
      inspectionId,
      vraag: vraag.trim(),
      photoIds,
      status: 'wachtend',
      answer: null,
      error: null,
      createdAt: nowIso(),
      answeredAt: null,
      feedback: null,
    };
    await db.questions.add(record);
    return record;
  }

  async function setQuestionStatus(
    id: string,
    status: 'wachtend' | 'bezig' | 'mislukt',
    error: string | null = null,
  ) {
    await db.questions.update(id, { status, error });
  }

  async function setAnswer(id: string, answer: Answer) {
    await db.questions.update(id, { status: 'klaar', answer, error: null, answeredAt: nowIso() });
  }

  /**
   * The inspector's verdict on an answer (👍 / 👎). 👎 with a correction becomes a proposed
   * lesson; it only affects later answers after approval in the Lessen screen.
   * Changing the verdict removes a lesson that was not approved yet.
   */
  async function setFeedback(questionId: string, verdict: 'klopt' | 'fout' | null, correctie = '') {
    await db.transaction('rw', db.questions, db.lessen, async () => {
      const q = await db.questions.get(questionId);
      if (!q) return;
      const existing = await db.lessen.get(`les-${questionId}`);
      if (existing?.status !== 'goedgekeurd') await db.lessen.delete(`les-${questionId}`);
      if (verdict === null) {
        await db.questions.update(questionId, { feedback: null });
        return;
      }
      await db.questions.update(questionId, {
        feedback: { verdict, correctie: correctie.trim(), at: nowIso() },
      });
      if (
        verdict === 'fout' &&
        correctie.trim() &&
        q.answer &&
        existing?.status !== 'goedgekeurd'
      ) {
        await db.lessen.put({
          id: `les-${questionId}`,
          vraag: q.vraag,
          fout_antwoord: q.answer.antwoord,
          correctie: correctie.trim(),
          status: 'voorgesteld',
          photoIds: q.photoIds,
          answer: q.answer,
          createdAt: nowIso(),
          decidedAt: null,
          inspectionId: q.inspectionId,
          questionId,
        });
      }
    });
  }

  async function updateLesson(id: string, correctie: string) {
    await db.lessen.update(id, { correctie: correctie.trim() });
  }

  /** Approve or reject a lesson. Only approved lessons are sent to the assistant. */
  async function decideLesson(id: string, status: 'goedgekeurd' | 'afgewezen' | 'voorgesteld') {
    await db.lessen.update(id, { status, decidedAt: status === 'voorgesteld' ? null : nowIso() });
  }

  async function deleteLesson(id: string) {
    await db.lessen.delete(id);
  }

  // --- Settings ----------------------------------------------------------------

  async function getSettings(): Promise<SettingsRecord> {
    return { ...DEFAULT_SETTINGS, ...(await db.settings.get('settings')) };
  }

  async function saveSettings(patch: Partial<Omit<SettingsRecord, 'id'>>) {
    await db.settings.put({ ...(await getSettings()), ...patch, id: 'settings' });
  }

  return {
    setPreviousReport,
    setPreviousReportStatus,
    setPreviousReportFacts,
    setRemarkChecked,
    dismissHint,
    addTextNote,
    updateTextNote,
    tagTextNote,
    deleteTextNote,
    addQuestion,
    setQuestionStatus,
    setAnswer,
    setFeedback,
    updateLesson,
    decideLesson,
    deleteLesson,
    getSettings,
    saveSettings,
    getInspection,
    setInspectionStatus,
    saveRuleReview,
    deleteRuleReview,
    createInspection,
    updateInspection,
    deleteInspection,
    updateItem,
    addPhoto,
    tagPhoto,
    deletePhoto,
    addVoiceNote,
    updateVoiceNote,
    tagVoiceNote,
    deleteVoiceNote,
  };
}

export const repo = createRepository(defaultDb);
