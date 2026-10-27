/**
 * Tests for every rule in knowledge/rules. Each rule needs at least one situation where it
 * fires and one where it must NOT fire (typically: the value is still unknown).
 * The last test fails when a rule has no test cases, so new rules cannot slip in untested.
 */
import { describe, expect, it } from 'vitest';
import { BEPO_BOVENGRONDS } from '../../src/checklist/bepo-bovengronds';
import { findItem } from '../../src/checklist';
import { emptyItemState, newInspection } from '../../src/domain/factories';
import type { Inspection, ItemStatus } from '../../src/domain/schemas';
import { findBrandNames } from '../../src/rules/brands';
import { factsUsed, type Condition } from '../../src/rules/conditions';
import { RULES, STANDARD_SENTENCES, evaluateRules } from '../../src/rules/engine';
import { isKnownFact } from '../../src/rules/facts';

type Setup = (i: Inspection) => void;

const BESTAAND = 'bestaand (vóór 01/01/2025)';
const NIEUW = 'nieuw (vanaf 01/01/2025)';

function make(...setups: Setup[]): Inspection {
  const i = newInspection({ datum: '2026-06-15' });
  for (const s of setups) s(i);
  return i;
}

/** Set an item's status and/or values. */
const item =
  (id: string, status: ItemStatus | null, values: Record<string, string> = {}): Setup =>
  (i) => {
    const cur = i.items[id] ?? emptyItemState(id);
    i.items[id] = { ...cur, status: status ?? cur.status, values: { ...cur.values, ...values } };
  };
const datum =
  (d: string): Setup =>
  (i) =>
    void (i.datum = d);
const vlampunt =
  (v: number | null, atex: boolean | null = null): Setup =>
  (i) => {
    i.product.vlampuntC = v;
    i.product.atexZone = atex;
  };
const wall =
  (w: 'enkelwandig' | 'dubbelwandig' | null): Setup =>
  (i) =>
    void (i.tank.wall = w);
const nothing: Setup = () => {};

const fires = (id: string, i: Inspection) => evaluateRules(i).some((r) => r.rule.id === id);

const CASES: Record<string, { fires: Setup[][]; quiet: Setup[][] }> = {
  'ontvlambaar.controles': {
    fires: [[vlampunt(21)], [vlampunt(80, true)]],
    quiet: [[vlampunt(60, false)], [nothing], [vlampunt(60)]],
  },
  'aarding.nvt_niet_ontvlambaar': {
    fires: [[vlampunt(60, false)], [vlampunt(55, false)]],
    quiet: [[vlampunt(21, false)], [vlampunt(60)], [nothing]],
  },
  'atex.nvt_niet_ontvlambaar': {
    fires: [[vlampunt(100, false)]],
    quiet: [[vlampunt(100, true)], [nothing]],
  },
  'ontluchting.emissiebeperking': {
    fires: [
      [(i) => void (i.product.ghs = ['GHS06'])],
      [(i) => void (i.product.dampdrukKpa = 13.3)],
    ],
    quiet: [[(i) => void (i.product.dampdrukKpa = 1)], [nothing]],
  },
  'ontluchting.emissiebeperking_nvt': {
    fires: [[(i) => void (i.product.dampdrukKpa = 0.5)]],
    quiet: [
      [(i) => void (i.product.dampdrukKpa = 0.5), (i) => void (i.product.ghs = ['GHS06'])],
      [nothing],
    ],
  },
  'lekdetectie.kijkglas_vlotter_logboek': {
    fires: [
      [item('T8.systeem', null, { type: 'Kijkglas' })],
      [item('T8.systeem', null, { type: 'vlotter' })],
    ],
    quiet: [[item('T8.systeem', null, { type: 'vacuüm' })], [nothing]],
  },
  'lekdetectie.een_signaal_tot_2027': {
    fires: [
      [
        item('T8.systeem', null, { bouwperiode: BESTAAND }),
        item('T8.signaal', 'NOK', { signalen: 'enkel akoestisch' }),
      ],
    ],
    quiet: [
      [
        item('T8.systeem', null, { bouwperiode: NIEUW }),
        item('T8.signaal', 'NOK', { signalen: 'enkel visueel' }),
      ],
      [
        item('T8.systeem', null, { bouwperiode: BESTAAND }),
        item('T8.signaal', 'OK', { signalen: 'akoestisch én visueel' }),
      ],
      [
        datum('2028-01-10'),
        item('T8.systeem', null, { bouwperiode: BESTAAND }),
        item('T8.signaal', 'NOK', { signalen: 'enkel visueel' }),
      ],
      [item('T8.signaal', 'NOK', { signalen: 'enkel visueel' })],
    ],
  },
  'lekdetectie.nieuw_kenplaat': {
    fires: [[item('T8.systeem', null, { bouwperiode: NIEUW }), item('T8.kenplaat', 'NOK')]],
    quiet: [
      [item('T8.systeem', null, { bouwperiode: BESTAAND }), item('T8.kenplaat', 'NOK')],
      [item('T8.systeem', null, { bouwperiode: NIEUW })],
    ],
  },
  'lekdetectie.ontbreekt_dubbelwandig': {
    fires: [[wall('dubbelwandig'), item('T8.systeem', 'NOK', { aanwezig: 'NEEN' })]],
    quiet: [
      [wall('enkelwandig'), item('T8.systeem', 'NOK', { aanwezig: 'NEEN' })],
      [wall('dubbelwandig'), item('T8.systeem', 'OK', { aanwezig: 'JA' })],
      [wall('dubbelwandig')],
      [item('T8.systeem', 'NOK', { aanwezig: 'NEEN' })],
    ],
  },
  'lekdetectie.doorvoer_nvt_enkelwandig': {
    fires: [[wall('enkelwandig')]],
    quiet: [[wall('dubbelwandig')], [nothing]],
  },
  'dubbelwandig.doorvoeren_bewaakt': {
    fires: [
      [
        wall('dubbelwandig'),
        (i) => void (i.tank.bouwjaar = 2010),
        item('T6.doorvoer', null, { onder_vloeistofniveau: 'JA' }),
      ],
    ],
    quiet: [
      [
        wall('dubbelwandig'),
        (i) => void (i.tank.bouwjaar = 2025),
        item('T6.doorvoer', null, { onder_vloeistofniveau: 'JA' }),
      ],
      [wall('dubbelwandig'), item('T6.doorvoer', null, { onder_vloeistofniveau: 'JA' })],
      [
        wall('dubbelwandig'),
        (i) => void (i.tank.bouwjaar = 2010),
        item('T6.doorvoer', null, { onder_vloeistofniveau: 'NEEN' }),
      ],
    ],
  },
  'overvulling.alarmfluit_tot_2027': {
    fires: [[item('T11.systeem', null, { type: 'Alarmfluit' })]],
    quiet: [
      [item('T11.systeem', null, { type: 'overvulbeveiliging' })],
      [datum('2028-03-01'), item('T11.systeem', null, { type: 'alarmfluit' })],
      [nothing],
    ],
  },
  'overvulling.nieuw_kenplaat': {
    fires: [[item('T11.systeem', null, { bouwperiode: NIEUW }), item('T11.kenplaat', 'NOK')]],
    quiet: [
      [item('T11.systeem', null, { bouwperiode: BESTAAND }), item('T11.kenplaat', 'NOK')],
      [item('T11.systeem', null, { bouwperiode: NIEUW }), item('T11.kenplaat', 'OK')],
    ],
  },
  'overvulling.ontbreekt': {
    fires: [[item('T11.systeem', 'NOK', { aanwezig: 'NEEN' })]],
    quiet: [[item('T11.systeem', 'OK', { aanwezig: 'JA' })], [item('T11.systeem', 'NOK')]],
  },
  'peilmeting.is_overvulsysteem': {
    fires: [[item('T12.afzonderlijk', 'NOK')]],
    quiet: [[item('T12.afzonderlijk', 'OK')], [nothing]],
  },
  'levensduur.thermoplast': {
    fires: [
      [(i) => Object.assign(i.tank, { material: 'thermoplast', bouwjaar: 2000 })],
      [(i) => Object.assign(i.tank, { material: 'thermoplast', bouwjaar: 2004 })],
    ],
    quiet: [
      [(i) => Object.assign(i.tank, { material: 'thermoplast', bouwjaar: 2010 })],
      [(i) => Object.assign(i.tank, { material: 'staal', bouwjaar: 1990 })],
      [(i) => Object.assign(i.tank, { material: 'thermoplast' })],
    ],
  },
  'levensduur.verstreken': {
    fires: [[(i) => Object.assign(i.tank, { bouwjaar: 1990, levensduurJaar: 30 })]],
    quiet: [
      [(i) => Object.assign(i.tank, { bouwjaar: 1990, levensduurJaar: 40 })],
      [(i) => Object.assign(i.tank, { bouwjaar: 1990 })],
    ],
  },
  'inkuiping.enkelwandig': {
    fires: [[wall('enkelwandig')]],
    quiet: [[wall('dubbelwandig')], [nothing]],
  },
  'inkuiping.capaciteit_kleiner_dan_inhoud': {
    fires: [
      [
        (i) => void (i.tank.inhoudLiter = 5000),
        item('T10.capaciteit', null, { capaciteit_l: '4000' }),
      ],
    ],
    quiet: [
      [
        (i) => void (i.tank.inhoudLiter = 5000),
        item('T10.capaciteit', null, { capaciteit_l: '5500,5' }),
      ],
      [(i) => void (i.tank.inhoudLiter = 5000)],
      [item('T10.capaciteit', null, { capaciteit_l: '4000' })],
    ],
  },
  'vulpunt.geen_vaste_voorziening': {
    fires: [[item('T15.opvang', 'NOK')], [item('T17.verdeelzone', 'NOK')]],
    quiet: [[item('T15.opvang', 'OK'), item('T17.verdeelzone', 'NVT')], [nothing]],
  },
  'lospiste.nok': {
    fires: [[item('T17.standplaats_tankwagen', 'NOK')]],
    quiet: [[item('T17.standplaats_tankwagen', 'OK')], [nothing]],
  },
  'kws.afscheider_2028': {
    fires: [[item('T17.kws_afscheider', 'OK')], [item('T17.kws_afscheider', 'NOK')]],
    quiet: [[item('T17.kws_afscheider', 'NVT')], [nothing]],
  },
  'kws.reinigingsattest': {
    fires: [[item('T17.kws_afscheider', 'OK')]],
    quiet: [[item('T17.kws_afscheider', 'NVT')], [nothing]],
  },
  'tankenpark.nvt': {
    fires: [[nothing]],
    quiet: [[(i) => void (i.tank.deelVanTankenpark = true)]],
  },
  'identificatie.onvolledig': {
    fires: [[item('T18.tank', 'NOK')], [item('T18.vulpunt', 'NOK')]],
    quiet: [[item('T18.tank', 'OK'), item('T18.vulpunt', 'OK')], [nothing]],
  },
  'omgevingsvergunning.niet_voorgelegd': {
    fires: [[item('T5.omgevingsvergunning', 'NOK', { situatie: 'niet voorgelegd' })]],
    quiet: [[item('T5.omgevingsvergunning', 'OK', { situatie: 'voorgelegd' })], [nothing]],
  },
  'omgevingsvergunning.verlopen': {
    fires: [
      [item('T5.omgevingsvergunning', 'NOK', { situatie: 'verlopen' })],
      [item('T5.omgevingsvergunning', null, { geldig_tot: '01/01/2020' })],
      [item('T5.omgevingsvergunning', null, { geldig_tot: '2026-06-14' })],
    ],
    quiet: [
      [item('T5.omgevingsvergunning', 'OK', { geldig_tot: '31/12/2030' })],
      [item('T5.omgevingsvergunning', 'OK', { geldig_tot: 'onbepaalde duur' })],
      [nothing],
    ],
  },
  'conformiteitsattest.niet_voorgelegd': {
    fires: [[item('T5.conformiteitsattest', 'NOK')]],
    quiet: [[item('T5.conformiteitsattest', 'OK')], [nothing]],
  },
};

describe('every rule: fires when it should, stays quiet otherwise', () => {
  for (const [id, { fires: yes, quiet }] of Object.entries(CASES)) {
    describe(id, () => {
      yes.forEach((setups, n) =>
        it(`fires (case ${n + 1})`, () => expect(fires(id, make(...setups))).toBe(true)),
      );
      quiet.forEach((setups, n) =>
        it(`stays quiet (case ${n + 1})`, () => expect(fires(id, make(...setups))).toBe(false)),
      );
    });
  }

  it('every rule has test cases (and every test case has a rule)', () => {
    expect(Object.keys(CASES).sort()).toEqual(RULES.map((r) => r.id).sort());
  });
});

describe('rule texts', () => {
  it('fills the thermoplast end-of-life year into the standard sentence', () => {
    const i = make((i) => Object.assign(i.tank, { material: 'thermoplast', bouwjaar: 2000 }));
    const result = evaluateRules(i).find((r) => r.rule.id === 'levensduur.thermoplast');
    expect(result?.text).toContain('einde levensduur op 2025 op basis');
    expect(result?.isStandardSentence).toBe(true);
  });

  it('uses standard sentences verbatim', () => {
    const i = make(item('T17.standplaats_tankwagen', 'NOK'));
    const result = evaluateRules(i).find((r) => r.rule.id === 'lospiste.nok');
    expect(result?.text).toBe(STANDARD_SENTENCES.lospiste_nok?.text_nl);
  });

  it('gives no results for underground tanks (own rule set still TODO)', () => {
    expect(evaluateRules(make((i) => void (i.tank.placement = 'ondergronds')))).toEqual([]);
  });
});

describe('rule files are consistent with the checklist and knowledge base', () => {
  const comparisons = (c: Condition): { fact: string; op: string; value?: unknown }[] =>
    'all' in c
      ? c.all.flatMap(comparisons)
      : 'any' in c
        ? c.any.flatMap(comparisons)
        : 'not' in c
          ? comparisons(c.not)
          : [c];

  it('ids are unique', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  for (const rule of RULES) {
    it(`${rule.id}: references existing items, facts, sentences and options`, () => {
      for (const id of rule.items) expect(findItem(BEPO_BOVENGRONDS, id), id).toBeDefined();
      for (const fact of factsUsed(rule.trigger)) expect(isKnownFact(fact), fact).toBe(true);
      for (const fact of Object.values(rule.fill ?? {})) expect(isKnownFact(fact), fact).toBe(true);
      if (rule.standard_sentence) expect(STANDARD_SENTENCES[rule.standard_sentence]).toBeDefined();

      // A rule comparing a choice field must use one of that field's exact option texts.
      for (const c of comparisons(rule.trigger)) {
        const m = /^item:(T\d+\.[a-z_]+)\.values\.([a-z_]+)$/.exec(c.fact);
        if (!m || !['eq', 'neq', 'in', 'nin'].includes(c.op)) continue;
        const field = findItem(BEPO_BOVENGRONDS, m[1]!)?.fields?.find((f) => f.key === m[2]);
        if (field?.kind !== 'choice') continue;
        const values = Array.isArray(c.value) ? c.value : [c.value];
        for (const v of values) expect(field.options, `${c.fact} = ${String(v)}`).toContain(v);
      }
    });
  }

  it('no rule text or standard sentence names a brand (independence rule)', () => {
    const texts = [
      ...RULES.map((r) => r.text_nl ?? ''),
      ...Object.values(STANDARD_SENTENCES).map((s) => s.text_nl),
    ];
    for (const t of texts) expect(findBrandNames(t), t).toEqual([]);
  });
});
