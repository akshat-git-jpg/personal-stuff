#!/usr/bin/env bash
# SessionStart hook — auto-tag a session with a fleet-view group based on its cwd.
#
# Claude Code stores a session's tag ("group" in its own vocabulary) as a plain
# text file at $CLAUDE_CONFIG_DIR/jobs/<short-session-id>/group. Sessions opened
# in a known folder land in "Ungrouped" until tagged by hand with ctrl+e; this
# writes the tag for them. See tooling/cli/pp-claude-tags/README.md.
#
# Registered in the USER settings of both accounts, not in this repo's
# .claude/settings.json — a session started in a sub-folder that has its own
# .claude/ (tooling/boss does) never loads the repo-root settings, which is
# exactly the case this hook exists for.
#
# Never clobbers an existing tag, so a manual ctrl+e retag always wins.
set -uo pipefail

# CLAUDE_SESSION_GROUP_DEBUG=1 traces where this ran and what it decided.
dbg() {
  [ "${CLAUDE_SESSION_GROUP_DEBUG:-}" = "1" ] || return 0
  echo "$(date -u +%FT%TZ) $*" >> /tmp/session-group.log
}

fields=$(/usr/bin/python3 -c 'import json,sys
try: d = json.load(sys.stdin)
except Exception: d = {}
print(d.get("session_id") or "")
print(d.get("cwd") or "")' 2>/dev/null)

sid=$(printf '%s\n' "$fields" | sed -n 1p)
cwd=$(printf '%s\n' "$fields" | sed -n 2p)

dbg "fired cwd=$cwd cfg=${CLAUDE_CONFIG_DIR:-unset}"
[ -n "$sid" ] && [ -n "$cwd" ] || { dbg "no session_id or cwd in payload"; exit 0; }

# cwd -> group name. Add a case per folder you want auto-tagged.
group=""
case "$cwd" in
  */personal-stuff/tooling/boss|*/personal-stuff/tooling/boss/*) group="boss" ;;
esac
[ -n "$group" ] || { dbg "no rule matches cwd"; exit 0; }

cfg="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
jobdir="$cfg/jobs/${sid%%-*}"

# The daemon may not have created the job dir yet when SessionStart fires, so
# wait for it in the background rather than creating an orphan dir here.
(
  for _ in $(seq 1 40); do
    if [ -d "$jobdir" ]; then
      if [ -e "$jobdir/group" ]; then
        dbg "kept existing tag on $jobdir"
      else
        printf '%s' "$group" > "$jobdir/group"
        dbg "tagged $jobdir as $group"
      fi
      exit 0
    fi
    sleep 0.5
  done
  dbg "gave up waiting for $jobdir"
) >/dev/null 2>&1 &

exit 0
