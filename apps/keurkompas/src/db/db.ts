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
import type { Answer } from '../ai/schemas';
import type { AiSuggestion, Inspection } from '../domain/schemas';
import type { RuleReview } from '../rules/review';

/**
 * Background sorting into a BEPO section (T2–T20). `handmatig` = set by the inspector; the
 * assistant never overrides that. Missing on records from before v3 = treat as `wachtend`.
 */
export interface Tag {
  tagStatus?: 'wachtend' | 'klaar' | 'handmatig' | 'mislukt';
  sectie?: string | null;
  /** Short caption from the assistant, e.g. "Kijkglas lekdetectie, droog". */
  omschrijving?: string;
}

export interface PhotoRecord extends Tag {
  id: string;
  inspectionId: string;
  /** e.g. T10_inkuiping_01.jpg, or FOTO_01.jpg until sorted — renamed when tagged. */
  fileName: string;
  blob: Blob;
  width: number;
  height: number;
  /** Original capture time from EXIF (DateTimeOriginal), else the file time. ISO string. */
  takenAt: string | null;
  createdAt: string;
}

export type TranscriptionStatus = 'wachtend' | 'bezig' | 'klaar' | 'mislukt';

export interface VoiceNoteRecord extends Tag {
  id: string;
  inspectionId: string;
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

export interface TextNoteRecord extends Tag {
  id: string;
  inspectionId: string;
  text: string;
  createdAt: string;
}

export type QuestionStatus = 'wachtend' | 'bezig' | 'klaar' | 'mislukt';

/** A question to the assistant, with its answer and the inspector's feedback. */
export interface QuestionRecord {
  id: string;
  inspectionId: string;
  vraag: string;
  /** Photos sent along with the question. */
  photoIds: string[];
  status: QuestionStatus;
  answer: Answer | null;
  error: string | null;
  createdAt: string;
  answeredAt: string | null;
  feedback: { verdict: 'klopt' | 'fout'; correctie: string; at: string } | null;
}

/**
 * A correction the inspector made to an answer ("les"). Safe learning loop: it only affects
 * later answers once the inspector approved it in the Lessen screen. Approved lessons are also
 * synced to OneDrive, to be added permanently to knowledge/lessons.md and the evals.
 */
export interface LessonRecord {
  id: string;
  vraag: string;
  fout_antwoord: string;
  correctie: string;
  status: 'voorgesteld' | 'goedgekeurd' | 'afgewezen';
  /** The original inputs: photos sent with the question and the full answer. */
  photoIds: string[];
  answer: Answer;
  createdAt: string;
  decidedAt: string | null;
  inspectionId: string;
  questionId: string;
}

export interface SettingsRecord {
  id: 'settings';
  /** e.g. https://keurkompas-api.<account>.workers.dev */
  serverUrl: string;
  appToken: string;
  /** Application (client) ID of the Microsoft app registration. */
  oneDriveClientId: string;
  /** Root folder in OneDrive. */
  oneDriveFolder: string;
  /** Also upload the audio of voice notes (transcripts are always in notities.md). */
  uploadAudio: boolean;
}

/** What has been uploaded to OneDrive: one row per file path, with a hash of its content. */
export interface SyncRecord {
  path: string;
  inspectionId: string;
  hash: string;
  uploadedAt: string;
}

export class KeurKompasDB extends Dexie {
  inspections!: EntityTable<Inspection, 'id'>;
  photos!: EntityTable<PhotoRecord, 'id'>;
  voiceNotes!: EntityTable<VoiceNoteRecord, 'id'>;
  suggestions!: EntityTable<AiSuggestion, 'id'>;
  ruleReviews!: EntityTable<RuleReview, 'ruleId'>;
  textNotes!: EntityTable<TextNoteRecord, 'id'>;
  questions!: EntityTable<QuestionRecord, 'id'>;
  lessen!: EntityTable<LessonRecord, 'id'>;
  settings!: EntityTable<SettingsRecord, 'id'>;
  syncState!: EntityTable<SyncRecord, 'path'>;

  constructor(name = 'keurkompas') {
    super(name);
    this.version(1).stores({
      inspections: 'id, updatedAt, status',
      photos: 'id, inspectionId, itemId, createdAt',
      voiceNotes: 'id, inspectionId, itemId, recordedAt',
      suggestions: 'id, inspectionId, itemId, decision',
    });
    // v2 (M2): the inspector's review of each rule ("Regels nakijken").
    this.version(2).stores({
      ruleReviews: 'ruleId',
    });
    // v3: capture-first app with the assistant and OneDrive sync.
    this.version(3)
      .stores({
        textNotes: 'id, inspectionId, createdAt',
        questions: 'id, inspectionId, status, createdAt',
        lessen: 'id, createdAt',
        settings: 'id',
        syncState: 'path, inspectionId',
      })
      .upgrade((tx) =>
        tx
          .table('inspections')
          .toCollection()
          .modify((i: Record<string, unknown>) => {
            i.schemaVersion = 2;
            i.omschrijving ??= '';
            i.vorigVerslag ??= null;
            i.verborgenHints ??= [];
          }),
      );
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
