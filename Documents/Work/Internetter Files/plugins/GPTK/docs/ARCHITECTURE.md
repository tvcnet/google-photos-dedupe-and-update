# Architecture

## Runtime split

GPTK has three main layers:

### Dashboard layer

- `gptk/tabs/app.html`
- `gptk/tabs/app.a1d14322.js`
- `gptk/tabs/dashboard.js`

This is the extension hub shown from the extension UI.

### Bridge layer

- `gptk/google-photos-bridge.8ad19c6d.js`
- `gptk/google-photos-image-bridge.js`
- `gptk/static/background/index.js`

This layer connects the extension runtime to the Google Photos page context and background worker.
AI provider requests run through the background worker so Gemini and optional Ollama proxy keys remain in extension storage instead of being exposed to the page context.

### Google Photos page layer

- `gptk/scripts/google-photos-toolkit.user.js`
- `gptk/scripts/google-photos-commands.js`

This is where the in-page toolkit UI and most Google Photos operations run.

## Product split

### Scan for Duplicates

The left-hand hub card. This is the legacy deduper application and remains the main duplicate-scanning surface.

### Update Photo Albums

The right-hand hub card plus the in-page GPTK panel. This is the AI-assisted album metadata workflow.
It supports Gemini and local Ollama for AI Descriptions; Smart Albums and Metadata Cleanup are available as distinct tool groups in `4.5.0`.
