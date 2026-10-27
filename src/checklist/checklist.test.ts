import { describe, expect, it } from 'vitest';
import { newInspection } from '../domain/factories';
import { SectionCode, type Inspection } from '../domain/schemas';
import { BEPO_BOVENGRONDS } from './bepo-bovengronds';
import { isOntvlambaarOfAtex, vereistEmissiebeperking } from './conditions';
import {
  checklistFor,
  checklistProgress,
  findItem,
  openNvtSuggestions,
  paddedSection,
  photoFileName,
} from './index';
import { ONDERGRONDS_PLACEHOLDER } from './ondergronds';

function inspection(change: (i: Inspection) => void = () => {}): Inspection {
  const i = newInspection();
  change(i);
  return i;
}

function nvtReason(i: Inspection, itemId: string): string | null {
  return findItem(BEPO_BOVENGRONDS, itemId)?.suggestNvt?.(i) ?? null;
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
  it('pads the section and numbers per item', () => {
    const item = findItem(BEPO_BOVENGRONDS, 'T6.buitenwand') ?? null;
    expect(photoFileName(item, 1)).toBe('T06_buitenwand_01.jpg');
    expect(photoFileName(findItem(BEPO_BOVENGRONDS, 'T10.dichtheid') ?? null, 12)).toBe(
      'T10_dichtheid_12.jpg',
    );
    expect(photoFileName(null, 3)).toBe('ONGESORTEERD_03.jpg');
    expect(paddedSection('T19')).toBe('T19');
  });
});

describe('flammability conditions', () => {
  it('is unknown until vlampunt or ATEX is known', () => {
    expect(isOntvlambaarOfAtex(inspection())).toBeNull();
  });

  it('vlampunt < 55 °C → flammable', () => {
    expect(isOntvlambaarOfAtex(inspection((i) => (i.product.vlampuntC = 21)))).toBe(true);
  });

  it('ATEX zone → flammable regardless of vlampunt', () => {
    const i = inspection((i) => {
      i.product.vlampuntC = 80;
      i.product.atexZone = true;
    });
    expect(isOntvlambaarOfAtex(i)).toBe(true);
  });

  it('vlampunt ≥ 55 °C but ATEX unknown → still unknown', () => {
    expect(isOntvlambaarOfAtex(inspection((i) => (i.product.vlampuntC = 60)))).toBeNull();
  });

  it('vlampunt ≥ 55 °C and no ATEX → not flammable (boundary 55 included)', () => {
    const i = inspection((i) => {
      i.product.vlampuntC = 55;
      i.product.atexZone = false;
    });
    expect(isOntvlambaarOfAtex(i)).toBe(false);
  });

  it('emission-reducing measures for GHS06 or dampdruk ≥ 13,3 kPa', () => {
    expect(vereistEmissiebeperking(inspection())).toBeNull();
    expect(vereistEmissiebeperking(inspection((i) => (i.product.ghs = ['GHS06'])))).toBe(true);
    expect(vereistEmissiebeperking(inspection((i) => (i.product.dampdrukKpa = 13.3)))).toBe(true);
    expect(vereistEmissiebeperking(inspection((i) => (i.product.dampdrukKpa = 1)))).toBe(false);
  });
});

describe('NVT suggestions', () => {
  const diesel = (i: Inspection) => {
    i.product.vlampuntC = 60;
    i.product.atexZone = false;
  };

  it('suggests T13 aarding NVT for vlampunt ≥ 55 °C and no ATEX', () => {
    expect(nvtReason(inspection(diesel), 'T13.aarding')).toMatch(/Vlampunt/);
    expect(
      nvtReason(
        inspection((i) => (i.product.vlampuntC = 21)),
        'T13.aarding',
      ),
    ).toBeNull();
  });

  it('makes no suggestion while product data is unknown', () => {
    expect(nvtReason(inspection(), 'T13.aarding')).toBeNull();
    expect(nvtReason(inspection(), 'T9.systeem')).toBeNull();
    expect(nvtReason(inspection(), 'T16.emissiebeperking')).toBeNull();
  });

  it('suggests T9 NVT for single-walled tanks only', () => {
    expect(
      nvtReason(
        inspection((i) => (i.tank.wall = 'enkelwandig')),
        'T9.systeem',
      ),
    ).not.toBeNull();
    expect(
      nvtReason(
        inspection((i) => (i.tank.wall = 'dubbelwandig')),
        'T9.systeem',
      ),
    ).toBeNull();
  });

  it('suggests T19 NVT when the tank is not part of a tankenpark', () => {
    expect(nvtReason(inspection(), 'T19.peilputten')).not.toBeNull();
    expect(
      nvtReason(
        inspection((i) => (i.tank.deelVanTankenpark = true)),
        'T19.peilputten',
      ),
    ).toBeNull();
  });

  it('only lists unchecked items, never overrides the inspector', () => {
    const i = inspection(diesel);
    const t13 = BEPO_BOVENGRONDS.sections.find((s) => s.code === 'T13')!;
    expect(openNvtSuggestions(i, t13)).toHaveLength(1);
    i.items['T13.aarding'] = {
      itemId: 'T13.aarding',
      status: 'OK',
      beschrijving: '',
      values: {},
      teBevestigen: false,
      updatedAt: i.createdAt,
    };
    expect(openNvtSuggestions(i, t13)).toHaveLength(0);
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
