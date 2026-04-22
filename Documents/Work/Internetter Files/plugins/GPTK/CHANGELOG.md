# Changelog

## [Unreleased]

### Changed
- Removed "Trash" and "Restore" functionality from the in-page GPTK toolkit panel. This simplifies the UI and reduces internal logic clutter, as the legacy "Scan for Duplicates" dashboard remains the primary interface for bulk trashing operations.
- Purged unused `getTrashItems`, `moveItemsToTrash`, and `restoreFromTrash` logic from the userscript to improve performance and maintainability.
- Phase 1 stabilization now treats `./gptk` as the canonical live extension and `gptk 3.zip` as the current backup reference.
- Clarified GPTK as a two-service bundle:
  - **Scan for Duplicates** remains the Gemini-free deduper workflow.
  - **Update Photo Albums** remains the Gemini-gated album metadata workflow.
- Tightened the Update Photo Albums hub copy so it matches the intended user flow: save Gemini key, open an album, then use the in-page GPTK panel.

### Fixed
- Hardened the in-page GPTK icon and panel injection path for Google Photos SPA navigation and DOM churn.
- Restored missing panel bootstrap helpers so the injected toolkit does not fail silently after partial rebuilds.
- Normalized Gemini settings so `chrome.storage.local.apiSettings` is the canonical live store.
- Prevented stale page `localStorage` from continuing to act as the active Gemini source after extension-level settings are cleared.
- Disabled `AI Describe` in library mode to match the runtime safety guard that blocks library-wide execution.
- Improved Google Photos tab selection in the service worker so health checks and command routing prefer the intended active/linked tab instead of an arbitrary Photos tab.

## [3.0.0] - 2026-04-21

### Added
- **Branding Shift**: Officially transitioned from "Google Photos Deduper" to **Google Photos Toolkit (GPTK)** to reflect the broader AI-powered feature set.
- Major version bump to **3.0.0** to signify the first stable release of the AI-integrated toolkit.

### Added Earlier In 3.0.0 Work
- Trusted Types compliance for current Google Photos pages
- SPA durability work for reinjection after in-app navigation
- Gemini 2.5 Flash-Lite support for AI-powered photo descriptions
- Dual-card dashboard hub for deduper plus album-update surfaces

## [2.1.3] - Upstream Baseline

Original Google Photos Deduper v2.1.3 by Mack Talcott.  
See upstream repo for baseline history: https://github.com/nicholasgasior/google-photos-deduper
