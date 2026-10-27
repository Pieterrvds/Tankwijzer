/**
 * "Vergeet-niet" (don't forget): everything that still needs attention for one inspection,
 * and the check that blocks closing an inspection while something is missing.
 */
import { checklistFor, statusOf, type ItemDefinition } from '../checklist';
import type { Inspection, PreviousRemark } from '../domain/schemas';
import { evaluateRules, nvtSuggestionsFor, type RuleResult } from './engine';

/** Remarks like "tegen volgende keuring …": this inspection IS that next inspection. */
export const VOLGENDE_KEURING_PATTERN = /(tegen|tegen de|bij|vóór|voor) (de )?volgende keuring/i;

export interface VergeetNiet {
  /** Unchecked open remarks from the previous report. */
  vorigeOpmerkingen: (PreviousRemark & { volgendeKeuring: boolean })[];
  /** Rule reminders ("herinnering") without an NVT proposal. */
  herinneringen: RuleResult[];
  /** Proposed tekortkomingen / opmerkingen / informatie from the rules. */
  bevindingen: RuleResult[];
  /** Unchecked items that have an NVT proposal. */
  nvtVoorstellen: { item: ItemDefinition; result: RuleResult }[];
  /** Items not yet checked, per section. */
  nietGecontroleerd: { code: string; title: string; items: ItemDefinition[] }[];
  /** Items flagged "te bevestigen". */
  teBevestigen: ItemDefinition[];
  /** NOK items without a description (the office needs to know what was wrong). */
  nokZonderBeschrijving: ItemDefinition[];
}

export function buildVergeetNiet(inspection: Inspection): VergeetNiet {
  const checklist = checklistFor(inspection);
  const results = evaluateRules(inspection);
  const allItems = checklist.sections.flatMap((s) => s.items);

  return {
    vorigeOpmerkingen: inspection.vorigeKeuring.openOpmerkingen
      .filter((r) => !r.checked)
      .map((r) => ({ ...r, volgendeKeuring: VOLGENDE_KEURING_PATTERN.test(r.text) })),
    herinneringen: results.filter((r) => r.severity === 'herinnering' && !r.suggestStatus),
    bevindingen: results.filter((r) => r.severity !== 'herinnering'),
    nvtVoorstellen: allItems.flatMap((item) => {
      const [result] = nvtSuggestionsFor(inspection, results, item.id);
      return result ? [{ item, result }] : [];
    }),
    nietGecontroleerd: checklist.sections
      .map((s) => ({
        code: s.code,
        title: s.title,
        items: s.items.filter((i) => statusOf(inspection, i.id) === 'NIET_GECONTROLEERD'),
      }))
      .filter((s) => s.items.length > 0),
    teBevestigen: allItems.filter((i) => inspection.items[i.id]?.teBevestigen),
    nokZonderBeschrijving: allItems.filter(
      (i) => statusOf(inspection, i.id) === 'NOK' && !inspection.items[i.id]?.beschrijving.trim(),
    ),
  };
}

export interface CloseCheck {
  canClose: boolean;
  /** Must be resolved before closing. */
  blockers: string[];
  /** Shown, but do not block (e.g. "te bevestigen" is resolved at the office). */
  warnings: string[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function closeCheck(v: VergeetNiet): CloseCheck {
  const unchecked = v.nietGecontroleerd.reduce((n, s) => n + s.items.length, 0);
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (unchecked > 0)
    blockers.push(`${plural(unchecked, 'item', 'items')} nog niet gecontroleerd (OK, NOK of NVT).`);
  if (v.vorigeOpmerkingen.length > 0)
    blockers.push(
      `${plural(v.vorigeOpmerkingen.length, 'open opmerking', 'open opmerkingen')} van de vorige keuring niet nagekeken.`,
    );
  if (v.nokZonderBeschrijving.length > 0)
    blockers.push(
      `${plural(v.nokZonderBeschrijving.length, 'NOK-item', 'NOK-items')} zonder beschrijving.`,
    );
  if (v.teBevestigen.length > 0)
    warnings.push(
      `${plural(v.teBevestigen.length, 'item', 'items')} gemarkeerd als te bevestigen.`,
    );
  if (v.herinneringen.length > 0)
    warnings.push(
      `${plural(v.herinneringen.length, 'herinnering', 'herinneringen')} uit de regels.`,
    );
  return { canClose: blockers.length === 0, blockers, warnings };
}
