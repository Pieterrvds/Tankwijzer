# Data model

Source of truth: [`src/domain/schemas.ts`](../src/domain/schemas.ts) (Zod). Summary:

```ts
Inspection {
  schemaVersion: 1; id; createdAt; updatedAt; status: 'open' | 'afgesloten'
  klant; plaatsVanOnderzoek; datum /* yyyy-mm-dd */; verslagnummer /* bepo.JJ.XXXX */
  waterwingebied: boolean | null              // T2
  tank: Tank                                  // T2/T3
  product: Product                            // T4
  vorigeKeuring: PreviousInspection           // "wat was het vorige keer?"
  items: Record<itemId, CheckItemState>       // T2–T19
  findings: Finding[]                         // T20 (M6)
}

Tank { material: 'staal'|'rvs'|'gvk'|'thermoplast'|'ander'|null; materialOther
       wall: 'enkelwandig'|'dubbelwandig'|null; placement: 'bovengronds'|'ondergronds'
       inhoudLiter; bouwjaar; fabricagenr; tankbouwer; internTanknr; prototypekeurnr; norm
       levensduurJaar; afmetingen; ontwerpdruk; ontwerptemp; ontwerpdichtheid
       deelVanTankenpark: boolean }

Product { naam; vlampuntC; dichtheid; dampdrukKpa; ghs: GHS01…GHS09[]
          atexZone: boolean | null; msdsBron }

PreviousInspection { datum; verslagnummer; lekdetectieType; overvulsysteemType
                     stickerkleur: 'groen'|'oranje'|'rood'|null
                     openOpmerkingen: { id; text; checked }[]; notities }

CheckItemState { itemId; status: 'OK'|'NOK'|'NVT'|'NIET_GECONTROLEERD'
                 beschrijving; values: Record<string,string>; teBevestigen; updatedAt }

AiSuggestion { id; inspectionId; itemId; origin: 'rule'|'voice'|'photo'; originRef
               proposal { status?; beschrijving?; values?; finding? }
               reason; article; source; confidence: 'hoog'|'middel'|'laag'
               decision: 'open'|'aanvaard'|'aangepast'|'verworpen'; createdAt; decidedAt }

Finding { id; severity: 'tekortkoming'|'opmerking'|'informatie'; text
          itemIds: string[]; ruleId; standardSentenceId }
```

Binary data (IndexedDB only, referenced by `inspectionId` + `itemId`, `null` = unsorted):

```ts
PhotoRecord     { id; inspectionId; itemId; fileName /* T10_dichtheid_01.jpg */
                  blob; width; height; takenAt; createdAt }
VoiceNoteRecord { id; inspectionId; itemId; label /* VN_01 */; blob; mimeType; durationMs
                  recordedAt; transcription { status; text; provider; updatedAt } }
```

`null` always means _unknown_, which is different from "nee"/`false`. NVT suggestions and
rules never fire on unknown values.

## T-section mapping

Item ids are `<section>.<slug>` and are stable. Full definitions:
[`src/checklist/bepo-bovengronds.ts`](../src/checklist/bepo-bovengronds.ts).

| Code | Section                            | Items                                                                                                                   | Data in                                    |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| T2   | Algemene gegevens                  | ligging, tankenpark                                                                                                     | `waterwingebied`, `tank.deelVanTankenpark` |
| T3   | Houdergegevens                     | kenplaat, prototypekeur, levensduur                                                                                     | `tank.*`                                   |
| T4   | Productgegevens                    | product, vib                                                                                                            | `product.*`                                |
| T5   | Inzage documenten                  | vorig_rapport, indienststelling, omgevingsvergunning, bijzondere_voorwaarden, conformiteitsattest                       | items                                      |
| T6   | Visuele controle                   | verontreiniging, buitenwand, fundering, statische_dichtheid, toebehoren, beveiliging, inspectieopening, doorvoer, brand | items                                      |
| T7   | Leidingwerk                        | materiaal, antihevel, bovengronds, ondergronds                                                                          | items                                      |
| T8   | Lekdetectie tank                   | systeem (bestaand/nieuw, type, merk, serienr), signaal, atex, kenplaat                                                  | items                                      |
| T9   | Lekdetectie dubbelwandige doorvoer | systeem, signaal, atex, kenplaat                                                                                        | items                                      |
| T10  | Inkuiping                          | uitvoering, capaciteit, afstand, dichtheid, verontreiniging                                                             | items                                      |
| T11  | Systeem tegen overvulling          | systeem (bestaand/nieuw, soort, type, merk, serienr), werking, atex, kenplaat                                           | items                                      |
| T12  | Peilmeter                          | peilmeter, afzonderlijk, atex                                                                                           | items                                      |
| T13  | Aarding                            | aarding                                                                                                                 | items                                      |
| T14  | Overloop                           | overloop                                                                                                                | items                                      |
| T15  | Vulpunt                            | uitvoering, opvang                                                                                                      | items                                      |
| T16  | Ontluchting                        | uitvoering, emissiebeperking, dampretour                                                                                | items                                      |
| T17  | Vloeistofdichte zones              | standplaats_tankwagen, verdeelzone, kws_afscheider, ander_opvangsysteem                                                 | items                                      |
| T18  | Identificatie                      | vulpunt, tank, pictogrammen                                                                                             | items                                      |
| T19  | Tankenpark                         | peilputten, blussen_koelen, toegankelijkheid, dossier                                                                   | items                                      |
| T20  | Resultaat                          | —                                                                                                                       | `findings` + sticker proposal (M6)         |

### NVT proposals

NVT proposals come from rules with `"suggest_status": "NVT"` in `knowledge/rules` (see
[`rules.md`](rules.md)). They are shown on unchecked items only; the inspector accepts with one
tap.

### Explicit fields used by rules (M2)

| Item                                | Field                   | Options                                                         |
| ----------------------------------- | ----------------------- | --------------------------------------------------------------- |
| T5.omgevingsvergunning              | `situatie`              | voorgelegd / niet voorgelegd / verlopen                         |
| T6.doorvoer                         | `onder_vloeistofniveau` | JA / NEEN                                                       |
| T8.systeem, T9.systeem, T11.systeem | `aanwezig`              | JA / NEEN                                                       |
| T8.signaal, T9.signaal              | `signalen`              | akoestisch én visueel / enkel akoestisch / enkel visueel / geen |

Rule reviews are stored on the device in the `ruleReviews` table (Dexie v2):
`{ ruleId, ruleHash, verdict: 'akkoord' | 'niet_akkoord', comment, reviewedAt }`. A review only
counts while the rule content (hash) is unchanged.
