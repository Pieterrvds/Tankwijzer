/** Constructors for empty domain objects. Empty = unknown: never fill in guessed values. */
import {
  SCHEMA_VERSION,
  type CheckItemState,
  type Inspection,
  type ItemStatus,
  type PreviousInspection,
  type Product,
  type Tank,
} from './schemas';

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date as yyyy-mm-dd in local time (not UTC, so late-evening inspections get the right day). */
export function todayIsoDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function emptyTank(): Tank {
  return {
    material: null,
    materialOther: '',
    wall: null,
    placement: 'bovengronds',
    inhoudLiter: null,
    bouwjaar: null,
    fabricagenr: '',
    tankbouwer: '',
    internTanknr: '',
    prototypekeurnr: '',
    norm: '',
    levensduurJaar: null,
    afmetingen: '',
    ontwerpdruk: '',
    ontwerptemp: '',
    ontwerpdichtheid: '',
    deelVanTankenpark: false,
  };
}

export function emptyProduct(): Product {
  return {
    naam: '',
    vlampuntC: null,
    dichtheid: null,
    dampdrukKpa: null,
    ghs: [],
    atexZone: null,
    msdsBron: '',
  };
}

export function emptyPreviousInspection(): PreviousInspection {
  return {
    datum: '',
    verslagnummer: '',
    lekdetectieType: '',
    overvulsysteemType: '',
    stickerkleur: null,
    openOpmerkingen: [],
    notities: '',
  };
}

export function newInspection(
  fields: Partial<
    Pick<Inspection, 'klant' | 'plaatsVanOnderzoek' | 'datum' | 'verslagnummer' | 'omschrijving'>
  > = {},
): Inspection {
  const now = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    status: 'open',
    klant: fields.klant ?? '',
    plaatsVanOnderzoek: fields.plaatsVanOnderzoek ?? '',
    datum: fields.datum ?? todayIsoDate(),
    verslagnummer: fields.verslagnummer ?? '',
    omschrijving: fields.omschrijving ?? '',
    vorigVerslag: null,
    verborgenHints: [],
    waterwingebied: null,
    tank: emptyTank(),
    product: emptyProduct(),
    vorigeKeuring: emptyPreviousInspection(),
    items: {},
    findings: [],
  };
}

export function emptyItemState(itemId: string): CheckItemState {
  return {
    itemId,
    status: 'NIET_GECONTROLEERD',
    beschrijving: '',
    values: {},
    teBevestigen: false,
    updatedAt: nowIso(),
  };
}

/**
 * Turn pasted text from the previous report into separate remarks: one per non-empty line,
 * with leading bullets/numbering stripped.
 */
export function splitRemarks(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–•*]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0);
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  OK: 'OK',
  NOK: 'NOK',
  NVT: 'NVT',
  NIET_GECONTROLEERD: 'Nog niet gecontroleerd',
};

/** Short tank label for lists: the inspector's description, else "Tank 3 · 5 000 l · mazout". */
export function tankLabel(i: Inspection): string {
  if (i.omschrijving.trim()) return i.omschrijving.trim();
  const parts: string[] = [];
  if (i.tank.internTanknr) parts.push(`Tank ${i.tank.internTanknr}`);
  if (i.tank.inhoudLiter !== null) parts.push(`${i.tank.inhoudLiter.toLocaleString('nl-BE')} l`);
  if (i.product.naam) parts.push(i.product.naam);
  return parts.length ? parts.join(' · ') : 'Tank nog niet beschreven';
}
