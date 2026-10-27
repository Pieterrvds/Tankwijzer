/**
 * Shapes exchanged with the AI assistant. Shared by the app and the server (no browser APIs).
 *
 * The server asks Claude for exactly these JSON shapes (structured outputs), so every answer
 * carries its sources and how certain it is. `null` = unknown: the model must never guess.
 */
import { z } from 'zod/v4';

export const SourceKind = z.enum([
  'vlarem', // official VLAREM II text in knowledge/text
  'vorig_verslag', // the previous report of this tank
  'regel', // a rule from knowledge/rules
  'standaardzin', // a standard sentence
  'foto', // a photo the inspector attached
  'notitie', // a voice/text note of this visit
  'les', // a lesson (correction) the inspector approved
]);
export type SourceKind = z.infer<typeof SourceKind>;

export const Citation = z.object({
  bron: SourceKind,
  /** e.g. "art. 5.17.4.1.21", "vorig verslag, T8", "regel lospiste.nok", "foto 2". */
  referentie: z.string(),
  /** Verbatim passage that supports the answer; empty when there is none (photo, general). */
  citaat: z.string(),
});
export type Citation = z.infer<typeof Citation>;

export const Answer = z.object({
  /** Short, practical answer in Dutch, as a colleague would say it on site. */
  antwoord: z.string(),
  zekerheid: z.enum(['hoog', 'middel', 'laag']),
  /** True when anything in the answer still needs the inspector's confirmation. */
  te_bevestigen: z.boolean(),
  bronnen: z.array(Citation),
  /** BEPO section the question is about (T2–T20), or null. */
  sectie: z.string().nullable(),
  /** Proposed report wording, only when it clearly helps; standard sentences verbatim. */
  voorstel_tekst: z
    .object({
      soort: z.enum(['tekortkoming', 'opmerking', 'informatie']),
      tekst: z.string(),
    })
    .nullable(),
  /** What to check on site to be sure (at most three short items). */
  nakijken: z.array(z.string()),
});
export type Answer = z.infer<typeof Answer>;

/** What the assistant extracts from the previous report, once per inspection. */
export const PreviousReportFacts = z.object({
  /** 3–6 short lines: what installation this is and how it was last time. */
  samenvatting: z.string(),
  verslagnummer: z.string().nullable(),
  /** yyyy-mm-dd */
  datum: z.string().nullable(),
  klever: z.enum(['groen', 'oranje', 'rood']).nullable(),
  tank: z.object({
    materiaal: z.string().nullable(),
    wand: z.enum(['enkelwandig', 'dubbelwandig']).nullable(),
    plaatsing: z.enum(['bovengronds', 'ondergronds']).nullable(),
    inhoud_liter: z.number().nullable(),
    bouwjaar: z.number().nullable(),
    fabricagenr: z.string().nullable(),
    tankbouwer: z.string().nullable(),
    tanknr: z.string().nullable(),
    norm: z.string().nullable(),
    deel_van_tankenpark: z.boolean().nullable(),
  }),
  product: z.object({
    naam: z.string().nullable(),
    vlampunt_c: z.number().nullable(),
    dampdruk_kpa: z.number().nullable(),
    ghs: z.array(z.string()),
  }),
  lekdetectie: z.string().nullable(),
  overvulsysteem: z.string().nullable(),
  peilmeter: z.string().nullable(),
  /** Tekortkomingen/opmerkingen from last time: what to look at again now. */
  aandachtspunten: z.array(
    z.object({
      tekst: z.string(),
      soort: z.enum(['tekortkoming', 'opmerking', 'informatie']),
      sectie: z.string().nullable(),
      /** "tegen volgende keuring …" — this inspection is that next inspection. */
      tegen_volgende_keuring: z.boolean(),
    }),
  ),
});
export type PreviousReportFacts = z.infer<typeof PreviousReportFacts>;

/** Background tagging of a photo or note to a BEPO section, so the export is sorted. */
export const TagResult = z.object({
  /** T2–T20, or null when it does not clearly belong to one section. */
  sectie: z.string().nullable(),
  /** Short caption in Dutch (max ~10 words), e.g. "Kijkglas lekdetectie, droog". */
  omschrijving: z.string(),
  zekerheid: z.enum(['hoog', 'middel', 'laag']),
});
export type TagResult = z.infer<typeof TagResult>;

// ---------------------------------------------------------------------------
// Requests (app → server)
// ---------------------------------------------------------------------------

export const ImageInput = z.object({
  /** e.g. "foto 2 (T10_inkuiping_01.jpg)" — how the answer may refer to it. */
  label: z.string(),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  /** Base64 without data: prefix. */
  data: z.string(),
});

export const NoteInput = z.object({
  label: z.string(),
  tijd: z.string(),
  tekst: z.string(),
});

/** An approved lesson: a correction of an earlier answer, sent along so the mistake is not repeated. */
export const Lesson = z.object({
  vraag: z.string(),
  fout_antwoord: z.string(),
  correctie: z.string(),
});
export type Lesson = z.infer<typeof Lesson>;

export const AskRequest = z.object({
  vraag: z.string().min(1).max(4000),
  bezoek: z.object({
    klant: z.string(),
    datum: z.string(),
    tank: z.string(),
  }),
  /** Extracted text of the previous report (may be empty). */
  vorigVerslag: z.string().max(400_000),
  notities: z.array(NoteInput).max(100),
  fotos: z.array(ImageInput).max(5),
  /** Earlier questions and answers in this visit, for follow-up questions. */
  eerdereVragen: z.array(z.object({ vraag: z.string(), antwoord: z.string() })).max(10),
  lessen: z.array(Lesson).max(200),
});
export type AskRequest = z.infer<typeof AskRequest>;

export const ExtractRequest = z.object({
  vorigVerslag: z.string().min(1).max(400_000),
});
export type ExtractRequest = z.infer<typeof ExtractRequest>;

export const TagRequest = z
  .object({
    tekst: z.string().max(20_000).nullable(),
    foto: ImageInput.nullable(),
    /** Short summary of the previous report, for context. */
    context: z.string().max(5_000),
  })
  .refine((r) => r.tekst || r.foto, { message: 'tekst of foto nodig' });
export type TagRequest = z.infer<typeof TagRequest>;

export const TranscribeResponse = z.object({ text: z.string(), provider: z.string() });
export type TranscribeResponse = z.infer<typeof TranscribeResponse>;
