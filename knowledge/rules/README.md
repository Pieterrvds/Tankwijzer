# Rules

One JSON file per rule (or per small group of related rules). The shape is validated by the
`Rule` schema in `src/domain/knowledge.ts`:

```json
{
  "id": "aarding.nvt_niet_ontvlambaar",
  "section": "T13",
  "trigger": { "…": "defined with the rules engine in M2" },
  "severity": "informatie",
  "article": "art. 5.17.…",
  "standard_sentence": "lekdetectie_ontbreekt",
  "valid_from": null,
  "valid_until": null,
  "source": "Richtlijnen BEPO-verslag (keurder)",
  "verified_by_user": false
}
```

The seed rules from the build prompt (§5) are added in **milestone M2**, together with the
rules engine, unit tests and the review screen where the inspector confirms each rule.
