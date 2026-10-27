# Architecture

```
┌──────────────────────── Phone (PWA, offline-first) ────────────────────────┐
│ React + TypeScript + Tailwind (Vite)                                        │
│   pages/ ─ components/ ─ checklist/ (T2–T19 definitions, NVT suggestions)   │
│        │                                                                    │
│   db/repository.ts ── validates with domain/schemas.ts (Zod) ──┐            │
│        │                                                       │            │
│   IndexedDB (Dexie): inspections · photos (blobs) · voiceNotes · suggestions│
│   Service worker (Workbox): app shell precached → starts without network    │
└──────────────┬──────────────────────────────────────────────────────────────┘
               │ (M3) ZIP export via Web Share API → OneDrive / Drive / mail
               │ (M4/M5) AI jobs queued, sent when online
               ▼
┌──────────── Thin backend, EU region (from M4) ────────────┐
│ Node + Hono: AI proxy (keys never on the phone),           │
│ speech-to-text provider (pluggable), multimodal LLM with   │
│ structured JSON output validated by the same Zod schemas.  │
│ (M7) EU storage for sync + desktop `keurkompas pull`.      │
└────────────────────────────────────────────────────────────┘
```

## Key decisions

- **PWA instead of native apps.** One codebase for Android, iPhone and desktop. Camera via
  `<input capture>`, audio via MediaRecorder, both work offline. Installable on the home screen.
- **Single package for now.** The backend arrives in M4. `src/domain` is kept free of browser
  APIs so it can then move to a shared package without changes.
- **Zod as the single source of truth.** Types are derived from schemas. The same schemas
  validate every DB write, the export (`inspection.json`, `schemaVersion`) and AI output.
- **Blobs in separate tables.** Listing inspections never loads photos or audio.
- **Persistent storage requested** (`navigator.storage.persist()`) so the OS does not evict
  unexported photos.
- **Photos compressed on capture** (≤ 2000 px, JPEG 0.8). EXIF capture time is read before
  re-encoding and stored as `takenAt`.
- **Checklist as code, rules as data.** Checklist structure (sections, items, fields) is
  TypeScript in `src/checklist`. Regulatory rules (M2) are JSON in `knowledge/rules` so they can
  be reviewed and versioned separately. Simple "probably NVT" hints already live with the
  checklist items; they are suggestions only.
- **One inspection = one tank.** Matches "one ZIP per tank" in the export.
- **Underground tanks**: captured with a separate placeholder checklist
  (`src/checklist/ondergronds.ts`) until the requirements are provided.

## Offline behaviour

| What                               | Offline                                            |
| ---------------------------------- | -------------------------------------------------- |
| Open the app, all screens          | ✅ (precached)                                     |
| Create/edit inspections, checklist | ✅ IndexedDB                                       |
| Photos, voice notes                | ✅ stored as blobs                                 |
| Transcription, AI analysis         | queued, runs when online (M4/M5)                   |
| Export                             | ✅ ZIP built on device (M3); sharing needs network |
