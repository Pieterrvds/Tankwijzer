/**
 * The OneDrive sync loop: uploads new photos, voice notes and the updated notities.md of every
 * inspection, plus the lessen. Idempotent and resumable: what was uploaded is remembered per
 * file (path + hash), so after a lost connection it simply continues.
 */
import { useSyncExternalStore } from 'react';
import { db as defaultDb, type KeurKompasDB } from '../db/db';
import { createRepository } from '../db/repository';
import { GraphError, uploadFile } from './graph';
import { getToken } from './onedrive';
import { planInspection, planLessons, type PlannedFile } from './plan';

export type SyncState = 'uit' | 'aanmelden' | 'bezig' | 'ok' | 'wacht' | 'fout';

export interface SyncStatus {
  state: SyncState;
  message: string;
  /** Files still to upload, per inspection id. */
  pending: Record<string, number>;
  lastSuccess: string | null;
}

let status: SyncStatus = { state: 'uit', message: '', pending: {}, lastSuccess: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/** Work out which planned files still need uploading. Exported for tests. */
export async function pendingFiles(db: KeurKompasDB, files: PlannedFile[]): Promise<PlannedFile[]> {
  const done = await db.syncState.bulkGet(files.map((f) => f.path));
  return files.filter((f, n) => done[n]?.hash !== f.hash);
}

async function planAll(db: KeurKompasDB, root: string, uploadAudio: boolean) {
  const inspections = await db.inspections.toArray();
  const plans: { inspectionId: string; files: PlannedFile[] }[] = [];
  for (const inspection of inspections) {
    const id = inspection.id;
    const [photos, voiceNotes, textNotes, questions] = await Promise.all([
      db.photos.where('inspectionId').equals(id).sortBy('createdAt'),
      db.voiceNotes.where('inspectionId').equals(id).sortBy('recordedAt'),
      db.textNotes.where('inspectionId').equals(id).sortBy('createdAt'),
      db.questions.where('inspectionId').equals(id).sortBy('createdAt'),
    ]);
    const files = planInspection(
      root,
      { inspection, photos, voiceNotes, textNotes, questions },
      uploadAudio,
    );
    plans.push({ inspectionId: id, files: await pendingFiles(db, files) });
  }
  const lessen = planLessons(root, await db.lessen.orderBy('createdAt').toArray());
  if (lessen) plans.push({ inspectionId: '_lessen', files: await pendingFiles(db, [lessen]) });
  return plans;
}

export async function syncOnce(
  db: KeurKompasDB = defaultDb,
  token: (clientId: string) => Promise<string | null> = getToken,
  upload: typeof uploadFile = uploadFile,
): Promise<void> {
  const settings = await createRepository(db).getSettings();
  if (!settings.oneDriveClientId) {
    setStatus({ state: 'uit', message: 'OneDrive is niet ingesteld.' });
    return;
  }
  const plans = await planAll(db, settings.oneDriveFolder, settings.uploadAudio);
  const pending = Object.fromEntries(plans.map((p) => [p.inspectionId, p.files.length]));
  setStatus({ pending });
  if (!navigator.onLine) {
    setStatus({ state: 'wacht', message: 'Wacht op netwerk.' });
    return;
  }
  const accessToken = await token(settings.oneDriveClientId);
  if (!accessToken) {
    setStatus({ state: 'aanmelden', message: 'Meld je aan bij OneDrive (Instellingen).' });
    return;
  }

  setStatus({ state: 'bezig', message: 'Uploaden…' });
  for (const plan of plans) {
    for (const file of plan.files) {
      try {
        await upload(accessToken, file.path, file.load());
      } catch (e) {
        if (e instanceof GraphError && e.status === 401) {
          setStatus({ state: 'aanmelden', message: 'Meld je opnieuw aan bij OneDrive.' });
        } else if (e instanceof GraphError) {
          setStatus({ state: 'fout', message: e.message });
        } else {
          setStatus({ state: 'wacht', message: 'Verbinding weggevallen; later verder.' });
        }
        return;
      }
      await db.syncState.put({
        path: file.path,
        inspectionId: plan.inspectionId,
        hash: file.hash,
        uploadedAt: new Date().toISOString(),
      });
      pending[plan.inspectionId] = (pending[plan.inspectionId] ?? 1) - 1;
      setStatus({ pending: { ...pending } });
    }
  }
  setStatus({
    state: 'ok',
    message: 'Alles staat op OneDrive.',
    lastSuccess: new Date().toISOString(),
  });
}

let running: Promise<void> | null = null;
let again = false;

/** Start a sync now (or right after the one that is running). */
export function kickSync(): void {
  if (running) {
    again = true;
    return;
  }
  running = syncOnce()
    .catch((e) => {
      console.error('OneDrive', e);
      setStatus({ state: 'fout', message: 'OneDrive-synchronisatie mislukt.' });
    })
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        kickSync();
      }
    });
}

export function startSync(): () => void {
  kickSync();
  const onOnline = () => kickSync();
  window.addEventListener('online', onOnline);
  const timer = setInterval(kickSync, 60_000);
  return () => {
    window.removeEventListener('online', onOnline);
    clearInterval(timer);
  };
}
