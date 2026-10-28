# Data model

Sources of truth: [`src/domain/schemas.ts`](../src/domain/schemas.ts) (inspection),
[`src/ai/schemas.ts`](../src/ai/schemas.ts) (everything exchanged with the assistant) and
[`src/db/db.ts`](../src/db/db.ts) (records on the phone).

## On the phone (IndexedDB, Dexie v3)

```ts
Inspection {               // one inspection = one tank = one OneDrive folder
  schemaVersion: 2; id; createdAt; updatedAt; status
  klant; plaatsVanOnderzoek; datum; verslagnummer; omschrijving /* "Tank 3 — mazout" */
  vorigVerslag: { fileName; text; importedAt; status; facts: PreviousReportFacts | null; error } | null
  vorigeKeuring: { datum; verslagnummer; lekdetectieType; overvulsysteemType; stickerkleur;
                   openOpmerkingen: { id; text; checked }[]; notities }   // filled from facts
  tank; product           // filled from facts where empty; used by the rule hints
  verborgenHints: string[]  // dismissed hint rule ids
  items; findings; waterwingebied   // kept for the rules engine; no checklist UI
}

Tag { tagStatus: 'wachtend' | 'klaar' | 'handmatig' | 'mislukt'; sectie: 'T2'…'T20' | null; omschrijving }

PhotoRecord     extends Tag { id; inspectionId; fileName /* T10_inkuiping_01.jpg | FOTO_01.jpg */;
                              blob; width; height; takenAt; createdAt }
VoiceNoteRecord extends Tag { id; inspectionId; label /* VN_01 */; blob; mimeType; durationMs;
                              recordedAt; transcription { status; text; provider; updatedAt } }
TextNoteRecord  extends Tag { id; inspectionId; text; createdAt }

QuestionRecord { id; inspectionId; vraag; photoIds; status: 'wachtend'|'bezig'|'klaar'|'mislukt';
                 answer: Answer | null; error; createdAt; answeredAt;
                 feedback: { verdict: 'klopt' | 'fout'; correctie; at } | null }

LessonRecord { id; vraag; fout_antwoord; correctie; status: 'voorgesteld'|'goedgekeurd'|'afgewezen';
               photoIds; answer /* original inputs */; createdAt; decidedAt; inspectionId; questionId }

SettingsRecord { serverUrl; appToken; oneDriveClientId; oneDriveFolder; uploadAudio }
SyncRecord     { path; inspectionId; hash; uploadedAt }   // what is already on OneDrive
```

## Exchanged with the assistant

```ts
Answer { antwoord; zekerheid: 'hoog'|'middel'|'laag'; te_bevestigen;
         bronnen: { bron: 'vlarem'|'vorig_verslag'|'regel'|'standaardzin'|'foto'|'notitie'|'les';
                    referentie; citaat }[];
         sectie; voorstel_tekst: { soort; tekst } | null; nakijken: string[] }

PreviousReportFacts { samenvatting; verslagnummer; datum; klever; tank {…}; product {…};
                      lekdetectie; overvulsysteem; peilmeter;
                      aandachtspunten: { tekst; soort; sectie; tegen_volgende_keuring }[] }

TagResult { sectie; omschrijving; zekerheid }
```

`null` always means _unknown_. The assistant must use `null` rather than guess.

## On OneDrive (per inspection)

```
KeurKompas/<JJJJMMDD>_<klant>_<tanknr>/
  photos/T10_inkuiping_01.jpg …   notes.md (grouped per T-section, kept answers)
  transcripts/VN_01.txt …         inspection.json (structured, schemaVersion)
  audio/VN_01.m4a … (optional)
KeurKompas/_lessen/lessen.json    approved lessons
```

## BEPO sections

Item ids (`T10.dichtheid`, …) in [`src/checklist/bepo-bovengronds.ts`](../src/checklist/bepo-bovengronds.ts)
remain the vocabulary for rules and sorting. They are not shown as a checklist.
