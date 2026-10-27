/**
 * Small, pure helper conditions on the inspection data, shared by the checklist
 * (NVT suggestions) and — from M2 — by the rules engine.
 *
 * Convention: when a value is unknown (`null`), helpers return `null` so callers make
 * NO suggestion rather than a wrong one.
 */
import type { Inspection } from '../domain/schemas';

/** Flash point threshold for flammable products, VLAREM II hfdst. 5.17. */
export const VLAMPUNT_GRENS_C = 55;
/** Vapour pressure threshold for emission-reducing measures. */
export const DAMPDRUK_GRENS_KPA = 13.3;

/**
 * Is the product "flammable" in the sense of the report guidelines:
 * flash point < 55 °C OR the tank is in an ATEX zone?
 * Returns null when this cannot be determined yet.
 */
export function isOntvlambaarOfAtex(i: Inspection): boolean | null {
  const { vlampuntC, atexZone } = i.product;
  if (atexZone === true) return true;
  if (vlampuntC !== null && vlampuntC < VLAMPUNT_GRENS_C) return true;
  if (vlampuntC !== null && atexZone === false) return false;
  return null;
}

/** GHS06 (toxic) or vapour pressure ≥ 13,3 kPa → emission-reducing measures required. */
export function vereistEmissiebeperking(i: Inspection): boolean | null {
  const { ghs, dampdrukKpa } = i.product;
  if (ghs.includes('GHS06')) return true;
  if (dampdrukKpa !== null) return dampdrukKpa >= DAMPDRUK_GRENS_KPA;
  return null;
}

/** NVT reason used by ATEX / aarding / pictogram items. */
export function nietOntvlambaarReden(i: Inspection): string | null {
  return isOntvlambaarOfAtex(i) === false
    ? `Vlampunt ≥ ${VLAMPUNT_GRENS_C} °C en geen ATEX-zone.`
    : null;
}
