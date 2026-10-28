/**
 * Facts: the values rules can look at, derived from an inspection.
 *
 *   inspection.datum | inspection.jaar
 *   tank.<field>     | product.<field>          (see src/domain/schemas.ts)
 *   derived.<name>                              (computed below)
 *   item:<itemId>.status | .beschrijving | .teBevestigen | .values.<key>
 *
 * Unknown values resolve to `null`. An item that is "nog niet gecontroleerd" has status `null`,
 * so a rule like "T17 standplaats = NOK" can never fire before the inspector looked at it.
 */
import { findItem } from '../checklist';
import { BEPO_BOVENGRONDS } from '../checklist/bepo-bovengronds';
import type { Inspection } from '../domain/schemas';

/** Flash point threshold for flammable products, VLAREM II hfdst. 5.17. */
export const VLAMPUNT_GRENS_C = 55;
/** Vapour pressure threshold for emission-reducing measures. */
export const DAMPDRUK_GRENS_KPA = 13.3;
/** Maximum lifespan of thermoplastic tanks. */
export const LEVENSDUUR_THERMOPLAST_JAAR = 25;

/**
 * Flash point < 55 °C OR ATEX zone. null when this cannot be determined yet.
 * (ATEX = ja is decisive on its own; "not flammable" needs both vlampunt and ATEX known.)
 */
export function isOntvlambaarOfAtex(i: Inspection): boolean | null {
  const { vlampuntC, atexZone } = i.product;
  if (atexZone === true) return true;
  if (vlampuntC !== null && vlampuntC < VLAMPUNT_GRENS_C) return true;
  if (vlampuntC !== null && atexZone === false) return false;
  return null;
}

/** GHS06 or vapour pressure ≥ 13,3 kPa. */
export function vereistEmissiebeperking(i: Inspection): boolean | null {
  if (i.product.ghs.includes('GHS06')) return true;
  if (i.product.dampdrukKpa !== null) return i.product.dampdrukKpa >= DAMPDRUK_GRENS_KPA;
  return null;
}

function inspectionYear(i: Inspection): number | null {
  const y = Number(i.datum.slice(0, 4));
  return Number.isInteger(y) && y > 1900 ? y : null;
}

export function derivedFacts(i: Inspection) {
  const jaar = inspectionYear(i);
  const { bouwjaar, levensduurJaar, material } = i.tank;
  const eindeThermoplast =
    material === 'thermoplast' && bouwjaar !== null ? bouwjaar + LEVENSDUUR_THERMOPLAST_JAAR : null;
  const eindeBerekend =
    bouwjaar !== null && levensduurJaar !== null ? bouwjaar + levensduurJaar : null;
  return {
    ontvlambaarOfAtex: isOntvlambaarOfAtex(i),
    emissiebeperkingVereist: vereistEmissiebeperking(i),
    /** Year in which a thermoplastic tank reaches 25 years. */
    eindeLevensduurThermoplast: eindeThermoplast,
    jarenTotEindeThermoplast:
      eindeThermoplast !== null && jaar !== null ? eindeThermoplast - jaar : null,
    /** bouwjaar + berekende levensduur. */
    eindeBerekendeLevensduur: eindeBerekend,
    levensduurVerstreken: eindeBerekend !== null && jaar !== null ? eindeBerekend < jaar : null,
  };
}

export type DerivedFacts = ReturnType<typeof derivedFacts>;

/** Create a resolver for fact paths on this inspection. */
export function factResolver(i: Inspection): (path: string) => unknown {
  const derived = derivedFacts(i);
  return (path) => {
    if (path.startsWith('item:')) {
      // item:T8.systeem.values.type → item id "T8.systeem", rest "values.type"
      const [section, slug, field, key] = path.slice(5).split('.');
      const state = i.items[`${section}.${slug}`];
      if (!state) return null;
      if (field === 'status') return state.status === 'NIET_GECONTROLEERD' ? null : state.status;
      if (field === 'values') return key ? (state.values[key] ?? null) : null;
      if (field === 'beschrijving') return state.beschrijving;
      if (field === 'teBevestigen') return state.teBevestigen;
      return undefined;
    }
    const [scope, name] = path.split('.');
    if (!name) return undefined;
    if (scope === 'inspection') {
      if (name === 'datum') return i.datum;
      if (name === 'jaar') return inspectionYear(i);
      return undefined;
    }
    if (scope === 'tank') return (i.tank as Record<string, unknown>)[name];
    if (scope === 'product') return (i.product as Record<string, unknown>)[name];
    if (scope === 'derived') return (derived as Record<string, unknown>)[name];
    return undefined;
  };
}

/** Dutch labels for facts, used to show triggers in the review screen. */
const FACT_LABELS: Record<string, string> = {
  'inspection.datum': 'datum keuring',
  'inspection.jaar': 'jaar keuring',
  'tank.material': 'materiaal houder',
  'tank.wall': 'wand',
  'tank.placement': 'plaatsing',
  'tank.inhoudLiter': 'inhoud (l)',
  'tank.bouwjaar': 'bouwjaar',
  'tank.levensduurJaar': 'berekende levensduur (jaar)',
  'tank.deelVanTankenpark': 'deel van tankenpark',
  'tank.norm': 'norm / constructiecode',
  'product.naam': 'product',
  'product.vlampuntC': 'vlampunt (°C)',
  'product.dampdrukKpa': 'dampdruk (kPa)',
  'product.ghs': 'GHS-pictogrammen',
  'product.atexZone': 'ATEX-zone',
  'derived.ontvlambaarOfAtex': 'vlampunt < 55 °C of ATEX-zone',
  'derived.emissiebeperkingVereist': 'GHS06 of dampdruk ≥ 13,3 kPa',
  'derived.eindeLevensduurThermoplast': 'einde levensduur thermoplast (jaar)',
  'derived.jarenTotEindeThermoplast': 'jaren tot einde levensduur thermoplast',
  'derived.eindeBerekendeLevensduur': 'einde berekende levensduur (jaar)',
  'derived.levensduurVerstreken': 'berekende levensduur verstreken',
};

export function factLabel(path: string): string {
  if (path.startsWith('item:')) {
    const [section, slug, field, key] = path.slice(5).split('.');
    const item = findItem(BEPO_BOVENGRONDS, `${section}.${slug}`);
    const name = item ? `${section} ${item.label}` : `${section}.${slug}`;
    if (field === 'status') return `status “${name}”`;
    if (field === 'values') {
      const f = item?.fields?.find((x) => x.key === key);
      return `“${name}” › ${f?.label ?? key}`;
    }
    return `“${name}” › ${field}`;
  }
  return FACT_LABELS[path] ?? path;
}

/** Is this a fact path rules may use? (Checked in tests for every rule.) */
export function isKnownFact(path: string): boolean {
  if (path.startsWith('item:')) {
    const [section, slug, field, key] = path.slice(5).split('.');
    const item = findItem(BEPO_BOVENGRONDS, `${section}.${slug}`);
    if (!item) return false;
    if (field === 'values') return !!item.fields?.some((f) => f.key === key);
    return ['status', 'beschrijving', 'teBevestigen'].includes(field ?? '') && key === undefined;
  }
  return path in FACT_LABELS;
}
