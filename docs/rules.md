# Rules overview

> This file will be **generated** from `knowledge/rules/*.json` once the rules engine exists
> (milestone M2). Until then it lists the seed rules that will be implemented, all starting
> as `verified_by_user: false`.

| #   | Trigger                                                                               | Result                                                                         | Section                |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| 1   | vlampunt < 55 °C or ATEX zone                                                         | T13 relevant; check ATEX on T8/T11/T12; no-fire/no-smoking pictograms required | T13, T8, T11, T12, T18 |
| 2   | vlampunt ≥ 55 °C and no ATEX                                                          | T13 = NVT, even if the previous report said OK                                 | T13                    |
| 3   | GHS06 or dampdruk ≥ 13,3 kPa                                                          | check emission-reducing measures                                               | T16                    |
| 4   | leak detection = kijkglas or vlotter                                                  | informatie: logbook procedure                                                  | T8                     |
| 5   | leak detection before 01/01/2025 with one signal only                                 | opmerking: allowed until 31/12/2027                                            | T8                     |
| 6   | overfill = alarmfluit                                                                 | opmerking: sufficient until 31/12/2027                                         | T11                    |
| 7   | leak detection / overfill placed after 01/01/2025 without prototypekeurnr. + kenplaat | tekortkoming                                                                   | T8, T11                |
| 8   | no leak detection on double-walled tank                                               | tekortkoming `lekdetectie_ontbreekt`                                           | T8                     |
| 9   | no overfill system                                                                    | tekortkoming `overvulsysteem_ontbreekt`                                        | T11                    |
| 10  | level gauge = overfill system                                                         | informatie `peilmeting_is_overvulsysteem`                                      | T12                    |
| 11  | KWS-afscheider present                                                                | opmerking: deadline 01/01/2028 + info cleaning certificate                     | T17                    |
| 12  | double-walled before 01/01/2025, penetrations below liquid level                      | opmerking: monitored penetrations                                              | T6/T9                  |
| 13  | thermoplast                                                                           | end of life = bouwjaar + 25; warn near/past (`levensduur_thermoplast`)         | T3                     |
| 14  | calculated lifespan expired                                                           | tekortkoming `levensduur_verstreken`                                           | T3                     |
| 15  | enkelwandig                                                                           | must be in a bund holding the largest tank                                     | T10                    |
| 16  | no fixed liquid-tight provision at filling point / dispensing zone                    | opmerking: drip tray + absorbent                                               | T15, T17               |
| 17  | tanker standing area NOK                                                              | tekortkoming `lospiste_nok`                                                    | T17                    |
| 18  | identification incomplete                                                             | opmerking (art. 5.17.4.3.5 §2)                                                 | T18                    |
| 19  | omgevingsvergunning not shown / expired                                               | standard sentence                                                              | T5                     |
| 20  | conformiteitsattest not shown                                                         | `conformiteitsattest`                                                          | T5                     |
| 21  | open remark "tegen volgende keuring …"                                                | herinnering: this is that inspection                                           | —                      |
