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

/** File-name slug of a section title: T10 → "inkuiping", T11 → "systeem_tegen_overvulling". */
export function sectionSlug(code: string): string {
  const title =
    BEPO_BOVENGRONDS.sections.find((s) => s.code === code)?.title ??
    (code === 'T20' ? 'resultaat' : '');
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Consistent photo file name: T10_inkuiping_01.jpg, or FOTO_01.jpg when not sorted (yet). */
export function photoFileName(sectie: string | null, index: number): string {
  const n = String(index).padStart(2, '0');
  const slug = sectie ? sectionSlug(sectie) : '';
  return sectie && slug ? `${paddedSection(sectie)}_${slug}_${n}.jpg` : `FOTO_${n}.jpg`;
}
