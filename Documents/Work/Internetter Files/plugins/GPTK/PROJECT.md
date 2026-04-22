# Google Photos Toolkit (GPTK) v3.0.0

**Fork of:** [nicholasgasior/google-photos-deduper](https://github.com/nicholasgasior/google-photos-deduper)  
**Our fork:** https://github.com/tvcnet/google-photos-dedupe-and-update  
**Base system:** Google Photos Deduper v2.1.3  
**Bundle name:** Google Photos Toolkit (GPTK)  
**Local extension payload:** `./gptk/`
**Current backup reference:** `./gptk 3.zip`

## What This Bundle Is

GPTK is one Chrome extension bundle with two separate product surfaces:

1. **Scan for Duplicates**
   The original Google Photos Deduper workflow. This is the legacy engine and still handles duplicate scanning, grouping, trashing, restoring, and scan logs.

2. **Update Photo Albums**
   The newer GPTK workflow layered into the same extension. This currently centers on Gemini-powered AI descriptions for album photos, with Smart Albums and Metadata Cleanup presented as planned follow-on tools.

The current notes should treat these as distinct services that happen to share one manifest, one extension install, and some bridge/runtime infrastructure.

For stabilization work, treat `./gptk` as the only live implementation target. `gptk 3.zip` is the fallback snapshot, not the primary editing surface.

## Product Split

### 1. Scan for Duplicates

This is the inherited deduper application.

- Primary purpose: scan the Google Photos library for visually similar items
- Main operations: scan, group duplicates, trash selected items, restore items
- UI surface: left card in the dashboard hub
- Runtime style: React app in the extension dashboard, plus page-context API operations routed through the extension bridge
- Current maturity: the more complete and operationally central part of the bundle

### 2. Update Photo Albums

This is the newer GPTK-specific addition.

- Primary purpose: update album/photo metadata with AI-assisted tools
- Current live feature: **AI Descriptions**
- Planned features shown in UI: **Smart Albums**, **Metadata Cleanup**
- UI surface: right card in the dashboard hub
- Runtime style: dashboard setup card plus actions performed inside the injected Google Photos toolkit panel
- Current maturity: partially integrated; AI Describe exists, but the broader service split is still clearer in UX than in internal wiring
- **Note:** The in-page toolkit panel focuses exclusively on metadata and organizational tasks; bulk "Trash" and "Restore" actions have been removed to avoid redundancy with the legacy deduper service.
- Gemini requirement: this is the only service that depends on a Gemini API key

## Shared Extension Infrastructure

Both services sit on top of the same extension shell:

```text
gptk/
├── manifest.json
├── static/background/index.js
├── google-photos-bridge.8ad19c6d.js
├── google-photos-image-bridge.js
├── google-photos-inject.757a6863.js
├── scripts/google-photos-toolkit.user.js
├── scripts/google-photos-commands.js
├── tabs/app.html
├── tabs/app.a1d14322.js
└── tabs/dashboard.js
```

## Runtime Separation

### Dashboard Layer

- `tabs/app.html`
  Hosts the two-card hub layout.
- `tabs/app.a1d14322.js`
  Runs the original deduper dashboard application.
- `tabs/dashboard.js`
  Runs the custom logic for the Update Photo Albums card, especially Gemini key setup and card state transitions.

### Extension Bridge Layer

- `static/background/index.js`
  Service worker for routing commands, tab pairing, progress, and image fetch proxying.
- `google-photos-bridge.8ad19c6d.js`
  Content-script bridge between extension runtime and page context.
- `google-photos-image-bridge.js`
  Dedicated image-fetch bridge for thumbnail retrieval through the service worker.

### Google Photos Page Layer

- `scripts/google-photos-toolkit.user.js`
  Main injected toolkit UI and page-context logic. This is where most page actions actually happen.
- `scripts/google-photos-commands.js`
  Main-world command handler used by the dashboard/bridge path.

## Current State By Service

### Scan for Duplicates

Implemented and materially usable:

- duplicate scan flow
- similarity grouping
- trash flow
- restore flow
- scan logging and progress reporting
- React dashboard path

### Update Photo Albums

Implemented in part:

- Gemini API key setup in dashboard card
- bridge-based key handoff into Google Photos runtime
- `AI Describe` action inside the injected toolkit
- Gemini 2.5 Flash-Lite caption generation
- description write-back to Google Photos

Not yet a full standalone service:

- Smart Albums is placeholder-only
- Metadata Cleanup is placeholder-only
- dashboard card does not directly execute the album-update action set end-to-end
- some docs and labels still blur the line between hub setup and in-page execution

## Important Architectural Distinction

The right-hand card is not a replacement for the left-hand deduper app.

- The **left card** is a functional application with its own scan lifecycle.
- The **right card** is currently a setup-and-launch surface for a newer album-update workflow whose live action still happens inside the injected Google Photos toolkit panel.

The intended user flow is:

1. Install the extension and open Google Photos.
2. Click the GPTK icon in Google Photos, either from library or album view.
3. Use **Scan for Duplicates** directly with no Gemini setup.
4. Use **Update Photo Albums** only when Gemini-backed album work is needed.
5. After Gemini setup, open the target album and use **AI Describe** from the in-page GPTK panel.

That distinction should remain explicit in project notes, reviews, and future planning.

## Recommended Documentation Language

Use this framing consistently:

- **Google Photos Toolkit (GPTK)** is the combined extension bundle.
- **Scan for Duplicates** is the legacy deduper service retained inside GPTK.
- **Update Photo Albums** is the newer GPTK service for metadata and AI-assisted album updates.

Avoid describing GPTK as if the whole extension is only the AI describe feature, and avoid describing the whole dashboard as if it is only the old deduper.
