# Decisions and open questions

## What is built (first pass over milestones W0–W7)

| Milestone | Status |
|---|---|
| W0 Monorepo | Done: `packages/vlarem-core`, `packages/ai`, `services/api`, `apps/tankwijzer`, and KeurKompas moved from `Pieterrvds/myapp` into `apps/keurkompas` (with its git history). Rules merged into one shared set. CI runs lint, format, typecheck, tests and build for all. |
| W1 Tank register | Company, sites, team invites, tanks by hand or from nameplate/sticker/label photos (owner confirms each value). |
| W2 Rules & planning | "Wat geldt?", deadlines, planning page, `.ics`, daily reminder job (emails go to an outbox folder for now). |
| W3 Document vault | Upload, AI extraction (best effort), confirm/edit facts, per-tank "what's missing". |
| W4 Klaar voor de keuring? | 4-step photo walk-around against the rules of each step. |
| W5 Vraag het | Grounded chat with citations and a "vraag het aan uw milieudeskundige" fallback. |
| W6 Keuring aanvragen | Booking by email to the inspection body + consented dossier share link. |
| W7 Orange sticker | Deadline, findings, repair proof, import of official report into the tank. |

## Technical choices

- **TypeScript everywhere, pnpm workspaces.** Packages are consumed as source (no build step) to keep things simple.
- **Database: SQLite locally, Postgres online.** One async database layer (`services/api/src/db.ts`) with two drivers: `node:sqlite` for local development and tests, and Netlify Database (Postgres) online. SQL is written once in the common subset of both; the API tests run on both engines. Domain objects are stored as JSON validated by the shared Zod schemas.
- **Hosting: everything on Netlify** (chosen by the user): static web app, API as a Netlify Function, Netlify Database, Netlify Blobs for files, a scheduled function for reminders. The API is pre-bundled into one file (`pnpm --filter @tankwijzer/api bundle:netlify`) because Netlify's bundler does not include this monorepo's own packages.
- **Hono** for the API: small, typed, easy to test without a running server.
- **Claude** (`claude-opus-5-5`, overridable with `TANKWIJZER_AI_MODEL`) with structured outputs and server-side refusal fallback enabled.
- **Email**: locally to `DATA_DIR/outbox`; online through Brevo (EU) when `BREVO_API_KEY` is set. Without an email service, login only works in test mode (`DEV_MAGIC_LINK=1`), which the app shows with a warning banner.
- **Uploads** are limited to 4 MB on Netlify; the web app shrinks photos (long side 2000 px, JPEG) before uploading.

## Merging the KeurKompas and Tankwijzer rules

- KeurKompas's 28 inspector rules and Tankwijzer's 22 owner rules became **37 shared rules** in
  `packages/vlarem-core/knowledge/rules`: 12 rules have both an inspector and an owner part,
  16 are inspector-only, 9 are owner-only (inspection frequency, sticker meaning, documents).
  Tankwijzer's two identification rules (tank, filling point) became one, like KeurKompas's.
- **KeurKompas ids were kept** (reviews on the inspector's device are stored by id); Tankwijzer's
  ids were renamed to the same style (e.g. `VL-TRANS-OVERFILL-WHISTLE` → `overvulling.alarmfluit_tot_2027`).
- Where both apps had a rule, KeurKompas's article and source won (it had real article numbers
  for several rules); Tankwijzer now shows those to owners.
- The 16 inspector-only rules map to exactly the same rule as before, so their reviews on the
  device stay valid. The 12 rules that gained an owner part show "nog na te kijken" again, so
  the inspector approves the owner wording too. The 9 owner-only rules are in a new section of
  "Regels nakijken".
- The two condition languages stay separate: inspector triggers work on BEPO checklist facts
  (KeurKompas), owner conditions on the owner's answers (Tankwijzer).
- Standard sentences, brand blocklist (both lists combined) and the VLAREM text folder moved to
  `packages/vlarem-core/knowledge`. KeurKompas keeps its assistant context, vocabulary and
  lessons in `apps/keurkompas/knowledge`.

## Interpretations to verify (a wrong guess here is expensive)

1. **Article numbers.** 28 of the 37 rules still say `te bevestigen` (shown as "VLAREM II — artikel te bevestigen"). All rules are `verified_by_user: false` and the UI says "nog niet nagekeken door een milieudeskundige".
2. **Underground tanks built from 01/01/2025**: implemented as general inspection at 50 % of the expected lifespan *or* the regular 15/10 years, whichever comes first.
3. **Water protection zone unknown** → conservative: yearly limited inspection, 10-year general inspection for underground tanks.
4. **KWS separator by 01/01/2028**: shown for diesel and gasoline tanks only, as "ask your expert if this applies to your site".
5. **Single-signal leak detection**: we cannot tell when the detection system itself was built, so the transition rule applies to every single-signal system.
6. **Sticker without a type**: a sticker read from a photo is stored as a limited inspection until the owner changes it.
7. **Brand blocklist** (`packages/vlarem-core/src/guards.ts`) is a first list; it should be reviewed by the inspection body.

## Still to do

- Fill in the `te bevestigen` articles from the VLAREM text, and add that text to `packages/vlarem-core/knowledge/text`.
- Inspector auth realm and the dossier import in KeurKompas.
- Archive `Pieterrvds/myapp` once KeurKompas is deployed from this repository.
- Brevo account for real email (then switch off `DEV_MAGIC_LINK`), and the Frankfurt functions region on Netlify (Pro plan) for EU processing.
- The paid plan.
- Inbox screen for the inspection body (v1 is email).
