# KeurKompas

_Je kompas op het terrein._ An offline-first field app (PWA) for inspecting storage tanks under
VLAREM II, hoofdstuk 5.17, structured as the BEPO report (T2–T20).

**What it does:** take photos, voice or text notes on site (offline). Add the previous report
once. When you are unsure, tap **Vraag het**: the assistant answers from the previous report,
VLAREM knowledge and what you just captured, with its sources and how sure it is. Everything is
sorted into the BEPO sections in the background and lands in your OneDrive → PC. Corrections you
approve become lessons, so it gets better over time.

Setup (server, app, Microsoft): [`docs/SETUP.md`](docs/SETUP.md).

## Try it

```bash
npm install
npm run dev -- --host
```

Open the printed network URL on your phone (same Wi-Fi). To install it on the home screen and
test offline use, run a production build (`npm run build && npm run preview -- --host`) and
serve it over HTTPS (camera, microphone and installation need HTTPS outside `localhost`).

See [`CLAUDE.md`](CLAUDE.md) for the principles, glossary and conventions, and
[`docs/`](docs/) for the architecture and data model.
