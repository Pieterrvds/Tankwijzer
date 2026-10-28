# Setting up KeurKompas

About an hour, once. You need four accounts. All of them have a free start; you pay per use for
the AI.

| What               | Why                                    | Where                                     |
| ------------------ | -------------------------------------- | ----------------------------------------- |
| Anthropic API key  | The assistant (Claude)                 | console.anthropic.com → API keys          |
| Mistral API key    | Voice notes → text (EU company)        | console.mistral.ai → API keys             |
| Cloudflare account | Hosts the app and the small server     | dash.cloudflare.com (free plan is enough) |
| Microsoft 365      | Photos and notes to OneDrive → your PC | portal.azure.com (may need your IT admin) |

Run the commands below in the project folder on your PC (Node.js 20 or newer installed).

## 1. The server (keeps the API keys away from the phone)

From the repository root (KeurKompas is part of the Tankwijzer monorepo):

```bash
pnpm install
```

Then run the commands below in `apps/keurkompas`.

```bash
npx wrangler login
```

Choose a long random app key, e.g. with `openssl rand -hex 24`, and keep it: you will type it
once on the phone. Then store the secrets (each command asks for the value):

```bash
cd server && npx wrangler secret put ANTHROPIC_API_KEY
```

```bash
cd server && npx wrangler secret put MISTRAL_API_KEY
```

```bash
cd server && npx wrangler secret put APP_TOKEN
```

```bash
npm run server:deploy
```

Note the address it prints, like `https://keurkompas-api.<name>.workers.dev`.

## 2. The app

```bash
npm run app:deploy
```

Note the address, like `https://keurkompas.pages.dev`. Put it in `server/wrangler.toml` under
`ALLOWED_ORIGINS` (so only your app may call the server), then run `npm run server:deploy` again.

## 3. OneDrive (Microsoft app registration)

1. portal.azure.com → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `KeurKompas`. Supported account types: _Accounts in any organizational directory and
   personal Microsoft accounts_.
3. Redirect URI: platform **Single-page application (SPA)**, address = your app address with a
   slash, e.g. `https://keurkompas.pages.dev/`.
4. After creating: **API permissions** → _Add a permission_ → Microsoft Graph → _Delegated_ →
   `Files.ReadWrite`. (If your organisation requires it, ask IT to _grant admin consent_.)
5. Copy the **Application (client) ID** from the overview page.

## 4. On the phone

1. Open the app address in Safari (iPhone) or Chrome (Android) → _Add to Home Screen_.
2. ⚙️ Instellingen → **Assistent**: server address from step 1 + your app key → _Bewaren en testen_.
3. ⚙️ Instellingen → **OneDrive**: the client ID from step 3 → _Bewaren_ → _Aanmelden bij Microsoft_.

Files then appear in OneDrive under `KeurKompas/<JJJJMMDD>_<klant>_<tanknr>/` and on your PC
through the normal OneDrive sync.

## Privacy, in short

- Everything is stored on the phone first. Nothing leaves it until there is signal.
- Photos and notes go **directly from the phone to your own OneDrive** (no server in between).
- Questions, photos you attach, and the previous report text go through your Cloudflare server
  to **Anthropic** (Claude). Anthropic does not train on API data; inference is not limited to
  the EU. Zero data retention can be arranged with Anthropic for business accounts.
- Voice notes go through your server to **Mistral** (EU) for transcription.
- The server stores nothing.

## Costs (rough)

- Claude: about €0.03–0.08 per question, and about €0.01–0.02 per photo or note for the
  automatic sorting into T-sections. A typical inspection with 20 photos and 5 questions:
  about €0.50–0.80.
- Mistral transcription: about €0.20 per hour of audio.
- Cloudflare and Microsoft: free at this volume.

Check your usage in the Anthropic and Mistral consoles, and set a monthly limit there.
