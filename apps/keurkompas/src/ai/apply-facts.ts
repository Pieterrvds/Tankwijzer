/**
 * Copies what the assistant read from the previous report into the inspection, so the rules
 * engine and the "vorige keer" panel can use it. Only fills fields that are still empty:
 * never overwrites what the inspector entered.
 */
import type { Inspection } from '../domain/schemas';
import { emptyItemState, newId } from '../domain/factories';
import type { PreviousReportFacts } from './schemas';

const MATERIALS: Record<string, Inspection['tank']['material']> = {
  staal: 'staal',
  koolstofstaal: 'staal',
  rvs: 'rvs',
  inox: 'rvs',
  gvk: 'gvk',
  polyester: 'gvk',
  pe: 'thermoplast',
  polyethyleen: 'thermoplast',
  thermoplast: 'thermoplast',
};

export function materialFromText(text: string | null): Inspection['tank']['material'] {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const [key, value] of Object.entries(MATERIALS))
    if (new RegExp(`\\b${key}\\b`).test(t)) return value;
  return null;
}

const GHS = /^GHS0[1-9]$/;

export function applyFacts(draft: Inspection, facts: PreviousReportFacts): void {
  const { tank, product } = draft;
  const f = facts;

  tank.material ??= materialFromText(f.tank.materiaal);
  tank.wall ??= f.tank.wand;
  if (f.tank.plaatsing) tank.placement = f.tank.plaatsing;
  tank.inhoudLiter ??= f.tank.inhoud_liter;
  tank.bouwjaar ??= f.tank.bouwjaar !== null ? Math.round(f.tank.bouwjaar) : null;
  if (!tank.fabricagenr) tank.fabricagenr = f.tank.fabricagenr ?? '';
  if (!tank.tankbouwer) tank.tankbouwer = f.tank.tankbouwer ?? '';
  if (!tank.internTanknr) tank.internTanknr = f.tank.tanknr ?? '';
  if (!tank.norm) tank.norm = f.tank.norm ?? '';
  if (f.tank.deel_van_tankenpark !== null) tank.deelVanTankenpark ||= f.tank.deel_van_tankenpark;

  if (!product.naam) product.naam = f.product.naam ?? '';
  product.vlampuntC ??= f.product.vlampunt_c;
  product.dampdrukKpa ??= f.product.dampdruk_kpa;
  if (product.ghs.length === 0) {
    product.ghs = f.product.ghs
      .map((g) => g.toUpperCase().replace(/\s/g, ''))
      .filter((g): g is Inspection['product']['ghs'][number] => GHS.test(g));
  }

  const v = draft.vorigeKeuring;
  if (!v.datum) v.datum = f.datum ?? '';
  if (!v.verslagnummer) v.verslagnummer = f.verslagnummer ?? '';
  if (!v.lekdetectieType) v.lekdetectieType = f.lekdetectie ?? '';
  if (!v.overvulsysteemType) v.overvulsysteemType = f.overvulsysteem ?? '';
  v.stickerkleur ??= f.klever;
  if (v.openOpmerkingen.length === 0) {
    v.openOpmerkingen = f.aandachtspunten.map((a) => ({
      id: newId(),
      text: `${a.sectie ? `${a.sectie} — ` : ''}${a.tekst}`,
      checked: false,
    }));
  }

  // Systems as they were last time, so type-based rules (kijkglas, alarmfluit) can remind.
  for (const [itemId, type] of [
    ['T8.systeem', f.lekdetectie],
    ['T11.systeem', f.overvulsysteem],
  ] as const) {
    if (!type) continue;
    const state = draft.items[itemId] ?? emptyItemState(itemId);
    if (!state.values.type) draft.items[itemId] = { ...state, values: { ...state.values, type } };
  }
}
