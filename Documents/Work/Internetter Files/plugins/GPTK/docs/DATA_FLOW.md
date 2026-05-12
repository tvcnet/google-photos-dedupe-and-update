# Data Flow

GPTK has two distinct workflows in one extension.

## Scan for Duplicates

The duplicate scanner runs inside Google Photos and can be used without Gemini or Ollama. It reads Google Photos library metadata and media thumbnails needed for local duplicate analysis. When smart image comparison is needed, it downloads the MediaPipe image-embedding model/data asset from Google Cloud Storage and uses the bundled local WASM runtime to compute embeddings in the browser.

Duplicate-scan progress/log state is stored in `chrome.storage.local`. Image embeddings may be cached in browser-side IndexedDB under the extension origin to improve repeat scans over larger libraries.

No Gemini or Ollama provider is required for duplicate scanning.

## Update Photo Albums

The album-update workflow is the only AI-provider-gated workflow. AI settings are stored in `chrome.storage.local.apiSettings`.

When the user selects Gemini and runs `AI Describe`, selected image content is sent to the Gemini API through the extension service worker.

When the user selects Ollama and runs `AI Describe`, selected image content is sent to the configured local Ollama server at `http://127.0.0.1:11434` or `http://localhost:11434`.

Stored Gemini keys and optional Ollama proxy keys stay in extension storage and are not exposed back to the Google Photos page context.
