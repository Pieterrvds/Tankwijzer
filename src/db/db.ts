/**
 * Offline storage: IndexedDB through Dexie.
 *
 * - `inspections` holds the structured data (validated by the Zod schema on write).
 * - `photos` and `voiceNotes` hold the binary blobs, linked by inspectionId (+ itemId).
 *   They are kept in separate tables so listing inspections never loads megabytes of media.
 *
 * When changing a table's indexes, add a new `this.version(n)` block — never edit an old one,
 * or existing data on the inspector's phone will not upgrade.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { AiSuggestion, Inspection } from '../domain/schemas';

export interface PhotoRecord {
  id: string;
  inspectionId: string;
  /** null = in the "ongesorteerd" tray, to be assigned to an item later. */
  itemId: string | null;
  /** e.g. T10_inkuiping_01.jpg — recomputed on assignment. */
  fileName: string;
  blob: Blob;
  width: number;
  height: number;
  /** Original capture time from EXIF (DateTimeOriginal), else the file time. ISO string. */
  takenAt: string | null;
  createdAt: string;
}

export type TranscriptionStatus = 'wachtend' | 'bezig' | 'klaar' | 'mislukt';

export interface VoiceNoteRecord {
  id: string;
  inspectionId: string;
  itemId: string | null;
  /** e.g. VN_01 — used for the export file names. */
  label: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  recordedAt: string;
  transcription: {
    status: TranscriptionStatus;
    text: string;
    provider: string | null;
    updatedAt: string | null;
  };
}

export class KeurKompasDB extends Dexie {
  inspections!: EntityTable<Inspection, 'id'>;
  photos!: EntityTable<PhotoRecord, 'id'>;
  voiceNotes!: EntityTable<VoiceNoteRecord, 'id'>;
  suggestions!: EntityTable<AiSuggestion, 'id'>;

  constructor(name = 'keurkompas') {
    super(name);
    this.version(1).stores({
      inspections: 'id, updatedAt, status',
      photos: 'id, inspectionId, itemId, createdAt',
      voiceNotes: 'id, inspectionId, itemId, recordedAt',
      suggestions: 'id, inspectionId, itemId, decision',
    });
  }
}

export const db = new KeurKompasDB();

/**
 * Ask the browser not to evict our data under storage pressure. Important on iOS/Android:
 * without this, photos captured offline could be cleared before they are exported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
