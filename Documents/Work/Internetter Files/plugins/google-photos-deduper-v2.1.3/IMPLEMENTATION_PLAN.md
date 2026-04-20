# AI Photo Description Generator — Implementation Plan

> **Status:** ✅ Implemented (2026-04-20)  
> **Fork:** https://github.com/tvcnet/google-photos-dedupe-and-update

---

## Goal

Add an "AI Describe" action to the Google Photos Toolkit (GPTK) extension that uses Google's Gemini API to analyze photos and write descriptions into the Google Photos "Add a description" field.

---

## Design Decisions

- **Follows `copyDescriptionFromOther` pattern exactly** — same data flow, same concurrency control, same skip-if-exists logic
- **No manifest change needed** — `*.googleapis.com/*` already in `host_permissions`
- **Gemini API key stored in localStorage** — same mechanism as existing API settings
- **Image size: 1024px** — good balance of quality vs. transfer size for Gemini Vision
- **Concurrency: 1** — respects Gemini free tier rate limits (15 RPM)
- **Skip policy: skip if descriptionFull is non-empty** — matches copy-from-EXIF behavior

---

## Implementation: 9 Steps in `google-photos-toolkit.user.js`

| # | What | Where |
|---|---|---|
| 1 | `<button id="aiDescribe">` in action bar HTML | ~line 319 |
| 2 | Gemini API Key `<input type="password">` in Advanced Settings | ~line 292 |
| 3 | `geminiApiKey: ''` in `apiSettingsDefault` | ~line 2125 |
| 4 | Wire `geminiApiKeyInput` in `advancedSettingsListenersSetUp()` | ~line 4354 |
| 5 | `callGeminiVision(apiKey, imageUrl)` standalone helper | after `splitArrayIntoChunks` |
| 6 | `ApiUtils.aiDescribeOneItem(mediaItems)` | after `copyDescriptionFromOther` |
| 7 | `ApiUtils.aiDescribeItems(mediaItems)` batch orchestrator | after step 6 |
| 8 | `aiDescribe: async (p) => ...` in `actionHandlers` map | ~line 3470 |
| 9 | `{ elementId: 'aiDescribe' }` in `actions[]` + `updateUI()` disable | ~line 4226 |

---

## Data Flow

```
User clicks "AI Describe"
    → Core.actionHandlers.aiDescribe()
    → ApiUtils.aiDescribeItems(mediaItems)
        → executeWithConcurrency(..., concurrency=1)
            → ApiUtils.aiDescribeOneItem([item])
                → api.getItemInfoExt(mediaKey)  — check existing description
                → fetch(item.thumb + '=w1024-h1024')  — get image
                → callGeminiVision(apiKey, imageUrl)  — Gemini API call
                → api.setItemDescription(dedupKey, text)  — write to Google Photos
```

---

## Verification

1. Load unpacked extension in `chrome://extensions`
2. Open `photos.google.com` → launch GPTK
3. Advanced Settings → paste Gemini API key → Save
4. Select source/filter → click **AI Describe**
5. Verify log shows progress; check Google Photos info panel for description
6. Re-run → verify already-described photos are skipped

---

## Future Enhancements

- Overwrite mode (checkbox to re-describe existing)
- Custom prompt field in Advanced Settings
- Dry run / preview before applying
- Configurable delay between Gemini calls
