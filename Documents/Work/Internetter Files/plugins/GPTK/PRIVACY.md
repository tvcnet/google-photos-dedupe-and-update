# Privacy

Google Photos Toolkit runs locally in your browser as a Chrome extension.

## What GPTK stores locally

GPTK stores extension settings in `chrome.storage.local`, including:

- AI provider selection
- Gemini API key, if configured
- Ollama local server settings, if configured
- optional Ollama proxy/API key, if configured
- extension operational settings and some scan state

Duplicate-scan support data may also be cached locally by the extension runtime to improve repeat scans. This includes browser-side scan state and image-embedding cache data used for duplicate analysis.

Gemini keys and optional Ollama proxy keys are kept in extension storage. The Google Photos page-context toolkit receives only redacted settings plus configured/not-configured flags.

## What GPTK sends over the network

GPTK communicates with:

- `photos.google.com` and related Google Photos content hosts required for the extension to function
- `storage.googleapis.com` to download the MediaPipe image-embedding model/data asset used for local duplicate analysis
- Google's Gemini API only when the user has configured a Gemini key and runs the AI description workflow
- a local Ollama server at `http://127.0.0.1:11434` or `http://localhost:11434` only when the user selects Ollama and runs the AI description workflow

## What GPTK does not do by default

- GPTK does not require Gemini or Ollama for duplicate scanning.
- GPTK does not send image content to Gemini unless the AI description workflow is explicitly used with Gemini selected.
- GPTK does not send image content to Ollama unless the AI description workflow is explicitly used with Ollama selected.
- GPTK does not expose stored Gemini or Ollama keys back to the Google Photos page.
- GPTK does not download remote JavaScript or WASM for duplicate analysis; the executable embedding runtime is packaged with the extension.

## Third-party services

When Gemini is used, the extension service worker sends requests to Google's Gemini API using the user-provided key.

When Ollama is used, the extension service worker sends requests only to the local Ollama server configured by the user.

For local Ollama compatibility, GPTK uses narrow Chrome dynamic network rules that remove `Origin` and `Referer` only from extension-origin requests to `127.0.0.1:11434` or `localhost:11434`. These rules do not apply to Google Photos, Gemini, Google user-content hosts, or arbitrary websites.

## Contact

See [SUPPORT.md](./SUPPORT.md).
