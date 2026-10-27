# KeurKompas

_Je kompas op het terrein._ An offline-first field app (PWA) for inspecting storage tanks under
VLAREM II, hoofdstuk 5.17, structured as the BEPO report (T2–T20).

**Status:** M0 (foundation), M1 (offline capture) and M2 (rules engine + vergeet-niet) are
built: inspections, tank/product data, previous-inspection facts, the T2–T19 checklist with
OK/NOK/NVT, photos and hold-to-record voice notes, all offline on the device; plus 28 VLAREM
rules from `knowledge/rules` that propose NVT, reminders and findings, a rule review screen, and
a vergeet-niet list that blocks closing an inspection while something is missing.

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
