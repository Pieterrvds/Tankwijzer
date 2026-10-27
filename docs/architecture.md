# Architecture

```
┌──────────────────────────── Phone (PWA, offline-first) ─────────────────────────────┐
│  Capture: 📷 Foto · 🎤 Spraak · ✏️ Notitie · ❓ Vraag het      Vorige keuring card     │
│        │                                                                             │
│  IndexedDB (Dexie): inspections · photos · voiceNotes · textNotes · questions ·      │
│                     lessen · settings · syncState                                    │
│        │                                     │                                       │
│  AI queue (when online)                      OneDrive sync loop (when online)        │
│   1 transcribe voice notes                    photos/, notes.md, transcripts/,       │
│   2 read previous report → facts              inspection.json, audio/ (optional)     │
│   3 answer questions                          per inspection; _lessen/lessen.json     │
│   4 sort photos/notes into T2–T20                  │                                 │
└────────┼─────────────────────────────────────────────┼─────────────────────────────────┘
         │ HTTPS + app key                              │ Microsoft Graph, user's own login
         ▼                                              ▼
┌──────── KeurKompas server (Cloudflare Worker) ──┐   ┌──── OneDrive ────┐
│ /api/ask /api/extract /api/tag → Claude         │   │ synced to the PC  │
│ /api/transcribe → Mistral (Voxtral, EU)         │   └───────────────────┘
│ holds the API keys, validates, stores nothing   │
└──────────────────────────────────────────────────┘
```

## Key decisions

- **Capture first, AI later.** Every capture is saved on the phone immediately. AI work and
  uploads are queues that run when there is signal, so a basement without coverage loses nothing.
- **The previous report is read on the phone** (pdf.js / mammoth), so it works offline and the
  original file never leaves the device. Only its text goes to the assistant. Word tables become
  `cell | cell` lines, which keeps the T2–T20 tables readable.
- **Grounded answers.** Claude gets: instructions (`src/ai/instructions.ts`), the knowledge
  bundle (`knowledge/` → `server/src/knowledge.generated.ts`), approved lessons, the previous
  report text, today's notes, earlier Q&A and the attached photos. Structured outputs force the
  answer into the `Answer` schema (sources, certainty, te_bevestigen). Prompt caching keeps the
  repeated part (knowledge + report) cheap.
- **Invisible T-structure.** The assistant sorts each photo/note into a section (`/api/tag`);
  photos are renamed `T10_inkuiping_01.jpg`; notes.md is grouped per section. The inspector can
  change a section by hand, and the assistant never overrides that.
- **Safe learning loop.** Corrections are proposals until approved; only approved lessons reach
  the assistant. They are synced to OneDrive for permanent inclusion in `knowledge/lessons.md`
  and `evals/`.
- **OneDrive directly from the phone.** MSAL (PKCE) with the user's own Microsoft account and
  only `Files.ReadWrite`. No storage of our own, no desktop software.
- **Preview build.** `npm run build:preview` makes a single page that asks Claude through
  claude.ai itself (no server), to try the flow. No voice and no OneDrive there.
- **Rules stay deterministic** (`knowledge/rules`, tested) and now feed gentle, dismissible hints
  and the assistant's knowledge, instead of a checklist.
