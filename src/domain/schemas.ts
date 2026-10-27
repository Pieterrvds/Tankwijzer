/**
 * Core data model for KeurKompas.
 *
 * Everything is defined as a Zod schema first, and the TypeScript types are derived from it.
 * The same schemas will be shared with the backend (M4+) and are used to validate
 * `inspection.json` in the export package (M3), so keep them free of browser-only types.
 *
 * Binary data (photos, audio) is NOT part of these schemas: it lives in separate IndexedDB
 * tables (see src/db/db.ts) and is referenced by id.
 */
import { z } from 'zod';

/** Bump when the shape of `inspection.json` changes in a non-backwards-compatible way. */
export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** BEPO section codes. Must match the report tables (T0–T20) exactly so the export maps 1:1. */
export const SectionCode = z.enum([
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
  'T7',
  'T8',
  'T9',
  'T10',
  'T11',
  'T12',
  'T13',
  'T14',
  'T15',
  'T16',
  'T17',
  'T18',
  'T19',
  'T20',
]);
export type SectionCode = z.infer<typeof SectionCode>;

/** Status of one check item. `NIET_GECONTROLEERD` is the initial state. */
export const ItemStatus = z.enum(['OK', 'NOK', 'NVT', 'NIET_GECONTROLEERD']);
export type ItemStatus = z.infer<typeof ItemStatus>;

export const TankMaterial = z.enum(['staal', 'rvs', 'gvk', 'thermoplast', 'ander']);
export type TankMaterial = z.infer<typeof TankMaterial>;

export const TankWall = z.enum(['enkelwandig', 'dubbelwandig']);
export type TankWall = z.infer<typeof TankWall>;

export const TankPlacement = z.enum(['bovengronds', 'ondergronds']);
export type TankPlacement = z.infer<typeof TankPlacement>;

export const GhsPictogram = z.enum([
  'GHS01',
  'GHS02',
  'GHS03',
  'GHS04',
  'GHS05',
  'GHS06',
  'GHS07',
  'GHS08',
  'GHS09',
]);
export type GhsPictogram = z.infer<typeof GhsPictogram>;

/** Finding categories as used in T20 (Resultaat). `herinnering` is app-internal, never exported. */
export const Severity = z.enum(['tekortkoming', 'opmerking', 'informatie', 'herinnering']);
export type Severity = z.infer<typeof Severity>;

export const StickerColour = z.enum(['groen', 'oranje', 'rood']);
export type StickerColour = z.infer<typeof StickerColour>;

// ---------------------------------------------------------------------------
// Tank + product (structured tank type, see build prompt §3)
// ---------------------------------------------------------------------------

/** Optional number: empty input in a form becomes `null`, never a guessed value. */
const optionalNumber = z.number().finite().nullable();

export const Tank = z.object({
  material: TankMaterial.nullable(),
  /** Free text when material = 'ander'. */
  materialOther: z.string(),
  wall: TankWall.nullable(),
  placement: TankPlacement,
  inhoudLiter: optionalNumber,
  bouwjaar: z.number().int().nullable(),
  fabricagenr: z.string(),
  tankbouwer: z.string(),
  internTanknr: z.string(),
  /** Prototypekeurnummer; "Bestaande situatie" for old tanks. */
  prototypekeurnr: z.string(),
  /** Norm / constructiecode (e.g. EN 12285-2). */
  norm: z.string(),
  /** Berekende levensduur in jaren, if known. */
  levensduurJaar: z.number().int().nullable(),
  afmetingen: z.string(),
  ontwerpdruk: z.string(),
  ontwerptemp: z.string(),
  ontwerpdichtheid: z.string(),
  /** Part of a tankenpark (> 250 m³ in one bund). */
  deelVanTankenpark: z.boolean(),
});
export type Tank = z.infer<typeof Tank>;

export const Product = z.object({
  naam: z.string(),
  vlampuntC: optionalNumber,
  dichtheid: optionalNumber,
  dampdrukKpa: optionalNumber,
  ghs: z.array(GhsPictogram),
  /** Is the tank in an ATEX zone? `null` = not yet known. */
  atexZone: z.boolean().nullable(),
  msdsBron: z.string(),
});
export type Product = z.infer<typeof Product>;

// ---------------------------------------------------------------------------
// Previous inspection ("vorige keuring") — simple manual import (build prompt §6.2)
// ---------------------------------------------------------------------------

export const PreviousRemark = z.object({
  id: z.string(),
  text: z.string(),
  /** Set when the inspector has checked this remark during the current inspection. */
  checked: z.boolean(),
});
export type PreviousRemark = z.infer<typeof PreviousRemark>;

export const PreviousInspection = z.object({
  datum: z.string(), // ISO date or empty
  verslagnummer: z.string(),
  lekdetectieType: z.string(),
  overvulsysteemType: z.string(),
  stickerkleur: StickerColour.nullable(),
  openOpmerkingen: z.array(PreviousRemark),
  notities: z.string(),
});
export type PreviousInspection = z.infer<typeof PreviousInspection>;

// ---------------------------------------------------------------------------
// Checklist state
// ---------------------------------------------------------------------------

/** State of one check item. The item definitions themselves live in src/checklist/. */
export const CheckItemState = z.object({
  itemId: z.string(),
  status: ItemStatus,
  /** Leave empty when the status says it all ("OK" alone is never written as a description). */
  beschrijving: z.string(),
  /** Structured values, e.g. { merk: '…', serienr: '…' } for leak detection. */
  values: z.record(z.string(), z.string()),
  /** Uncertain: rendered blue (#0070C0) on yellow, as in the report convention. */
  teBevestigen: z.boolean(),
  updatedAt: z.string(),
});
export type CheckItemState = z.infer<typeof CheckItemState>;

// ---------------------------------------------------------------------------
// AI suggestions + findings (types defined now, used from M2/M4 onwards)
// ---------------------------------------------------------------------------

export const AiSuggestion = z.object({
  id: z.string(),
  inspectionId: z.string(),
  itemId: z.string().nullable(),
  origin: z.enum(['rule', 'voice', 'photo']),
  /** Which photo / voice note / rule produced this proposal. */
  originRef: z.string(),
  proposal: z.object({
    status: ItemStatus.optional(),
    beschrijving: z.string().optional(),
    values: z.record(z.string(), z.string()).optional(),
    finding: z
      .object({ severity: Severity, text: z.string(), standardSentenceId: z.string().optional() })
      .optional(),
  }),
  reason: z.string(),
  /** Every proposal must cite the regulation, e.g. "art. 5.17.4.1.21". */
  article: z.string(),
  source: z.string(),
  confidence: z.enum(['hoog', 'middel', 'laag']),
  decision: z.enum(['open', 'aanvaard', 'aangepast', 'verworpen']),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
});
export type AiSuggestion = z.infer<typeof AiSuggestion>;

export const Finding = z.object({
  id: z.string(),
  severity: Severity.exclude(['herinnering']),
  text: z.string(),
  /** Every tekortkoming/opmerking must link back to at least one check item. */
  itemIds: z.array(z.string()),
  ruleId: z.string().nullable(),
  standardSentenceId: z.string().nullable(),
});
export type Finding = z.infer<typeof Finding>;

// ---------------------------------------------------------------------------
// Inspection (one inspection = one tank; the export produces one ZIP per tank)
// ---------------------------------------------------------------------------

export const Inspection = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(['open', 'afgesloten']),

  klant: z.string(),
  plaatsVanOnderzoek: z.string(),
  /** Inspection date, ISO yyyy-mm-dd. */
  datum: z.string(),
  /** Optional, format bepo.JJ.XXXX. */
  verslagnummer: z.string(),

  /** T2 — Algemene gegevens. */
  waterwingebied: z.boolean().nullable(),

  tank: Tank,
  product: Product,
  vorigeKeuring: PreviousInspection,

  /** Keyed by item id (e.g. "T10.dichtheid"). Missing key = not yet checked. */
  items: z.record(z.string(), CheckItemState),

  findings: z.array(Finding),
});
export type Inspection = z.infer<typeof Inspection>;

/** Format check for the optional report number: bepo.JJ.XXXX (e.g. bepo.26.0142). */
export const VERSLAGNUMMER_PATTERN = /^bepo\.\d{2}\.\d{4}$/;
