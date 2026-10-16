#!/bin/bash
# my-repo - is the live map at my-repo.agrolloo.com older than the repo it maps.
# Exit 0 = current, 1 = stale, 2 = a check itself broke.
#
# MYREPO_URL points at another deploy (or a stub) for tests.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

URL="${MYREPO_URL:-https://my-repo.agrolloo.com}"
# Paths the scanner reads; a change in any of them can change the map.
PATHS=(.claude/skills pipelines/.claude/skills tooling/cli tooling/press-clis tooling/mcp
       scripts/regen-mcp-json.sh .claude/settings.json CLAUDE.md VPS-CRONS.md apps/my-repo/data/curated.json)

echo "# my-repo findings - $(today)"
echo

body="$(/usr/bin/curl -fsS --max-time 15 "$URL/api/version" 2>/dev/null)" || die "could not reach $URL/api/version"
sha="$(printf '%s' "$body" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["sha"])' 2>/dev/null)" || die "no sha in $URL/api/version"
scanned="$(printf '%s' "$body" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["scannedAt"][:10])')"

/usr/bin/git -C "$REPO_ROOT" cat-file -e "$sha^{commit}" 2>/dev/null || die "live map was built from $sha, which this clone does not have (git fetch first)"
changed="$(/usr/bin/git -C "$REPO_ROOT" diff --name-only "$sha" HEAD -- "${PATHS[@]}" | /usr/bin/wc -l | /usr/bin/tr -d ' ')"

if [ "$changed" -gt 0 ]; then
  echo "- STALE live map built from $sha on $scanned; $changed mapped file(s) changed since. Say \"update my-repo\"."
  /usr/bin/git -C "$REPO_ROOT" diff --name-only "$sha" HEAD -- "${PATHS[@]}" | "$SED" -n '1,15s/^/  - /p'
  exit 1
fi
echo "- live map is current (built from $sha on $scanned)"
exit 0
