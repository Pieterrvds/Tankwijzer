# Tankwijzer

Web app for companies that own storage tanks in Flanders. It explains in plain Dutch which VLAREM II rules apply to each tank, when the next inspections are due, which documents to have ready and what will *probably* need attention, and it lets owners request an inspection.

**Tankwijzer is not an inspection.** Only a recognised environmental expert (erkend milieudeskundige) can inspect a tank and place a sticker. Every check result says so.

## Monorepo

```
apps/
  tankwijzer/      # owner web app (React + Vite, Dutch UI, installable PWA)
  keurkompas/      # inspector app — to be moved in here (see docs/decisions.md)
packages/
  vlarem-core/     # shared knowledge core: data model (Zod), rules JSON + engine,
                   # deadlines, documents checklist, brand/claim guards, .ics, dossier schema, evals
  ai/              # shared Claude clients: photo reading, document extraction,
                   # pre-check, grounded "Vraag het", output guards
services/
  api/             # backend (Hono + SQLite); owner auth realm, company-scoped data
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
pnpm test        # all packages
```

```bash
pnpm typecheck
```

```bash
pnpm build && pnpm start   # API on :8787 also serves the built web app
```

```bash
pnpm reminders   # daily job: email reminders 3 months and 1 month before deadlines
```

## How it fits together

- **Rules decide, the AI explains.** Applicability, statuses and deadlines come from `packages/vlarem-core` (rules in `src/rules/rules.vl.json`). Unknown facts give status *onbekend — foto of info nodig* with the question to answer, never a guess.
- Every rule has `article`, `source`, `valid_from`/`valid_until`, `verified_by_user` (all `false` until the inspector approves them) and separate `text_owner_nl` / `text_inspector_nl`.
- AI outputs are structured JSON validated with Zod. Pre-check points and chat citations must reference existing rule ids; invented ones are dropped. A guard redacts brand names and replaces "is conform"-style claims. Every AI call is logged with its input and 👍/👎 feedback (`ai_log` table).
- **Keuringsdossier**: when an owner books an inspection and gives consent, the API builds a dossier (schema `KeuringsDossier` in vlarem-core) labelled `volgens exploitant`, shared through a 90-day token link. Pre-check conclusions are never included, only the photos.
- **Privacy**: every owner table carries `company_id` and every query filters on it. One-click export and delete in Instellingen.
- **Plans**: free up to 3 tanks (enforced); the paid plan is prepared, not built.

See [docs/decisions.md](docs/decisions.md) for the decisions taken and the open questions.
