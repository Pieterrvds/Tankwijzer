# KeurKompas — guide for AI coding agents and developers

**KeurKompas** ("je kompas op het terrein") is a mobile-first, offline-first field app for a
Flemish _milieudeskundige_ who inspects storage tanks under **VLAREM II, hoofdstuk 5.17**.

**What it is (course correction, see the inspector's brief):** not a checklist and not a
report filler. The inspector **captures** (photo, voice, text — one tap, offline), and **asks**
("Vraag het") when unsure. The assistant answers from the **previous report**, the shared VLAREM knowledge
(rules, standard sentences, VLAREM text), approved lessons and what was just captured, with its
sources and certainty. In the background it **sorts** every photo and note into a BEPO section
(T2–T20), and everything is **synced to the inspector's OneDrive** → PC, sorted per inspection.
It gets smarter through **lessons**: corrections the inspector approves.

The user is not a full-time developer: explain decisions briefly, keep code clean and
commented, and work in small, tested steps.

## Non-negotiable principles

1. **The AI suggests, the inspector decides.** Every answer carries its sources and a
   certainty. Uncertain → _te bevestigen_ (blue `#0070C0` on yellow, like the report).
2. **Grounded answers only.** Sources: previous report, the knowledge base, the captured
   photo/voice/text. Not covered → "Niet zeker — controleer ter plaatse." Never guess.
3. **Safe learning loop.** 👎 + correction → proposed lesson → only used after the inspector
   approves it (Lessen screen). Approved lessons go to OneDrive, then into
   `knowledge/lessons.md` and an eval case in `evals/`. Nothing changes behaviour unapproved.
4. **No gates.** No mandatory checklist, no blocking. Rule hints are gentle and dismissible.
5. **Never invent values.** Unknown = empty/`null`. A field the AI cannot read stays empty.
6. **Independence rule.** Never recommend or mention brands, products or suppliers in any
   proposed text. Refer only to the VLAREM requirement. `src/rules/brands.ts` blocks names from
   the shared `brand-blocklist.json` in rule output; tests check all rule texts.
7. **Offline-first.** Capture always works; AI and sync jobs queue until there is signal.
8. **Law from the repo, not from model memory.** Rules and wording live in the shared
   knowledge (see below). Standard sentences are used **verbatim**.
9. **Section codes match the report exactly** (T2–T20), so the sorted export maps 1:1.
10. **API keys never in the app.** The phone talks to our server (`server/`), which holds the
    Anthropic/Mistral keys. OneDrive goes directly from the phone with the user's own login.

## Shared with Tankwijzer

KeurKompas is one app in the Tankwijzer monorepo. The VLAREM knowledge is shared with
Tankwijzer (the tank owners' app) in `packages/vlarem-core/knowledge`, imported here as
`@vlarem-knowledge/…`: `rules/*.json`, `standard-sentences.json`, `brand-blocklist.json`,
`text/`. Format: `packages/vlarem-core/knowledge/README.md`.

- Each rule stores article, source, validity and `verified_by_user` once, with an `inspector`
  part (evaluated here) and/or an `owner` part (Tankwijzer). Rules without an inspector part
  appear only in "Regels nakijken" (section "Alleen voor eigenaars").
- Never rename a rule id: reviews on the device are stored by id and content hash.
- Owner data never changes findings here, and nothing from KeurKompas (notes, photos, AI
  answers) is ever shown in Tankwijzer.

## Report conventions (for exported text)

- Status OK → leave the description empty (never write just "OK").
- An empty field that must contain something gets `/` (never empty, never `-`).
- Every NOK appears in tekortkomingen or opmerkingen, and every tekortkoming/opmerking links
  back to an item. Validate before export.

## Glossary (Dutch → meaning)

| Term                                  | Meaning                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| milieudeskundige / keurder            | Accredited environmental inspector (the user)                                      |
| BEPO                                  | Beperkt onderzoek bovengrondse houder — limited inspection of an above-ground tank |
| houder / tank                         | Storage tank                                                                       |
| bovengronds / ondergronds             | Above-ground / underground                                                         |
| enkelwandig / dubbelwandig            | Single-walled / double-walled                                                      |
| GVK                                   | Glasvezelversterkte kunststof (fibreglass/polyester)                               |
| RVS                                   | Roestvast staal (stainless steel)                                                  |
| thermoplast / PE                      | Thermoplastic (polyethylene) tank — max. lifespan 25 years                         |
| inkuiping                             | Bund / secondary containment                                                       |
| lekdetectie                           | Leak detection                                                                     |
| kijkglas                              | Sight glass (simple leak detection)                                                |
| systeem tegen overvulling             | Overfill system: overvulwaarschuwing (≤ 95 %) or overvulbeveiliging (≤ 98 %)       |
| alarmfluit                            | Vent whistle (simple overfill warning)                                             |
| peilmeter / peilmeting                | Level gauge                                                                        |
| vulpunt                               | Filling point                                                                      |
| ontluchting                           | Vent line                                                                          |
| overloop                              | Overflow line                                                                      |
| aarding                               | Earthing                                                                           |
| kenplaat                              | Identification/type plate                                                          |
| prototypekeurnummer                   | Type-approval number                                                               |
| KWS-afscheider                        | Hydrocarbon (oil) separator                                                        |
| lospiste / standplaats tankwagen      | Tanker unloading area                                                              |
| tankenpark                            | Tank farm (> 250 m³ in one bund)                                                   |
| vlampunt / dampdruk                   | Flash point / vapour pressure                                                      |
| VIB / MSDS                            | Safety data sheet                                                                  |
| tekortkoming / opmerking / informatie | Deficiency / remark / information (T20 categories)                                 |
| klever (groen/oranje/rood)            | Inspection sticker colour                                                          |
| VERO                                  | Verlenging oranje klever (extension of orange sticker)                             |
| NVT                                   | Niet van toepassing (not applicable)                                               |
| te bevestigen                         | To be confirmed                                                                    |

## Folder structure

```
src/
  ai/          Assistant: shared schemas + instructions, request building, background queue
               (transcribe → read report → answer → sort), server and preview providers.
  sync/        OneDrive: Microsoft login (MSAL), Graph upload, upload plan, notes.md, loop.
  domain/      Zod schemas for the inspection + factories.
  checklist/   BEPO section/item definitions (T2–T19) — used invisibly: sorting, rules, names.
  rules/       Rules engine (hints), brand check, rule review, docs/rules.md generator,
               tests for every inspector rule (knowledge-rules.test.ts).
  db/          Dexie (IndexedDB) database + repository (all writes go through here).
  capture/     Photo compression/EXIF, audio recording, previous-report reading (PDF/Word).
  components/  UI (Timeline, Composers, VorigeKeuringCard, Hints, AnswerView, …).
  pages/       Screens: list, inspection, settings, lessons, rule review.
server/        Cloudflare Worker (Hono): /api/ask, /api/extract, /api/tag, /api/transcribe.
knowledge/     context.md, lessons.md, vocabulary.json (app-specific; rules, standard
               sentences, brand list and VLAREM text are shared — see above).
evals/         Eval cases every prompt/knowledge/model change must pass (pnpm evals).
docs/          SETUP.md (deploy), architecture.md, data-model.md, rules.md, examples/
```

## Commands

Run `pnpm install` once from the repository root; run the others in `apps/keurkompas`.

```bash
pnpm dev             # dev server on http://localhost:5173 (add --host to test on a phone)
pnpm run check       # lint + format check + typecheck + tests (run before every commit)
pnpm test            # unit tests (Vitest)
pnpm build           # production build incl. service worker
pnpm preview         # serve the production build (test offline/install here)
pnpm docs:rules      # regenerate docs/rules.md after changing the shared rules
pnpm knowledge:bundle  # regenerate the server's knowledge after changing any knowledge
pnpm evals           # run the eval cases against Claude (needs ANTHROPIC_API_KEY; costs cents)
pnpm server:dev      # run the API locally (server/.dev.vars holds local secrets)
pnpm build:preview   # one-file preview page (assistant via claude.ai, no server)
```

## Coding conventions

- UI text: **Dutch (nl-BE)**. Code, comments, commit messages: **English**.
- TypeScript strict; types are derived from Zod schemas (`z.infer`), not written twice.
- Never rename a checklist item id (stored data refers to it). Add new ids instead.
- Dexie schema changes: add a new `version(n)` block; never edit an existing one.
- Tap targets ≥ 48 px (prefer 56 px), high contrast, labels always visible.
- Every inspector rule gets unit tests (fires + stays quiet). Pure functions where possible.
- Rules never fire on unknown values; never guess an article (`"te bevestigen"`).
- Choice-field option texts are referenced by rules: change both together (a test checks).
- Bump `SCHEMA_VERSION` when `inspection.json` changes incompatibly.

## Milestones (after the course correction)

1. Capture stream (photo, voice, text) + offline storage ✅
2. Previous report import + summary card ✅
3. Sync to PC via OneDrive/Graph ✅ (ZIP + share sheet fallback: todo)
4. Voice transcription + background sorting into T-sections ✅
5. "Vraag het" with grounded answers and sources ✅
6. Feedback → lessons → review screen → evals ✅ (lessons → knowledge/lessons.md by hand)
7. Gentle hints from rules + previous report ✅

Model: Claude Opus 5.5 (`claude-opus-5-5`) with structured outputs, prompt caching and
server-side fallback. Change only with the evals passing.
