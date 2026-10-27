# KeurKompas

_Je kompas op het terrein._ An offline-first field app (PWA) for inspecting storage tanks under
VLAREM II, hoofdstuk 5.17, structured as the BEPO report (T2–T20).

**Status:** M0 (foundation) and M1 (offline capture) are built: inspections, tank/product
data, previous-inspection facts, the T2–T19 checklist with OK/NOK/NVT, photos and hold-to-record
voice notes, all stored offline on the device.

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
