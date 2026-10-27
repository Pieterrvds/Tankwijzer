/**
 * All writes go through these functions, so validation and bookkeeping (updatedAt,
 * file names) happen in one place. UI components read with `useLiveQuery`.
 */
import { checklistFor, findItem, photoFileName } from '../checklist';
import { emptyItemState, newId, newInspection, nowIso } from '../domain/factories';
import { Inspection, type CheckItemState } from '../domain/schemas';
import type { RuleReview } from '../rules/review';
import { db as defaultDb, type KeurKompasDB, type PhotoRecord, type VoiceNoteRecord } from './db';

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
    await db.transaction('rw', [db.inspections, db.photos, db.voiceNotes, db.suggestions], () =>
      Promise.all([
        db.inspections.delete(id),
        db.photos.where('inspectionId').equals(id).delete(),
        db.voiceNotes.where('inspectionId').equals(id).delete(),
        db.suggestions.where('inspectionId').equals(id).delete(),
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

  /** Next free file name for a photo on this item (T10_inkuiping_01.jpg, _02, …). */
  async function nextPhotoFileName(inspectionId: string, itemId: string | null): Promise<string> {
    const inspection = await getInspection(inspectionId);
    const item = itemId ? (findItem(checklistFor(inspection), itemId) ?? null) : null;
    const existing = new Set(
      (await db.photos.where('inspectionId').equals(inspectionId).toArray()).map((p) => p.fileName),
    );
    let n = 1;
    while (existing.has(photoFileName(item, n))) n++;
    return photoFileName(item, n);
  }

  async function addPhoto(
    photo: Omit<PhotoRecord, 'id' | 'createdAt' | 'fileName'>,
  ): Promise<PhotoRecord> {
    const record: PhotoRecord = {
      ...photo,
      id: newId(),
      createdAt: nowIso(),
      fileName: await nextPhotoFileName(photo.inspectionId, photo.itemId),
    };
    await db.photos.add(record);
    return record;
  }

  /** Assign a photo to another item (or back to the unsorted tray); renames it accordingly. */
  async function movePhoto(photoId: string, itemId: string | null): Promise<void> {
    const photo = await db.photos.get(photoId);
    if (!photo || photo.itemId === itemId) return;
    const fileName = await nextPhotoFileName(photo.inspectionId, itemId);
    await db.photos.update(photoId, { itemId, fileName });
  }

  async function deletePhoto(photoId: string): Promise<void> {
    await db.photos.delete(photoId);
  }

  async function addVoiceNote(
    note: Pick<VoiceNoteRecord, 'inspectionId' | 'itemId' | 'blob' | 'mimeType' | 'durationMs'>,
  ): Promise<VoiceNoteRecord> {
    const count = await db.voiceNotes.where('inspectionId').equals(note.inspectionId).count();
    const record: VoiceNoteRecord = {
      ...note,
      id: newId(),
      label: `VN_${String(count + 1).padStart(2, '0')}`,
      recordedAt: nowIso(),
      // Transcription runs later, when online (M4). Until then the note waits in the queue.
      transcription: { status: 'wachtend', text: '', provider: null, updatedAt: null },
    };
    await db.voiceNotes.add(record);
    return record;
  }

  async function updateVoiceNote(
    id: string,
    patch: Partial<Pick<VoiceNoteRecord, 'itemId' | 'transcription'>>,
  ): Promise<void> {
    await db.voiceNotes.update(id, patch);
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

  return {
    getInspection,
    setInspectionStatus,
    saveRuleReview,
    deleteRuleReview,
    createInspection,
    updateInspection,
    deleteInspection,
    updateItem,
    addPhoto,
    movePhoto,
    deletePhoto,
    addVoiceNote,
    updateVoiceNote,
    deleteVoiceNote,
  };
}

export const repo = createRepository(defaultDb);
