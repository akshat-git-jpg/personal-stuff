<!-- boss frontmatter -->
---
executor: claude-p
model: opus
test_cmd: bash .claude/hooks/test-no-history-in-main.sh
ui:
deploy:
needs: []
needs_prs: [226]
touches: [.claude/hooks/no-history-in-main.sh, .claude/hooks/test-no-history-in-main.sh, .claude/settings.json, .claude/hooks/branch-guard.sh, CLAUDE.md, decisions.md]

mutation_apply: |
  python3 - <<'PY'
  p='.claude/hooks/no-history-in-main.sh'
  s=open(p).read()
  needle='--path-format=absolute'
  assert needle in s, 'mutation target not found — the normalisation is missing'
  # Reintroduce the exact silent-fail-open defect: compare RAW rev-parse output. git
  # returns --git-dir absolute and --git-common-dir relative below the toplevel, so the
  # wall stops firing in every subdirectory while still "existing".
  s=s.replace('--path-format=absolute --git-dir --git-common-dir', '--git-dir --git-common-dir', 1)
  open(p,'w').write(s)
  PY
mutation_command: bash .claude/hooks/test-no-history-in-main.sh
mutation_expect: "FAIL: wall did not fire in a SUBDIRECTORY of the main worktree"
mutation_cwd:
mutation_timeout: 300
---

# Plan 227: the wall — no recording history in the main checkout

## Summary

- **Problem statement**: The existing guard, `.claude/hooks/branch-guard.sh`, fails in three ways
  at once. Its regex is `git\s+(switch|checkout)\s+[^-]`, so **any flag bypasses it** —
  `git checkout -q main`, `git checkout -b x`, `git switch -c x` all sail through. It guards only
  branch *switching*, so it is blind to the 2026-08-22 incident, where a correctly-scoped
  `git add decisions.md` swallowed a concurrent session's edit. And it fires only
  *probabilistically*, when another session's transcript happens to have been touched in the last
  5 minutes. Its `MAIN_CHECKOUT` is also hardcoded to this Mac, and `.claude/settings.json` is
  **tracked**, so the useless copy ships to the VPS — where interactive Claude actually runs via
  Remote Control.
- **Goals**: one `PreToolUse` hook that denies every history-recording git verb when the working
  directory is the **main worktree** of this repo, on any clone. Reading and writing files stay
  free; only recording history moves to a workspace. Retire `branch-guard.sh`.
- **Executor proposed**: `claude-p` / `opus`. `tooling/boss/data/rules.md` routes
  *security-sensitive* here, and this guard's failure mode is **silent fail-open** — the class that
  has already bitten this repo five separate times.
- **Done criteria** (terse — full list below): `bash .claude/hooks/test-no-history-in-main.sh`
  passes all nine cases; `branch-guard.sh` is gone and unreferenced; the mutation recipe fails
  with the subdirectory marker.
- **Stop conditions** (terse — full list below): a `GUARD_OK=1` call site is added anywhere; the
  hook is made to block file *writes*; the predicate is simplified back to raw `rev-parse`.
- **Test / verification for success**: a new `.claude/hooks/test-no-history-in-main.sh` that feeds
  the hook real JSON on stdin from **nine** positions — including the three flag forms that defeat
  the current guard, and both a main subdirectory and a linked-worktree subdirectory.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 69042eb1..HEAD -- .claude/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH — a `PreToolUse` hook runs before **every** Bash call in this repo. A bug here
  either blocks all work or silently protects nothing.
- **Depends on**: PR for plan 226 — the deny message names `pp-work claim`, which that plan
  creates. Landing this first would tell the model to run a command that does not exist.
- **Category**: security
- **Difficulty**: tricky
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

The 2026-08-22 incident is the whole argument. A session ran `git add decisions.md` — one file,
correctly scoped, no wildcard — and committed a concurrent session's unrelated 36-line edit,
because the copy of that file on disk already contained it. It happened while the agent was
explicitly watching for that failure.

So a rule that depends on vigilance is not a fix, and a guard on *writing* is not a fix either:
both sessions were entitled to edit that file. The only mechanical chokepoint is the act of
**recording history**. Deny that in the shared checkout and both logged incidents become
impossible; leave reading and writing alone and nothing else changes.

## Current state

### `.claude/hooks/branch-guard.sh` — what it does and why it fails

The load-bearing lines, verbatim:

```bash
MAIN_CHECKOUT="/Users/kbtg/codebase/personal-stuff"
LIVE_WINDOW_MIN=5   # a transcript touched within this many minutes = live session
...
if ! printf '%s' "$CMD" | grep -qE '(^|[;&|]\s*|\s)(rtk\s+)?git\s+(switch|checkout)\s+[^-]'; then
  exit 0
fi
...
if [ "$OTHERS" -gt 0 ]; then
  ...
  exit 2
fi
exit 0
```

Three failures, all live:

1. `\s+[^-]` requires the token after the verb to be a non-dash, so **every flag form escapes**.
2. Only `switch|checkout` — `add`, `commit`, `rebase`, `merge`, `reset` are unguarded.
3. It denies only when another transcript file was modified within 5 minutes. A session idle for
   6 minutes is invisible, so the guard is probabilistic on a deterministic invariant.

It does read the right JSON fields, and it demonstrates the deny mechanism (`exit 2` with a
message on stderr). Reuse that shape.

### `.claude/settings.json` — verbatim, and it is tracked

```json
{
  "outputStyle": "ELI5",
  "worktree": { "bgIsolation": "none" },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [ { "type": "command",
          "command": "/Users/kbtg/codebase/personal-stuff/.claude/hooks/branch-guard.sh" } ] }
    ]
  }
}
```

`git ls-files .claude/settings.json` confirms it is tracked, so the absolute Mac path in the
`command` field — and `branch-guard.sh`'s hardcoded `MAIN_CHECKOUT` — both ship to the VPS clone at
`/srv/projects/personal-stuff`, where they match nothing.

### The predicate, and the trap that must not be repeated

"Is this the main worktree?" is `--git-dir` equals `--git-common-dir`. But raw output is **not**
comparable below the toplevel. Measured in this repo, git 2.54.0:

| cwd | `--git-dir` | `--git-common-dir` | raw compare |
|---|---|---|---|
| main toplevel | `.git` | `.git` | equal ✅ |
| **main `pipelines/`** | `/Users/…/personal-stuff/.git` | `../.git` | **unequal ❌ — wall skips** |
| workspace toplevel | `…/.git/worktrees/<name>` | `…/.git` | unequal ✅ |
| workspace `pipelines/` | `…/.git/worktrees/<name>` | `…/.git` | unequal ✅ |

So a raw comparison **silently fails open in every subdirectory of the main checkout** — which is
where sessions actually run. With `--path-format=absolute` it is correct in all five positions
(main toplevel, two main subdirectories, workspace toplevel, workspace subdirectory), verified by
measurement. That is what the mutation gate pins.

### Repo identity without a hardcoded path

The wall must fire on this repo's main worktree on **any** clone (this Mac, the VPS, a future one)
and must **never** fire in a ZluriHQ work repo. Do not use a path, and do not use the origin URL
(a fork or a rename breaks it). Use a **self-identifying marker**: the repo that ships the wall is
the repo the wall applies to.

```bash
[ -f "$main_top/.claude/hooks/no-history-in-main.sh" ]
```

The hook checks for its own presence in the resolved main worktree. Zluri repos do not have that
file, so they never match; a fresh clone of this repo does, so it works there with no
configuration. It is also what makes the harness able to build a throwaway repo that the wall
recognises.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| The gate | `bash .claude/hooks/test-no-history-in-main.sh` | prints `ALL TESTS PASSED`, exit 0 |
| Syntax-check | `bash -n .claude/hooks/no-history-in-main.sh` | no output, exit 0 |
| Validate settings JSON | `python3 -c "import json;json.load(open('.claude/settings.json'))"` | no output, exit 0 |
| Normalised predicate probe | `git rev-parse --path-format=absolute --git-dir --git-common-dir` | two identical absolute paths in the main checkout |

## Scope

**In scope**:
- `.claude/hooks/no-history-in-main.sh` — new
- `.claude/hooks/test-no-history-in-main.sh` — new
- `.claude/settings.json` — repoint the `PreToolUse` command
- `.claude/hooks/branch-guard.sh` — **delete**
- `CLAUDE.md` — a **two-line** rule (see Step 4; length is a hard constraint)
- `decisions.md` — one dated line

**Out of scope** — looks related, do not touch:
- **Blocking file writes.** The hook must **not** deny `Edit`, `Write`, or a Bash write
  (`sed -i`, a heredoc, `python3 -c`). Deploys, VPS ops, skill edits and `decisions.md` appends all
  need writes in the main checkout, and the 2026-08-22 incident was a *staging* failure, not a
  write. Bash writes are unparseable anyway; the commit is the chokepoint every change must pass
  to become durable or shared. This is a deliberate, accepted residual.
- **`GUARD_OK=1` call sites.** The override exists for a human's deliberate one-off. Adding it to
  any script trains it on and the wall degrades to a convention. There must be **zero** call sites
  in the repo.
- **boss and secretary scripts.** They do not need changing: a `PreToolUse` matcher sees only the
  Bash **command string** the agent runs, never the `git` calls *inside* a script. So
  `boss-commit-main.sh`, `boss-merge.sh` and `secretary` keep working untouched. Verify this rather
  than assume it (Step 3's case 9).
- `"worktree": { "bgIsolation": "none" }` in settings — leave it exactly as is.
- `pp-work` itself — plan 226 owns it.

## Git workflow

- Branch: `advisor/227-the-wall-no-history-in-main`
- Commit per step, message style `feat(guard): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Write the hook

Create `.claude/hooks/no-history-in-main.sh`, `chmod +x`, with **exactly** this content.

```bash
#!/usr/bin/env bash
# The wall: no RECORDING HISTORY in the main checkout of this repo.
#
# Why the commit and not the write: on 2026-08-22 a session ran `git add decisions.md` —
# one file, correctly scoped — and committed a concurrent session's unrelated 36-line
# edit, because the on-disk copy already contained it. Both sessions were entitled to
# edit that file, so guarding writes fixes nothing. Recording history is the chokepoint.
#
# Replaces branch-guard.sh, which (a) had `\s+[^-]` after the verb so ANY flag bypassed
# it, (b) covered only switch/checkout, and (c) fired only when another transcript had
# been touched in the last 5 minutes — probabilistic, on a deterministic invariant.
#
# Wired as a PreToolUse hook (matcher: Bash) in .claude/settings.json.
# Deliberate one-off override: prefix the command with GUARD_OK=1.
set -u

INPUT="$(cat)"

json_field() {
  printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = d
for k in sys.argv[1].split('.'):
    v = v.get(k, {}) if isinstance(v, dict) else {}
print(v if isinstance(v, str) else '')
" "$1" 2>/dev/null
}

CMD="$(json_field tool_input.command)"
CWD="$(json_field cwd)"
[ -n "$CMD" ] || exit 0

# --- cheapest test first: does this even look like a history-recording git verb? ---
# Allows any number of flags, including flag-with-value pairs like `-C <path>`, which is
# exactly what branch-guard.sh's `\s+[^-]` failed to handle.
VERBS='add|commit|stash|rebase|merge|switch|checkout|reset|cherry-pick|am|apply|revert|tag'
if ! printf '%s' "$CMD" | grep -qE "(^|[;&|(]|[[:space:]])(rtk[[:space:]]+)?git([[:space:]]+-{1,2}[^[:space:]]+([[:space:]]+[^-][^[:space:]]*)?)*[[:space:]]+($VERBS)([[:space:]]|$)"; then
  exit 0
fi

# `git checkout <ref> -- <path>` / `git checkout -- <path>` is a path restore, not history.
if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+(switch|checkout)[[:space:]]+([^[:space:]]+[[:space:]]+)?--[[:space:]]'; then
  exit 0
fi

# Deliberate human override.
printf '%s' "$CMD" | grep -q 'GUARD_OK=1' && exit 0

# --- is CWD the MAIN worktree of the repo that ships this wall? ---
[ -n "$CWD" ] || exit 0
git -C "$CWD" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# --path-format=absolute is load-bearing. Raw output is absolute for --git-dir but
# RELATIVE for --git-common-dir below the toplevel, so a raw comparison silently fails
# open in pipelines/, apps/, tooling/ — where sessions actually run.
read -r GD GCD < <(git -C "$CWD" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0
[ "$GD" = "$GCD" ] || exit 0          # a linked worktree — the whole point is that it is allowed

# Self-identifying repo test: the repo that ships this wall is the repo it applies to.
# No hardcoded path (branch-guard.sh's was this Mac's, and .claude/settings.json is
# tracked, so it shipped to the VPS and matched nothing) and no origin-URL coupling.
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/no-history-in-main.sh" ] || exit 0

cat >&2 <<MSG
BLOCKED: recording git history in the main checkout.

Two sessions share this working tree, so a commit here can capture another session's
uncommitted edits — even a correctly-scoped one (2026-08-22).

Do this instead:
  cd "\$(pp-work claim --kind code --slug <short-task-name>)"
and run the same git command there. It lands on main by itself.

Deliberate one-off: GUARD_OK=1 <your command>
MSG
exit 2
```

The message is deliberately short. It is read by the model on every block, so length is token
cost.

**Verify**: `bash -n .claude/hooks/no-history-in-main.sh` -> no output, exit 0
**Verify**: `test -x .claude/hooks/no-history-in-main.sh` -> exit 0

Commit: `feat(guard): the wall — no recording history in the main checkout`

### Step 2: Wire it and retire the old guard

Edit `.claude/settings.json` so the `PreToolUse` Bash matcher points at the new hook. Keep
`outputStyle` and `worktree` exactly as they are. Use a **repo-relative** command if the harness
supports it; if an absolute path is required, keep the same absolute form the old entry used — but
note in your report which you chose, because an absolute Mac path is what made the old guard inert
on the VPS.

Then `git rm .claude/hooks/branch-guard.sh`.

**Verify**: `python3 -c "import json;json.load(open('.claude/settings.json'))"` -> no output
**Verify**: `grep -c 'branch-guard' .claude/settings.json` -> `0`
**Verify**: `test -f .claude/hooks/branch-guard.sh` -> **fails** (the file is gone)
**Verify**: `grep -rc 'branch-guard' --include='*.sh' --include='*.json' --include='*.md' . | grep -v ':0' | grep -v decisions.md` -> no results other than `decisions.md`

Commit: `feat(guard): retire branch-guard.sh`

### Step 3: Write the harness — nine positions

Create `.claude/hooks/test-no-history-in-main.sh`. It builds a throwaway repo in `mktemp -d`,
**creates `.claude/hooks/no-history-in-main.sh` inside it** (so the self-identifying marker is
present), adds a linked worktree, and feeds the real hook JSON on stdin.

Helper shape:

```bash
run_hook() {  # run_hook <cwd> <command> ; echo the exit code
  printf '{"tool_input":{"command":%s},"cwd":%s,"session_id":"t"}' \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$2")" \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")" \
    | bash "$HOOK" >/dev/null 2>&1
  echo $?
}
```

Required cases. **2 must be exit 2** and each `FAIL` message must be exactly as given, because the
mutation gate greps one of them.

| # | cwd | command | expect |
|---|---|---|---|
| 1 | main toplevel | `git commit -m x` | 2 (blocked) |
| 2 | **main subdirectory** | `git commit -m x` | 2 — `FAIL: wall did not fire in a SUBDIRECTORY of the main worktree` |
| 3 | main toplevel | `git checkout -q main` | 2 — the flag form that defeats `branch-guard.sh` |
| 4 | main toplevel | `git checkout -b feature/x` | 2 — ditto |
| 5 | main toplevel | `git switch -c feature/x` | 2 — ditto |
| 6 | main toplevel | `git -C /some/path commit -m x` | 2 — flag-with-value form |
| 7 | **linked worktree** toplevel | `git commit -m x` | 0 (allowed — the whole point) |
| 8 | linked worktree subdirectory | `git commit -m x` | 0 (allowed) |
| 9 | main toplevel | `bash tooling/boss/bin/boss-merge.sh 1` | 0 — a script that commits internally is invisible to a command-string matcher, which is why boss needs no change |

Plus:

| # | cwd | command | expect |
|---|---|---|---|
| 10 | main toplevel | `git status` | 0 — read-only verbs untouched |
| 11 | main toplevel | `git checkout -- README.md` | 0 — a path restore is not history |
| 12 | main toplevel | `GUARD_OK=1 git commit -m x` | 0 — the deliberate override |
| 13 | main toplevel | `echo hello > f.txt` | 0 — writes stay free |
| 14 | a temp dir with **no** marker file | `git commit -m x` | 0 — a repo that does not ship the wall is never blocked (this is the ZluriHQ case) |

Case 14 must be a real git repo **without** `.claude/hooks/no-history-in-main.sh`, so it proves the
identity test rather than the git-dir test.

Finish with `echo "ALL TESTS PASSED"`.

**Verify**: `bash .claude/hooks/test-no-history-in-main.sh` -> `ALL TESTS PASSED`, exit 0

Commit: `test(guard): pin the wall across nine positions`

### Step 4: The two-line rule, and the decision record

In `CLAUDE.md`, add **exactly two lines** to the operating notes. This file loads in every session,
so every extra line is a permanent token cost:

```markdown
- **Changing tracked files? Claim a workspace first.** `cd "$(pp-work claim --kind code --slug <task>)"` — the main checkout refuses to record git history (`.claude/hooks/no-history-in-main.sh`).
- Talking, reading and one-off file edits on main are fine; only `commit`/`add`/`merge`/`switch` move.
```

Append one dated line to `decisions.md` recording: `branch-guard.sh` retired in favour of a wall
on history-recording verbs; the reason is that the 2026-08-22 incident was a correctly-scoped
`git add`, so a switch-only, flag-bypassable, probabilistic guard could not have caught it.

**Verify**: `grep -c 'pp-work claim' CLAUDE.md` -> `1`
**Verify**: the addition is two lines —
`git diff --numstat CLAUDE.md | awk '{print $1}'` -> `2`

Commit: `docs: record the wall and retire branch-guard`

## Test plan

`bash .claude/hooks/test-no-history-in-main.sh` is the gate: fourteen cases, all behavioural, each
feeding the real hook real JSON and checking the real exit code.

Cases 3-5 are the three forms that defeat `branch-guard.sh` **today**, so they are the regression
proof that this is a real replacement and not a rename. Case 2 is the mutation target: reverting
the predicate to raw `rev-parse` makes only that case flip, which is exactly how the defect would
have shipped unnoticed. Cases 7-8 prove the wall does not fight workspaces — without them the
override would train on and the design would be worse than no wall. Case 14 proves ZluriHQ repos
are untouched. Case 9 proves boss needs no changes.

## Done criteria

- [ ] `bash .claude/hooks/test-no-history-in-main.sh` prints `ALL TESTS PASSED`, exit 0.
- [ ] `test -x .claude/hooks/no-history-in-main.sh` and
      `test -f .claude/hooks/test-no-history-in-main.sh` both exit 0 (LESSONS 2026-08-17).
- [ ] `test -f .claude/hooks/branch-guard.sh` **fails** — the old guard is deleted, not left
      alongside.
- [ ] `python3 -c "import json;json.load(open('.claude/settings.json'))"` exits 0 and
      `grep -c 'no-history-in-main' .claude/settings.json` returns `1`.
- [ ] `grep -c 'path-format=absolute' .claude/hooks/no-history-in-main.sh` returns `1`.
- [ ] `grep -rn 'GUARD_OK=1' --include='*.sh' . | grep -v '.claude/hooks/' | wc -l` returns `0` —
      **no call sites** anywhere in the repo.
- [ ] `grep -c 'pp-work claim' CLAUDE.md` returns `1`, and the `CLAUDE.md` diff is exactly
      **2 added lines**.
- [ ] `git rev-parse --path-format=absolute --git-dir --git-common-dir` run in the repo root
      prints two identical absolute paths (the predicate's premise still holds).
- [ ] The mutation recipe behaves as specified: clean passes; applying it makes the harness fail
      printing `FAIL: wall did not fire in a SUBDIRECTORY of the main worktree`; reverting passes.
- [ ] `git diff --stat` against the branch point touches only the six files in `touches`.

## STOP conditions

- **You are about to add `GUARD_OK=1` to any script, alias, or wrapper.** STOP. Zero call sites.
  An override that appears in a script is an override that is always on, and the wall becomes a
  convention.
- **You are about to make the hook deny `Edit`, `Write`, or a Bash file write.** STOP. Writes must
  stay free — see Scope. The commit is the chokepoint.
- **You are about to simplify the predicate to raw `git rev-parse --git-dir --git-common-dir`.**
  STOP. That is the mutation this plan gates against; it silently fails open in every
  subdirectory.
- **Case 7 or 8 fails** (the wall blocks a linked worktree). STOP — do **not** work around it by
  adding an override. The predicate is wrong and must be fixed, or the whole design inverts.
- **Case 14 fails** (a repo without the marker is blocked). STOP — that means ZluriHQ work repos
  would be affected, which violates the scope the owner set.
- **A test fails and the tempting fix is to relax the verb list or the regex.** STOP. Fix the
  regex to be more precise, never less. Removing a verb from `VERBS` is a STOP.
- **`.claude/settings.json` will not parse after editing.** STOP and report the exact JSON error
  rather than guessing at the schema — a broken settings file disables every hook, silently.

## Maintenance notes

- The predicate is `same repo && --path-format=absolute --git-dir == --git-common-dir`. Both halves
  are load-bearing: drop the normalisation and it fails open in subdirectories; drop the
  identity test and it fires in ZluriHQ repos.
- Identity is **self-identifying** — the hook looks for its own file in the resolved main worktree.
  That is what makes it work on the VPS, on a fresh clone, and in the harness, with no
  configuration. If a future change moves the hook, this test moves with it.
- Known accepted residual: Bash writes (`sed -i`, heredocs, `python3 -c`) are unparseable, and in
  bypass-permissions sessions agents are actively told to prefer Bash for edits. The wall guards
  the commit. Anyone proposing to also guard writes should read the 2026-08-22 incident first —
  both sessions were entitled to write that file.
- A `PreToolUse` matcher cannot see git calls inside scripts. That is why boss and secretary need
  no changes, and it is also the limit of this guard: a script an agent writes and then runs is
  outside it. Case 9 pins the behaviour so nobody "fixes" it later.
- The verb list includes `revert` and `tag`, which the design's original list omitted. Both record
  history; leaving them out would be an arbitrary hole.
