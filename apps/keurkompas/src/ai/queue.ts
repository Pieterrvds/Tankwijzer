/**
 * Background work that needs the network: transcribe voice notes, read the previous report,
 * answer questions. Everything is stored first and processed here when there is signal, so
 * nothing is lost offline. Runs on start, when the network returns, after new work is added,
 * and every 30 seconds.
 */
import { db as defaultDb, type KeurKompasDB } from '../db/db';
import { createRepository } from '../db/repository';
import { audioExtension } from '../capture/audio';
import { blobToBase64, buildAskRequest } from './context';
import type { TagResult } from './schemas';
import { AiError, createServerProvider, type AiProvider } from './provider';

let previewProvider: Promise<AiProvider | null> | null = null;

/** The provider for the current settings, or null when the app is not connected yet. */
export async function currentProvider(db: KeurKompasDB = defaultDb): Promise<AiProvider | null> {
  if (import.meta.env.VITE_PREVIEW === 'true') {
    previewProvider ??= import('./preview-provider').then((m) => m.createPreviewProvider());
    return previewProvider;
  }
  const settings = await createRepository(db).getSettings();
  return settings.serverUrl && settings.appToken ? createServerProvider(settings) : null;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Onbekende fout';
}

/** true = stop this round (network/server temporarily unavailable). */
function shouldStop(e: unknown): boolean {
  return e instanceof AiError ? e.retry : true;
}

export async function processQueue(
  provider: AiProvider,
  db: KeurKompasDB = defaultDb,
): Promise<void> {
  const repo = createRepository(db);

  // 1. Voice notes → text (the answers use the transcripts, so these go first).
  if (provider.transcribe) {
    const notes = await db.voiceNotes
      .filter((n) => n.transcription.status === 'wachtend')
      .toArray();
    for (const note of notes) {
      try {
        const name = `${note.label}.${audioExtension(note.mimeType)}`;
        const { text, provider: by } = await provider.transcribe(note.blob, name);
        await repo.updateVoiceNote(note.id, {
          transcription: {
            status: 'klaar',
            text,
            provider: by,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (e) {
        if (shouldStop(e)) return;
        await repo.updateVoiceNote(note.id, {
          transcription: {
            ...note.transcription,
            status: 'mislukt',
            updatedAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  // 2. Previous reports → facts and aandachtspunten.
  //    (Before tagging: the summary helps to sort photos and notes.)
  const reports = await db.inspections
    .filter((i) => i.vorigVerslag?.status === 'wachtend')
    .toArray();
  for (const inspection of reports) {
    try {
      await repo.setPreviousReportStatus(inspection.id, 'bezig');
      const facts = await provider.extract(inspection.vorigVerslag!.text);
      await repo.setPreviousReportFacts(inspection.id, facts);
    } catch (e) {
      const stop = shouldStop(e);
      await repo.setPreviousReportStatus(
        inspection.id,
        stop ? 'wachtend' : 'mislukt',
        messageOf(e),
      );
      if (stop) return;
    }
  }

  // 3. Questions, oldest first.
  //    (Before tagging: the inspector is waiting for these.)
  const questions = await db.questions.where('status').equals('wachtend').sortBy('createdAt');
  for (const question of questions) {
    try {
      await repo.setQuestionStatus(question.id, 'bezig');
      const answer = await provider.ask(await buildAskRequest(db, question));
      await repo.setAnswer(question.id, answer);
    } catch (e) {
      const stop = shouldStop(e);
      await repo.setQuestionStatus(question.id, stop ? 'wachtend' : 'mislukt', messageOf(e));
      if (stop) return;
    }
  }

  // 4. Sort photos and notes into T-sections, so the export on the PC is ordered.
  const isOpen = (t: { tagStatus?: string }) => !t.tagStatus || t.tagStatus === 'wachtend';
  const contextOf = async (inspectionId: string) =>
    (await db.inspections.get(inspectionId))?.vorigVerslag?.facts?.samenvatting ?? '';
  const done = (r: TagResult) => ({
    tagStatus: 'klaar' as const,
    sectie: /^T([2-9]|1\d|20)$/.test(r.sectie ?? '') ? r.sectie : null,
    omschrijving: r.omschrijving.slice(0, 120),
  });
  const failed = { tagStatus: 'mislukt' as const, sectie: null, omschrijving: '' };

  for (const photo of await db.photos.filter(isOpen).toArray()) {
    try {
      const foto = {
        label: photo.fileName,
        mediaType: 'image/jpeg' as const,
        data: await blobToBase64(photo.blob),
      };
      const r = await provider.tag({
        tekst: null,
        foto,
        context: await contextOf(photo.inspectionId),
      });
      await repo.tagPhoto(photo.id, done(r));
    } catch (e) {
      if (shouldStop(e)) return;
      await repo.tagPhoto(photo.id, failed);
    }
  }
  const voice = await db.voiceNotes
    .filter((n) => isOpen(n) && n.transcription.status === 'klaar')
    .toArray();
  for (const note of voice) {
    try {
      const r = await provider.tag({
        tekst: note.transcription.text,
        foto: null,
        context: await contextOf(note.inspectionId),
      });
      await repo.tagVoiceNote(note.id, done(r));
    } catch (e) {
      if (shouldStop(e)) return;
      await repo.tagVoiceNote(note.id, failed);
    }
  }
  for (const note of await db.textNotes.filter(isOpen).toArray()) {
    try {
      const r = await provider.tag({
        tekst: note.text,
        foto: null,
        context: await contextOf(note.inspectionId),
      });
      await repo.tagTextNote(note.id, done(r));
    } catch (e) {
      if (shouldStop(e)) return;
      await repo.tagTextNote(note.id, failed);
    }
  }
}

let running: Promise<void> | null = null;

/** Run the queue once (never twice at the same time). Safe to call often. */
export function kickQueue(): Promise<void> {
  if (running || !navigator.onLine) return running ?? Promise.resolve();
  running = (async () => {
    const provider = await currentProvider();
    if (provider) await processQueue(provider);
  })()
    .catch((e) => console.error('Werkrij', e))
    .finally(() => {
      running = null;
    });
  return running;
}

/** Start the background loop. Call once at app start. */
export function startQueue(): () => void {
  void kickQueue();
  const onOnline = () => void kickQueue();
  window.addEventListener('online', onOnline);
  const timer = setInterval(() => void kickQueue(), 30_000);
  return () => {
    window.removeEventListener('online', onOnline);
    clearInterval(timer);
  };
}

/** Is the assistant connected? (Preview: always; app: once server address + key are set.) */
export function isAssistantConfigured(
  settings: { serverUrl: string; appToken: string } | undefined,
): boolean {
  return import.meta.env.VITE_PREVIEW === 'true' || !!(settings?.serverUrl && settings.appToken);
}
