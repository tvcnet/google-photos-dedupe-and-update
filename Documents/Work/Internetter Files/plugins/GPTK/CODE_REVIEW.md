# Google Photos Toolkit (GPTK) v3.0.0 - Code Review

This review treats the current extension as a combined bundle with two distinct service surfaces:

1. **Scan for Duplicates**  
   The original Google Photos Deduper application retained inside GPTK.
2. **Update Photo Albums**  
   The newer GPTK service that adds Gemini-assisted album/photo update tooling.

That separation matters because the two surfaces do not have the same runtime shape, maturity level, or integration depth.

## Architectural Overview

The extension currently operates across four runtime layers:

1. **Dashboard Hub**
   `tabs/app.html` provides the two-card shell.
2. **Deduper Dashboard App**
   `tabs/app.a1d14322.js` is the original React-based deduper UI.
3. **Album Update Card Logic**
   `tabs/dashboard.js` powers the Update Photo Albums card, including Gemini key storage and state transitions.
4. **Google Photos Runtime**
   `static/background/index.js`, `google-photos-bridge.8ad19c6d.js`, `google-photos-image-bridge.js`, `scripts/google-photos-commands.js`, and `scripts/google-photos-toolkit.user.js` cooperate to run actions against the live `photos.google.com` page.

## Service-Level Status

### 1. Scan for Duplicates

This remains the most complete service in the bundle.

- The dashboard app can connect to a Google Photos tab.
- It can request media items through the bridge.
- It can run duplicate detection.
- It can trash and restore via command routing.
- It has scan logs, progress reporting, and caching behavior.

Operationally, this still looks like the backbone of the extension.

### 2. Update Photo Albums

This is present, but less fully integrated.

- The dashboard card can store a Gemini API key.
- The injected toolkit can read that key through the storage bridge.
- `AI Describe` is implemented inside the page-context toolkit.
- Smart Albums and Metadata Cleanup are still placeholders.

So the album-update service is real, but it is not yet a dashboard-native workflow in the same sense that the deduper service is.

## Key Review Findings

### 1. Service Boundaries Are Under-Documented

Current notes and some UI text blur the distinction between:

- the legacy deduper application
- the newer album-update application surface
- the shared runtime/bridge layer underneath both

This makes the bundle appear more unified than it actually is. For planning and stabilization, the services should be documented separately, then tied back together through the shared extension infrastructure.

### 2. The Dashboard Does Not Yet Fully Orchestrate Album Updates

The Update Photo Albums card behaves more like a setup and launch surface than a full command center.

- It stores settings in `chrome.storage.local`.
- It opens Google Photos.
- It instructs the user to continue in the injected GPTK panel.

That is a valid first integration step, but it is not yet equivalent to the deduper dashboard, which directly manages a fuller lifecycle.

### 3. Command Bridge Coverage Still Reflects Deduper Priorities

`scripts/google-photos-commands.js` currently exposes:

- `getAllMediaItems`
- `trashItems`
- `restoreItems`
- `healthCheck`

There is no explicit command bridge support for the album-update action set. This reinforces that the bridge contract still primarily serves the deduper flow.

### 4. UI and Runtime Constraints Are Not Fully Aligned

The album-update path has runtime restrictions that are not clearly represented in the visible UI.

Example:

- `AI Describe` is blocked for the `library` source in the injected runtime.
- The button is not disabled for that state in the visible action controls.

The result is avoidable confusion: the UI suggests the action is available, then the runtime rejects it later.

### 5. Settings Ownership Is Split Across Two Storage Models

The album-update service uses both:

- extension-level `chrome.storage.local`
- page/account-level `localStorage`

This makes the current settings model less clear than the service boundary shown in the dashboard card. It also creates edge cases where clearing one surface does not necessarily clear the effective runtime value.

## What Is Working Well

- The bundle concept is coherent: one extension, two visible cards, shared support infrastructure.
- The deduper side is materially implemented and provides the stronger operational base.
- The album-update side already has the critical AI path in place.
- The service worker and image bridge solve the practical cross-origin image-fetch problem needed for Gemini.
- The dashboard visual split already communicates the product direction better than the notes did.

## Recommended Framing For Future Work

Treat future work as three tracks instead of one:

1. **Deduper service**
   Stabilize and preserve the original duplicate-scanning workflow.
2. **Album update service**
   Expand AI Descriptions, Smart Albums, and Metadata Cleanup as their own coherent product line.
3. **Shared extension platform**
   Bridge messaging, storage, page injection, health checks, and tab routing that support both services.

## Practical Conclusion

The extension is not "an AI describe fork" and it is not simply "the old deduper with one extra card."

It is now a shared extension platform carrying:

- one mature legacy service: **Scan for Duplicates**
- one newer emerging service: **Update Photo Albums**

The code and dashboard already reflect that split more than the old notes did. The project documentation should now follow that same structure explicitly.
