#!/bin/bash
# skills — the mechanical half. Writes findings to stdout; run-job.sh captures it.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"
cd "$REPO_ROOT" || die "cannot reach repo root"

found=0
note() { echo "- $1"; found=1; }

echo "# skills findings — $(today)"
echo

echo "## account skill dirs must be EMPTY"
for d in "$HOME/.claude/skills" "$HOME/.claude-work/skills" "$HOME/.claude-personal/skills"; do
  n=$(ls "$d" 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" != "0" ] && note "$d holds $n entries — a skill there reintroduces the account dependency"
done
echo

echo "## dangling symlinks"
for d in "$HOME/.claude-work/skills" "$HOME/.claude-personal/skills" "$HOME/.codex/skills" \
         ".claude/skills" "pipelines/.claude/skills"; do
  [ -d "$d" ] || continue
  for f in "$d"/*; do
    [ -e "$f" ] || note "dangling link: $f"
  done
done
echo

echo "## real duplicates (symlinks skipped — every intentional one looks like a dup)"
for d in .claude/skills pipelines/.claude/skills pipelines/.agents/skills "$HOME/codebase/work-skills/skills"; do
  [ -d "$d" ] || continue
  "$FIND" "$d" -maxdepth 1 -mindepth 1 -type d -exec basename {} \;
done | sort | uniq -d | while read -r dup; do
  case "$dup" in
    claude-router|github-router|humanizer|i-have-adhd|session-handoff) ;;   # the 5 duplicated on purpose
    *) note "unexpected duplicate skill: $dup" ;;
  esac
done
echo

echo "## description budget"
if ! bash .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh >/dev/null 2>&1; then
  note "description budget check failed — run it directly for the offenders"
fi
echo

echo "## shared-skill drift (repo vs the private plugin)"
if ! bash scripts/sync-shared-skills.sh --check >/dev/null 2>&1; then
  note "the 5 shared skills have drifted from the work-skills plugin"
fi
echo

echo "## reference counts — A CANDIDATE LIST, NEVER A VERDICT"
echo "(skill-maintenance runbook §8: usage data does not exist. 8 skills had zero"
echo " references at the last audit and were correctly KEPT. Zero references means"
echo " 'look at this', not 'delete this'.)"
for s in .claude/skills/*/; do
  name="$(basename "$s")"
  n=$(git grep -l "$name" -- ':!.claude/skills' 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" = "0" ] && echo "  zero repo references: $name"
done

exit $found
