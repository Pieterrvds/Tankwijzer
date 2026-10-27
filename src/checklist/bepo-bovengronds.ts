/**
 * BEPO checklist for above-ground tanks (beperkt onderzoek bovengrondse houder),
 * following the Corcon bv report template, tables T2–T19. T20 (Resultaat) is assembled
 * from findings and is not a checklist section.
 *
 * Section codes and order MUST match the report so the export maps 1:1.
 * Item ids are stored in the database: add new items freely, but never rename an id.
 */
import { nietOntvlambaarReden, vereistEmissiebeperking } from './conditions';
import type { Checklist, ItemDefinition, ItemField, SectionDefinition } from './types';

const BESTAAND_NIEUW: ItemField = {
  key: 'bouwperiode',
  label: 'Geplaatst',
  kind: 'choice',
  options: ['bestaand (vóór 01/01/2025)', 'nieuw (vanaf 01/01/2025)'],
};

const enkelwandigReden: ItemDefinition['suggestNvt'] = (i) =>
  i.tank.wall === 'enkelwandig' ? 'Enkelwandige houder: geen dubbelwandige doorvoer.' : null;

/** Helper so every item automatically gets its section and a full id. */
function section(
  def: Omit<SectionDefinition, 'items'> & {
    items: (Omit<ItemDefinition, 'id' | 'section'> & { id?: string })[];
  },
): SectionDefinition {
  return {
    ...def,
    items: def.items.map((item) => ({
      ...item,
      id: `${def.code}.${item.id ?? item.slug}`,
      section: def.code,
    })),
  };
}

export const BEPO_BOVENGRONDS: Checklist = {
  id: 'bepo-bovengronds',
  title: 'BEPO — bovengrondse houder',
  sections: [
    section({
      code: 'T2',
      title: 'Algemene gegevens',
      editsGegevens: 'algemeen',
      items: [
        {
          slug: 'ligging',
          label: 'Ligging t.o.v. waterwin- of beschermingsgebied',
          hint: 'Ja/nee invullen bij Gegevens.',
        },
        {
          slug: 'tankenpark',
          label: 'Deel van een tankenpark (> 250 m³ in één inkuiping)',
          hint: 'Ja/nee invullen bij Tank.',
        },
      ],
    }),
    section({
      code: 'T3',
      title: 'Houdergegevens',
      editsGegevens: 'tank',
      intro: 'Gegevens van de kenplaat. Neem altijd een foto van de kenplaat.',
      items: [
        {
          slug: 'kenplaat',
          label: 'Kenplaat houder',
          hint: 'Fabricagenr., tankbouwer, bouwjaar, norm, inhoud.',
        },
        {
          slug: 'prototypekeur',
          label: 'Prototypekeurnummer',
          hint: '"Bestaande situatie" voor oude houders.',
        },
        {
          slug: 'levensduur',
          label: 'Levensduur',
          hint: 'Berekende levensduur; thermoplast: max. 25 jaar na bouwjaar.',
        },
      ],
    }),
    section({
      code: 'T4',
      title: 'Productgegevens',
      editsGegevens: 'product',
      items: [
        { slug: 'product', label: 'Opgeslagen product', hint: 'Product, GHS, vlampunt, dampdruk.' },
        { slug: 'vib', label: 'VIB / MSDS', hint: 'Bron van de productgegevens.' },
      ],
    }),
    section({
      code: 'T5',
      title: 'Inzage documenten',
      items: [
        { slug: 'vorig_rapport', label: 'Vorig keuringsrapport' },
        { slug: 'indienststelling', label: 'Keuring bij indienststelling' },
        {
          slug: 'omgevingsvergunning',
          label: 'Omgevingsvergunning',
          fields: [
            { key: 'referentie', label: 'Referentie / datum', kind: 'text' },
            { key: 'geldig_tot', label: 'Geldig tot', kind: 'text' },
          ],
        },
        {
          slug: 'bijzondere_voorwaarden',
          label: 'Bijzondere milieuvoorwaarden',
          fields: [{ key: 'aanwezig', label: 'Aanwezig', kind: 'choice', options: ['JA', 'NEEN'] }],
        },
        {
          slug: 'conformiteitsattest',
          label: 'Conformiteitsattest tankbouwer',
          hint: '"Voorgelegd" indien getoond.',
        },
      ],
    }),
    section({
      code: 'T6',
      title: 'Visuele controle',
      items: [
        { slug: 'verontreiniging', label: 'Verontreiniging' },
        {
          slug: 'buitenwand',
          label: 'Buitenwand',
          hint: 'Zwelling, vervorming, schade, corrosie.',
        },
        { slug: 'fundering', label: 'Fundering' },
        { slug: 'statische_dichtheid', label: 'Statische dichtheid', hint: 'Lekken?' },
        { slug: 'toebehoren', label: 'Toebehoren' },
        { slug: 'beveiliging', label: 'Beveiliging' },
        { slug: 'inspectieopening', label: 'Inspectieopening' },
        {
          slug: 'doorvoer',
          label: 'Dubbelwandige doorvoer',
          suggestNvt: enkelwandigReden,
        },
        { slug: 'brand', label: 'Maatregelen bij brand' },
      ],
    }),
    section({
      code: 'T7',
      title: 'Leidingwerk',
      items: [
        {
          slug: 'materiaal',
          label: 'Materiaal leidingen',
          fields: [{ key: 'materiaal', label: 'Materiaal', kind: 'text' }],
        },
        { slug: 'antihevel', label: 'Anti-hevelwerking' },
        {
          slug: 'bovengronds',
          label: 'Bovengrondse leidingen',
          fields: [
            {
              key: 'uitvoering',
              label: 'Uitvoering',
              kind: 'choice',
              options: ['enkelwandig', 'dubbelwandig'],
            },
          ],
        },
        { slug: 'ondergronds', label: 'Ondergrondse leidingen' },
      ],
    }),
    section({
      code: 'T8',
      title: 'Lekdetectie tank',
      items: [
        {
          slug: 'systeem',
          label: 'Lekdetectiesysteem',
          hint: 'Type (bv. kijkglas, vlotter, vacuüm, …), merk, serienummer.',
          fields: [
            BESTAAND_NIEUW,
            { key: 'type', label: 'Type', kind: 'text' },
            { key: 'merk', label: 'Merk', kind: 'text' },
            { key: 'serienr', label: 'Serienummer', kind: 'text' },
          ],
        },
        { slug: 'signaal', label: 'Akoestisch én visueel signaal werkend' },
        { slug: 'atex', label: 'ATEX', suggestNvt: nietOntvlambaarReden },
        {
          slug: 'kenplaat',
          label: 'Prototypekeurnummer + kenplaat',
          hint: 'Verplicht voor systemen geplaatst vanaf 01/01/2025.',
          fields: [{ key: 'prototypekeurnr', label: 'Prototypekeurnr.', kind: 'text' }],
        },
      ],
    }),
    section({
      code: 'T9',
      title: 'Lekdetectie dubbelwandige doorvoer',
      intro: 'Vaak NVT.',
      items: [
        {
          slug: 'systeem',
          label: 'Lekdetectiesysteem doorvoer',
          suggestNvt: enkelwandigReden,
          fields: [
            BESTAAND_NIEUW,
            { key: 'type', label: 'Type', kind: 'text' },
            { key: 'merk', label: 'Merk', kind: 'text' },
            { key: 'serienr', label: 'Serienummer', kind: 'text' },
          ],
        },
        {
          slug: 'signaal',
          label: 'Akoestisch én visueel signaal werkend',
          suggestNvt: enkelwandigReden,
        },
        {
          slug: 'atex',
          label: 'ATEX',
          suggestNvt: (i) => enkelwandigReden(i) ?? nietOntvlambaarReden(i),
        },
        {
          slug: 'kenplaat',
          label: 'Prototypekeurnummer + kenplaat',
          suggestNvt: enkelwandigReden,
          fields: [{ key: 'prototypekeurnr', label: 'Prototypekeurnr.', kind: 'text' }],
        },
      ],
    }),
    section({
      code: 'T10',
      title: 'Inkuiping',
      items: [
        {
          slug: 'uitvoering',
          label: 'Uitvoering / materiaal',
          fields: [{ key: 'materiaal', label: 'Materiaal', kind: 'text' }],
        },
        {
          slug: 'capaciteit',
          label: 'Opvangcapaciteit',
          hint: 'Moet de grootste houder kunnen bevatten.',
          fields: [
            {
              key: 'capaciteit_l',
              label: 'Opvangcapaciteit (l)',
              kind: 'text',
              inputMode: 'decimal',
            },
          ],
        },
        { slug: 'afstand', label: 'Afstandsregels / spatscherm' },
        { slug: 'dichtheid', label: 'Dichtheid', hint: 'Scheuren, doorboringen.' },
        {
          slug: 'verontreiniging',
          label: 'Verontreiniging',
          hint: 'Water, vreemde stoffen in de inkuiping.',
        },
      ],
    }),
    section({
      code: 'T11',
      title: 'Systeem tegen overvulling',
      items: [
        {
          slug: 'systeem',
          label: 'Systeem tegen overvulling',
          hint: 'Waarschuwing ≤ 95 % (akoestisch ≥ 70 dB, hoorbaar aan vulpunt) of beveiliging ≤ 98 % (automatische afsluiting).',
          fields: [
            BESTAAND_NIEUW,
            {
              key: 'soort',
              label: 'Soort',
              kind: 'choice',
              options: ['overvulwaarschuwing (≤ 95 %)', 'overvulbeveiliging (≤ 98 %)'],
            },
            { key: 'type', label: 'Type', kind: 'text' },
            { key: 'merk', label: 'Merk', kind: 'text' },
            { key: 'serienr', label: 'Serienummer', kind: 'text' },
          ],
        },
        { slug: 'werking', label: 'Werking getest' },
        { slug: 'atex', label: 'ATEX', suggestNvt: nietOntvlambaarReden },
        {
          slug: 'kenplaat',
          label: 'Prototypekeurnummer + kenplaat',
          hint: 'Verplicht voor systemen geplaatst vanaf 01/01/2025.',
          fields: [{ key: 'prototypekeurnr', label: 'Prototypekeurnr.', kind: 'text' }],
        },
      ],
    }),
    section({
      code: 'T12',
      title: 'Peilmeter',
      items: [
        {
          slug: 'peilmeter',
          label: 'Peilmeter',
          fields: [{ key: 'type', label: 'Type', kind: 'text' }],
        },
        {
          slug: 'afzonderlijk',
          label: 'Afzonderlijk van systeem tegen overvulling',
          hint: 'Teller van pomp/verdeelzuil is niet toegelaten.',
        },
        { slug: 'atex', label: 'ATEX', suggestNvt: nietOntvlambaarReden },
      ],
    }),
    section({
      code: 'T13',
      title: 'Aarding',
      intro: 'Enkel relevant bij vlampunt < 55 °C of ATEX-zone, anders NVT.',
      items: [{ slug: 'aarding', label: 'Aarding', suggestNvt: nietOntvlambaarReden }],
    }),
    section({
      code: 'T14',
      title: 'Overloop',
      items: [{ slug: 'overloop', label: 'Overloop', hint: 'Leiding boven de overvulsensor.' }],
    }),
    section({
      code: 'T15',
      title: 'Vulpunt',
      items: [
        {
          slug: 'uitvoering',
          label: 'Uitvoering vulpunt',
          hint: 'Koppeling, IBC, trechter, …',
          fields: [{ key: 'uitvoering', label: 'Uitvoering', kind: 'text' }],
        },
        {
          slug: 'opvang',
          label: 'Vaste vloeistofdichte voorziening',
          hint: 'Lekbak of losplaats.',
        },
      ],
    }),
    section({
      code: 'T16',
      title: 'Ontluchting',
      items: [
        {
          slug: 'uitvoering',
          label: 'Uitvoering ontluchting',
          fields: [{ key: 'uitvoering', label: 'Uitvoering', kind: 'text' }],
        },
        {
          slug: 'emissiebeperking',
          label: 'Emissiebeperkende maatregelen',
          hint: 'Vereist bij GHS06 of dampdruk ≥ 13,3 kPa.',
          suggestNvt: (i) =>
            vereistEmissiebeperking(i) === false ? 'Geen GHS06 en dampdruk < 13,3 kPa.' : null,
        },
        { slug: 'dampretour', label: 'Dampretour' },
      ],
    }),
    section({
      code: 'T17',
      title: 'Vloeistofdichte zones',
      items: [
        {
          slug: 'standplaats_tankwagen',
          label: 'Standplaats tankwagen',
          hint: 'Vaste vloeistofdichte zone ≥ 8 m² met afloop naar opvangsysteem.',
        },
        { slug: 'verdeelzone', label: 'Verdeelzone' },
        { slug: 'kws_afscheider', label: 'KWS-afscheider' },
        { slug: 'ander_opvangsysteem', label: 'Ander opvangsysteem' },
      ],
    }),
    section({
      code: 'T18',
      title: 'Identificatie',
      items: [
        {
          slug: 'vulpunt',
          label: 'Identificatie aan het vulpunt',
          hint: 'Tanknummer, inhoud, gevarensymbolen, productnaam.',
        },
        {
          slug: 'tank',
          label: 'Identificatie op de tank',
          hint: 'Tanknummer, inhoud, gevarensymbolen, productnaam.',
        },
        {
          slug: 'pictogrammen',
          label: 'Pictogrammen verbod op vuur / roken',
          hint: 'Enkel voor ontvlambare producten.',
          suggestNvt: nietOntvlambaarReden,
        },
      ],
    }),
    section({
      code: 'T19',
      title: 'Tankenpark',
      items: [
        { slug: 'peilputten', label: 'Peilputten' },
        { slug: 'blussen_koelen', label: 'Blus- en koelmiddelen (groep 1)' },
        { slug: 'toegankelijkheid', label: 'Toegankelijkheid' },
        { slug: 'dossier', label: 'Dossier tankenpark' },
      ].map((item) => ({
        ...item,
        suggestNvt: (i) => (i.tank.deelVanTankenpark ? null : 'Geen deel van een tankenpark.'),
      })),
    }),
  ],
};
