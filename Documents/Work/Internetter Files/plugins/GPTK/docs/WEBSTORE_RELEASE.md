# Chrome Web Store Release Packaging

Use this repository for local unpacked-extension testing, but do not upload the Git working tree directly to the Chrome Web Store.

This directory contains `.git` metadata and repository-only files. Chrome Web Store uploads should be generated with:

```sh
./tools/create-webstore-package.sh
```

The script creates `dist/gptk-webstore-v<version>.zip` with `manifest.json` at the ZIP root and excludes:

- `.git/`
- `.gitignore`
- `.DS_Store`
- `*.log`
- `*.zip`
- `dist/`
- `docs/`
- `tools/`
- repository-only Markdown files

Before submission:

1. Load this directory unpacked in Chrome and complete the smoke test.
2. Run `./tools/create-webstore-package.sh`.
3. Upload the generated ZIP from `dist/`, not the live repository directory.
4. Use [CHROME_REVIEW_NOTES.md](./CHROME_REVIEW_NOTES.md) for reviewer-facing explanations of sensitive permissions such as `declarativeNetRequest`.
5. Use [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for bundled/minified/WASM provenance notes.
6. Use [WEBSTORE_LISTING_DRAFT.md](./WEBSTORE_LISTING_DRAFT.md) for initial store listing text.
7. Use [WEBSTORE_SUBMISSION_CHECKLIST.md](./WEBSTORE_SUBMISSION_CHECKLIST.md) before final submission.
8. If Chrome requests source/provenance details for bundled or WASM files, provide repository docs and third-party notes rather than adding non-runtime files to the upload ZIP.
