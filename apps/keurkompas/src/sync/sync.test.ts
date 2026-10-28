import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Answer } from '../ai/schemas';
import { KeurKompasDB } from '../db/db';
import { createRepository } from '../db/repository';
import { newInspection } from '../domain/factories';
import { encodePath, GraphError, uploadFile } from './graph';
import { renderNotesMd } from './notes-md';
import { inspectionFolder, planInspection, safeName } from './plan';
import { syncOnce } from './sync';

const ANSWER: Answer = {
  antwoord: 'Alarmfluit volstaat tot 31/12/2027.',
  zekerheid: 'hoog',
  te_bevestigen: false,
  bronnen: [{ bron: 'regel', referentie: 'overvulling.alarmfluit_tot_2027', citaat: '' }],
  sectie: 'T11',
  voorstel_tekst: null,
  nakijken: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('notes.md', () => {
  it('groups notes per T-section and keeps only answers marked 👍 (or corrected)', () => {
    const inspection = newInspection({
      klant: 'Klant NV',
      datum: '2026-10-27',
      omschrijving: 'Tank 3',
    });
    const t = (h: number) => `2026-10-27T${String(h).padStart(2, '0')}:00:00`;
    const md = renderNotesMd({
      inspection,
      photos: [
        {
          id: 'p1',
          inspectionId: '',
          fileName: 'T10_inkuiping_01.jpg',
          blob: new Blob(),
          width: 1,
          height: 1,
          takenAt: t(9),
          createdAt: t(9),
          sectie: 'T10',
          omschrijving: 'water',
        },
      ],
      voiceNotes: [],
      textNotes: [
        {
          id: 'n1',
          inspectionId: '',
          text: 'alarmfluit nog aanwezig',
          createdAt: t(10),
          sectie: 'T11',
        },
        { id: 'n2', inspectionId: '', text: 'algemene opmerking', createdAt: t(11), sectie: null },
      ],
      questions: [
        {
          id: 'q1',
          inspectionId: '',
          vraag: 'Volstaat de alarmfluit?',
          photoIds: [],
          status: 'klaar',
          answer: ANSWER,
          error: null,
          createdAt: t(12),
          answeredAt: t(12),
          feedback: { verdict: 'klopt', correctie: '', at: t(12) },
        },
        {
          id: 'q2',
          inspectionId: '',
          vraag: 'Niet bewaard?',
          photoIds: [],
          status: 'klaar',
          answer: { ...ANSWER, antwoord: 'GEHEIM' },
          error: null,
          createdAt: t(13),
          answeredAt: t(13),
          feedback: null,
        },
      ],
    });
    expect(md.indexOf('## T10 Inkuiping')).toBeLessThan(
      md.indexOf('## T11 Systeem tegen overvulling'),
    );
    expect(md).toContain('[T10_inkuiping_01.jpg](photos/T10_inkuiping_01.jpg) — water');
    expect(md).toContain('**Antwoord (bewaard ✔):** Alarmfluit volstaat tot 31/12/2027.');
    expect(md).not.toContain('GEHEIM');
    expect(md).toContain('## Niet ingedeeld');
  });
});

describe('plan', () => {
  it('uses <JJJJMMDD>_<klant>_<tanknr> and safe names', () => {
    const i = newInspection({ klant: 'Klant: NV/BV', datum: '2026-10-27' });
    i.tank.internTanknr = '3';
    expect(inspectionFolder('KeurKompas', i)).toBe('KeurKompas/20261027_Klant- NV-BV_3');
    expect(safeName('  a#b%c.  ')).toBe('a-b-c');
  });

  it('plans photos, notes.md, transcripts, inspection.json and optional audio', () => {
    const inspection = newInspection({ datum: '2026-10-27', klant: 'K', omschrijving: 'T1' });
    const files = planInspection(
      'KK',
      {
        inspection,
        photos: [
          {
            id: 'p1',
            inspectionId: '',
            fileName: 'FOTO_01.jpg',
            blob: new Blob(),
            width: 1,
            height: 1,
            takenAt: null,
            createdAt: '2026-10-27T09:00:00',
          },
        ],
        voiceNotes: [
          {
            id: 'v1',
            inspectionId: '',
            label: 'VN_01',
            blob: new Blob(),
            mimeType: 'audio/mp4',
            durationMs: 1000,
            recordedAt: '2026-10-27T09:00:00',
            transcription: { status: 'klaar', text: 'hallo', provider: null, updatedAt: null },
          },
        ],
        textNotes: [],
        questions: [],
      },
      true,
    ).map((f) => f.path);
    expect(files).toEqual([
      'KK/20261027_K_T1/photos/FOTO_01.jpg',
      'KK/20261027_K_T1/audio/VN_01.m4a',
      'KK/20261027_K_T1/transcripts/VN_01.txt',
      'KK/20261027_K_T1/notes.md',
      'KK/20261027_K_T1/inspection.json',
    ]);
  });
});

describe('Microsoft Graph upload', () => {
  it('encodes each path segment', () => {
    expect(encodePath('KK/20261027_K #1/a b.jpg')).toBe('KK/20261027_K%20%231/a%20b.jpg');
  });

  it('uploads small files in one PUT, large files in 320 KiB-multiple chunks', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      if (String(url).endsWith('createUploadSession'))
        return new Response(JSON.stringify({ uploadUrl: 'https://upload.example/s' }), {
          status: 200,
        });
      return new Response('{}', { status: 200 });
    });
    await uploadFile('tok', 'KK/a.jpg', new Blob(['x'], { type: 'image/jpeg' }), fetchImpl);
    expect(calls[0]!.url).toBe('https://graph.microsoft.com/v1.0/me/drive/root:/KK/a.jpg:/content');
    expect(calls[0]!.init.method).toBe('PUT');

    calls.length = 0;
    const big = new Blob([new Uint8Array(5 * 1024 * 1024)]);
    await uploadFile('tok', 'KK/VN_01.m4a', big, fetchImpl);
    const chunks = calls.filter((c) => c.url === 'https://upload.example/s');
    expect(chunks.length).toBe(2);
    expect(new Headers(chunks[0]!.init.headers).get('Content-Range')).toBe(
      `bytes 0-${10 * 320 * 1024 - 1}/${big.size}`,
    );
    expect(new Headers(chunks[0]!.init.headers).get('Authorization')).toBeNull();
  });

  it('reports a failed upload with its status', async () => {
    const fetchImpl = vi.fn(async () => new Response('nee', { status: 403 }));
    await expect(uploadFile('tok', 'a', new Blob(['x']), fetchImpl)).rejects.toEqual(
      new GraphError('Upload mislukt (403)', 403),
    );
  });
});

describe('sync loop', () => {
  it('uploads what is new, remembers it, and only re-uploads what changed', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const db = new KeurKompasDB(`sync-${crypto.randomUUID()}`);
    const repo = createRepository(db);
    await repo.saveSettings({
      oneDriveClientId: 'client',
      oneDriveFolder: 'KK',
      uploadAudio: false,
    });
    const i = await repo.createInspection({ klant: 'K', datum: '2026-10-27', omschrijving: 'T1' });
    await repo.addPhoto({
      inspectionId: i.id,
      blob: new Blob(['x']),
      width: 1,
      height: 1,
      takenAt: null,
    });

    const uploaded: string[] = [];
    const upload = vi.fn(async (_t: string, path: string) => void uploaded.push(path));
    await syncOnce(db, async () => 'token', upload);
    expect(uploaded).toEqual([
      'KK/20261027_K_T1/photos/FOTO_01.jpg',
      'KK/20261027_K_T1/notes.md',
      'KK/20261027_K_T1/inspection.json',
    ]);

    uploaded.length = 0;
    await syncOnce(db, async () => 'token', upload);
    expect(uploaded).toEqual([]);

    await repo.addTextNote(i.id, 'nieuwe notitie');
    await syncOnce(db, async () => 'token', upload);
    expect(uploaded).toEqual(['KK/20261027_K_T1/notes.md', 'KK/20261027_K_T1/inspection.json']);
  });

  it('asks to sign in when there is no token, and uploads nothing', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const db = new KeurKompasDB(`sync-${crypto.randomUUID()}`);
    const repo = createRepository(db);
    await repo.saveSettings({ oneDriveClientId: 'client' });
    await repo.createInspection();
    const upload = vi.fn();
    await syncOnce(db, async () => null, upload);
    expect(upload).not.toHaveBeenCalled();
  });
});
