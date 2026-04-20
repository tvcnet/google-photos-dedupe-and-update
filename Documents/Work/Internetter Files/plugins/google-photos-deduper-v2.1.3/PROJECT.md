# Google Photos Dedupe & Update

**Fork of:** [nicholasgasior/google-photos-deduper](https://github.com/nicholasgasior/google-photos-deduper)  
**Our fork:** https://github.com/tvcnet/google-photos-dedupe-and-update  
**Base version:** v2.1.3  
**Local repo:** `./gdupe/` (git initialized 2026-04-19)

# Google Photos Deduper v2.1.3 - Gemini Edition

## Vision
A high-performance toolkit for managing Google Photos, now enhanced with **Gemini 2.5 Flash-Lite** for intelligent metadata management and AI-generated descriptions.

## Key Features
- **AI Descriptions**: Automatically generate captions for photos in albums using Google's latest Gemini models.
- **Sky-Glass Dashboard**: A premium, dual-card hub interface for managing cleanup tasks.
- **Smart Search Deduplication**: Local high-speed duplicate detection.
- **Cross-Origin Sync**: Persistent API key management synced between the extension dashboard and Google Photos.

## Roadmap
- [x] Gemini 2.5 API Integration
- [x] Interactive Dashboard Hub
- [x] Trusted Types & SPA Durability Layer
- [ ] Smart Album Auto-sorting
- [ ] Metadata Cleanup Tool

## Goal

Transform the Google Photos Deduper Chrome extension into a full **AI-powered photo management toolkit** that can:

1. **Deduplicate** — existing functionality, preserved as-is
2. **AI Describe** — analyze photos with Gemini Vision and auto-write descriptions into the Google Photos "Add a description" field

---

## Architecture

```
gdupe/                          Chrome extension (load unpacked)
├── manifest.json               Permissions, content scripts
├── scripts/
│   └── google-photos-toolkit.user.js   Main UI + API logic (primary file)
├── static/background/index.js  Service worker (bridge storage router)
├── tabs/app.html               Main dashboard (Hub)
├── tabs/dashboard.js           Hub logic
├── tabs/dashboard.css          Sky-glass styling
└── google-photos-bridge.js     Bridge content script (storage & CSP)
```

### Key internal classes / patterns

| Symbol | Role |
|---|---|
| `Api` | Raw GPTK API calls (`makeApiRequest`, `setItemDescription`, `getItemInfoExt`, etc.) |
| `ApiUtils` | High-level batch operations built on `Api` |
| `Core` | Orchestrator — fetches media, applies filters, dispatches to `actionHandlers` |
| `actionHandlers` | Strategy map `{ actionId: async fn }` — add a new action here |
| `actions[]` | Button-to-handler wiring array |
| `callGeminiVision()` | Standalone helper — fetches thumbnail → base64 → Gemini API |

### Adding a new action — checklist

- [ ] Add button HTML to action bar (line ~319)
- [ ] Add handler to `actionHandlers` map in `Core` constructor
- [ ] Add `{ elementId: 'yourId' }` to `actions[]` array
- [ ] Add `setDisabled('yourId', condition)` in `updateUI()` if needed
- [ ] Add method(s) to `ApiUtils`

---

## AI Describe — Implementation Details

**API:** Gemini 2.0 Flash (`gemini-2.0-flash`) via `v1beta/models/gemini-2.0-flash:generateContent`  
**Image:** 1024px thumbnail (`item.thumb + '=w1024-h1024'`) — no watermark, no auth required  
**Skip logic:** Items with an existing `descriptionFull` are skipped  
**Concurrency:** 1 item at a time (respects Gemini free-tier rate limits)  
**Key storage:** `localStorage` via existing `saveToStorage('apiSettings', ...)` pattern

**Prompt:**
> "Describe this photo in 1-2 natural sentences suitable for a photo caption. Focus on the scene, subjects, and setting. Be concise and factual."

---

## UI Theme

Based on `social-toolkit.css` (TVCNet Sky Glass design system):

- **Accent:** sky-500 (`#0ea5e9`)
- **Panel:** deep navy gradient background
- **Surfaces:** glassmorphism with `backdrop-filter: blur`
- **Font:** Inter (Google Fonts)
- **Animations:** shimmer sweep on buttons, pill-glow on active source tabs, fadeUp on log entries
- **Accessibility:** `prefers-reduced-motion` respected

---

## Roadmap / Future Ideas

- [ ] **Overwrite mode** — checkbox to re-describe already-described photos
- [ ] **Custom prompt** — let user edit the Gemini prompt in Advanced Settings
- [ ] **Dry run / preview** — show AI descriptions before applying
- [ ] **Batch rate-limit delay** — configurable sleep between Gemini calls
- [ ] **Video support** — detect video mime type, use different prompt
- [x] **Push to fork** — sync local git changes to `tvcnet/google-photos-dedupe-and-update`
