#!/usr/bin/env bash
set -euo pipefail
REPO="$(git rev-parse --show-toplevel)"
PIPE="$REPO/pipelines/youtube/tutorial-pipeline-1"
cd "$PIPE"

echo "→ python syntax check"
python3 -m py_compile lib/*.py shared/*.py steps/*/*.py

echo "→ node syntax check"
node --check "$REPO/tooling/cli/heygen-web/heygen-web.mjs"

echo "→ pp-drive syntax check"
python3 -m py_compile "$REPO/tooling/cli/drive/pp_drive.py"

echo "→ structure check"
for f in PIPELINE.md lib/drive.py lib/audio.py lib/heygen.py shared/avatar_mapping.py; do
  [ -f "$f" ] || { echo "✖ missing $f"; exit 1; }
done
for d in steps/010-resolve-drive-input-run steps/020-extract-audio-run \
         steps/030-submit-avatar-renders-run steps/040-download-avatar-renders-run \
         steps/050-package-and-upload-run; do
  [ -d "$d" ] || { echo "✖ missing $d"; exit 1; }
done

echo "✓ all checks passed"
