#!/usr/bin/env bash
# Refuses to end a turn while a pp-work workspace holds uncommitted work.
#
# This is the MECHANICAL half of the auto-commit guarantee. `.claude/skills/commit-now`
# declares auto-commit the default, but a skill is an instruction the model can skip, and a
# skipped commit is work that silently never reaches main. On 2026-08-23 the owner asked
# whether that meant his commits might just not happen; the honest answer was yes.
#
# A shell hook cannot author a Conventional Commits subject, and the owner rejected `wip:`
# messages — which is why auto-commit was written as an instruction in the first place. A
# Stop hook resolves that tension: it does not write the commit, it refuses to let the turn
# END until the model has. The model still writes the message, the harness enforces that it
# happens. Guarantee AND message quality.
#
# Wired for BOTH Stop and SubagentStop in .claude/settings.json: a subagent editing files in
# a workspace is one of the three ways auto-commit was being missed.
#
# Exit codes: 0 = let the turn end. 2 = block, with the reason on stderr for the model.
set -u

INPUT="$(cat)"

json_field() {
  printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = d.get(sys.argv[1])
if v is True:  print('true')
elif v is False: print('false')
elif isinstance(v, str): print(v)
else: print('')
" "$1" 2>/dev/null
}

# The loop guard. The harness sets this when it is re-running us after a block, and without
# honouring it a turn that CANNOT commit — a red check, which commit-now says must not be
# committed — would be blocked forever. One nag per turn, then the turn is allowed to end.
case "$(json_field stop_hook_active)" in
  true|True|1) exit 0 ;;
esac

CWD="$(json_field cwd)"
[ -n "$CWD" ] || exit 0
git -C "$CWD" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# A LINKED worktree only. Nothing can be committed in the main checkout anyway — the wall
# blocks it — so nagging there would be a dead end.
read -r GD GCD < <(git -C "$CWD" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0
[ "$GD" = "$GCD" ] && exit 0

# Only this repo, and only a real pp-work workspace (its parent holds the manifest).
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/commit-before-stop.sh" ] || exit 0
TOP="$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)" || exit 0
SLUG_DIR="$(dirname "$TOP")"
[ -f "$SLUG_DIR/manifest" ] || exit 0

# Tracked modifications and genuinely new files both count. Gitignored paths do not appear
# in --porcelain at all, so renders and node_modules cannot trigger this.
DIRTY="$(git -C "$TOP" status --porcelain 2>/dev/null)"
[ -n "$DIRTY" ] || exit 0

COUNT="$(printf '%s\n' "$DIRTY" | grep -c . || true)"
BRANCH="$(git -C "$TOP" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

cat >&2 <<MSG
This workspace has $COUNT uncommitted change(s) and the turn is about to end.

  workspace: $TOP
  branch:    $BRANCH

Auto-commit is the default in this repo. Run the commit-now flow now: run the check that
covers what you touched, print the summary, then stage the specific files and commit.

  cd "$TOP" && git add <the files you changed> && git commit -m "<type>(<scope>): <subject>"

Use ONE retargeting form per command — after a \`cd\`, plain \`git add\`, no \`-C\`.

If you genuinely must not commit — a check is failing, or the owner told you not to — say
so plainly in your reply and end the turn. This hook allows the next attempt through, so it
will not trap you; but do not end silently on uncommitted work.
MSG
exit 2
