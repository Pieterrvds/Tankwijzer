import { describe, expect, it } from 'vitest';
import { newInspection, splitRemarks, tankLabel, todayIsoDate } from './factories';
import { Inspection, SCHEMA_VERSION, VERSLAGNUMMER_PATTERN } from './schemas';

describe('Inspection schema', () => {
  it('accepts a freshly created inspection', () => {
    const i = newInspection({ klant: 'Klant NV' });
    expect(Inspection.parse(i)).toEqual(i);
    expect(i.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('starts with unknowns as null, never guessed values', () => {
    const i = newInspection();
    expect(i.product.vlampuntC).toBeNull();
    expect(i.product.atexZone).toBeNull();
    expect(i.tank.wall).toBeNull();
    expect(i.waterwingebied).toBeNull();
  });

  it('rejects invalid item status', () => {
    const i = newInspection();
    const bad = {
      ...i,
      items: {
        'T10.dichtheid': {
          itemId: 'T10.dichtheid',
          status: 'GOED',
          beschrijving: '',
          values: {},
          teBevestigen: false,
          updatedAt: i.createdAt,
        },
      },
    };
    expect(Inspection.safeParse(bad).success).toBe(false);
  });
});

describe('helpers', () => {
  it('validates verslagnummer format bepo.JJ.XXXX', () => {
    expect(VERSLAGNUMMER_PATTERN.test('bepo.26.0142')).toBe(true);
    expect(VERSLAGNUMMER_PATTERN.test('bepo.2026.142')).toBe(false);
  });

  it('uses the local date for today', () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('splits pasted remarks into one per line, stripping bullets', () => {
    expect(splitRemarks('- eerste\n\n2) tweede\n• derde  ')).toEqual(['eerste', 'tweede', 'derde']);
  });

  it('builds a short tank label', () => {
    const i = newInspection();
    expect(tankLabel(i)).toBe('Tank nog niet beschreven');
    i.tank.internTanknr = '3';
    i.product.naam = 'diesel';
    expect(tankLabel(i)).toBe('Tank 3 · diesel');
  });
});
