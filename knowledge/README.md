# Knowledge base (VLAREM II, hoofdstuk 5.17)

KeurKompas does **not** rely on an AI model's memory of the law. Everything the app "knows"
lives in this folder, under version control, so every suggestion can cite its source.

| Path                      | What                                                                                         | Status                            |
| ------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------- |
| `standard-sentences.json` | Exact standard sentences from the report guidelines, used **verbatim**.                      | ✅ filled in                      |
| `rules/*.json`            | Deterministic rules that code evaluates (with unit tests).                                   | ✅ 28 seed rules (to review)      |
| `text/`                   | Official VLAREM II source text (hfdst. 5.17 + bijlagen 5.17.x), for retrieval and citations. | To be added by the user           |
| `brand-blocklist.json`    | Brand names that may never appear in proposed texts.                                         | ✅ starter list — please complete |

Rules:

- Never change the wording of a standard sentence without the inspector's OK.
- Every rule has an `article` and a `source`, and starts as `verified_by_user: false`.
- Never mention brands, products or suppliers in any text here (independence rule).
