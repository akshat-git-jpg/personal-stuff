#!/usr/bin/env bash
# Where this repo's skills load, and whether that is healthy. Exit 1 on a real problem.
#
# Skills are REPO-SCOPED (2026-08-25). Claude Code reads `<repo>/.claude/skills/`
# automatically for whoever opens the repo, so most of what the old version of this
# script checked — per-account manifests and symlinks — no longer exists. What is
# left worth checking is the machine-local edges: the Codex mirror, the private
# work-skills plugin copy, and account skill dirs that should now be empty of
# anything belonging to this repo.
set -uo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPTS_DIR/.." && pwd)"
status=0
note() { printf '  %-10s %s\n' "$1" "$2"; }

echo "repo: $REPO"
echo

# --- 1. the repo's own skills: the only thing Claude needs -------------------
n_root=$(find "$REPO/.claude/skills" -maxdepth 1 -mindepth 1 \( -type d -o -type l \) 2>/dev/null | wc -l | tr -d ' ')
n_pipe=$(find "$REPO/pipelines/.claude/skills" -maxdepth 1 -mindepth 1 \( -type d -o -type l \) 2>/dev/null | wc -l | tr -d ' ')
echo "repo-scoped (load automatically, any account):"
note "ok" ".claude/skills            $n_root"
note "ok" "pipelines/.claude/skills  $n_pipe"
[ "$n_root" -gt 0 ] || { note "FAIL" ".claude/skills is empty"; status=1; }

# A dangling symlink here is invisible to the eye and silently drops a skill.
broken=0
while IFS= read -r l; do [ -e "$l" ] || { note "FAIL" "broken link: $l"; broken=1; }; done < <(
  find "$REPO/.claude/skills" "$REPO/pipelines/.claude/skills" -maxdepth 1 -type l 2>/dev/null)
[ "$broken" -eq 0 ] || status=1
echo

# --- 2. Codex: no per-repo path, so it needs an explicit global mirror -------
echo "codex (global — it has no per-repo skill path):"
CODEX="${CODEX_HOME:-$HOME/.codex}/skills"
want=$(grep -cve '^\s*$' -e '^\s*#' "$REPO/.claude/codex-skills.txt" 2>/dev/null || echo 0)
if [ -d "$CODEX" ]; then
  have=0
  while IFS= read -r s; do
    case "$s" in ''|'#'*) continue ;; esac
    if [ -e "$CODEX/$s" ]; then have=$((have+1)); else note "warn" "$s not mirrored — run scripts/relink.sh"; fi
  done < "$REPO/.claude/codex-skills.txt"
  note "ok" "$have/$want mirrored into $CODEX"
else
  note "skip" "$CODEX does not exist (codex not installed here)"
fi
echo

# --- 3. the private work-skills plugin ---------------------------------------
echo "private work-skills plugin:"
PLUGIN="${WORK_SKILLS_DIR:-$HOME/codebase/work-skills}"
if [ -d "$PLUGIN/skills" ]; then
  note "ok" "$(find "$PLUGIN/skills" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ') skills at $PLUGIN"
  if "$SCRIPTS_DIR/sync-shared-skills.sh" --check >/dev/null 2>&1; then
    note "ok" "shared skills in sync"
  else
    note "FAIL" "shared skills DIFFER — run scripts/sync-shared-skills.sh"; status=1
  fi
else
  note "skip" "no checkout at $PLUGIN"
fi
echo

# --- 4. account dirs: nothing of ours should be left there -------------------
# ADVISORY. A leftover link into this repo still loads in every session on that
# account, which is exactly the account dependency the repo-scoped model removes.
echo "account skill dirs (should hold nothing from this repo):"
for d in "$HOME/.claude-work/skills" "$HOME/.claude-personal/skills" "$HOME/.claude/skills"; do
  [ -d "$d" ] || continue
  leak=0
  while IFS= read -r l; do
    t="$(readlink "$l" 2>/dev/null)" || continue
    case "$t" in "$REPO"/*|*/personal-stuff/*) note "warn" "$(basename "$l") -> $t"; leak=$((leak+1)) ;; esac
  done < <(find "$d" -maxdepth 1 -type l 2>/dev/null)
  n=$(find "$d" -maxdepth 1 -mindepth 1 | wc -l | tr -d ' ')
  [ "$leak" -eq 0 ] && note "ok" "$(basename "$(dirname "$d")")  $n entries, none from this repo" \
                    || note "warn" "$(basename "$(dirname "$d")")  $leak stale link(s) from this repo"
done

echo
[ "$status" -eq 0 ] && echo "skills status OK" || echo "skills status: problems above" >&2
exit "$status"
