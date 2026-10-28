import { describe, expect, it } from 'vitest';
import { fillSentence, StandardSentencesFile } from '../src/domain/knowledge';
import sentencesJson from '@vlarem-knowledge/standard-sentences.json';

const file = StandardSentencesFile.parse(sentencesJson);

describe('standard sentences', () => {
  it('contains all sentences from the report guidelines', () => {
    expect(Object.keys(file.sentences).sort()).toEqual(
      [
        'conformiteitsattest',
        'identificatie_inhoud',
        'kenplaat_lekdetectie',
        'kenplaat_overvulsysteem',
        'leidingen_dichtheid',
        'levensduur_thermoplast',
        'levensduur_verstreken',
        'lekdetectie_ontbreekt',
        'lospiste_nok',
        'omgevingsvergunning_niet_voorgelegd',
        'omgevingsvergunning_verlopen',
        'ongeschikt_product_vlampunt',
        'overvulsysteem_ontbreekt',
        'peilmeting_is_overvulsysteem',
      ].sort(),
    );
  });

  it('keeps the exact wording (spot check)', () => {
    expect(file.sentences.lekdetectie_ontbreekt?.text_nl).toBe(
      'Een lekdetectiesysteem conform bijlage 5.17.3 dient geplaatst te worden (art. 5.17.4.1.21), uitgerust met akoestisch & visueel signaal.',
    );
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    const text = file.sentences.ongeschikt_product_vlampunt!.text_nl;
    const filled = fillSentence(text, { product: 'benzine', norm: 'EN 12285-2' });
    expect(filled).toContain('gevuld worden met benzine inzake');
    expect(filled).toContain('constructiecode EN 12285-2');
    expect(filled).toContain('[x] °C');
  });
});
