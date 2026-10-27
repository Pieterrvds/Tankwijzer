import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Answer } from '../src/ai/schemas';
import { checkAnswer, EvalCase } from './eval-case';

const answer: Answer = {
  antwoord: 'Een alarmfluit volstaat tot 31/12/2027.',
  zekerheid: 'hoog',
  te_bevestigen: false,
  bronnen: [{ bron: 'regel', referentie: 'overvulling.alarmfluit_tot_2027', citaat: '' }],
  sectie: 'T11',
  voorstel_tekst: null,
  nakijken: [],
};

describe('evals', () => {
  it('every case file is valid', () => {
    const dir = new URL('./cases/', import.meta.url);
    for (const f of readdirSync(dir))
      EvalCase.parse(JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
  });

  it('checks answers deterministically', () => {
    const c = EvalCase.parse({
      id: 'x',
      vraag: 'v',
      vorigVerslag: '',
      notities: [],
      verwacht: {
        bevat: ['2027'],
        bevat_niet: ['merk'],
        zekerheid_in: ['hoog'],
        bron_in: ['regel'],
      },
    });
    expect(checkAnswer(c, answer)).toEqual([]);
    expect(
      checkAnswer(c, { ...answer, antwoord: 'Geen idee', zekerheid: 'laag', bronnen: [] }),
    ).toHaveLength(3);
  });
});
