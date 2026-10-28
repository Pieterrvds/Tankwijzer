# Tankwijzer

Two apps for storage tanks in Flanders that share one VLAREM "brain":

- **Tankwijzer** (`apps/tankwijzer`) — for companies that own tanks.
- **KeurKompas** (`apps/keurkompas`) — the inspector's offline field assistant (see its own
  [README](apps/keurkompas/README.md) and [CLAUDE.md](apps/keurkompas/CLAUDE.md)).

Tankwijzer is a web app for companies that own storage tanks in Flanders. It explains in plain Dutch which VLAREM II rules apply to each tank, when the next inspections are due, which documents to have ready and what will *probably* need attention, and it lets owners request an inspection.

**Tankwijzer is not an inspection.** Only a recognised environmental expert (erkend milieudeskundige) can inspect a tank and place a sticker. Every check result says so.

## Monorepo

```
apps/
  tankwijzer/      # owner web app (React + Vite, Dutch UI, installable PWA)
  keurkompas/      # inspector field app (React + Vite PWA, offline, OneDrive sync, Worker API)
packages/
  vlarem-core/     # shared core
    knowledge/     #   shared VLAREM knowledge: rules/*.json (one rule, both apps), standard
                   #   sentences, brand blocklist, VLAREM text — see knowledge/README.md
    src/           #   owner data model (Zod), owner rules engine, deadlines, documents
                   #   checklist, guards, .ics, dossier schema; evals/ = owner eval set
  ai/              # shared Claude clients: photo reading, document extraction,
                   # pre-check, grounded "Vraag het", output guards
services/
  api/             # backend (Hono): SQLite locally, Netlify Database + Blobs online; owner auth
                   # realm, company-scoped data
```

## Run it locally

Requirements: Node 22.13+ and pnpm 10.

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm dev
```

Open http://localhost:5173 and log in with any email address. In development the magic link is shown on screen (`DEV_MAGIC_LINK=1`); emails are written to `.data/outbox/`.

Without `ANTHROPIC_API_KEY` the app works, but photo reading, document extraction, the photo pre-check and "Vraag het" are switched off and owners fill in data by hand.

Other commands:

```bash
pnpm test        # all packages (pnpm lint and pnpm format:check cover KeurKompas)
```

```bash
pnpm typecheck
```

```bash
pnpm build && pnpm start   # API on :8787 also serves the built web app
```

```bash
pnpm dev:keurkompas        # KeurKompas dev server
```

```bash
pnpm reminders   # daily job: email reminders 3 months and 1 month before deadlines
```

The API tests run on SQLite and, when `TEST_PG_URL` points to a Postgres database, also on
Postgres (CI always does both).

## Online on Netlify

Tankwijzer runs fully on Netlify (`netlify.toml`):

- the web app is served as static files (`apps/tankwijzer/dist`);
- the API runs as a Netlify Function on `/api/*` (`services/api/netlify/functions/api.mts`), with
  a daily scheduled function for email reminders;
- data lives in **Netlify Database** (Postgres; the schema is applied on every deploy from
  `netlify/database/migrations`), files in **Netlify Blobs**.

Settings on Netlify (one time):

1. *Site configuration → Build & deploy*: repository `Pieterrvds/Tankwijzer`, branch `main`,
   **base directory empty** (build command and publish directory come from `netlify.toml`).
2. *Environment variables*: `ANTHROPIC_API_KEY` (AI features); for a test phase
   `DEV_MAGIC_LINK=1` (login without email — no real customer data); for real use
   `BREVO_API_KEY` + `MAIL_FROM` instead; `INSPECTION_BODY_EMAIL`.
3. Deploy. Netlify creates the database on the first deploy with migrations (Netlify Database is
   available on credit-based plans).

Limits to know: uploads max. 4 MB (photos are shrunk in the browser first); one request max.
60 s (AI calls fit); functions run in Ohio (US) unless the region is changed to Frankfurt
(*Functions → Region*, Pro plan) — relevant for GDPR.

## How it fits together

- **One source of truth for VLAREM.** Every rule lives once in `packages/vlarem-core/knowledge/rules`, with its `article`, `source`, `valid_from`/`valid_until` and `verified_by_user`, plus an `inspector` part (KeurKompas: BEPO section, trigger, report wording via `text_inspector_nl` or a standard sentence) and/or an `owner` part (Tankwijzer: `text_owner_nl`, `applies_when`/`ok_when`). The inspector approves rules in KeurKompas ("Regels nakijken"), including the owner wording and the owner-only rules.
- **Rules decide, the AI explains.** Applicability, statuses and deadlines come from the rules engine. Unknown facts give status *onbekend — foto of info nodig* with the question to answer, never a guess.
- AI outputs are structured JSON validated with Zod. Pre-check points and chat citations must reference existing rule ids; invented ones are dropped. A guard redacts brand names and replaces "is conform"-style claims. Every AI call is logged with its input and 👍/👎 feedback (`ai_log` table).
- **Keuringsdossier**: when an owner books an inspection and gives consent, the API builds a dossier (schema `KeuringsDossier` in vlarem-core) labelled `volgens exploitant`, shared through a 90-day token link. Pre-check conclusions are never included, only the photos.
- **Privacy**: every owner table carries `company_id` and every query filters on it. One-click export and delete in Instellingen.
- **Plans**: free up to 3 tanks (enforced); the paid plan is prepared, not built.

See [docs/decisions.md](docs/decisions.md) for the decisions taken and the open questions.
