#!/bin/bash
# diskspace — the mechanical half. Reports; deletes nothing, moves nothing.
# Exit 0 = nothing worth reclaiming, 1 = findings, 2 = the check itself broke.
#
# Sizes every GITIGNORED path in the working tree and sorts it into one of four
# classes. `bigfiles` already lists oversized untracked FILES; it never sizes
# DIRECTORIES, so a 4.8 GB cache made of 12,000 small files is invisible to it.
# That gap is this script.
#
# Knobs:
#   DISKSPACE_ROOT        repo to scan (default: this repo) — point it at a fixture
#   DISKSPACE_MIN_MB      ignore anything smaller (default 50)
#   DISKSPACE_STALE_DAYS  a DERIVED path is only a candidate past this age (default 30)
set -uo pipefail
JOB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$(cd "$JOB_DIR/../../bin" && pwd)/lib.sh"
source "$JOB_DIR/classify.sh"

DU=/usr/bin/du
SORT=/usr/bin/sort
XARGS=/usr/bin/xargs

ROOT="${DISKSPACE_ROOT:-$REPO_ROOT}"
MIN_MB="${DISKSPACE_MIN_MB:-50}"
STALE_DAYS="${DISKSPACE_STALE_DAYS:-30}"

cd "$ROOT" || die "cannot reach $ROOT"
git rev-parse --git-dir >/dev/null 2>&1 || die "$ROOT is not a git repo"
[ -x "$DU" ] || die "$DU missing"

now=$("$DATE" +%s)

# Newest file inside a path, in whole days. Only called for DERIVED, which is a
# handful of video folders; running it over node_modules would crawl.
age_days() {
  local p="$1" newest
  if [ -f "$p" ]; then
    newest=$("$STAT" -f %m "$p" 2>/dev/null || echo "$now")
  else
    newest=$("$FIND" "$p" -type f -print0 2>/dev/null \
      | "$XARGS" -0 "$STAT" -f %m 2>/dev/null | "$SORT" -rn | head -1)
  fi
  case "${newest:-}" in ''|*[!0-9]*) newest="$now" ;; esac
  echo $(( (now - newest) / 86400 ))
}

# --- collect ----------------------------------------------------------------
# `--ignored=matching` returns the ignored ENTRY (the directory), not its
# thousands of children, which is exactly the granularity a size report wants.
tmp="$(mktemp -t diskspace)"
rows="$(mktemp -t diskspace-rows)"
trap '/bin/rm -f "$tmp" "$rows"' EXIT

git status --porcelain --ignored=matching 2>/dev/null \
  | "$SED" -n 's/^!! //p' > "$tmp"

if [ ! -s "$tmp" ]; then
  echo "# diskspace findings — $(today)"
  echo
  echo "No gitignored paths in \`$ROOT\`. Nothing to do."
  exit 0
fi

echo "# diskspace findings — $(today)"
echo
echo "Repo: \`$ROOT\`"
echo "Gates: paths under ${MIN_MB} MB are not listed; a DERIVED path under ${STALE_DAYS} days old is held."
echo

total_kb=0; cache_kb=0; rebuild_kb=0; derived_kb=0; keep_kb=0; unk_kb=0
min_kb=$(( MIN_MB * 1024 ))

while IFS= read -r p; do
  [ -e "$p" ] || continue
  kb=$("$DU" -sk "$p" 2>/dev/null | "$AWK" '{print $1+0}')
  case "${kb:-}" in ''|*[!0-9]*) continue ;; esac
  total_kb=$(( total_kb + kb ))
  cls=$(classify "$p")
  case "$cls" in
    CACHE)        cache_kb=$((cache_kb + kb)) ;;
    REBUILD)      rebuild_kb=$((rebuild_kb + kb)) ;;
    DERIVED)      derived_kb=$((derived_kb + kb)) ;;
    KEEP)         keep_kb=$((keep_kb + kb)) ;;
    UNCLASSIFIED) unk_kb=$((unk_kb + kb)) ;;
  esac
  [ "$kb" -ge "$min_kb" ] || continue
  # A LITERAL "-", never an empty field. IFS=$'\t' treats tab as IFS
  # WHITESPACE, so bash collapses two adjacent tabs into one delimiter and the
  # reader below silently shifts the path into `age`. Every row printed its
  # size and class with a blank path until this line stopped emitting "".
  age="-"
  [ "$cls" = "DERIVED" ] && age=$(age_days "$p")
  printf '%s\t%s\t%s\t%s\n' "$kb" "$cls" "$age" "$p" >> "$rows"
done < "$tmp"

gb() { "$AWK" -v k="$1" 'BEGIN{printf "%.1f GB", k/1048576}'; }
mb() { "$AWK" -v k="$1" 'BEGIN{printf "%.0f MB", k/1024}'; }

echo "## 1. where the bytes are"
echo
echo "| class | size | meaning |"
echo "|---|---|---|"
echo "| CACHE | $(gb $cache_kb) | reappears by itself on the next run |"
echo "| REBUILD | $(gb $rebuild_kb) | one documented command brings it back |"
echo "| DERIVED | $(gb $derived_kb) | a pipeline re-run — costs time, sometimes money |"
echo "| KEEP | $(gb $keep_kb) | **no copy in git and no way to regenerate** |"
echo "| UNCLASSIFIED | $(gb $unk_kb) | this script does not know it — treated as KEEP |"
echo "| **total ignored** | **$(gb $total_kb)** | |"
echo

# Subshell-safe: `section` runs in this shell, but the sort feeding it is a
# process substitution, so the counter below it is set here and survives.
found=0
section() {
  local want="$1" title="$2" note="$3" n=0 kb cls age p
  echo "## $title"
  echo "$note"
  echo
  while IFS=$'\t' read -r kb cls age p; do
    [ "$cls" = "$want" ] || continue
    case "$want" in
      DERIVED)
        if [ "${age:-0}" -lt "$STALE_DAYS" ]; then
          echo "- HELD $(mb "$kb")  \`$p\` — last touched ${age}d ago, inside the ${STALE_DAYS}d window"
          continue
        fi
        n=$((n + 1))
        echo "- ARCHIVE $(mb "$kb")  \`$p\` — idle ${age}d"
        ;;
      REBUILD)
        n=$((n + 1))
        echo "- DROP $(mb "$kb")  \`$p\`"
        echo "    back via: \`$(rebuild_cmd "$p")\`"
        ;;
      UNCLASSIFIED)
        n=$((n + 1))
        echo "- UNKNOWN $(mb "$kb")  \`$p\` — classify it in classify.sh before proposing anything"
        ;;
      *)
        n=$((n + 1))
        echo "- DROP $(mb "$kb")  \`$p\`"
        ;;
    esac
  done < <("$SORT" -rn "$rows")
  [ "$n" = "0" ] && echo "- nothing over ${MIN_MB} MB"
  [ "$n" = "0" ] || found=1
  echo
}

section CACHE   "2. CACHE — delete on approval" \
  "These regenerate at no cost. Deleting one only makes the next run slower once."
section REBUILD "3. REBUILD — delete on approval, command quoted" \
  "Reversible only if the quoted command is real. Never approve one reading UNKNOWN."
section DERIVED "4. DERIVED — archive, and only when stale" \
  "A re-run costs GPU time or an API bill. These MOVE to the archive; they are not deleted."
section UNCLASSIFIED "5. UNCLASSIFIED — a gap in this script, not a candidate" \
  "The classifier is an allowlist. An unknown path stays KEEP until someone teaches it otherwise."

echo "## 6. not touching"
echo
echo "\`videos/*/src/\`, \`screen.mp4\`, \`vo.mp3\`, \`.dev.vars\`, \`.mcp.json\`, \`config.json\`,"
echo "\`seed.sql\` and the reference voices are gitignored AND irreplaceable — $(gb $keep_kb) of"
echo "owner-recorded source and live secrets. They are never candidates. A blanket"
echo "\"clean the ignored files\" is a data-loss event, which is why this job classifies"
echo "before it counts."
echo
echo "Removals land in \`$ARCHIVE_ROOT/$(today)-diskspace/\`, outside the repo."

exit $found
