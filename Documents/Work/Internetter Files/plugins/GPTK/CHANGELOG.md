# Changelog

## [Unreleased]

## [4.5.0] - 2026-05-11

### Added
- **UI Categorization**: Restructured the injected toolkit panel's Actions menu into distinct `Smart Albums & Organization`, `Metadata Cleanup`, and `AI Features` categories.
- Re-enabled dashboard feature tiles to accurately link to the fully functional toolkit features.

### Changed
- Advanced the live GPTK release line to `4.5.0`.
- Removed legacy "in development" placeholder text from dashboard UI and documentation.

## [4.4.0] - 2026-05-11

### Added
- **Local Ollama Support**: Integrated local Ollama as an AI provider alongside Gemini.
- Added `isAlbumUpdateConfigured` validation logic for better setup status visualization.
- Configured declarativeNetRequest rules to bypass CORS restrictions for `127.0.0.1:11434` and `localhost:11434` for seamless local model interaction.
- Moved `callGeminiVision` and `callOllamaVision` logic directly to the extension service worker to protect API keys and API request details from the page context.
- Added advanced in-page UI settings for local model selection and provider toggling.

### Changed
- Advanced the live GPTK release line to `4.4.0`.
- Changed AI logic routing: Content scripts now pass `gptkOllamaRequest` and `gptkAiDescribeRequest` directly to the service worker.
- Updated `tabs/dashboard.html` copy and `tabs/dashboard.js` flow to decouple duplicate scanning from AI provider requirements and accurately reflect Ollama/Gemini independence.

## [4.2.0] - 2026-05-11

### Changed
- Advanced the live GPTK release line to `4.2.0`.
- Added a repeatable Chrome Web Store packaging script that creates a clean upload ZIP from `gptk/`.
- Documented the release packaging workflow and the rule to upload the generated `dist/` ZIP instead of the live Git working tree.

## [4.1.0] - 2026-05-11

### Changed
- Advanced the live GPTK release line to `4.1.0`.
- Updated manifest metadata and shipped runtime strings after the latest review-facing changes.
- Updated shipped repository references to `https://github.com/tvcnet/gptk`.
- Adopted the versioning rule that significant changes should increment the minor version.

## [4.0.0] - 2026-05-10

### Changed
- Advanced the live GPTK release line to `4.0.0`.
- Began the repository and release-hardening phase focused on Chrome review readiness, public documentation, and GitHub presentation cleanup.
- Added public release-facing documentation: `README.md`, `PRIVACY.md`, `PERMISSIONS.md`, `SUPPORT.md`.
- Updated manifest metadata for Chrome Web Store submission (removed broad `tabs` permission, refined host permissions).
- Updated manifest `author` to `Jim Walker, @TVCNet`.
- Tightened the manifest description to a narrower review-facing purpose statement.
- Removed `offline_enabled` from the manifest so the metadata matches the real Google Photos/network-dependent runtime.
- **Sequential AI Processing**: Overhauled the AI Describe workflow to process images one-by-one, ensuring system stability and preventing Ollama queuing issues.
- **Real-time Feedback**: Added detailed, per-item status logging in the console for both AI Describe and Clear Description actions.
- **Clear Descriptions Feature**: Introduced a new "Clear Descriptions" action in the toolkit with a destructive action safety guard.
- **Reliability Fixes**: Corrected an issue where AI descriptions failed to persist due to stale dedupKeys and markdown formatting in AI responses.
- Corrected dashboard and in-page copy so AI-provider storage language matches `chrome.storage.local`.
- Removed "Trash" and "Restore" controls from the in-page album-update panel.

### Fixed
- Hardened the in-page GPTK icon and panel injection path for Google Photos SPA navigation and DOM churn.
- Restored missing panel bootstrap helpers so the injected toolkit does not fail silently after partial rebuilds.
- Normalized AI provider settings so `chrome.storage.local.apiSettings` is the canonical live store.
- Prevented stored Gemini and optional Ollama proxy keys from being exposed back to the Google Photos page context.
- Routed Gemini and Ollama AI-description requests through the extension service worker.
- Preserved stored secret values when the in-page Advanced Settings form saves non-secret provider settings.
- Fixed Ollama model fetches so optional stored Ollama proxy keys are honored.
- Prevented stale page `localStorage` from continuing to act as the active AI-provider source after extension-level settings are cleared.
- Disabled `AI Describe` in library mode to match the runtime safety guard that blocks library-wide execution.
- Improved Google Photos tab selection in the service worker so health checks and command routing prefer the intended active/linked tab instead of an arbitrary Photos tab.
- Restored deduper Trash/Restore RPC compatibility in the in-page API surface used by `google-photos-commands.js`.

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
