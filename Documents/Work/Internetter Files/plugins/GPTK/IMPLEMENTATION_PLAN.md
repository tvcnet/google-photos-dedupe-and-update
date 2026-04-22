# GPTK Phase 1 Stabilization Notes

> **Current live target:** `./gptk`  
> **Current backup reference:** `./gptk 3.zip`

## Intent

Stabilize the current unpacked extension without rebuilding the original source pipeline.

This phase treats GPTK as one extension with two distinct services:

1. **Scan for Duplicates**
   Legacy deduper workflow, usable without Gemini.
2. **Update Photo Albums**
   Gemini-gated workflow for album metadata actions, currently centered on **AI Descriptions**.

## Runtime Rules

- `./gptk` is the canonical repair surface.
- `gptk 3.zip` is the fallback reference only.
- The Google Photos in-page GPTK icon is the primary runtime entrypoint.
- The right-hand dashboard card is a setup-and-launch surface, not a full parallel executor for album actions.

## Intended User Flow

1. Install the extension.
2. Open `photos.google.com`.
3. Click the GPTK icon in Google Photos from library or album view.
4. Use **Scan for Duplicates** directly if duplicate cleanup is the goal.
5. Use **Update Photo Albums** only when Gemini-backed album updates are needed.
6. Save Gemini settings from the dashboard card.
7. Open the target album in Google Photos.
8. Use the GPTK panel and choose **AI Describe**.

## Stabilization Targets

### Primary entry flow

- Reliable icon injection in library and album views
- Reliable panel opening from the GPTK icon
- Reinjection across Google Photos SPA navigation
- No silent boot failures from missing helpers or partial rebuild artifacts

### Settings and bridge behavior

- `chrome.storage.local.apiSettings` is the canonical Gemini store
- Page `localStorage` remains compatibility-only
- Clearing or updating the Gemini key must change live runtime behavior immediately
- Deduper bridge scope remains limited to health-check, fetch, trash, and restore in this phase

### Product split

- Scan for Duplicates remains Gemini-free
- Update Photo Albums remains the only Gemini-dependent surface
- Smart Albums and Metadata Cleanup remain placeholders only

## Verification Targets

- GPTK icon appears in library view
- GPTK icon appears in album view
- Icon click opens the GPTK panel in both locations
- Scan for Duplicates works with no Gemini key configured
- Update Photo Albums is the only Gemini-gated flow
- Gemini key save, update, and clear affect the live runtime
- Health-check, media fetch, trash, and restore still work
- Dashboard copy matches the actual supported flow
