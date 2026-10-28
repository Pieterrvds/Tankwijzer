import type { Site, Tank } from "./model.ts";
import { addMonths, addYears, compareIso, formatDateNl as nl } from "./dates.ts";
import { builtFrom2025, buildReferenceDate, latestInspection, tri } from "./facts.ts";

/**
 * Inspection frequency and deadline logic for Flanders (VLAREM II, business tanks).
 *
 * Conservative defaults: when the owner does not know whether the site lies in a water
 * protection zone, we use the shorter (stricter) interval and say so in `basis_nl`.
 */

export type DeadlineKind =
  | "commissioning"
  | "limited"
  | "general"
  | "orange_reinspection"
  | "red_repair"
  | "transition"
  | "end_of_life";

export interface DeadlineItem {
  id: string;
  tankId: string;
  kind: DeadlineKind;
  /** null when we cannot compute it yet (missing info). */
  dueDate: string | null;
  title_nl: string;
  /** Short explanation of how the date was derived. */
  basis_nl: string;
  ruleId: string;
  overdue: boolean;
}

export const TRANSITION_2027 = "2027-12-31";
export const KWS_DEADLINE = "2028-01-01";
export const PE_MAX_LIFESPAN_YEARS = 25;
export const ORANGE_MONTHS = 6;

export function limitedIntervalYears(tank: Tank, site: Site | null): { years: number; note: string } | null {
  if (tank.placement === "above_ground") return { years: 3, note: "bovengrondse tank: om de 3 jaar" };
  if (tank.placement === "underground") {
    const wpz = tri(site?.inWaterProtectionZone);
    if (wpz === true) return { years: 1, note: "ondergronds in waterwin- of beschermingszone: jaarlijks" };
    if (wpz === false) return { years: 2, note: "ondergrondse tank: om de 2 jaar" };
    return {
      years: 1,
      note: "ondergronds; zolang niet gekend is of de site in een beschermingszone ligt, rekenen we voorzichtig met jaarlijks",
    };
  }
  return null;
}

/** Returns null when no general inspection is required (or cannot be determined). */
export function generalIntervalYears(
  tank: Tank,
  site: Site | null,
): { years: number; note: string } | null {
  const from2025 = builtFrom2025(tank);
  const lifespan = tank.expectedLifespanYears;

  if (tank.placement === "above_ground") {
    if (tank.capacityL === null || tank.capacityL <= 20000) return null;
    if (from2025 === true && lifespan !== null) {
      const share = lifespan * 0.75;
      return share < 20
        ? { years: share, note: `gebouwd vanaf 2025: op 75 % van de verwachte levensduur (${lifespan} jaar)` }
        : { years: 20, note: "gebouwd vanaf 2025: 20 jaar (korter dan 75 % van de levensduur)" };
    }
    return { years: 20, note: "bovengronds, meer dan 20.000 liter: om de 20 jaar" };
  }

  if (tank.placement === "underground") {
    if (tank.material === "gvk") return null; // GVK underground tanks are exempt.
    const wpz = tri(site?.inWaterProtectionZone);
    const base = wpz === false ? 15 : 10;
    const baseNote =
      wpz === true
        ? "ondergronds in beschermingszone: om de 10 jaar"
        : wpz === false
          ? "ondergronds: om de 15 jaar"
          : "ondergronds; beschermingszone onbekend, voorzichtig gerekend met 10 jaar";
    if (from2025 === true && lifespan !== null) {
      // Interpretation (to be verified by the inspector): at 50 % of the expected lifespan,
      // or the regular interval if that comes first.
      const share = lifespan * 0.5;
      if (share < base) {
        return { years: share, note: `gebouwd vanaf 2025: op 50 % van de verwachte levensduur (${lifespan} jaar)` };
      }
    }
    return { years: base, note: baseNote };
  }
  return null;
}

export function computeDeadlines(tank: Tank, site: Site | null, today: string): DeadlineItem[] {
  const items: DeadlineItem[] = [];
  const add = (item: Omit<DeadlineItem, "overdue" | "tankId">) =>
    items.push({
      ...item,
      tankId: tank.id,
      overdue: item.dueDate !== null && compareIso(item.dueDate, today) < 0,
    });

  const latest = latestInspection(tank);

  // 1. Commissioning inspection before first use.
  if (!latest) {
    add({
      id: `${tank.id}:commissioning`,
      kind: "commissioning",
      dueDate: tank.commissioningDate,
      title_nl: "Keuring vóór eerste gebruik (of laatste keuring toevoegen)",
      basis_nl:
        "Een nieuwe tank moet gekeurd worden voor het eerste gebruik. Is de tank al gekeurd? Voeg dan de laatste keuring toe.",
      ruleId: "frequentie.eerste_keuring",
    });
  }

  // 2. Limited inspection.
  const limited = limitedIntervalYears(tank, site);
  if (latest && limited) {
    if (latest.nextDueDate) {
      add({
        id: `${tank.id}:limited`,
        kind: "limited",
        dueDate: latest.nextDueDate,
        title_nl: "Volgend beperkt onderzoek",
        basis_nl: `Datum volgens de laatste keuringsklever (${limited.note}).`,
        ruleId: tank.placement === "underground" ? "frequentie.beperkt_ondergronds" : "frequentie.beperkt_bovengronds",
      });
    } else {
      add({
        id: `${tank.id}:limited`,
        kind: "limited",
        dueDate: addYears(latest.date, limited.years),
        title_nl: "Volgend beperkt onderzoek",
        basis_nl: `Berekend vanaf de keuring van ${nl(latest.date)}: ${limited.note}.`,
        ruleId: tank.placement === "underground" ? "frequentie.beperkt_ondergronds" : "frequentie.beperkt_bovengronds",
      });
    }
  } else if (latest && !limited) {
    add({
      id: `${tank.id}:limited`,
      kind: "limited",
      dueDate: null,
      title_nl: "Volgend beperkt onderzoek",
      basis_nl: "Kan niet berekend worden: geef aan of de tank bovengronds of ondergronds staat.",
      ruleId: "frequentie.beperkt_bovengronds",
    });
  }

  // 3. General inspection.
  const general = generalIntervalYears(tank, site);
  if (general) {
    const lastGeneral = latestInspection(tank, ["general"]);
    const base = lastGeneral?.date ?? tank.commissioningDate ?? buildReferenceDate(tank);
    add({
      id: `${tank.id}:general`,
      kind: "general",
      dueDate: base ? addYears(base, general.years) : null,
      title_nl: "Volgend algemeen onderzoek",
      basis_nl: base
        ? `Berekend vanaf ${lastGeneral ? "het laatste algemeen onderzoek" : "de ingebruikname/bouw"} (${nl(base)}): ${general.note}.`
        : `Kan niet berekend worden: vul de datum van ingebruikname of het laatste algemeen onderzoek in (${general.note}).`,
      ruleId: tank.placement === "underground" ? "frequentie.algemeen_ondergronds" : "frequentie.algemeen_bovengronds",
    });
  }

  // 4. Sticker follow-up.
  if (latest?.sticker === "orange") {
    add({
      id: `${tank.id}:orange`,
      kind: "orange_reinspection",
      dueDate: addMonths(latest.date, ORANGE_MONTHS),
      title_nl: "Herkeuring na oranje klever",
      basis_nl: `Oranje klever op ${nl(latest.date)}: vullen mag nog maximaal 6 maanden; herkeuring vóór het einde van die termijn.`,
      ruleId: "klever.oranje",
    });
  }
  if (latest?.sticker === "red") {
    add({
      id: `${tank.id}:red`,
      kind: "red_repair",
      dueDate: latest.date,
      title_nl: "Rode klever: niet vullen — herstellen en herkeuren",
      basis_nl: `Rode klever op ${nl(latest.date)}: vullen is verboden tot na herstelling en een nieuwe keuring.`,
      ruleId: "klever.rood",
    });
  }

  // 5. Transition deadlines.
  if (tank.overfillAlarm === "whistle") {
    add({
      id: `${tank.id}:whistle`,
      kind: "transition",
      dueDate: TRANSITION_2027,
      title_nl: "Overvulfluit volstaat nog tot 31/12/2027",
      basis_nl: "Een fluit als overvulwaarschuwing is toegelaten tot en met 31/12/2027.",
      ruleId: "overvulling.alarmfluit_tot_2027",
    });
  }
  if (tank.leakDetection === "single_signal") {
    add({
      id: `${tank.id}:single-signal`,
      kind: "transition",
      dueDate: TRANSITION_2027,
      title_nl: "Lekdetectie met enkelvoudig signaal: toegelaten tot 31/12/2027",
      basis_nl: "Lekdetectiesystemen met één signaal, gebouwd vóór 01/01/2025, zijn toegelaten tot en met 31/12/2027.",
      ruleId: "lekdetectie.een_signaal_tot_2027",
    });
  }
  if (
    (tank.product === "diesel" || tank.product === "gasoline") &&
    site?.kwsSeparatorPresent !== "yes"
  ) {
    add({
      id: `${tank.id}:kws`,
      kind: "transition",
      dueDate: KWS_DEADLINE,
      title_nl: "Koolwaterstofafscheider (KWS) tegen 01/01/2028",
      basis_nl: "Voor KWS-afscheiders geldt een overgangstermijn tot 01/01/2028.",
      ruleId: "kws.afscheider_2028",
    });
  }
  if (tank.material === "pe") {
    const ref = buildReferenceDate(tank);
    add({
      id: `${tank.id}:pe-eol`,
      kind: "end_of_life",
      dueDate: ref ? addYears(ref, PE_MAX_LIFESPAN_YEARS) : null,
      title_nl: "Einde maximale levensduur PE-tank (25 jaar)",
      basis_nl: ref
        ? `PE-tanks hebben een maximale levensduur van 25 jaar (bouw: ${nl(ref)}).`
        : "PE-tanks hebben een maximale levensduur van 25 jaar; vul het bouwjaar in om de datum te berekenen.",
      ruleId: "levensduur.thermoplast",
    });
  }

  return items.sort((a, b) => {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return compareIso(a.dueDate, b.dueDate);
  });
}

/** The single next date shown in the tank list. */
export function nextDeadline(items: DeadlineItem[]): DeadlineItem | null {
  return items.find((i) => i.dueDate !== null) ?? null;
}
