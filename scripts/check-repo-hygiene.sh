#!/usr/bin/env bash
# Behavioural hygiene gate. Every assertion asks git WHICH FILE supplies an ignore rule,
# because that is the property that matters: a rule in .git/info/exclude protects this
# machine only, and this repo is PUBLIC. Asserting on .gitignore's text instead would be
# circular — the rule could be present and still not apply.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() { echo "$1" >&2; exit 1; }

# HYGIENE-1: credential-bearing local settings must be ignored by the TRACKED .gitignore,
# so the protection exists in a fresh clone and on the VPS.
src=$(git check-ignore -v .claude/settings.local.json 2>/dev/null | cut -d: -f1 || true)
[ "$src" = ".gitignore" ] || fail "HYGIENE-1: .claude/settings.local.json is ignored by '${src:-nothing}', not .gitignore — a fresh clone of this PUBLIC repo would track a file holding GH_TOKEN"

# HYGIENE-2: per-session worktrees, same reasoning.
src=$(git check-ignore -v .claude/worktrees/probe 2>/dev/null | cut -d: -f1 || true)
[ "$src" = ".gitignore" ] || fail "HYGIENE-2: .claude/worktrees/ is ignored by '${src:-nothing}', not .gitignore"


# HYGIENE-3: the rendered-media rule must match the path the files actually live at.
# It pointed at a tree that had moved under archive/, so it matched nothing for months.
git check-ignore -q pipelines/archive/hyperframes-vs-remotion/yt-visuals/cutaways/probe.mp4 \
  || fail "HYGIENE-3: rendered media under pipelines/archive/.../cutaways/ is NOT ignored — the rule is dead again"

# HYGIENE-4: actually RUN the bootstrap hook into a temp dir and assert it links every
# machine-local runtime file. A grep for a `link` line would pass while a glob silently
# matched nothing — which is exactly how the dead .gitignore rule above survived for
# months. So this executes the hook and checks for real symlinks.
repo="$PWD"
probe=$(mktemp -d)
( cd "$probe" && WT_MAIN_CHECKOUT="$repo" bash "$repo/tooling/cli/wt/bootstrap.d/personal-stuff.sh" ) >/dev/null 2>&1 \
  || { rm -rf "$probe"; fail "HYGIENE-4: the wt bootstrap hook failed to run"; }
for f in pipelines/.env pipelines/credentials.json .mcp.json apps/tutorial-tracker-app/.dev.vars; do
  [ -L "$probe/$f" ] || { rm -rf "$probe"; fail "HYGIENE-4: bootstrap hook did not link $f into a fresh worktree"; }
done
n=$(find "$probe/apps" -maxdepth 2 -name .dev.vars -type l 2>/dev/null | wc -l | tr -d ' ')
rm -rf "$probe"
[ "${n:-0}" -ge 8 ] || fail "HYGIENE-4: bootstrap linked only ${n:-0} app .dev.vars files, expected at least 8"

# HYGIENE-5: manifest entries that resolve to nothing in this repo. ADVISORY, because
# relink.sh resolves an entry against TWO roots: tooling/claude-skills (this repo) and
# ~/.agents/skills (the printing-press pp-* skills, which live outside the repo). Only the
# first is checkable from repo content, so a miss here is a report, not a failure — it found
# `pp-openrouter` on the first run, which is correctly external, not broken.
for m in tooling/claude-skills/manifest/work.txt tooling/claude-skills/manifest/personal.txt; do
  while IFS= read -r skill; do
    case "$skill" in ''|'#'*) continue ;; esac
    if [ ! -d "tooling/claude-skills/$skill" ]; then
      echo "warn HYGIENE-5: $m lists '$skill', absent from tooling/claude-skills — expected to come from ~/.agents/skills" >&2
    fi
  done < "$m"
done

# HYGIENE-6: the commit-now split (2026-08-23). personal-stuff commits through a REPO-LEVEL
# `commit-now` (auto-commit, pp-work workspaces, lands itself); ZluriHQ work repos use the
# user-level `commit-now-work`. A leftover user-level `commit-now` would shadow the repo-level
# one from either account and silently reinstate the work rules — `feature/` branch naming and
# a commit that never lands — inside this repo.
#
# These are text/-path assertions rather than behavioural ones because a skill IS text: there
# is no code to execute. The non-circular part is the SHAPE (which file exists where, and what
# the manifests point at), not the wording.
[ -f .claude/skills/commit-now/SKILL.md ] \
  || fail "SKILL-SPLIT: .claude/skills/commit-now/SKILL.md is missing — personal-stuff has no commit flow of its own"
[ ! -e tooling/claude-skills/commit-now ] \
  || fail "SKILL-SPLIT: tooling/claude-skills/commit-now/ is back; a user-level commit-now shadows the repo-level one and reimposes the work-repo rules here"
# commit-now-work moved to the PRIVATE work-skills plugin (this repo is public).
# Nothing to assert here any more; the gate lives outside this repo.
for m in tooling/claude-skills/manifest/work.txt tooling/claude-skills/manifest/personal.txt; do
  grep -qx 'commit-now' "$m" \
    && fail "SKILL-SPLIT: $m still lists commit-now; it would be linked into the account and shadow the repo-level skill"
done
# The installed symlinks. ADVISORY ONLY, deliberately: whether `relink.sh` has been run is
# machine state, not repo content. Failing on it would block a land on the VPS (no
# ~/.claude-* dirs at all) and would also make this gate unpassable in the very commit that
# performs the rename — relink cannot run until the rename is on main.
for d in "$HOME/.claude-work/skills" "$HOME/.claude-personal/skills"; do
  [ -d "$d" ] || continue
  if [ -e "$d/commit-now" ]; then
    echo "warn SKILL-SPLIT: $d/commit-now is still installed — run scripts/relink.sh" >&2
  fi
done

echo "repo hygiene OK"
