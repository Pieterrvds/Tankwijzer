# Shared VLAREM knowledge (KeurKompas + Tankwijzer)

Neither app relies on an AI model's memory of the law. Everything they "know" about VLAREM lives
in this folder, under version control, so every suggestion can cite its source. **One source of
truth:** a rule fixed or added here updates both apps.

| Path                      | What                                                                                      | Used by     |
| ------------------------- | ----------------------------------------------------------------------------------------- | ----------- |
| `rules/*.json`            | One rule per obligation, with an inspector part and/or an owner part (format below).      | both        |
| `standard-sentences.json` | Exact standard sentences from the report guidelines, used **verbatim**.                   | KeurKompas  |
| `brand-blocklist.json`    | Brand names that may never appear in proposed texts, rule texts or AI answers.            | both        |
| `text/`                   | Official VLAREM II source text (hfdst. 5.17 + bijlagen 5.17.x), for retrieval/citations.  | KeurKompas  |

App-specific knowledge stays with the app (KeurKompas: `apps/keurkompas/knowledge/` — assistant
context, vocabulary, approved lessons).

## A rule

```json
{
  "id": "overvulling.alarmfluit_tot_2027",
  "title_nl": "Alarmfluit volstaat tot 31/12/2027",
  "region": "VL",
  "article": "te bevestigen",
  "source": "Richtlijnen BEPO-verslag (keurder)",
  "valid_from": null,
  "valid_until": "2027-12-31",
  "verified_by_user": false,
  "inspector": {
    "section": "T11",
    "trigger": { "fact": "item:T11.systeem.values.type", "op": "matches", "value": "alarmfluit" },
    "severity": "opmerking",
    "text_inspector_nl": "Een alarmfluit als systeem tegen overvulling volstaat slechts tot 31/12/2027.",
    "items": ["T11.systeem"]
  },
  "owner": {
    "category": "transition",
    "title_nl": "Overvulfluit: toegelaten tot 31/12/2027",
    "text_owner_nl": "Een fluit als overvulwaarschuwing volstaat nog tot en met 31/12/2027. …",
    "why_nl": "De nieuwe regels vragen een betrouwbaardere beveiliging; …",
    "applies_when": { "fact": "overfill_alarm", "op": "eq", "value": "whistle" },
    "ok_when": { "fact": "today", "op": "lte", "value": "2027-12-31" },
    "deadline": "2027-12-31",
    "attention_nl": "De overgangstermijn voor een overvulfluit is voorbij. …"
  }
}
```

**Shared part** (stored once, for both apps): `id`, `title_nl` (inspector wording, used in the
review screen), `region` (`VL` now; `BR`, `WAL`, `NL` later), `article`, `source`, `valid_from` /
`valid_until` (inclusive, `null` = open), `verified_by_user`, optional `note`.

**`inspector`** — evaluated by KeurKompas against the inspection (BEPO checklist):

- `section` (T2–T20), `trigger`, `severity` (`tekortkoming`, `opmerking`, `informatie`, or
  `herinnering` = reminder, never exported), `items`, optional `fill`, `suggest_status: "NVT"`.
- Text: either `standard_sentence` (id in `standard-sentences.json`, used verbatim) or
  `text_inspector_nl` (own wording — shown as "voorstel KeurKompas" until confirmed).
- Trigger language: `{ "all" }`, `{ "any" }`, `{ "not" }`, `{ "fact", "op", "value" | "valueFact" }`
  with operators `eq neq in nin lt lte gt gte contains matches isEmpty isNotEmpty dateBefore`.
  Facts: `inspection.datum|jaar`, `tank.<field>`, `product.<field>`, `derived.<name>`,
  `item:<itemId>.status|beschrijving|teBevestigen|values.<key>`
  (see `apps/keurkompas/src/rules/facts.ts`).

**`owner`** — evaluated by Tankwijzer against what the owner told us about the tank:

- `category`, owner-friendly `title_nl`, `text_owner_nl`, `why_nl`, optional `attention_nl`
  (what the rule asks — never how or with which product) and `deadline`.
- `applies_when` / `ok_when` with operators `eq neq in gt gte lt lte is_true is_false` on owner
  facts (see `packages/vlarem-core/src/facts.ts`). `ok_when` true → "waarschijnlijk in orde",
  false → "mogelijk aandachtspunt"; without `ok_when`, `status_when_applies` (`info`/`attention`).

A rule has an inspector part, an owner part, or both. Owner-only rules (inspection frequency,
sticker meaning) are still reviewed by the inspector in KeurKompas.

## Conventions

- **Unknown is not false.** A condition on an unknown value is _unknown_: KeurKompas does not
  fire, Tankwijzer shows "onbekend — foto of info nodig". Never guess.
- **Never guess an article**: use `"te bevestigen"`. Tankwijzer shows it as "VLAREM II — artikel
  te bevestigen".
- Every rule starts as `verified_by_user: false`. The inspector confirms rules in KeurKompas
  ("Regels nakijken"); the result is copied back here. Approving a rule approves both texts.
- Never change the wording of a standard sentence without the inspector's OK.
- Never mention brands, products or suppliers in any text here (independence rule).
- Keep KeurKompas rule ids stable: reviews on the inspector's device are stored by id.

## After changing a rule

```bash
pnpm test
```

```bash
pnpm --filter keurkompas docs:rules
```

```bash
pnpm --filter keurkompas knowledge:bundle
```

Tests fail when a rule file is invalid, not loaded, refers to an unknown standard sentence or fact,
names a brand, or when an inspector rule lacks a test case that fires and one that stays quiet
(`apps/keurkompas/src/rules/knowledge-rules.test.ts`).
