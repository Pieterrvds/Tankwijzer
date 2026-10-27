import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { KeurKompasDB } from './db';
import { createRepository } from './repository';

let db: KeurKompasDB;
let repo: ReturnType<typeof createRepository>;

beforeEach(async () => {
  db = new KeurKompasDB(`test-${crypto.randomUUID()}`);
  repo = createRepository(db);
});

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });

describe('repository', () => {
  it('creates and updates an inspection item', async () => {
    const i = await repo.createInspection({ klant: 'Klant NV' });
    await repo.updateItem(i.id, 'T10.dichtheid', { status: 'NOK' });
    await repo.updateItem(i.id, 'T10.dichtheid', { beschrijving: 'Scheur in de bodem' });
    const saved = await repo.getInspection(i.id);
    expect(saved.items['T10.dichtheid']).toMatchObject({
      status: 'NOK',
      beschrijving: 'Scheur in de bodem',
    });
  });

  it('refuses to save invalid data', async () => {
    const i = await repo.createInspection();
    await expect(
      repo.updateInspection(i.id, (d) => {
        (d as { status: string }).status = 'kapot';
      }),
    ).rejects.toThrow();
    expect((await repo.getInspection(i.id)).status).toBe('open');
  });

  it('names photos per item and renames them when moved', async () => {
    const i = await repo.createInspection();
    const base = { inspectionId: i.id, blob: jpeg(), width: 1, height: 1, takenAt: null };
    const a = await repo.addPhoto({ ...base, itemId: 'T10.dichtheid' });
    const b = await repo.addPhoto({ ...base, itemId: 'T10.dichtheid' });
    const c = await repo.addPhoto({ ...base, itemId: null });
    expect([a.fileName, b.fileName, c.fileName]).toEqual([
      'T10_dichtheid_01.jpg',
      'T10_dichtheid_02.jpg',
      'ONGESORTEERD_01.jpg',
    ]);
    await repo.movePhoto(c.id, 'T10.dichtheid');
    expect((await db.photos.get(c.id))?.fileName).toBe('T10_dichtheid_03.jpg');
  });

  it('numbers voice notes VN_01, VN_02 and queues them for transcription', async () => {
    const i = await repo.createInspection();
    const blob = new Blob(['x'], { type: 'audio/webm' });
    const note = {
      inspectionId: i.id,
      itemId: null,
      blob,
      mimeType: 'audio/webm',
      durationMs: 2000,
    };
    const v1 = await repo.addVoiceNote(note);
    const v2 = await repo.addVoiceNote(note);
    expect([v1.label, v2.label]).toEqual(['VN_01', 'VN_02']);
    expect(v1.transcription.status).toBe('wachtend');
  });

  it('deletes an inspection together with its photos and voice notes', async () => {
    const i = await repo.createInspection();
    await repo.addPhoto({
      inspectionId: i.id,
      itemId: null,
      blob: jpeg(),
      width: 1,
      height: 1,
      takenAt: null,
    });
    await repo.addVoiceNote({
      inspectionId: i.id,
      itemId: null,
      blob: new Blob(['x']),
      mimeType: 'audio/webm',
      durationMs: 1000,
    });
    await repo.deleteInspection(i.id);
    expect(await db.inspections.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
    expect(await db.voiceNotes.count()).toBe(0);
  });
});
