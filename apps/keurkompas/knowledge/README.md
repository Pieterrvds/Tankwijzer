# KeurKompas knowledge

The VLAREM knowledge shared with Tankwijzer — rules, standard sentences, brand blocklist and the
official VLAREM text — lives in [`packages/vlarem-core/knowledge`](../../../packages/vlarem-core/knowledge/README.md)
and is imported here as `@vlarem-knowledge/…`.

This folder keeps what only the inspector's assistant uses:

| Path              | What                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `context.md`      | Domain context the assistant receives with every question.                |
| `vocabulary.json` | Words passed to transcription so terms like "kijkglas" are spelled right. |
| `lessons.md`      | Lessons the inspector approved (from the Lessen screen).                  |
