# Chrome Web Store Listing Draft

## Extension Name

Google Photos Toolkit (GPTK)

## Short Description

Scan Google Photos duplicates and generate album photo descriptions with Gemini or local Ollama.

## Single Purpose

GPTK helps users work inside Google Photos by providing duplicate scanning and album photo-description tools from one extension surface.

## Detailed Description

Google Photos Toolkit (GPTK) adds a focused toolkit to Google Photos.

The extension has two distinct workflows:

- Scan for Duplicates: find visually similar photos in Google Photos and review duplicate groups.
- Update Photo Albums: generate concise photo descriptions for album photos using either Gemini or a local Ollama vision model selected by the user.

Duplicate scanning does not require Gemini, Ollama, or any AI provider setup. AI provider settings apply only to the album-update description workflow.

GPTK stores settings locally in Chrome extension storage. Gemini API keys and optional Ollama proxy keys are kept in extension storage and are not exposed back to the Google Photos page context.

## Privacy Summary

GPTK runs locally in the browser as a Chrome extension. It communicates with Google Photos because the extension operates inside Google Photos. It downloads a MediaPipe model asset from Google Cloud Storage for local duplicate analysis. It sends image content to Gemini only when the user selects Gemini and runs AI descriptions. It sends image content to local Ollama only when the user selects Ollama and runs AI descriptions.

## Permission Justification Summary

- `activeTab`: targets the active Google Photos tab when opening or reconnecting the toolkit.
- `storage`: stores extension settings, scan state, and AI provider configuration locally.
- `unlimitedStorage`: supports larger duplicate scans and local embedding cache data used for repeat scans.
- `declarativeNetRequest`: supports optional local Ollama compatibility only for extension requests to `localhost:11434` or `127.0.0.1:11434`.

## Screenshot Plan

Recommended Chrome Web Store screenshots:

- Dual-card GPTK hub showing `Scan for Duplicates` and `Update Photo Albums`.
- Google Photos library or album toolbar with the GPTK icon visible.
- Duplicate scan panel/results flow.
- Update Photo Albums panel with `AI Describe` visible in an album context.
- Advanced Settings showing `Choose Your Model` with Gemini/Ollama provider options, with any personal keys redacted.

Avoid screenshots showing private photo content, personal email addresses, API keys, or unrelated Chrome UI.
