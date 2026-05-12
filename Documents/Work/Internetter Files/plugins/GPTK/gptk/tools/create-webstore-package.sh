#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gptk-webstore.XXXXXX")"

cleanup() {
  rm -rf "$STAGING_DIR"
}
trap cleanup EXIT

if [[ ! -f "$REPO_DIR/manifest.json" ]]; then
  echo "Missing extension manifest: $REPO_DIR/manifest.json" >&2
  exit 1
fi

VERSION="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.version)' "$REPO_DIR/manifest.json")"
ZIP_PATH="$DIST_DIR/gptk-webstore-v$VERSION.zip"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"
mkdir -p "$STAGING_DIR/gptk"

rsync -a "$REPO_DIR/" "$STAGING_DIR/gptk/" \
  --exclude '.git/' \
  --exclude '.gitignore' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  --exclude '*.zip' \
  --exclude 'dist/' \
  --exclude 'docs/' \
  --exclude 'tools/' \
  --exclude 'README.md' \
  --exclude 'CHANGELOG.md' \
  --exclude 'PERMISSIONS.md' \
  --exclude 'PRIVACY.md' \
  --exclude 'SUPPORT.md'

find "$STAGING_DIR/gptk" -name '.DS_Store' -delete

(
  cd "$STAGING_DIR/gptk"
  zip -qr "$ZIP_PATH" .
)

if ! unzip -p "$ZIP_PATH" manifest.json >/dev/null 2>&1; then
  echo "Release ZIP is invalid: manifest.json is not at the ZIP root." >&2
  exit 1
fi

if unzip -l "$ZIP_PATH" | awk '{print $4}' | grep -Eq '(^|/)(\.git|\.DS_Store|README\.md|CHANGELOG\.md|PERMISSIONS\.md|PRIVACY\.md|SUPPORT\.md|docs|tools|dist)(/|$)'; then
  echo "Release ZIP contains repository metadata, tooling, or documentation-only files." >&2
  exit 1
fi

echo "Created Chrome Web Store package:"
echo "$ZIP_PATH"
unzip -l "$ZIP_PATH" | tail -1
