<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: bash tooling/cli/pp-work/test-pp-work.sh
ui:
deploy:
needs: []
needs_prs: [183]
touches: [tooling/cli/pp-work/pp-work, tooling/cli/pp-work/test-pp-work.sh, tooling/cli/pp-work/README.md, scripts/link-clis.sh]

mutation_apply: |
  python3 - <<'PY'
  p='tooling/cli/pp-work/pp-work'
  s=open(p).read()
  needle='PPWORK-DIRTY'
  assert needle in s, 'mutation target not found — the dirty guard is missing or was reworded'
  # Reintroduce the real defect: `remove` deletes a workspace holding uncommitted work.
  s=s.replace('if ! ws_is_clean "$wt"; then', 'if false; then', 1)
  open(p,'w').write(s)
  PY
mutation_command: bash tooling/cli/pp-work/test-pp-work.sh
mutation_expect: "FAIL: remove DELETED a workspace holding uncommitted work"
mutation_cwd:
mutation_timeout: 600
---

# Plan 226: `pp-work` — per-session workspaces that are never wiped, and one inventory

## Summary

- **Problem statement**: Every Claude/agy/boss session shares one checkout, so they share one
  working tree, one HEAD and one index. Reproduced in a scratch repo: session B on **its own
  branch**, staging **only its own file**, still committed session A's uncommitted paragraph,
  because one working tree holds one copy of each file — and `git switch` in B moved HEAD for A
  too. Branches cannot fix this; separate working trees can. The existing `wt` pool is the wrong
  tool for it: `wt`'s README reserves it for managed agent runs, it has a fixed 8 slots, and it
  **resets a slot on acquire and return**, which is precisely what must never happen to a
  session's in-progress work.
- **Goals**:
  - `pp-work claim` creates a per-session or per-subject worktree on demand, **outside** the
    repo tree and **outside** `wt`'s pool, with no fixed slot count.
  - A workspace is **never** reset or removed while it holds uncommitted work or generated media.
    Removal requires clean **and** merged.
  - A second live claim of the same subject slug **fails** instead of sharing a directory.
  - `pp-work list` is one inventory across all three worktree roots plus `wt status`.
- **Executor proposed**: `agy` / agy default (Gemini 3.1 Pro High). Graded **standard**: a
  single self-contained bash tool whose every rule is stated below, no concurrency protocol of its
  own (git supplies the slug mutex), and a behavioural harness.
- **Done criteria** (terse — full list below): `bash tooling/cli/pp-work/test-pp-work.sh` passes;
  the tool and harness exist and are executable; the mutation recipe fails with the expected
  marker.
- **Stop conditions** (terse — full list below): a workspace is created under the main checkout or
  under `wt`'s pool; `wt`'s files are edited; anything under `~/kb-scratch` is deleted outside the
  harness's own temp dir.
- **Test / verification for success**: a new `tooling/cli/pp-work/test-pp-work.sh` building a
  throwaway repo in `mktemp -d`. Every assertion is behavioural — a directory that exists, a
  second claim that fails, a file that survives a removal attempt.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 69042eb1..HEAD -- tooling/cli/wt/ scripts/link-clis.sh`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — new tool, but it touches nothing existing except one line of `link-clis.sh`.
- **Depends on**: PR for plan 222 (it makes `wt return`/`wt get` refuse dirty trees; `pp-work`
  adopts the same invariant and its README cross-references it).
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

Two incidents on record, both from the shared checkout:

- **2026-07-10** — session B ran `git switch`; HEAD moved under session A and A's next commits
  landed on B's branch, requiring an exclusion-cherry-pick recovery.
- **2026-08-22** — a session ran `git add decisions.md`, correctly scoped to one file, and
  swallowed a concurrent session's unrelated 36-line edit. It happened while the agent was
  actively watching for exactly that.

The second is the important one: nothing about the *command* was wrong. The file on disk already
contained the other session's text. No branch scheme, no per-session index, and no commit lock
prevents that — only a separate working tree does.

Cost is modest and was measured: a worktree shares the 603 MB object store (its `.git` is a
one-line pointer file and its own git data is 740 KB), and duplicates only working files, about
1.1 GB. 51 GiB free.

## Current state

### Why not `wt`

`tooling/cli/wt/README.md` states the policy plainly: *"Owner interactive sessions, deploys,
VPS/cron ops, and skill edits stay on the main checkout. The `wt` tool is strictly for parallel
agent runs."* So the tool that provides isolation explicitly excludes the sessions that caused
both incidents.

Mechanically it is also wrong for this: `MAX_TREES=8` (`tooling/cli/wt/wt:83`), and both
`wt get` and `wt return` call `reset_worktree` — `checkout --detach` + `reset --hard` +
`clean -fd`. A session's workspace must survive exactly that.

### The three roots, and why they must not overlap

`tooling/cli/wt/wt:79-82`, verbatim:

```bash
REPO_TOPLEVEL=$(git -C "$REPO" rev-parse --show-toplevel)
REPO_BASENAME=$(basename "$REPO_TOPLEVEL")
HASH8=$(echo -n "$REPO_TOPLEVEL" | shasum -a 256 | cut -c 1-8)
POOL="$HOME/kb-scratch/worktrees/$REPO_BASENAME-$HASH8"
```

`wt return` guards on `[[ "$wt_path" != "$POOL/"*"/$REPO_BASENAME" ]]`, and greenlight's cleanup
calls exactly that. So a workspace laid out under `$POOL` would **match `wt return`'s own guard**
and be resettable by it. Workspaces therefore live under a **different** root:

```
wt pool     $HOME/kb-scratch/worktrees/<repo>-<hash8>/<n>/<repo>      reapable, reset on acquire
workspaces  $HOME/kb-scratch/workspaces/<repo>-<hash8>/<slug>/<repo>  NEVER reset or reaped
landing     $HOME/kb-scratch/landing/<repo>-<hash8>                   always reset (a later plan)
```

Three roots, three lifecycle rules. Mixing them is what made the pool able to wipe a workspace.

### The hash trap

`REPO_TOPLEVEL` above uses `--show-toplevel`, which inside a **linked worktree** returns *that
worktree's* path, not the main checkout's. So computing the hash that way from inside a workspace
would produce a different root every time. `pp-work` must derive the main checkout instead:

```bash
common=$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir)   # <main>/.git
MAIN=$(dirname "$common")
```

Measured: from the main checkout `--git-common-dir` is `<main>/.git`; from a linked worktree it is
also `<main>/.git`. That is the stable anchor.

### The slug mutex comes free from git

`git worktree add` refuses to check out a branch that is already checked out in another worktree.
So pinning a subject workspace to branch `subject/<slug>` makes a second live claim of the same
slug fail at the git level — no lock file, no PID tracking, no race.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| The gate | `bash tooling/cli/pp-work/test-pp-work.sh` | prints `ALL TESTS PASSED`, exit 0 |
| Syntax-check | `bash -n tooling/cli/pp-work/pp-work` | no output, exit 0 |
| Main checkout anchor | `git rev-parse --path-format=absolute --git-common-dir` | `<main>/.git` |
| Is a branch merged | `git merge-base --is-ancestor <branch> origin/main` | exit 0 = merged |
| Confirm the real pool is untouched | `wt status --repo /Users/kbtg/codebase/personal-stuff` | 8 rows, unchanged |

## Scope

**In scope**:
- `tooling/cli/pp-work/pp-work` — new
- `tooling/cli/pp-work/test-pp-work.sh` — new
- `tooling/cli/pp-work/README.md` — new
- `scripts/link-clis.sh` — add one row so `pp-work` is on `PATH`

**Out of scope** — looks related, do not touch:
- **`tooling/cli/wt/*`.** Do not widen, narrow or reuse `wt`. Plan 222 owns it. In particular do
  not "unify" the two tools — the whole point is that they have opposite lifecycle rules.
- **`tooling/cli/greenlight/greenlight`** and anything that lands. A later plan wires landing.
- **`~/.local/libexec/pp-push`** and the git hooks — plan 225 owns them. `pp-work` never pushes.
- **The `.claude/settings.json` hook wiring** — a later plan adds the wall. `pp-work` must be
  useful before any hook forces its use.
- Deleting anything under `~/kb-scratch` outside the harness's own `mktemp -d`.

## Git workflow

- Branch: `advisor/226-pp-work-workspaces-and-inventory`
- Commit per step, message style `feat(pp-work): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Write `pp-work`

Create `tooling/cli/pp-work/pp-work`, `chmod +x`. Implement exactly these subcommands and rules.

**Resolution, shared by every subcommand:**

```bash
#!/usr/bin/env bash
# pp-work — per-session and per-subject git worktrees that are NEVER reset.
#
# Distinct from `wt` on purpose. `wt` is a fixed pool of 8 slots that RESETS a slot on
# acquire and on return; a session's in-progress work must survive exactly that. The two
# live under different roots so `wt return`'s own guard ($POOL/*/<repo>) can never match a
# workspace.
set -euo pipefail

die() { echo "pp-work: $*" >&2; exit 1; }

# Anchor on the MAIN checkout, never `--show-toplevel`: inside a linked worktree that
# returns the worktree's own path, so the root would differ per workspace.
resolve() {
  local dir="${1:-$PWD}" common
  common=$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) \
    || die "not inside a git repository: $dir"
  MAIN=$(dirname "$common")
  REPO_NAME=$(basename "$MAIN")
  HASH8=$(echo -n "$MAIN" | shasum -a 256 | cut -c 1-8)
  WS_ROOT="$HOME/kb-scratch/workspaces/$REPO_NAME-$HASH8"
  WT_POOL="$HOME/kb-scratch/worktrees/$REPO_NAME-$HASH8"
  LANDING="$HOME/kb-scratch/landing/$REPO_NAME-$HASH8"
}
```

**`ws_is_clean <path>`** — the single definition of "safe to remove". Both conditions must hold:

```bash
# A workspace is clean only if it has NO uncommitted work AND NO generated media.
# Renders are gitignored, so a commit can never carry them — folder persistence is the
# only thing that saves them, which is why ignored media blocks removal forever with no
# TTL. node_modules and the bootstrap symlinks are ignored too and must NOT block.
ws_is_clean() {
  local wt="$1"
  [ -z "$(git -C "$wt" status --porcelain --untracked-files=all 2>/dev/null)" ] || return 1
  local media
  media=$(git -C "$wt" ls-files --others --ignored --exclude-standard 2>/dev/null \
          | grep -Ei '\.(mp4|mov|webm|wav|mp3|m4a|png|jpe?g)$' \
          | grep -v '/node_modules/' | head -1)
  [ -z "$media" ] || return 1
  return 0
}
```

**`pp-work claim --kind code|subject --slug <slug> [--task "<text>"]`**

1. `resolve`.
2. Reject a slug that is not `[a-z0-9._/-]+`, and reject one containing `..`.
3. `wt_path="$WS_ROOT/$slug/$REPO_NAME"`. **Refuse** if `$wt_path` resolves under `$MAIN`, under
   `$WT_POOL`, or under `$LANDING` — print which and exit 1.
4. **If `$wt_path` already exists**: this is a re-attach, not a create. Print the path and exit 0.
   Do **not** reset, clean, or checkout anything. This is what lets a new session continue a
   video whose renders are still on disk.
5. Otherwise: disk check first — if `df` reports under 10 GiB available on `$HOME`, print a
   warning naming `pp-work list` (do not refuse; the owner decides).
6. Branch name: `subject/<slug>` for `--kind subject`, `work/<slug>` for `--kind code`.
   `git -C "$MAIN" worktree add "$wt_path" -b "<branch>"` — if the branch already exists, use
   `git -C "$MAIN" worktree add "$wt_path" "<branch>"` instead. If git refuses because the branch
   is checked out elsewhere, **fail** with the holding path from
   `git -C "$MAIN" worktree list --porcelain`, and say read-only inspection is available there —
   never fall back to a different path for the same slug.
7. Run `wt`'s bootstrap hook so the workspace gets the machine-local runtime files:
   `( cd "$wt_path" && WT_MAIN_CHECKOUT="$MAIN" bash "$MAIN/tooling/cli/wt/bootstrap.d/$REPO_NAME.sh" ) || true`
   (guarded — a repo without that hook is fine.)
8. Write the manifest to `$WS_ROOT/$slug/manifest` as `key=value` lines: `kind`, `slug`, `branch`,
   `session=${CLAUDE_SESSION_ID:-unknown}`, `pid=$$`, `task=<--task text>`,
   `created=<epoch>`, `touched=<epoch>`, `main=$MAIN`.
9. If `$MAIN/tooling/boss/state/lands` exists, count `*.blocked` in it and, when non-zero, print
   one line: `pp-work: N blocked land(s) waiting — see pp-work list`. Tolerate the directory being
   absent; a later plan creates it.
10. Print **only the path** on stdout (everything else on stderr), so a caller can do
    `cd "$(pp-work claim ...)"`.

**`pp-work list`** — one inventory across all three roots plus `wt`:

- For each directory under `$WS_ROOT`: slug, kind, branch, age from `touched`, commits ahead of
  `origin/main` (`git rev-list --count origin/main..HEAD`), uncommitted file count,
  `media=yes/no` from `ws_is_clean`'s media test, size from `du -sh`, and a paste-ready
  `cd <path>` line.
- A line for `$LANDING` if it exists (size only — it holds no owner work by design).
- `wt status --repo "$MAIN"` appended verbatim under a heading.
- Total size across all three roots and available disk, as one summary line.
- Blocked lands from `$MAIN/tooling/boss/state/lands/*.blocked` if that directory exists.

**`pp-work remove <path>`** — the only way a workspace is ever deleted:

```bash
# Refuse unless BOTH: nothing uncommitted or generated, AND the branch is already merged.
# A mid-flight kill routinely leaves a complete-but-uncommitted implementation, and
# renders cannot be recovered from git at all.
if ! ws_is_clean "$wt"; then
  die "PPWORK-DIRTY refusing to remove $wt — it holds uncommitted work or generated media.
  Inspect it with: pp-work list
  There is no TTL and no automatic reclaim; this workspace stays until you deal with it."
fi
branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD)
git -C "$MAIN" merge-base --is-ancestor "$branch" origin/main 2>/dev/null \
  || die "PPWORK-UNMERGED refusing to remove $wt — branch '$branch' is not merged into origin/main."
git -C "$MAIN" worktree remove "$wt"
```

There is **no** `--force`, no TTL, and no reap. Removal is always an explicit act on a workspace
that is provably finished.

**Verify**: `bash -n tooling/cli/pp-work/pp-work` -> no output, exit 0
**Verify**: `test -x tooling/cli/pp-work/pp-work` -> exit 0

Commit: `feat(pp-work): claim, list and remove never-reset workspaces`

### Step 2: Put it on `PATH`

Add a row for `pp-work` to `scripts/link-clis.sh` alongside the existing entries. Read the file
first and match its exact row format.

Note: unlike `pp-push` (plan 225), a symlink into the checkout is **correct** here. `pp-work`
guards nothing and is not a security boundary, so the normal convention applies.

**Verify**: `grep -c 'pp-work' scripts/link-clis.sh` -> at least `1`
**Verify**: `bash -n scripts/link-clis.sh` -> no output, exit 0

Commit: `chore(cli): link pp-work`

### Step 3: Write the harness

Create `tooling/cli/pp-work/test-pp-work.sh`. Build a throwaway repo with a bare origin in
`mktemp -d`, export `HOME` into the sandbox so the roots land there, and assert:

1. **claim creates a worktree outside the main tree** — the path starts with
   `$HOME/kb-scratch/workspaces/` and is not under the repo.
2. **claim prints only the path on stdout** — `cd "$(pp-work claim ...)"` works.
3. **re-claiming the same slug re-attaches** — same path returned, and a file left in the
   workspace (both a tracked edit and an ignored `render.mp4`) **still exists** afterwards.
4. **a second live claim of the same subject slug FAILS** — non-zero exit, and the error names the
   holding path.
5. **remove refuses a dirty workspace** — non-zero exit, the file survives.
   Failure message must be `FAIL: remove DELETED a workspace holding uncommitted work`.
6. **remove refuses a clean-but-unmerged workspace** — non-zero exit.
7. **remove succeeds when clean and merged** — the directory is gone.
8. **an ignored `render.mp4` alone blocks removal** even with a clean status and a merged branch —
   this is the R5 guarantee and it is the one most likely to regress.
9. **claim refuses a slug that would land under the main checkout** or under
   `$HOME/kb-scratch/worktrees/` — non-zero exit.
10. **`pp-work list` names the workspace and its uncommitted count**.

Use the harness idiom from `tooling/cli/wt/test-wt.sh`: `fail()` printing `FAIL: <msg>` and a
final `echo "ALL TESTS PASSED"`. Guard every long operation so a regression fails rather than
hangs — a hanging test is an invisible failure.

**Verify**: `bash tooling/cli/pp-work/test-pp-work.sh` -> `ALL TESTS PASSED`, exit 0
**Verify**: `grep -c 'ALL TESTS PASSED' tooling/cli/pp-work/test-pp-work.sh` -> `1`

Commit: `test(pp-work): pin the never-reset and slug-mutex contracts`

### Step 4: Write the README

Create `tooling/cli/pp-work/README.md` covering: the three roots and their opposite lifecycle
rules; why this is not `wt` (quote `wt`'s own policy line and its `reset_worktree`); the two kinds;
the slug mutex coming free from `git worktree add`; that removal needs clean **and** merged with no
TTL and no force; and the reproduced branches-are-not-enough demonstration in one short paragraph.

**Verify**: `grep -c 'reset' tooling/cli/pp-work/README.md` -> at least `1`

Commit: `docs(pp-work): record the three roots and the never-reset rule`

## Test plan

`bash tooling/cli/pp-work/test-pp-work.sh` is the gate — ten behavioural assertions in a
`mktemp -d` repo with a bare origin, never touching the real pool or the real `~/kb-scratch`.

Assertions 5 and 8 are the load-bearing pair: a workspace holding uncommitted work must survive a
removal attempt, and one holding only an ignored render must survive too. Renders are gitignored,
so no commit can carry them and folder persistence is the only mechanism that saves them —
assertion 8 is what stops a future refactor from "tidying" that away.

Assertion 4 proves the slug mutex is real rather than assumed. It relies on `git worktree add`
refusing a branch checked out elsewhere, so it is testing git's guarantee, not a home-grown lock.

## Done criteria

- [ ] `bash tooling/cli/pp-work/test-pp-work.sh` prints `ALL TESTS PASSED`, exit 0.
- [ ] `test -x tooling/cli/pp-work/pp-work` and `test -f tooling/cli/pp-work/test-pp-work.sh`
      both exit 0 — the files exist, not merely specified (LESSONS 2026-08-17).
- [ ] `bash -n` passes on `pp-work`, `test-pp-work.sh` and `scripts/link-clis.sh`.
- [ ] `grep -c 'PPWORK-DIRTY' tooling/cli/pp-work/pp-work` returns `1`.
- [ ] `grep -c 'PPWORK-UNMERGED' tooling/cli/pp-work/pp-work` returns `1`.
- [ ] `grep -cE 'force|--force' tooling/cli/pp-work/pp-work` returns `0` — there is deliberately
      no override on removal.
- [ ] `grep -c 'kb-scratch/workspaces' tooling/cli/pp-work/pp-work` returns at least `1`, and
      `grep -c 'kb-scratch/worktrees' tooling/cli/pp-work/pp-work` returns at least `1` (the pool
      is referenced only to **refuse** paths under it).
- [ ] `grep -c 'show-toplevel' tooling/cli/pp-work/pp-work` returns `0` — the anchor is
      `--git-common-dir`, because `--show-toplevel` inside a linked worktree returns the wrong path.
- [ ] `wt status --repo /Users/kbtg/codebase/personal-stuff` is unchanged: 8 slots, same states.
- [ ] `ls ~/kb-scratch/workspaces` does **not** exist, or is empty — this plan must not create a
      real workspace outside its harness.
- [ ] The mutation recipe behaves as specified: clean passes; applying it makes the harness fail
      printing `FAIL: remove DELETED a workspace holding uncommitted work`; reverting passes.
- [ ] `git diff --stat` against the branch point touches only the four files in `touches`.

## STOP conditions

- **A workspace path would resolve under the main checkout, under `~/kb-scratch/worktrees/`, or
  under `~/kb-scratch/landing/`.** That is a hard refusal in the tool, not a warning. If a test
  needs it to be allowed, the test is wrong.
- **You are about to edit anything under `tooling/cli/wt/`.** STOP — plan 222 owns it, and
  "unifying" the two tools destroys the point.
- **You are about to add a `--force`, a TTL, or a reap to `pp-work remove`.** STOP. The absence of
  an override is the feature: a mid-flight kill routinely leaves a complete-but-uncommitted
  implementation, and gitignored renders cannot be recovered from git at all.
- **You are about to delete anything under the real `~/kb-scratch`**, or run the tool against the
  real checkout. STOP — the harness sandboxes `HOME`.
- **`git worktree add` refuses a branch and the tempting fix is a different path for the same
  slug.** STOP. Two directories for one subject is the co-tenancy this design exists to prevent;
  the refusal is correct.
- **A gate assertion fails and the tempting fix is to weaken `ws_is_clean`** — for example by
  dropping the ignored-media test because `node_modules` is noisy. STOP. Exclude the specific
  noise, never the check.

## Maintenance notes

- Three roots, three rules, and they must never overlap: the `wt` pool is reapable and reset on
  acquire; workspaces are never reset; the landing tree (a later plan) is always reset. An earlier
  draft of this design put workspaces **inside** `wt`'s pool, which made `wt return`'s own
  `$POOL/*/<repo>` guard able to wipe them.
- `ws_is_clean` is the single definition of "safe to remove" and is used by both `remove` and
  `list`. If a new kind of unrecoverable artifact appears, it belongs in that function, not in a
  caller.
- The anchor is `--git-common-dir`, never `--show-toplevel`. Anything that recomputes the root
  must use the same anchor or workspaces will scatter across per-worktree hashes.
- The slug mutex is git's, not ours. If a future change stops pinning a branch per subject, the
  mutex disappears silently and two sessions can share a directory — the exact 2026-08-22 failure,
  inside the isolation mechanism.
- `pp-work` deliberately does not push, land, commit, or notify. A later plan wires landing; this
  tool's only job is custody.
