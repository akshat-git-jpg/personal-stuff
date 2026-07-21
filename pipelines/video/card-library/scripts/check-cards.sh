#!/usr/bin/env bash
# Guards the path a new card takes to https://render2.agrolloo.com.
#
# render2's Templates tab DIRECTORY-SCANS this folder on the VPS (mounted
# read-only at /cards). A card appears there when, and only when, it is:
#   1. shaped <type>/<card-name>/index.html
#   2. committed AND pushed  (the VPS `repo-sync` cron pulls every 15 min)
# There is no registration step and no redeploy. Which also means a card that
# is merely SAVED locally is invisible to the editor forever, silently — that
# is how `verdict/winners-podium` went missing until 2026-07-20.
#
# catalog.json is a SEPARATE registration, read by visuals-flow's cue pass.
# A card missing there is invisible to the pipeline even while render2 shows it.
#
#   bash scripts/check-cards.sh             # structural — for the commit gate
#   bash scripts/check-cards.sh --publish   # also requires everything PUSHED
#                                           # (the end-of-a-video step)
set -uo pipefail
cd "$(dirname "$0")/.."

PUBLISH=0
[ "${1:-}" = "--publish" ] && PUBLISH=1

fail=0
err() { echo "  FAIL: $*"; fail=1; }

# Folders that are legitimately not card types. `brand/` holds the channel
# avatar/banner/thumbnail (flat .html + .png, no per-card folders); `logos/` is
# the shared logo registry the cards draw from.
IGNORE="node_modules assets compositions scripts logos renders brand .git"
is_ignored() { case " $IGNORE " in *" $1 "*) return 0;; *) return 1;; esac; }

echo "==> card folder shape"
cards=()
for type in */; do
  type="${type%/}"
  is_ignored "$type" && continue
  found_in_type=0
  for card in "$type"/*/; do
    card="${card%/}"
    [ -d "$card" ] || continue
    if [ ! -f "$card/index.html" ]; then
      err "$card has no index.html — render2 scans for <type>/<card>/index.html, so this card will never appear"
      continue
    fi
    cards+=("$card")
    found_in_type=1
  done
  # render2 scans every top-level folder as a card type. One holding no cards is
  # junk in the /cards mount — usually stray test output committed by mistake.
  if [ "$found_in_type" = "0" ]; then
    err "$type/ holds no cards but render2 scans it as a card type — remove it, or add it to IGNORE in this script if it is legitimately not a card type"
  fi
done
echo "  ${#cards[@]} cards found"

echo "==> catalog.json registration"
missing_catalog=$(node -e '
const fs = require("fs");
const cards = process.argv.slice(1);
let cat;
try { cat = JSON.parse(fs.readFileSync("catalog.json", "utf8")); }
catch (e) { console.error("catalog.json unreadable: " + e.message); process.exit(2); }
const slugs = new Set((cat.cards || []).map(c => c.slug));
const missing = cards.filter(c => !slugs.has(c));
if (missing.length) console.log(missing.join("\n"));
' "${cards[@]}" 2>&1)
if [ -n "$missing_catalog" ]; then
  while IFS= read -r m; do
    err "$m is not in catalog.json — visuals-flow's cue pass cannot select it"
  done <<< "$missing_catalog"
else
  echo "  all ${#cards[@]} cards registered"
fi

echo "==> catalog contract check"
if ! npm run check-catalog -s; then
  err "catalog contract validation failed"
fi

echo "==> nothing left untracked"
untracked=$(git ls-files --others --exclude-standard . 2>/dev/null)
if [ -n "$untracked" ]; then
  while IFS= read -r f; do
    case "$f" in
      */*/index.html|*/*/*) err "$f is untracked — a card file that never reaches render2 until it is committed and pushed" ;;
      *)                    err "$f is untracked — commit it or add it to .gitignore" ;;
    esac
  done <<< "$untracked"
else
  echo "  clean"
fi

if [ "$PUBLISH" = "1" ]; then
  echo "==> publish: everything committed and pushed"
  if ! git diff --quiet -- . || ! git diff --cached --quiet -- .; then
    err "uncommitted changes under card-library — commit them before publishing"
  fi
  upstream=$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)
  if [ -z "$upstream" ]; then
    err "no upstream branch — cannot confirm the VPS can pull these cards"
  else
    unpushed=$(git log --oneline "$upstream"..HEAD -- . 2>/dev/null)
    if [ -n "$unpushed" ]; then
      err "commits touching card-library are not pushed to $upstream:"
      echo "$unpushed" | sed 's/^/        /'
      echo "        -> git push, then render2 picks them up within ~15 min"
    else
      echo "  pushed — render2 will serve these within ~15 min (repo-sync cron)"
    fi
  fi
fi

echo "==> logo normalization gate"
if ! node scripts/check-logos.mjs; then
  err "logos failed validation"
fi

echo
if [ "$fail" = "1" ]; then
  echo "card check FAILED"
  exit 1
fi
echo "card check OK"
