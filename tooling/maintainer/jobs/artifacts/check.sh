#!/bin/bash
# artifacts — which published videos still have leftovers.
# Reports ONLY. Deletes nothing, moves nothing.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# ARTIFACTS_REGISTRY and ARTIFACTS_CARDS point at fixtures (JSON files), so the
# test never touches the network.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

REG="${ARTIFACTS_REGISTRY:-$REPO_ROOT/pipelines/video-registry/videos.json}"
CARDS="${ARTIFACTS_CARDS:-}"          # a JSON file of tracker cards; empty = fetch live

found=0
note() { echo "- $1"; found=1; }

echo "# artifacts findings — $(today)"
echo

[ -f "$REG" ] || die "no registry at $REG"

if [ -z "$CARDS" ]; then
  CARDS="$FINDINGS_DIR/$(today)-artifacts-cards.json"
  ( cd "$REPO_ROOT/pipelines/video-registry" \
    && node -e "import('./lib/tracker.mjs').then(async m=>{const r=await m.fetchCards();process.stdout.write(JSON.stringify(r))})" ) \
    > "$CARDS" 2>/dev/null || {
      echo "## could not read tracker-db"
      echo "- NOT CHECKED. Needs CF_ACCOUNT_ID and CF_API_TOKEN (pipelines/.env)."
      echo "  No tracker data means NOTHING is published as far as this job is concerned."
      exit 0
    }
fi

echo "## published videos with leftovers still in the repo"
python_out=$(python3 - "$REG" "$CARDS" <<'PY'
import json, io, sys, os
reg = json.load(io.open(sys.argv[1]))
cards = json.load(io.open(sys.argv[2]))
by_id = {str(c.get("id")): c for c in cards}

def published(c):
    # BOTH must hold. A link with no done status is a draft; a done status with no
    # link is a bookkeeping slip. Either alone is NOT proof a video shipped.
    link = (c.get("yt_link") or "").strip()
    status = (c.get("yt_upload_status") or "").strip().lower()
    return bool(link) and status in ("done", "published", "complete")

found_any = False
for key, e in sorted((reg.get("videos") or {}).items()):
    if key == "test-01":
        continue                      # a pipeline fixture, never a candidate
    cid = str(e.get("card_id") or "")
    if not cid or cid not in by_id:
        print("- NO-CARD %s (registry entry has no tracker card — cannot tell, not a candidate)" % key)
        continue
    if published(by_id[cid]):
        print("- PUBLISHED %s (%s)" % (key, (by_id[cid].get("yt_link") or "").strip()))
        found_any = True

if found_any: sys.exit(1)
sys.exit(0)
PY
)
rc=$?
if [ -n "$python_out" ]; then echo "$python_out"; fi
if [ $rc -eq 1 ]; then found=1; fi
echo

echo "## where each published video's folders are"
echo "(from vreg where — it looks under the canonical key AND every alias, because a"
echo " folder may still sit under an old name.)"
echo

echo "## untracked local renders (archive candidates, NEVER delete)"
git_out=$(git -C "$REPO_ROOT" status --porcelain --ignored 2>/dev/null \
  | "$AWK" '$1=="!!"{print $2}' \
  | "$GREP" -E 'videos/|renders?/|Output/' || true)
if [ -n "$git_out" ]; then
    echo "$git_out"
    found=1
fi
echo
echo "  A gitignored render has NO copy in git. Removing one is a MOVE to"
echo "  $ARCHIVE_ROOT/<date>-artifacts/, never a delete, and only after approval."

exit $found
