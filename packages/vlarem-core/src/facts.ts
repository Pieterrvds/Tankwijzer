import type { InspectionRecord, Site, Tank, TriState } from "./model.ts";
import { yearsBetween } from "./dates.ts";

/**
 * Facts are the flat, rule-friendly view of a tank. `null` always means "unknown":
 * the rules engine then answers "onbekend — foto of info nodig" instead of guessing.
 */
export type FactValue = string | number | boolean | null;
export type Facts = Record<string, FactValue>;

export function tri(v: TriState | undefined): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function unknownToNull<T extends string>(v: T | undefined): T | null {
  return v === undefined || v === "unknown" ? null : v;
}

/** Products classed as flammable (needing no-fire/no-smoking signs). Unknown products stay unknown. */
export function isFlammable(product: Tank["product"]): boolean | null {
  switch (product) {
    case "gasoline":
      return true;
    case "diesel":
    case "heating_oil":
    case "adblue":
    case "lubricating_oil":
      return false;
    default:
      // Waste oil may contain light fractions; "other" and "unknown" need a safety data sheet.
      return null;
  }
}

export const CUTOFF_2025 = "2025-01-01";

/** Was the tank built on or after 01/01/2025? */
export function builtFrom2025(tank: Tank): boolean | null {
  const { buildDate, buildYear } = tank.nameplate;
  if (buildDate) return buildDate >= CUTOFF_2025;
  if (buildYear !== null) {
    if (buildYear >= 2025) return true;
    if (buildYear <= 2024) return false;
  }
  return null;
}

/** Best known build reference date (exact date, else 1 January of the build year). */
export function buildReferenceDate(tank: Tank): string | null {
  if (tank.nameplate.buildDate) return tank.nameplate.buildDate;
  if (tank.nameplate.buildYear !== null) return `${tank.nameplate.buildYear}-01-01`;
  return null;
}

export function latestInspection(
  tank: Tank,
  types?: InspectionRecord["type"][],
): InspectionRecord | null {
  const list = tank.inspections
    .filter((i) => !types || types.includes(i.type))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return list[0] ?? null;
}

export function deriveFacts(tank: Tank, site: Site | null, today: string): Facts {
  const bundHoldsTank =
    tank.bundCapacityL !== null && tank.capacityL !== null
      ? tank.bundCapacityL >= tank.capacityL
      : null;
  const buildRef = buildReferenceDate(tank);
  const latest = latestInspection(tank);

  return {
    today,
    region: tank.region,
    placement: unknownToNull(tank.placement),
    wall: unknownToNull(tank.wall),
    material: unknownToNull(tank.material),
    product: unknownToNull(tank.product),
    flammable: isFlammable(tank.product),
    capacity_l: tank.capacityL,
    in_bund: tri(tank.inBund),
    bund_holds_tank: tank.inBund === "no" ? false : bundHoldsTank,
    in_water_protection_zone: tri(site?.inWaterProtectionZone),
    kws_separator_present: tri(site?.kwsSeparatorPresent),
    built_from_2025: builtFrom2025(tank),
    age_years: buildRef ? Math.floor(yearsBetween(buildRef, today)) : null,
    leak_detection: unknownToNull(tank.leakDetection),
    leak_detection_prototype_approval: tri(tank.leakDetectionPrototypeApproval),
    overfill_protection: tri(tank.overfillProtection),
    overfill_alarm: unknownToNull(tank.overfillAlarm),
    overfill_prototype_approval: tri(tank.overfillPrototypeApproval),
    level_gauge_separate: tri(tank.levelGaugeSeparateFromOverfill),
    filling_point_liquid_tight: tri(tank.fillingPointLiquidTight),
    identification_tank: tri(tank.identificationAtTank),
    identification_filling_point: tri(tank.identificationAtFillingPoint),
    no_fire_signs: tri(tank.noFireSignsPresent),
    has_inspection: tank.inspections.length > 0,
    latest_sticker: latest?.sticker ?? null,
  };
}

/** Dutch questions shown when a fact is unknown, so the owner knows what to add. */
export const FACT_QUESTIONS_NL: Record<string, string> = {
  placement: "Staat de tank bovengronds of ondergronds?",
  wall: "Is de tank enkelwandig of dubbelwandig?",
  material: "Uit welk materiaal is de tank (staal, GVK, PE …)?",
  product: "Welk product zit er in de tank?",
  flammable: "Is het product ontvlambaar? Kijk op de veiligheidsinformatieblad (VIB).",
  capacity_l: "Wat is de inhoud van de tank in liter? (zie typeplaat)",
  in_bund: "Staat de tank in een inkuiping (opvangbak)?",
  bund_holds_tank: "Hoeveel liter kan de inkuiping opvangen?",
  in_water_protection_zone: "Ligt de site in een waterwingebied of beschermingszone?",
  kws_separator_present: "Is er een koolwaterstofafscheider (KWS) op de site?",
  built_from_2025: "Wanneer is de tank gebouwd? (bouwjaar op de typeplaat)",
  age_years: "Wanneer is de tank gebouwd? (bouwjaar op de typeplaat)",
  leak_detection: "Welk lekdetectiesysteem heeft de tank?",
  leak_detection_prototype_approval: "Heeft het lekdetectiesysteem een typeplaat met prototypekeuringsnummer?",
  overfill_protection: "Heeft de tank een overvulbeveiliging?",
  overfill_alarm: "Hoe wordt overvullen gemeld (fluit, elektronisch alarm …)?",
  overfill_prototype_approval: "Heeft de overvulbeveiliging een typeplaat met prototypekeuringsnummer?",
  level_gauge_separate: "Zijn de peilmeter en de overvulbeveiliging twee aparte systemen?",
  filling_point_liquid_tight: "Is de vulplaats vloeistofdicht (bv. lekbak of vloeistofdichte vloer)?",
  identification_tank: "Staan tanknummer, inhoud, productnaam en gevarensymbolen op de tank?",
  identification_filling_point: "Staan tanknummer, inhoud, productnaam en gevarensymbolen aan de vulplaats?",
  no_fire_signs: "Hangen de pictogrammen 'vuur, open vlam en roken verboden'?",
  latest_sticker: "Welke kleur had de laatste keuringsklever?",
  limited_overdue: "Wanneer was de laatste keuring?",
  general_overdue: "Wanneer was het laatste algemeen onderzoek?",
};
