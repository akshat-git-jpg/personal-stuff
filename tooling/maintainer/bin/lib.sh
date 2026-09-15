#!/bin/bash
# Shared helpers for the maintainer. Sourced by every bin/ script.
#
# rtk rewrites commands through a hook and FAKES their output: a grep returned
# "23 matches in 0 files" and prettier always reports success. So every binary
# this agent depends on is called by absolute path. Do not "simplify" these.

GREP=/usr/bin/grep
FIND=/usr/bin/find
SED=/usr/bin/sed
AWK=/usr/bin/awk
STAT=/usr/bin/stat
DATE=/bin/date

MAINT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$MAINT_DIR/../.." && pwd)"
STATE_DIR="$MAINT_DIR/state"
FINDINGS_DIR="$STATE_DIR/findings"
PROPOSALS_DIR="$STATE_DIR/proposals"
LEDGER="$STATE_DIR/ledger.md"

# Gitignored files can NEVER be recovered from git, so a local removal is a MOVE.
ARCHIVE_ROOT="$HOME/pp-maintainer-archive"

today() { "$DATE" +%Y-%m-%d; }

mkdirs() { mkdir -p "$FINDINGS_DIR" "$PROPOSALS_DIR"; }

# Every job this agent knows, one per line. A job IS a folder with a check.sh —
# there is no registry to update, which is the whole point of the layout.
discover_jobs() {
  local d
  for d in "$MAINT_DIR"/jobs/*/check.sh; do
    [ -f "$d" ] || continue
    basename "$(dirname "$d")"
  done
}

job_dir() { echo "$MAINT_DIR/jobs/$1"; }

findings_file() { echo "$FINDINGS_DIR/$(today)-$1.md"; }
proposal_file() { echo "$PROPOSALS_DIR/$(today)-$1.md"; }

die() { echo "ERROR: $1" >&2; exit 2; }

# A memory store slug is LOSSY: Claude replaces every non-alphanumeric char in the
# path with '-', so '.claude-work' and 'personal-stuff' and a real '/' all become
# the same character. `sed 's|-|/|g'` therefore cannot reverse it — it turned
# 'personal-stuff' into 'personal/stuff' and reported 24 live directories as dead.
#
# Walk the real filesystem instead. At each level, normalise every directory entry
# the same way Claude does and take the LONGEST entry whose normalised name is a
# prefix of what is left of the slug. Prints the resolved path, or returns 1.
resolve_slug() {
  local rest="$1" path="" best="" bestnorm="" bestlen=0 e b norm ok
  case "$rest" in -*) ;; *) return 1 ;; esac
  while :; do
    best=""; bestnorm=""; bestlen=0
    for e in "$path"/* "$path"/.*; do
      [ -d "$e" ] || continue
      b="$(basename "$e")"
      [ "$b" = "." ] && continue
      [ "$b" = ".." ] && continue
      # Bash-native, NOT a sed subprocess: this runs once per directory entry per
      # level, and spawning sed there took the memory check from seconds to minutes.
      norm="-${b//[!a-zA-Z0-9]/-}"
      ok=0
      [ "$rest" = "$norm" ] && ok=1
      case "$rest" in "$norm"-*) ok=1 ;; esac
      [ "$ok" = "1" ] || continue
      if [ "${#norm}" -gt "$bestlen" ]; then
        best="$e"; bestnorm="$norm"; bestlen="${#norm}"
      fi
    done
    [ -n "$best" ] || return 1
    path="$best"
    rest="${rest#"$bestnorm"}"
    if [ -z "$rest" ]; then echo "$path"; return 0; fi
  done
}
