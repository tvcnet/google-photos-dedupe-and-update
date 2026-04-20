# Changelog

## [2.1.3] - 2026-04-20
### Added
- **Trusted Types Compliance**: Migration to native `createElement` and custom `TrustedTypes` policies to bypass Google's security blocks, ensuring the toolkit works on the latest Google Photos updates.
- **SPA URL Watcher**: Implemented a location-aware watcher that detects in-page navigation (e.g., transitions between Albums and Library) and re-injects the UI automatically.
- **Boot Guard**: Added a polling loop that waits for `WIZ_global_data` to be ready before initializing the UI, preventing race-condition crashes.
- **Safety Net (FAB)**: Persistent animated Floating Action Button in the bottom-right corner as a fallback UI.
- Integrated **Gemini 2.5 Flash-Lite** for AI-powered photo descriptions in albums.
- New **Sky-Glass Dashboard Hub** (app.html) with dual-card layout and real-time log streaming.

### Fixed
- **Crash Fix**: Resolved `GM_registerMenuCommand` is not a function error in Chrome extension context.
- **Crash Fix**: Resolved `insertAdjacentElement` failure caused by whitespace text nodes in the main template.
- **Security Fix**: Fixed silent crash during `windowGlobalData` initialization via a lazy Proxy getter.
- **Persistence**: Verified Gemini API key persistence via the cross-origin bridge.
- **UI**: Added explicit "photos in an album" labels to the dashboard for clarity.

## [2.1.0] - 2026-04-15
notable changes to this fork are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- `AI Describe` action button in the action bar
- Gemini API Key field in Advanced Settings (stored in localStorage per Google account)
- `callGeminiVision(apiKey, imageUrl)` — helper that fetches a 1024px thumbnail, converts to base64, and calls Gemini 2.0 Flash `generateContent` API
- `ApiUtils.aiDescribeOneItem(mediaItems)` — single-item processor; skips items that already have a description
- `ApiUtils.aiDescribeItems(mediaItems)` — batch orchestrator using existing `executeWithConcurrency` at concurrency=1

### Changed
- **UI Theme** — switched from generic blue (`#3b82f6`) to TVCNet sky-glass aesthetic (`#0ea5e9`) based on `social-toolkit.css`
  - Deep navy gradient panel background
  - Glassmorphism on sidebar and action bar (`backdrop-filter: blur`)
  - Shimmer sweep hover animation on all buttons
  - Special sky-glow style for the AI Describe button
  - Pill-glow animation on active source tabs
  - FadeUp entrance animation on log entries
  - Inter font via Google Fonts
  - Full `prefers-reduced-motion` support

### Repo
- Initialized local git repo in `gdupe/` with clean baseline commit (`fa870d8`)
- Added `PROJECT.md`, `CHANGELOG.md`, `IMPLEMENTATION_PLAN.md` to parent directory

---

## [2.1.3] — Upstream Baseline

Original Google Photos Deduper v2.1.3 by Mack Talcott.  
No changes from upstream at this commit (`fa870d8`).

See upstream repo for full history: https://github.com/nicholasgasior/google-photos-deduper
