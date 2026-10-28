import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeurKompasDB } from '../db/db';
import { createRepository } from '../db/repository';
import { newInspection } from '../domain/factories';
import { evaluateRules } from '../rules/engine';
import { applyFacts, materialFromText } from './apply-facts';
import { blobToBase64, buildAskRequest } from './context';
import { AiError, type AiProvider } from './provider';
import { processQueue } from './queue';
import type { Answer, PreviousReportFacts } from './schemas';

const FACTS: PreviousReportFacts = {
  samenvatting: 'Bovengrondse enkelwandige stalen houder, mazout.',
  verslagnummer: 'bepo.23.0042',
  datum: '2023-05-10',
  klever: 'groen',
  tank: {
    materiaal: 'koolstofstaal',
    wand: 'enkelwandig',
    plaatsing: 'bovengronds',
    inhoud_liter: 5000,
    bouwjaar: 1998,
    fabricagenr: '123',
    tankbouwer: null,
    tanknr: '3',
    norm: null,
    deel_van_tankenpark: false,
  },
  product: { naam: 'mazout', vlampunt_c: 60, dampdruk_kpa: null, ghs: ['GHS07', 'ghs 08', 'X'] },
  lekdetectie: null,
  overvulsysteem: 'alarmfluit',
  peilmeter: 'peilstok',
  aandachtspunten: [
    {
      tekst: 'Identificatie aan te vullen tegen volgende keuring.',
      soort: 'opmerking',
      sectie: 'T18',
      tegen_volgende_keuring: true,
    },
  ],
};

const ANSWER: Answer = {
  antwoord: 'Ja.',
  zekerheid: 'hoog',
  te_bevestigen: false,
  bronnen: [],
  sectie: null,
  voorstel_tekst: null,
  nakijken: [],
};

describe('applyFacts', () => {
  it('fills empty fields from the previous report, never overwrites the inspector', () => {
    const i = newInspection();
    i.tank.bouwjaar = 2001;
    applyFacts(i, FACTS);
    expect(i.tank).toMatchObject({
      material: 'staal',
      wall: 'enkelwandig',
      inhoudLiter: 5000,
      bouwjaar: 2001,
      internTanknr: '3',
    });
    expect(i.product.ghs).toEqual(['GHS07', 'GHS08']);
    expect(i.vorigeKeuring).toMatchObject({
      overvulsysteemType: 'alarmfluit',
      stickerkleur: 'groen',
      verslagnummer: 'bepo.23.0042',
    });
    expect(i.vorigeKeuring.openOpmerkingen[0]?.text).toBe(
      'T18 — Identificatie aan te vullen tegen volgende keuring.',
    );
  });

  it('lets the rules give gentle hints based on the previous report', () => {
    const i = newInspection({ datum: '2026-10-27' });
    applyFacts(i, FACTS);
    const ids = evaluateRules(i).map((r) => r.rule.id);
    expect(ids).toContain('overvulling.alarmfluit_tot_2027');
    expect(ids).toContain('inkuiping.enkelwandig');
  });

  it('recognises materials', () => {
    expect(materialFromText('GVK (polyester)')).toBe('gvk');
    expect(materialFromText('PE')).toBe('thermoplast');
    expect(materialFromText('beton')).toBeNull();
  });
});

describe('assistant context', () => {
  let db: KeurKompasDB;
  let repo: ReturnType<typeof createRepository>;
  beforeEach(() => {
    db = new KeurKompasDB(`ai-${crypto.randomUUID()}`);
    repo = createRepository(db);
  });

  it('sends the report, today’s notes, the chosen photo and only approved lessons', async () => {
    const i = await repo.createInspection({ klant: 'Klant NV', omschrijving: 'Tank 3' });
    await repo.setPreviousReport(i.id, 'vorig.pdf', 'T8 | Lekdetectie | kijkglas');
    await repo.addTextNote(i.id, 'kijkglas droog');
    const p = await repo.addPhoto({
      inspectionId: i.id,
      blob: new Blob([new Uint8Array([1, 2, 3])]),
      width: 1,
      height: 1,
      takenAt: null,
    });

    const old = await repo.addQuestion(i.id, 'oud', []);
    await repo.setAnswer(old.id, ANSWER);
    await repo.setFeedback(old.id, 'fout', 'goedgekeurde correctie');
    await repo.decideLesson(`les-${old.id}`, 'goedgekeurd');
    const other = await repo.addQuestion(i.id, 'ander', []);
    await repo.setAnswer(other.id, ANSWER);
    await repo.setFeedback(other.id, 'fout', 'nog niet goedgekeurd');

    await new Promise((r) => setTimeout(r, 5));
    const q = await repo.addQuestion(i.id, 'Is dit kijkglas OK?', [p.id]);
    const req = await buildAskRequest(db, q);
    expect(req.vorigVerslag).toContain('kijkglas');
    expect(req.notities.map((n) => n.tekst)).toEqual(['kijkglas droog']);
    expect(req.fotos).toHaveLength(1);
    expect(req.fotos[0]!.data).toBe(await blobToBase64(new Blob([new Uint8Array([1, 2, 3])])));
    expect(req.lessen.map((l) => l.correctie)).toEqual(['goedgekeurde correctie']);
    expect(req.eerdereVragen.map((e) => e.antwoord)).toContain(
      '(gecorrigeerd door keurder) goedgekeurde correctie',
    );
  });

  it('processes the queue: transcribe, read report, answer, sort', async () => {
    const i = await repo.createInspection();
    await repo.setPreviousReport(i.id, 'vorig.docx', 'verslagtekst');
    await repo.addVoiceNote({
      inspectionId: i.id,
      blob: new Blob(['x']),
      mimeType: 'audio/mp4',
      durationMs: 1000,
    });
    const q = await repo.addQuestion(i.id, 'vraag', []);
    const p = await repo.addPhoto({
      inspectionId: i.id,
      blob: new Blob(['x']),
      width: 1,
      height: 1,
      takenAt: null,
    });

    const provider: AiProvider = {
      name: 'test',
      ask: vi.fn(async () => ANSWER),
      extract: vi.fn(async () => FACTS),
      tag: vi.fn(async () => ({
        sectie: 'T11',
        omschrijving: 'alarmfluit',
        zekerheid: 'hoog' as const,
      })),
      transcribe: vi.fn(async (_b: Blob, name: string) => ({
        text: `tekst van ${name}`,
        provider: 't',
      })),
    };
    await processQueue(provider, db);

    expect((await db.voiceNotes.toArray())[0]).toMatchObject({
      transcription: { status: 'klaar', text: 'tekst van VN_01.m4a' },
      sectie: 'T11',
    });
    expect((await repo.getInspection(i.id)).vorigVerslag?.status).toBe('klaar');
    expect((await db.questions.get(q.id))?.status).toBe('klaar');
    expect((await db.photos.get(p.id))?.fileName).toBe('T11_systeem_tegen_overvulling_01.jpg');
  });

  it('keeps work queued when the network drops, and marks real errors as failed', async () => {
    const i = await repo.createInspection();
    const q1 = await repo.addQuestion(i.id, 'een', []);
    const offline: AiProvider = {
      name: 'test',
      ask: async () => {
        throw new AiError('Geen verbinding met de server.', true);
      },
      extract: async () => FACTS,
      tag: async () => ({ sectie: null, omschrijving: '', zekerheid: 'laag' }),
      transcribe: null,
    };
    await processQueue(offline, db);
    expect((await db.questions.get(q1.id))?.status).toBe('wachtend');

    const broken: AiProvider = {
      ...offline,
      ask: async () => {
        throw new AiError('Ongeldige vraag.', false);
      },
    };
    await processQueue(broken, db);
    expect(await db.questions.get(q1.id)).toMatchObject({
      status: 'mislukt',
      error: 'Ongeldige vraag.',
    });
  });
});
