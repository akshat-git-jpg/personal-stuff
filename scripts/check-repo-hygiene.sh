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
[ "$src" = ".gitignore" ] || fail "HYGIENE-2: .claude/worktrees/ is ignored by '${src*-nothing}', not .gitignore"


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

echo "repo hygiene OK"
