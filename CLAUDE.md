# KeurKompas — guide for AI coding agents and developers

**KeurKompas** ("je kompas op het terrein") is a mobile-first, offline-first field app for a
Flemish _milieudeskundige_ who inspects storage tanks under **VLAREM II, hoofdstuk 5.17**.
It captures photos, voice notes and checklist results per tank, structured as the
**BEPO report** (beperkt onderzoek bovengrondse houder, Corcon bv template, tables T0–T20),
and exports a package the inspector uses at the office to write the report.

The user is not a full-time developer: explain decisions briefly, keep code clean and
commented, and work in small, tested steps.

## Non-negotiable principles

1. **The AI suggests, the inspector decides.** Every AI proposal carries a reason, an article
   reference, a source and a confidence. Nothing is applied without the inspector's tap.
   Uncertain values are marked _te bevestigen_ (blue `#0070C0` on yellow, like the report).
2. **Never invent values.** Unknown = empty/`null`. A field the AI cannot read stays empty.
3. **Independence rule.** Never recommend or mention brands, products or suppliers in any
   proposed text. Refer only to the VLAREM requirement. `src/rules/brands.ts` blocks names from
   `knowledge/brand-blocklist.json` in rule output; tests check all rule texts.
4. **Offline-first.** Everything works without network; data stays on the device until export.
5. **Law from the repo, not from model memory.** Rules and wording live in `knowledge/`.
   Standard sentences are used **verbatim**.
6. **Section codes match the report exactly** (T2–T20), so the export maps 1:1.

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
  domain/      Zod schemas (single source of truth) + factories. Shared with backend later.
  checklist/   BEPO checklist definitions (T2–T19), file naming.
               ondergronds.ts = PLACEHOLDER module for underground tanks (TODO).
  rules/       Rules engine: condition language, facts, evaluation, brand check,
               vergeet-niet + close check, rule review, docs/rules.md generator.
  db/          Dexie (IndexedDB) database + repository (all writes go through here).
  capture/     Photo compression/EXIF, audio recording helpers.
  components/  UI building blocks (ItemCard, PhotoCapture, VoiceRecorder, …).
  pages/       Screens (routes).
  lib/         Small utilities (number parsing, hooks).
knowledge/
  standard-sentences.json   Verbatim standard sentences.
  rules/                    Deterministic rules (JSON) + their tests.
  brand-blocklist.json      Names that may never appear in proposed texts.
  text/                     VLAREM II source text (added by the user).
docs/          architecture.md, data-model.md, rules.md, examples/
```

## Commands

```bash
npm install          # once
npm run dev          # dev server on http://localhost:5173 (add --host to test on a phone)
npm run check        # lint + format check + typecheck + tests (run before every commit)
npm test             # unit tests (Vitest)
npm run build        # production build incl. service worker
npm run preview      # serve the production build (test offline/install here)
npm run docs:rules   # regenerate docs/rules.md after changing knowledge/rules
```

## Coding conventions

- UI text: **Dutch (nl-BE)**. Code, comments, commit messages: **English**.
- TypeScript strict; types are derived from Zod schemas (`z.infer`), not written twice.
- Never rename a checklist item id (stored data refers to it). Add new ids instead.
- Dexie schema changes: add a new `version(n)` block; never edit an existing one.
- Tap targets ≥ 48 px (prefer 56 px), high contrast, labels always visible.
- Every rule in `knowledge/rules` gets unit tests (fires + stays quiet). Pure functions where possible.
- Rules never fire on unknown values; never guess an article (`"te bevestigen"`).
- Choice-field option texts are referenced by rules: change both together (a test checks).
- Bump `SCHEMA_VERSION` when `inspection.json` changes incompatibly.

## Milestones

M0 Foundation ✅ · M1 Offline capture ✅ · M2 Rules engine + vergeet-niet ✅ · M3 Export v1 (ZIP)
· M4 Voice AI · M5 Photo AI · M6 Draft T20 + sticker proposal · M7 Sync v2 + `keurkompas pull`.
Finish one, demo it, wait for the user's OK, then continue.
