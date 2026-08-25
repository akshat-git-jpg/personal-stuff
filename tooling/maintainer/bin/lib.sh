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
