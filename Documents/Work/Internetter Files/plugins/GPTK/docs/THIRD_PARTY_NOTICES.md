# Third-Party and Bundled Runtime Notes

This repository contains the unpacked Chrome extension runtime used by GPTK.

## Bundled Application JavaScript

The extension includes production-bundled JavaScript files generated for the Chrome extension runtime:

- `tabs/app.a1d14322.js`
- `google-photos-inject.757a6863.js`

These files are bundled/minified production output. They are not intended to hide behavior; they package the extension UI/runtime dependencies for Chrome execution.

## MediaPipe / Emscripten WASM Runtime

The duplicate scanner uses a local browser-side image embedding pipeline. The related packaged files are:

- `scripts/embedder-worker.js`
- `scripts/vision_wasm_internal.js`
- `scripts/vision_wasm_internal.wasm`

These files are included in the extension package and loaded from `chrome.runtime.getURL(...)`. They are not downloaded as remote executable code at runtime.

The WASM runtime is used to compute image embeddings locally in the browser for duplicate detection.

## Remote MediaPipe Model Asset

When smart duplicate detection needs embeddings, GPTK downloads this model asset from Google Cloud Storage:

```text
https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_large/float32/latest/mobilenet_v3_large.tflite
```

This is a model/data asset used by the local embedding runtime. It is not JavaScript, WASM, or remotely executed code.

## Review Position

The Web Store upload ZIP intentionally contains only runtime files. Repository documentation, review notes, release tooling, and source/provenance notes remain in GitHub and are excluded from the upload package.
