# Chrome Web Store Submission Checklist

Use this checklist before submitting GPTK to the Chrome Web Store.

## Package

- Run `./tools/create-webstore-package.sh`.
- Upload `dist/gptk-webstore-v<version>.zip`.
- Confirm `manifest.json` is at the ZIP root.
- Confirm the ZIP does not include `.git/`, `docs/`, `tools/`, `dist/`, `.DS_Store`, or repository-only Markdown files.

## Store Listing

- Single-purpose statement: GPTK helps users work inside Google Photos by scanning duplicates and generating photo descriptions from the same extension surface.
- Product split: `Scan for Duplicates` works without Gemini or Ollama; `Update Photo Albums` is the only AI-provider workflow.
- Support URL: `https://github.com/tvcnet/gptk`
- Privacy policy: use the public repository privacy document or a hosted equivalent based on `PRIVACY.md`.
- Screenshots should show the dual-card hub, duplicate scan entry, and album-update/AI-description flow.

## Permission Justifications

- `activeTab`: targets the current Google Photos tab when opening or reconnecting GPTK.
- `storage`: stores extension settings and AI provider configuration in `chrome.storage.local`.
- `unlimitedStorage`: supports large local duplicate-scan state and the browser-side embedding cache used for repeat scans over larger Google Photos libraries.
- `declarativeNetRequest`: supports optional local Ollama requests only by removing `Origin` and `Referer` headers for extension-origin XHR requests to `localhost:11434` or `127.0.0.1:11434`.

## Host Permission Justifications

- `photos.google.com`: required because GPTK operates inside Google Photos.
- `*.googleusercontent.com` and `*.usercontent.google.com`: required for Google Photos media and thumbnail resources.
- `generativelanguage.googleapis.com`: used only when the user selects Gemini and runs AI descriptions.
- `storage.googleapis.com`: downloads the MediaPipe image-embedding model asset for local duplicate analysis.
- `localhost:11434` and `127.0.0.1:11434`: used only when the user selects local Ollama and runs AI descriptions.

## Final Smoke Test

- Load the repository directory unpacked in Chrome.
- If testing from the generated ZIP, extract it first and load the extracted folder unpacked.
- Open `https://photos.google.com`.
- Verify the GPTK icon appears in library view and album view.
- Verify clicking the GPTK icon opens the panel.
- Verify `Scan for Duplicates` can run without Gemini or Ollama.
- Verify AI descriptions require either Gemini settings or a selected local Ollama model.
- Verify the generated Web Store ZIP can be loaded as an unpacked extension after extraction.
- Capture store screenshots only after confirming the loaded extension is `4.5.0`.
- Record manual results in `docs/SMOKE_TEST_RESULTS.md`.

## Local Automation Note

An isolated command-line Chrome launch is useful for package checks, but the final review smoke test should be performed through Chrome's normal `Load unpacked` extension UI or another known-good local extension profile. This avoids false negatives from command-line extension loading restrictions in branded Chrome builds.
