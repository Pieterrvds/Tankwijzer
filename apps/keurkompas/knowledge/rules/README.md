# Rules

Deterministic rules that the app evaluates (`src/rules/engine.ts`). Each file holds a group of
related rules: `{ "rules": [ … ] }`. The shape is validated by the `Rule` schema in
`src/domain/knowledge.ts`; an overview is generated in [`docs/rules.md`](../../docs/rules.md)
(`npm run docs:rules`).

## A rule

```json
{
  "id": "lospiste.nok",
  "title_nl": "Standplaats tankwagen niet in orde",
  "section": "T17",
  "trigger": { "fact": "item:T17.standplaats_tankwagen.status", "op": "eq", "value": "NOK" },
  "severity": "tekortkoming",
  "article": "art. 5.17.4.1.16. 6° a",
  "standard_sentence": "lospiste_nok",
  "items": ["T17.standplaats_tankwagen"],
  "valid_from": null,
  "valid_until": null,
  "source": "Richtlijnen BEPO-verslag (keurder)",
  "verified_by_user": false
}
```

- **Text:** either `standard_sentence` (id in `../standard-sentences.json`, used verbatim) or
  `text_nl` (own wording — shown as "voorstel KeurKompas" until confirmed). `fill` maps
  `[placeholders]` to facts.
- **severity:** `tekortkoming`, `opmerking`, `informatie`, or `herinnering` (reminder for the
  inspector, never exported).
- **suggest_status: "NVT"** — propose NVT for the listed items while they are unchecked.
- **article:** `"te bevestigen"` when the guidelines gave none. Never guess an article.
- **valid_from / valid_until:** compared with the inspection date (inclusive).
- **verified_by_user:** stays `false` until the inspector confirms the rule in the app
  ("Regels nakijken") and the result is copied back here.

## Trigger language

```
{ "all": [ … ] }   { "any": [ … ] }   { "not": { … } }
{ "fact": "<path>", "op": "<operator>", "value": … }        compare with a value
{ "fact": "<path>", "op": "<operator>", "valueFact": "<path>" }   compare with another fact
```

Operators: `eq neq in nin lt lte gt gte contains matches isEmpty isNotEmpty dateBefore`.

Facts: `inspection.datum|jaar`, `tank.<field>`, `product.<field>`, `derived.<name>`
(see `src/rules/facts.ts`), and `item:<itemId>.status|beschrijving|teBevestigen|values.<key>`.

**Unknown is not false.** A comparison on an empty value, or on the status of an item that is
not yet checked, is _unknown_, and a rule only fires when its trigger is definitely true. Only
`isEmpty` / `isNotEmpty` treat "empty" as an answer.

## Tests

`rules.test.ts` must contain, for every rule, at least one case where it fires and one where it
stays quiet. A test fails when a rule has no cases, refers to an unknown item/fact/sentence,
compares a choice field with a value that is not one of its options, or names a brand.
