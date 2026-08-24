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

# HYGIENE-5: the store is gone (2026-08-25). Skills are repo-scoped: Claude Code reads
# .claude/skills/ for whoever opens the repo, so there is no manifest and no per-account
# symlink to keep honest. Assert the shape, so a revert to the old scheme is loud.
[ ! -e tooling/claude-skills ] \
  || fail "SKILL-SCOPE: tooling/claude-skills/ is back — skills are repo-scoped now; a global store reintroduces the account dependency (decisions.md 2026-08-25)"
[ -f .claude/codex-skills.txt ] \
  || fail "SKILL-SCOPE: .claude/codex-skills.txt is missing — Codex has no per-repo skill path and would get nothing"
while IFS= read -r skill; do
  case "$skill" in ''|'#'*) continue ;; esac
  [ -d ".claude/skills/$skill" ] \
    || fail "SKILL-SCOPE: codex-skills.txt lists '$skill', which is not in .claude/skills"
done < .claude/codex-skills.txt

# HYGIENE-6: the commit-now split (2026-08-23). personal-stuff commits through a REPO-LEVEL
# `commit-now` (auto-commit, pp-work workspaces, lands itself); ZluriHQ work repos use
# `commit-now-work`, which now ships in the PRIVATE work-skills plugin because this repo is
# public. A `commit-now-work` here would put the work rules back inside personal-stuff.
[ -f .claude/skills/commit-now/SKILL.md ] \
  || fail "SKILL-SPLIT: .claude/skills/commit-now/SKILL.md is missing — personal-stuff has no commit flow of its own"
[ ! -e .claude/skills/commit-now-work ] \
  || fail "SKILL-SPLIT: .claude/skills/commit-now-work/ is back in the public repo; it belongs to the private work-skills plugin"

# HYGIENE-7: the five person-level skills are duplicated into the private work-skills
# plugin on purpose (a symlink cannot span a public and a private repo). ADVISORY: the
# plugin is a separate checkout, so its absence is normal on the VPS and on a fresh clone.
if [ -x scripts/sync-shared-skills.sh ]; then
  scripts/sync-shared-skills.sh --check >/dev/null 2>&1 \
    || echo "warn SKILL-SYNC: shared skills differ from the work-skills plugin — run scripts/sync-shared-skills.sh" >&2
fi

echo "repo hygiene OK"
