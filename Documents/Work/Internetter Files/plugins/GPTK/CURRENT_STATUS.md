# GPTK Current Status

**Date:** April 21, 2026  
**Live extension target:** `./gptk`  
**Backup reference:** `./gptk 3.zip`

## Current Project State

GPTK is operational as an unpacked Chrome extension, but the codebase remains messy after multiple rebuilds and repair passes.

The product split is now documented and should be treated as fixed:

1. **Scan for Duplicates**
   Legacy deduper service. This should work without Gemini.
2. **Update Photo Albums**
   Newer GPTK service. This is the only Gemini-dependent surface.

## What Was Stabilized In This Session

### Runtime and architecture cleanup

- Treated `./gptk` as the canonical repair surface.
- Treated `./gptk 3.zip` as the current backup reference only.
- Rewrote the background worker into readable code in `gptk/static/background/index.js`.
- Rewrote the content-script bridge into readable code in `gptk/google-photos-bridge.8ad19c6d.js`.
- Kept the current command bridge scope centered on deduper operations and health-check.

### Google Photos entry flow

- Stabilized the GPTK icon/panel boot path in `gptk/scripts/google-photos-toolkit.user.js`.
- Restored missing helper coverage for reinjection and SPA navigation.
- Hardened button rebinding and panel recovery.
- Adjusted toolbar insertion so the GPTK icon is injected as its own sibling wrapper rather than sharing a native tooltip wrapper.

### Settings and hub behavior

- Made `chrome.storage.local.apiSettings` the canonical Gemini settings store.
- Kept page `localStorage` only as compatibility fallback.
- Updated dashboard key handling so clear/update affects the effective runtime state.
- Updated the dashboard/right-card copy to reflect the real flow:
  - Gemini is only for Update Photo Albums
  - the user should open the target album in Google Photos
  - AI Descriptions runs from the in-page toolkit, not the dashboard card itself

### Safer destructive action flow

- Restricted album include filtering so it only appears when `Source = Albums`.
- Added the selected album name to the confirm-action modal.
- Confirmed the modal now shows the chosen album correctly before destructive actions.

## Current Working Behavior

- The selected album name is displayed in the confirmation modal.
- Album-source reads are correctly scoped to the chosen album.
- The GPTK toolbar icon injection is structurally improved and no longer uses the older shared-wrapper insertion path.
- Trash flow now resolves album items into canonical library mutation targets before attempting the trash RPC.

## Current Known Problem

### Album -> Trash still does not move photos

The most important unresolved issue is:

- User selects `Source: Albums`
- User selects a target album
- User clicks `Trash`
- GPTK reads the correct album item count
- GPTK resolves all items into canonical mutation targets
- GPTK sends the trash RPC
- No photos actually move to Google Photos Trash

### What the latest logs show

Latest observed behavior:

```text
[17:50:56] Getting album items
[17:50:56] Found 300 items
[17:50:57] Found 16 items
[17:50:57] Source read complete
[17:50:57] Found items: 316
[17:50:57] Items to process: 316
[17:50:57] Resolving library item identities for trash
[17:51:09] Processed 100 items
[17:51:22] Processed 200 items
[17:51:36] Processed 300 items
[17:51:38] Moving 316 items to trash
[17:51:38] Processing 250 items
[17:51:38] Processing 66 items
[17:51:38] Task completed in 00:00:41
```

This means:

- album scoping is now correct
- item identity resolution is now working
- the remaining failure is at or below the actual trash RPC layer

## Most Likely Remaining Cause

The current leading hypothesis is:

- Google Photos is returning a silent no-op or non-obvious response shape from the `XwAOJf` trash RPC for these album-derived items
- or the RPC accepts the keys but does not treat them as currently trashable in this context

This no longer looks like a filter-scoping bug.

## Instrumentation Already Added

The next session starts with useful diagnostics already in place:

- album-source items retain album context (`sourceAlbumMediaKey`, `sourceAlbumAuthKey`, `sourceAlbumTitle`)
- trash flow resolves album items through `getItemInfo(...)` before mutation
- trash flow logs the raw RPC response preview from `moveItemsToTrash(...)`

## First Recommendations For Next Session

1. Re-run the same album -> `Trash` test and capture the new line:
   `Trash RPC response preview: ...`

2. Determine whether the response is:
   - a success shape that GPTK is misreading
   - a no-op shape
   - an embedded rejection shape inside a normal HTTP 200 response

3. If the response is ambiguous, log one full raw response object for a single-item trash attempt instead of only the preview.

4. Compare the album-trash RPC behavior against a known-good trash action on one item selected directly from the library view.

5. If the RPC is truly a no-op for album-derived items, decide whether GPTK should:
   - block album-source trash entirely
   - switch to a different trash path
   - or convert the flow into a remove-from-album action plus library trash action if that better matches Google Photos behavior

## Secondary Recommendations

- Re-check toolbar icon alignment visually after the latest wrapper insertion changes.
- Continue reducing minified/runtime-only confusion by keeping notes and changes focused on `./gptk`.
- Do not expand Smart Albums or Metadata Cleanup yet; both should remain placeholders until the core album action path is reliable.

## Files Most Relevant Next Session

- `gptk/scripts/google-photos-toolkit.user.js`
- `gptk/scripts/google-photos-commands.js`
- `gptk/google-photos-bridge.8ad19c6d.js`
- `gptk/static/background/index.js`
- `gptk/tabs/dashboard.js`
- `gptk/tabs/app.html`

## Suggested Opening Move Next Session

Start by reproducing the same album -> `Trash` test and reading the new `Trash RPC response preview` log line before making further logic changes.
