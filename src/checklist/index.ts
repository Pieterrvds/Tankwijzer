import type { Inspection, ItemStatus } from '../domain/schemas';
import { BEPO_BOVENGRONDS } from './bepo-bovengronds';
import { ONDERGRONDS_PLACEHOLDER } from './ondergronds';
import type { Checklist, ItemDefinition, SectionDefinition } from './types';

export type { Checklist, ItemDefinition, ItemField, SectionDefinition } from './types';

/** Pick the checklist that applies to this tank. */
export function checklistFor(inspection: Inspection): Checklist {
  return inspection.tank.placement === 'ondergronds' ? ONDERGRONDS_PLACEHOLDER : BEPO_BOVENGRONDS;
}

export function findItem(checklist: Checklist, itemId: string): ItemDefinition | undefined {
  for (const s of checklist.sections) {
    const item = s.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
}

export function statusOf(inspection: Inspection, itemId: string): ItemStatus {
  return inspection.items[itemId]?.status ?? 'NIET_GECONTROLEERD';
}

export interface Progress {
  done: number;
  total: number;
}

export function sectionProgress(inspection: Inspection, section: SectionDefinition): Progress {
  const done = section.items.filter((i) => statusOf(inspection, i.id) !== 'NIET_GECONTROLEERD');
  return { done: done.length, total: section.items.length };
}

export function checklistProgress(inspection: Inspection): Progress {
  return checklistFor(inspection).sections.reduce<Progress>(
    (acc, s) => {
      const p = sectionProgress(inspection, s);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
}

/** Zero-padded section code for file names: T6 → "T06". */
export function paddedSection(code: string): string {
  return code.replace(/^T(\d)$/, 'T0$1');
}

/** Consistent photo file name, e.g. T10_inkuiping_01.jpg. */
export function photoFileName(item: ItemDefinition | null, index: number): string {
  const n = String(index).padStart(2, '0');
  return item ? `${paddedSection(item.section)}_${item.slug}_${n}.jpg` : `ONGESORTEERD_${n}.jpg`;
}
