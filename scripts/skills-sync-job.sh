#!/usr/bin/env bash
# Daily backstop for the five person-level skills that live in BOTH this repo and the
# private work-skills plugin. Run by launchd as com.kushal.skills-sync.
#
# The primary guard is scripts/check-repo-hygiene.sh, which warns the moment you commit
# drift. This job catches what that cannot: a skill edited directly inside work-skills,
# or a change made here and never carried across.
#
# It only ever copies THIS REPO -> work-skills. If you edited the plugin copy by hand,
# this job overwrites it; that is deliberate, the repo is the source (see
# scripts/sync-shared-skills.sh).
#
# Safety: it commits and pushes work-skills, which is PRIVATE. It never touches
# personal-stuff, which is public, and never pushes anything else.
set -uo pipefail

REPO="${SKILLS_SYNC_REPO:-$HOME/codebase/personal-stuff}"
PLUGIN="${WORK_SKILLS_DIR:-$HOME/codebase/work-skills}"
NOTIFY="$REPO/tooling/cli/notify/notify"
say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

[ -d "$REPO" ]   || { say "no repo at $REPO — nothing to do"; exit 0; }
[ -d "$PLUGIN" ] || { say "no plugin checkout at $PLUGIN — nothing to do"; exit 0; }

# The sync script is missing on a checkout older than 2026-08-25. Say so plainly:
# without this, `--check` exits non-zero for the wrong reason and the run below
# reports drift that is not there.
SYNC="$REPO/scripts/sync-shared-skills.sh"
[ -x "$SYNC" ] || { say "no $SYNC — checkout predates repo-scoped skills; nothing to do"; exit 0; }

# Refuse to sync from a dirty checkout: copying a half-edited skill into the plugin and
# pushing it is worse than being a day late.
if [ -n "$(git -C "$REPO" status --porcelain -- .claude/skills 2>/dev/null)" ]; then
  say "personal-stuff has uncommitted skill changes — skipping this run"
  exit 0
fi

if "$SYNC" --check >/dev/null 2>&1; then
  say "in sync — nothing to do"
  exit 0
fi

say "drift found; syncing"
"$SYNC" || { say "sync failed"; exit 1; }

if [ -z "$(git -C "$PLUGIN" status --porcelain)" ]; then
  say "sync produced no file change"
  exit 0
fi

changed="$(git -C "$PLUGIN" status --porcelain | wc -l | tr -d ' ')"
git -C "$PLUGIN" add -A || { say "git add failed"; exit 1; }
git -C "$PLUGIN" commit -q -m "chore: sync shared skills" || { say "commit failed"; exit 1; }

if git -C "$PLUGIN" push -q 2>/dev/null; then
  say "pushed ($changed file(s))"
  [ -x "$NOTIFY" ] && "$NOTIFY" send "skills-sync: $changed file(s) synced to work-skills" >/dev/null 2>&1
else
  say "commit made but push failed — push it by hand"
  [ -x "$NOTIFY" ] && "$NOTIFY" send "skills-sync: committed to work-skills but PUSH FAILED" >/dev/null 2>&1
  exit 1
fi
