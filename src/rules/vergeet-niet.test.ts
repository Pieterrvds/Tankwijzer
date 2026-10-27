import { describe, expect, it } from 'vitest';
import { emptyItemState, newInspection } from '../domain/factories';
import type { Inspection } from '../domain/schemas';
import { buildVergeetNiet, closeCheck } from './vergeet-niet';

function allChecked(i: Inspection) {
  for (const v of buildVergeetNiet(i).nietGecontroleerd)
    for (const item of v.items) i.items[item.id] = { ...emptyItemState(item.id), status: 'OK' };
}

describe('vergeet-niet', () => {
  it('lists unchecked items and blocks closing', () => {
    const i = newInspection();
    const v = buildVergeetNiet(i);
    expect(v.nietGecontroleerd.map((s) => s.code)).toContain('T2');
    const check = closeCheck(v);
    expect(check.canClose).toBe(false);
    expect(check.blockers[0]).toMatch(/nog niet gecontroleerd/);
  });

  it('can close when everything is checked', () => {
    const i = newInspection();
    allChecked(i);
    expect(closeCheck(buildVergeetNiet(i))).toMatchObject({ canClose: true, blockers: [] });
  });

  it('turns open remarks of the previous report into reminders and highlights "volgende keuring"', () => {
    const i = newInspection();
    allChecked(i);
    i.vorigeKeuring.openOpmerkingen = [
      { id: '1', text: 'Kenplaat aan te brengen tegen volgende keuring.', checked: false },
      { id: '2', text: 'Reinigingsattest voorleggen.', checked: false },
      { id: '3', text: 'Al nagekeken.', checked: true },
    ];
    const v = buildVergeetNiet(i);
    expect(v.vorigeOpmerkingen.map((r) => [r.id, r.volgendeKeuring])).toEqual([
      ['1', true],
      ['2', false],
    ]);
    expect(closeCheck(v).canClose).toBe(false);
  });

  it('blocks a NOK without description, warns for te bevestigen', () => {
    const i = newInspection();
    allChecked(i);
    i.items['T10.dichtheid'] = {
      ...emptyItemState('T10.dichtheid'),
      status: 'NOK',
      teBevestigen: true,
    };
    const check = closeCheck(buildVergeetNiet(i));
    expect(check.blockers).toEqual(['1 NOK-item zonder beschrijving.']);
    expect(check.warnings[0]).toMatch(/te bevestigen/);
  });

  it('collects NVT proposals and findings from the rules', () => {
    const i = newInspection();
    i.product.vlampuntC = 60;
    i.product.atexZone = false;
    i.items['T17.standplaats_tankwagen'] = {
      ...emptyItemState('T17.standplaats_tankwagen'),
      status: 'NOK',
    };
    const v = buildVergeetNiet(i);
    expect(v.nvtVoorstellen.map((n) => n.item.id)).toContain('T13.aarding');
    expect(v.bevindingen.map((b) => b.rule.id)).toContain('lospiste.nok');
  });
});
