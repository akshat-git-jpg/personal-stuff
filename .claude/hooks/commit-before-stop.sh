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
# It also nags in the MAIN checkout, which it deliberately did not until 2026-08-23. The
# original reasoning was that nothing can be committed in main anyway, so a block there is a
# dead end. True, and beside the point: it meant the two hooks only protected a session that
# had ALREADY claimed a workspace. Skip the claim and edit main directly and NOTHING fires —
# the wall wants a git verb that never comes, and this hook exited early. Measured that
# afternoon: a session answered a read-only question, grew into a code change, appended to
# decisions.md in main, and ended silently. Meanwhile another session's four staged files sat
# in the same index, one `git add` away from the 2026-08-22 incident repeating.
#
# So the main-checkout nag does not ask for a commit (impossible there). It asks the session
# to move its own work into a workspace, or to say in one line that none of the dirty files
# are its. It cannot know WHICH files are the session's — main is shared and git records no
# author for a working-tree edit — so it lists them and lets the session judge. That means
# false positives whenever another session leaves main dirty, which is often. The cost is one
# extra turn; the alternative is the silent hole above. Deliberate trade.
#
# Exit codes: 0 = let the turn end. 2 = block, with the reason on stderr for the model.
set -u

INPUT="$(cat)"

# A JSON runtime, resolved once. See no-history-in-main.sh for why node is the fallback.
# This hook fails OPEN where the wall fails closed: it cannot read `stop_hook_active`
# without a runtime either, and a hook that blocks a turn it can never unblock would
# trap the session in a loop. The loud check lives in scripts/relink.sh instead.
JSON_RT=""; JSON_KIND=""
for c in python3 python py; do
  command -v "$c" >/dev/null 2>&1 && { JSON_RT="$c"; JSON_KIND=py; break; }
done
if [ -z "$JSON_RT" ] && command -v node >/dev/null 2>&1; then
  JSON_RT=node; JSON_KIND=node
fi
[ -n "$JSON_RT" ] || exit 0

json_field() {
  if [ "$JSON_KIND" = py ]; then
    printf '%s' "$INPUT" | "$JSON_RT" -c "
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
  else
    printf '%s' "$INPUT" | "$JSON_RT" -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  let d2; try { d2 = JSON.parse(s); } catch (e) { return; }
  const v = d2[process.argv[1]];
  console.log(v === true ? "true" : v === false ? "false"
              : (typeof v === "string" ? v : ""));
});' "$1" 2>/dev/null
  fi
}

# The loop guard. The harness sets this when it is re-running us after a block, and without
# honouring it a turn that CANNOT commit — a red check, which commit-now says must not be
# committed — would be blocked forever. One nag per turn, then the turn is allowed to end.
case "$(json_field stop_hook_active)" in
  true|True|1) exit 0 ;;
esac

CWD="$(json_field cwd)"
[ -n "$CWD" ] || exit 0

# Git Bash on Windows hands us a native path; bash needs the /c/... form.
if command -v cygpath >/dev/null 2>&1; then
  CWD="$(cygpath -u "$CWD" 2>/dev/null || printf '%s' "$CWD")"
fi
git -C "$CWD" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

read -r GD GCD < <(git -C "$CWD" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0

# Only this repo. Self-identifying, same trick the wall uses: the repo that ships this hook
# is the repo it applies to. This gate is above the main-vs-worktree split because BOTH
# branches below need it — a ZluriHQ work repo must never see either nag.
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/commit-before-stop.sh" ] || exit 0

TOP="$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null)" || exit 0

# Tracked modifications and genuinely new files both count. Gitignored paths do not appear
# in --porcelain at all, so renders and node_modules cannot trigger either branch.
DIRTY="$(git -C "$TOP" status --porcelain 2>/dev/null)"
[ -n "$DIRTY" ] || exit 0
COUNT="$(printf '%s\n' "$DIRTY" | grep -c . || true)"

# The list is what makes the nag actionable — the session recognises its own paths in it.
# Capped so a genuinely huge dirty tree does not bury the instruction underneath it.
LIST="$(printf '%s\n' "$DIRTY" | head -20 | sed 's/^/  /')"
if [ "$COUNT" -gt 20 ]; then
  LIST="$LIST
  ... and $((COUNT - 20)) more"
fi

# --- the MAIN checkout: ask for relocation, not a commit ---
if [ "$GD" = "$GCD" ]; then
  # Second suppression: the yt-script-desk process (a scheduled task on 5175) stages its
  # in-flight edits into pipelines/youtube/yt-script/videos/<slug>/script-plan.md and only
  # clears them at Publish. That means main is *supposed to* carry a dirty script-plan.md
  # between an edit and a publish — the hook's "someone left main dirty" assumption does
  # not apply. If every dirty path is a desk-managed script-plan.md, exit silently. Any
  # other dirty file (even one, alongside a desk file) still trips the nag.
  NON_DESK="$(printf '%s\n' "$DIRTY" | awk 'NF { p=substr($0,4); if (p !~ /^pipelines\/youtube\/yt-script\/videos\/[^/]+\/script-plan\.md$/) print }')"
  [ -z "$NON_DESK" ] && exit 0

  # Suppress the nag when THIS session made no file-editing tool call. Main is shared, so
  # its dirty files usually belong to someone else's session; forcing every read-only or
  # greeting-only turn to answer for those files was noise. We look at the session's own
  # transcript for a tool_use of Edit/Write/MultiEdit/NotebookEdit/Bash — anything that
  # could plausibly have dirtied a tracked file. A grep is enough: false positives (the
  # name appearing in message text) preserve the pre-fix behaviour of nagging, and false
  # negatives cannot occur when the session made no tool calls at all.
  TRANSCRIPT="$(json_field transcript_path)"
  if [ -n "$TRANSCRIPT" ]; then
    if command -v cygpath >/dev/null 2>&1; then
      TRANSCRIPT="$(cygpath -u "$TRANSCRIPT" 2>/dev/null || printf '%s' "$TRANSCRIPT")"
    fi
    if [ -f "$TRANSCRIPT" ] && ! grep -qE '"name":"(Edit|Write|MultiEdit|NotebookEdit|Bash)"' "$TRANSCRIPT" 2>/dev/null; then
      exit 0
    fi
  fi
  cat >&2 <<MSG
The main checkout has $COUNT uncommitted change(s) and the turn is about to end.

  checkout: $TOP

$LIST

This tree is shared, so some of these belong to other sessions. Only you know which are
yours.

If ANY of them are this session's work, they are in the wrong place. Nothing can be
committed here, so that work would sit in a shared tree until another session's commit
swept it up (2026-08-22) or you simply lost track of it. Move your own files, and only
yours, into a workspace:

  cd "\$(pp-work claim --kind code --slug <short-task-name>)"

Re-apply your edits there and undo them here. \`git apply\` is blocked in main, so reverse
them with POSIX \`patch -R\` rather than reaching for GUARD_OK=1.

If none of these are yours, say so in one line and end the turn. This hook allows the next
attempt through, so it will not trap you.
MSG
  exit 2
fi

# --- a LINKED worktree: only a real pp-work workspace, whose parent holds the manifest ---
SLUG_DIR="$(dirname "$TOP")"
[ -f "$SLUG_DIR/manifest" ] || exit 0

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
