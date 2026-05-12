# Google Photos Toolkit (GPTK)

Google Photos Toolkit is a Chrome extension for Google Photos with two distinct services in one install:

- `Scan for Duplicates`: the legacy deduper workflow for finding visually similar photos
- `Update Photo Albums`: the newer album workflow for AI-generated descriptions using Gemini or a local Ollama server

The live extension payload is in [`gptk/`](./gptk). This repository is the working and release source for the unpacked extension.

## Current product shape

GPTK is intentionally split:

- `Scan for Duplicates` does not require Gemini or Ollama.
- `Update Photo Albums` is the only AI-gated surface.
- `Smart Albums` and `Metadata Cleanup` tools are fully categorized and accessible within the toolkit panel in `4.5.0`.

## Install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `gptk/` folder.
5. Open `https://photos.google.com/`.

## How it works

### Scan for Duplicates

- Opens from the left-hand card in the hub
- Scans Google Photos items and groups visually similar media
- Downloads a MediaPipe image-embedding model from Google Cloud Storage when local embedding analysis is needed
- Supports duplicate review and deduper operations without any AI provider setup

### Update Photo Albums

- Uses the GPTK icon inside Google Photos
- Saves AI settings in `chrome.storage.local.apiSettings`
- Uses the extension service worker for provider calls so stored keys are not exposed back to the Google Photos page context
- Sends image content to Gemini only when Gemini is selected and the user runs `AI Describe`
- Sends image content to the local Ollama server only when Ollama is selected and the user runs `AI Describe`
- Supports selected-album workflows including current-album auto-selection, album-only similarity review, and description-status filters

## Privacy and permissions

See:

- [PRIVACY.md](./PRIVACY.md)
- [PERMISSIONS.md](./PERMISSIONS.md)
- [docs/DATA_FLOW.md](./docs/DATA_FLOW.md)
- [docs/CHROME_REVIEW_NOTES.md](./docs/CHROME_REVIEW_NOTES.md)
- [docs/THIRD_PARTY_NOTICES.md](./docs/THIRD_PARTY_NOTICES.md)
- [docs/WEBSTORE_RELEASE.md](./docs/WEBSTORE_RELEASE.md)
- [docs/WEBSTORE_LISTING_DRAFT.md](./docs/WEBSTORE_LISTING_DRAFT.md)
- [docs/WEBSTORE_SUBMISSION_CHECKLIST.md](./docs/WEBSTORE_SUBMISSION_CHECKLIST.md)

## Chrome Web Store package

Use `gptk/` for unpacked local testing. Do not upload that folder directly to the Chrome Web Store because it may contain repository metadata.

Create the review upload ZIP with:

```sh
cd gptk
./tools/create-webstore-package.sh
```

The generated file is written to `dist/` with `manifest.json` at the ZIP root.

## Repository layout

- [`gptk/`](./gptk): live extension runtime
- [`docs/`](./docs): public and maintainership documentation
- [`tools/`](./tools): local diagnostics and smoke-test helpers

## Project status

`4.5.0` remains in the same release-hardening phase, with focused album-workflow improvements added after the Chrome review cleanup pass.
