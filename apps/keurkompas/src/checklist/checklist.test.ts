import { describe, expect, it } from 'vitest';
import { newInspection } from '../domain/factories';
import { SectionCode, type Inspection } from '../domain/schemas';
import { BEPO_BOVENGRONDS } from './bepo-bovengronds';
import { checklistFor, checklistProgress, paddedSection, photoFileName } from './index';
import { ONDERGRONDS_PLACEHOLDER } from './ondergronds';

function inspection(change: (i: Inspection) => void = () => {}): Inspection {
  const i = newInspection();
  change(i);
  return i;
}

describe('BEPO checklist structure', () => {
  it('has sections T2–T19 in report order', () => {
    const expected = SectionCode.options.filter((c) => c !== 'T20');
    expect(BEPO_BOVENGRONDS.sections.map((s) => s.code)).toEqual(expected);
  });

  it('has unique item ids that start with their section code', () => {
    const items = BEPO_BOVENGRONDS.sections.flatMap((s) => s.items);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const item of items) {
      expect(item.id.startsWith(`${item.section}.`)).toBe(true);
      expect(item.slug).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('choice fields have options', () => {
    for (const item of BEPO_BOVENGRONDS.sections.flatMap((s) => s.items))
      for (const f of item.fields ?? [])
        if (f.kind === 'choice') expect(f.options?.length).toBeGreaterThan(1);
  });

  it('every section has at least one item', () => {
    for (const s of BEPO_BOVENGRONDS.sections) expect(s.items.length).toBeGreaterThan(0);
  });

  it('uses the separate placeholder checklist for underground tanks', () => {
    expect(checklistFor(inspection())).toBe(BEPO_BOVENGRONDS);
    expect(checklistFor(inspection((i) => (i.tank.placement = 'ondergronds')))).toBe(
      ONDERGRONDS_PLACEHOLDER,
    );
  });
});

describe('photo file names', () => {
  it('names photos per section, padded, numbered', () => {
    expect(photoFileName('T6', 1)).toBe('T06_visuele_controle_01.jpg');
    expect(photoFileName('T10', 12)).toBe('T10_inkuiping_12.jpg');
    expect(photoFileName('T11', 1)).toBe('T11_systeem_tegen_overvulling_01.jpg');
    expect(photoFileName(null, 3)).toBe('FOTO_03.jpg');
    expect(paddedSection('T19')).toBe('T19');
  });
});

describe('progress', () => {
  it('counts checked items', () => {
    const i = inspection();
    const before = checklistProgress(i);
    expect(before.done).toBe(0);
    i.items['T6.fundering'] = {
      itemId: 'T6.fundering',
      status: 'NVT',
      beschrijving: '',
      values: {},
      teBevestigen: false,
      updatedAt: i.createdAt,
    };
    expect(checklistProgress(i)).toEqual({ done: 1, total: before.total });
  });
});
