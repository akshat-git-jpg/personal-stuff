#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SLUG=".test-tmp/driver-smoke"
mkdir -p "videos/$SLUG"
mkdir -p "$SLUG"

cleanup() {
  rm -rf "videos/$SLUG"
  rm -rf "$SLUG"
}
trap cleanup EXIT

bash run.sh "$SLUG" status > /dev/null

if bash run.sh "$SLUG" nonsense > /dev/null 2>&1; then
  echo "Expected nonsense to exit 1"
  exit 1
fi

mkdir -p "videos/$SLUG"
echo '{"approved": false}' > "videos/$SLUG/screenplay.json"
if bash run.sh "$SLUG" author > /dev/null 2>&1; then
  echo "Expected author to exit 1 for unapproved screenplay"
  exit 1
fi

if bash run.sh "$SLUG" deliver > /dev/null 2>&1; then
  echo "Expected deliver to exit 1 when missing render"
  exit 1
fi

cp lib/fixtures/transcript-good.json "$SLUG/transcript.json" || cp lib/fixtures/transcript-good.json "videos/$SLUG/transcript.json"
echo '{"duration":8.4}' > "$SLUG/intake.json" || echo '{"duration":8.4}' > "videos/$SLUG/intake.json"
screenplay_out=$(bash run.sh "$SLUG" screenplay 2>&1)
if ! echo "$screenplay_out" | grep -q "## Your job"; then
  echo "Expected '## Your job' in screenplay output, got $screenplay_out"
  exit 1
fi
if echo "$screenplay_out" | grep -q "{{TRANSCRIPT}}"; then
  echo "Expected {{TRANSCRIPT}} to be substituted"
  exit 1
fi
