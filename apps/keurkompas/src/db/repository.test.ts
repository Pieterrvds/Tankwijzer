import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Answer } from '../ai/schemas';
import { KeurKompasDB } from './db';
import { createRepository } from './repository';

let db: KeurKompasDB;
let repo: ReturnType<typeof createRepository>;

beforeEach(async () => {
  db = new KeurKompasDB(`test-${crypto.randomUUID()}`);
  repo = createRepository(db);
});

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
const photo = (inspectionId: string) => ({
  inspectionId,
  blob: jpeg(),
  width: 1,
  height: 1,
  takenAt: null,
});
const ANSWER: Answer = {
  antwoord: 'Kijkglas is OK.',
  zekerheid: 'middel',
  te_bevestigen: false,
  bronnen: [],
  sectie: 'T8',
  voorstel_tekst: null,
  nakijken: [],
};

describe('repository', () => {
  it('refuses to save invalid data', async () => {
    const i = await repo.createInspection();
    await expect(
      repo.updateInspection(i.id, (d) => {
        (d as { status: string }).status = 'kapot';
      }),
    ).rejects.toThrow();
    expect((await repo.getInspection(i.id)).status).toBe('open');
  });

  it('names photos FOTO_nn until sorted, then T10_inkuiping_nn', async () => {
    const i = await repo.createInspection();
    const a = await repo.addPhoto(photo(i.id));
    const b = await repo.addPhoto(photo(i.id));
    expect([a.fileName, b.fileName]).toEqual(['FOTO_01.jpg', 'FOTO_02.jpg']);
    await repo.tagPhoto(a.id, {
      tagStatus: 'klaar',
      sectie: 'T10',
      omschrijving: 'water in inkuiping',
    });
    await repo.tagPhoto(b.id, { tagStatus: 'klaar', sectie: 'T10', omschrijving: '' });
    expect((await db.photos.get(a.id))?.fileName).toBe('T10_inkuiping_01.jpg');
    expect((await db.photos.get(b.id))?.fileName).toBe('T10_inkuiping_02.jpg');
  });

  it('never lets the assistant override a section chosen by hand', async () => {
    const i = await repo.createInspection();
    const p = await repo.addPhoto(photo(i.id));
    await repo.tagPhoto(p.id, { tagStatus: 'handmatig', sectie: 'T11', omschrijving: '' });
    await repo.tagPhoto(p.id, { tagStatus: 'klaar', sectie: 'T10', omschrijving: '' });
    expect(await db.photos.get(p.id)).toMatchObject({ sectie: 'T11', tagStatus: 'handmatig' });
  });

  it('numbers voice notes VN_01, VN_02 and queues them for transcription and sorting', async () => {
    const i = await repo.createInspection();
    const note = {
      inspectionId: i.id,
      blob: new Blob(['x']),
      mimeType: 'audio/webm',
      durationMs: 2000,
    };
    const v1 = await repo.addVoiceNote(note);
    const v2 = await repo.addVoiceNote(note);
    expect([v1.label, v2.label]).toEqual(['VN_01', 'VN_02']);
    expect(v1.transcription.status).toBe('wachtend');
    expect(v1.tagStatus).toBe('wachtend');
  });

  it('turns 👎 + correction into a proposed lesson that only counts after approval', async () => {
    const i = await repo.createInspection();
    const q = await repo.addQuestion(i.id, 'Is dit een kijkglas?', []);
    await repo.setAnswer(q.id, ANSWER);
    await repo.setFeedback(q.id, 'fout', 'Dit is een vlotter, geen kijkglas.');
    const [lesson] = await db.lessen.toArray();
    expect(lesson).toMatchObject({
      status: 'voorgesteld',
      correctie: 'Dit is een vlotter, geen kijkglas.',
      answer: ANSWER,
    });

    // Changing the verdict removes a lesson that was not approved yet…
    await repo.setFeedback(q.id, 'klopt');
    expect(await db.lessen.count()).toBe(0);

    // …but an approved lesson is kept.
    await repo.setFeedback(q.id, 'fout', 'Vlotter.');
    await repo.decideLesson(`les-${q.id}`, 'goedgekeurd');
    await repo.setFeedback(q.id, 'klopt');
    expect((await db.lessen.get(`les-${q.id}`))?.status).toBe('goedgekeurd');
  });

  it('deletes an inspection together with everything captured', async () => {
    const i = await repo.createInspection();
    await repo.addPhoto(photo(i.id));
    await repo.addVoiceNote({
      inspectionId: i.id,
      blob: new Blob(['x']),
      mimeType: 'audio/webm',
      durationMs: 1000,
    });
    await repo.addTextNote(i.id, 'notitie');
    await repo.addQuestion(i.id, 'vraag', []);
    await repo.deleteInspection(i.id);
    for (const table of [db.inspections, db.photos, db.voiceNotes, db.textNotes, db.questions]) {
      expect(await table.count()).toBe(0);
    }
  });

  it('keeps default settings until changed', async () => {
    expect((await repo.getSettings()).oneDriveFolder).toBe('KeurKompas');
    await repo.saveSettings({ serverUrl: 'https://x' });
    expect(await repo.getSettings()).toMatchObject({
      serverUrl: 'https://x',
      oneDriveFolder: 'KeurKompas',
    });
  });
});
