# FINAL: automatic worktree custody for personal-stuff

**Status: converged.** 14 adversarial review rounds (Opus 5, Opus 4.6, Gemini 3.1 Pro), 24
verified defects fixed. Every fact below was verified with live commands against the repo, not
assumed. Executor for implementation: `agy`. Scope: `personal-stuff` only.

Supersedes BRIEF-v1 … v14. Where this file and any BRIEF disagree, this file wins.

> **SUPERSEDED IN PART — read `decisions.md` (entries dated 2026-08-23) first.** This file
> records the design as approved on the MORNING of 2026-08-23. Two of its requirements were
> reversed by the owner the same day, so where this file and `decisions.md` disagree,
> **`decisions.md` wins**:
>
> - **R3 "No auto-commit"** — reversed. Auto-commit is now the DEFAULT in this repo, declared
>   by the repo-level `.claude/skills/commit-now` skill and backed by a `Stop` hook. The
>   owner's reason: worktrees made uncommitted work invisible, so he wanted forgetting it to
>   be impossible.
> - **"a second live claim fails … never co-tenancy"** (§6) — reversed. A re-claim of the same
>   slug SUCCEEDS and returns the same folder, because the owner asked for a new session to be
>   able to pick up an interrupted one. It now prints a note naming the previous session
>   rather than refusing.
>
> Also stale here: `branch-guard.sh` is deleted (replaced by
> `.claude/hooks/no-history-in-main.sh`), and the wall gained a `pre-commit` half so it stops
> commits typed by a human, not only those run by Claude.

---

## 1. The problem

Multiple Claude/agy/boss sessions share one checkout, `/Users/kbtg/codebase/personal-stuff`.
One checkout has one working tree, one HEAD, one index. Two logged incidents:

- **advisor/055 (2026-07-10)** — session B ran `git switch`; HEAD moved under session A, and A's
  next commits landed on B's branch.
- **2026-08-22** — a session ran `git add decisions.md` — correctly scoped, one file — and
  swallowed a concurrent session's unrelated 36-line edit, because the on-disk copy of that file
  already contained it. It happened while the agent was actively watching for exactly this.

**Branches cannot fix this.** Reproduced in a scratch repo: session B on its own branch, staging
only its own file, still committed session A's uncommitted paragraph. A branch separates
*history*; the problem is the *files*.

**Root inversion.** Today the directory *is* the storage, and `wt` **wipes** directories to reuse
them. v9 onward: the directory is never wiped while it holds work, and it is always findable.

---

## 2. Owner's requirements (decisions, not open questions)

| # | Requirement |
|---|---|
| R1 | Zero added owner workload. No worktree commands, no approvals, no conflict-fixing, no notifications |
| R2 | A dead session must never lose work, and its directory must be findable |
| R3 | **No auto-commit.** The owner controls every commit, exactly as today |
| R4 | **Full auto-merge to main**, all paths, accepted despite `vps-sync.sh` pulling `main` every 15 min |
| R5 | Pipeline runs isolated **and** re-attachable by subject across sessions |
| R6 | One active workspace per session |
| R7 | No new orchestrator — tie into `boss`, which the owner always keeps open |
| R8 | Token cost may rise a little, not a lot |
| R9 | `personal-stuff` only. ZluriHQ work repos completely unaffected |
| R10 | If boss is closed, it picks up pending work when it opens |

---

## 3. Live defects in existing tooling (all verified; fixed by L0)

| # | Defect |
|---|---|
| 1 | `GH_TOKEN=gho_…` in `.claude/settings.local.json`; repo is **PUBLIC**; kept out of git only by `.git/info/exclude:18` (per-clone) |
| 2 | `core.hooksPath` = `/Users/kbtg/codebase/personal stuff/.git/hooks` — a **space** for the hyphen. No git hook has ever run |
| 3 | `branch-guard.sh` regex `git\s+(switch\|checkout)\s+[^-]` — any flag bypasses it; path hardcoded to this Mac; ships to the VPS inert |
| 4 | `wt lock_pool` is `until mkdir` + EXIT trap. SIGKILL wedges **every** future `wt` call, forever |
| 5 | `wt get` discards dirty unleased work; `wt return` only prints `WARNING: worktree is dirty` then wipes |
| 6 | `.gitignore:66-67` point at `pipelines/hyperframes-vs-remotion/…`; real path is under `pipelines/archive/`. Dead rule |
| 7 | `.claude/settings.local.json` + `.claude/worktrees/` protected only by per-clone excludes |
| 8 | `boss-commit-main.sh:46-48` does `git add -A` + push on main. Two logged misfires |
| 9 | `vps-sync.sh` never calls `relink.sh`/`link-clis.sh` and never touches `hooksPath` |
| 10 | `~/kb-scratch` = 33 GB across 14 orphaned pool dirs; disk 89% full, 51 GiB free |
| 11 | `boss_chrome_lock_acquire` returns **0 without the lock** on timeout; `boss_chrome_lock_release` is a blind `rm -rf` that never checks owner |
| 12 | `state/` holds 171 `.meta`; the in-flight loop runs `gh pr view` on **every one, every startup**. No meta carries a terminal field |

---

## 4. L0 — one-off, in this order

1. **`pp-push`.** Tracked source `tooling/cli/pp-push/pp-push`; installed as a **copy** to
   `~/.local/libexec/pp-push` (never a symlink — `~/.local/bin/wt` is a symlink *into* the
   checkout, which would make the gate branch-editable). Holds the secret/size/tracked-extension
   gate and its **own** dedicated, reentrancy-safe, stale-breaking push lock — never boss's Chrome
   lock. Refuses to run if `$0` resolves inside a git working tree, if its **self-recorded**
   checksum (sibling file written at install) mismatches, or if the `pre-push` dispatcher is not
   armed. Divergence from the repo **warns**; any repo comparison reads
   `git show origin/main:…`, never the working tree.
2. Convert every in-repo pusher: `greenlight:389`, `boss-commit-main.sh:46-48`,
   `boss-merge.sh:155`.
3. **`scripts/lib/guard-install.sh`**, sourced by **both** `relink.sh` **and** `vps-sync.sh`.
   Creates `~/.local/libexec`; installs `pp-push` + checksum; **unsets** `core.hooksPath`
   (guarded — it exits **5** when absent and both callers use `set -euo pipefail`, so an
   unguarded unset would silently kill the VPS relink cron); installs `pre-push` and
   `post-commit` dispatchers into
   `$(git rev-parse --path-format=absolute --git-common-dir)/hooks/`. Verified: with
   `hooksPath` unset, a hook in the shared `.git/hooks` fires from the main worktree **and** from
   linked worktrees, is untracked so no cron dirties the tree, and sits outside the working tree
   so guarded branches cannot edit it. Verified no `package.json` has a `prepare`/`postinstall`
   or husky dep that would re-set it.
4. `boss-commit-main.sh`: `git add -A` → explicit-path staging.
5. Rotate `GH_TOKEN`; relocate outside the repo tree.
6. Add `.claude/settings.local.json` and `.claude/worktrees/` to the tracked `.gitignore`.
7. Fix the dead `.gitignore` rule (66-67).
8. `wt lock_pool`: PID+mtime stamp, bounded wait, stale-break with a message.
9. `wt get` **and `wt return`**: refuse a dirty tree absent `--force-dirty`. Never discard.
10. **Chrome lock hardening:** `release` checks `owner`/`pid` before removing; the timeout path
    **returns non-zero** so the caller knows it never held the lock.
11. **`STATE_DIR="${BOSS_STATE_DIR:-$BOSS_HOME/state}"`** in `boss-lib.sh:7` — byte-identical when
    unset. (`BOSS_HOME` is derived from `BASH_SOURCE` and is *not* env-overridable.)
12. **O(1) in-flight loop:** when boss records a PR done/landed, write a **terminal marker** into
    that PR's meta; the in-flight loop skips on that **local field, with no `gh` call**.
    **Do not prune `state/`** — `boss-deploy.sh` and the loop's own comment rely on a landed PR
    keeping its meta. No meta carries a terminal field today, so the marker must be written going
    forward, not merely read.
13. Add `.dev.vars` to `bootstrap.d/personal-stuff.sh`'s link list, beside `pipelines/.env`,
    `pipelines/credentials.json`, `.mcp.json` (recorded lesson `tracker-e2e-needs-devvars`).
14. One-time inventory of the 14 orphaned pool dirs (33 GB) for the owner to clear **by hand**.
    Never an automated delete.
15. Deliberately **no branch protection** — it would fight R4.

---

## 5. L1 — the wall

One `PreToolUse` hook matching Bash **command strings**. It fires only in the **main worktree of
this repo**:

```bash
same_repo && {
  read -r gd gcd < <(git rev-parse --path-format=absolute --git-dir --git-common-dir | tr '\n' ' ')
  [ "$gd" = "$gcd" ]
}
```

`--path-format=absolute` is load-bearing: raw output is absolute for `--git-dir` and *relative*
for `--git-common-dir` below the toplevel, so a raw comparison silently fails open in
`pipelines/`, `apps/…`, `tooling/`. Verified correct in five positions — main toplevel, two main
subdirectories, workspace toplevel, workspace subdirectory. **Ships with that five-position
test.**

There it denies `add`, `commit`, `stash`, `rebase`, `merge`, `switch`, `checkout`, `reset`,
`cherry-pick`, `am`, `apply`. Override `GUARD_OK=1` with **no call sites added anywhere** — adding
them would train the override on.

Reading and writing files stays allowed everywhere. Only *recording history* moves.

**Scope facts.** Being a command-string matcher, it cannot see git calls *inside* scripts, so
`boss-commit-main.sh`, `boss-merge.sh` and `secretary` are untouched and need no override. Its
real scope is **agent-typed git in the main worktree**, which is precisely both incidents.
It never matches a ZluriHQ repo. It **retires `branch-guard.sh`**.

**Known residual, accepted:** Bash file writes (`sed -i`, heredocs, `python3 -c`) are
unparseable. The commit is guarded, which is the chokepoint every change must pass to become
durable or shared.

---

## 6. L2 — workspaces

- **Created lazily.** Nothing exists while the owner is only conversing or reading. Claude creates
  one before its first file change.
- Root **`$HOME/kb-scratch/workspaces/<repo>-<hash8>/<slug>/personal-stuff`** — deliberately
  **separate** from `wt`'s `POOL` (`$HOME/kb-scratch/worktrees/<repo>-<hash8>`, verified
  byte-identical to an earlier draft, which is what made `wt return`'s
  `$POOL/*/$REPO_BASENAME` guard and greenlight's cleanup able to wipe a workspace) and separate
  from the landing tree. Creation **refuses** any path under the main worktree. No fixed count.
- **Never wiped, never reset** while holding uncommitted work or untracked ignored media. No TTL,
  no pool-full reclaim, no exception. Removed **only** when clean **and** its branch is merged.
  Disk pressure alarms and lists consumers; it never deletes to make room.
- Two kinds: **`code`** (session-keyed, short-lived) and **`subject`** (slug-keyed, long-lived,
  re-attached across sessions). `subject` is required by R5 and is the *only* possible mechanism:
  renders are gitignored, so a commit can never carry them — only folder persistence saves them.
- **Slug mutex** via `subject/<slug>` branch pinning. Git refuses one branch in two worktrees, so
  a second live claim **fails** with the holder's session id and PID, offering read-only
  inspection — never co-tenancy.
- Switching slugs **detaches without cleaning**. Removal is only ever explicit.
- On claim or create, **prints the blocked-land count** — the R1-compatible visibility channel,
  on a path the owner's own work unavoidably passes through.
- `code` workspaces may `cp -c` `node_modules` from main. **Never** `cp -c` the repo itself:
  measured, a `cp -c -R` of the 38 GB repo took 59 s and zero net disk, but carried **10
  secret-shaped files** a `git worktree` checkout cannot contain.
- Cost: history is **shared** (603 MB object store; a worktree's own git data is 740 KB and its
  `.git` is a one-line pointer file). Working files ~1.1 GB per workspace.

---

## 7. L3 — discoverability (replaces the cut snapshotter)

A plain-text manifest per workspace — kind, slug, branch, session id, PID, the task in the
owner's words, created-at, last-touched-at — written by the workspace tool.

**`pp-work list`** is the single inventory across **all three roots plus `wt status`**: age,
branch, commits ahead, uncommitted count, holds-ignored-media, per-root sizes, blocked lands, and
a paste-ready resume command. One summed disk alarm; a disk check also runs at
workspace-creation time so it still fires with no boss open.

**Nothing in L3 commits, pushes, or deletes. No `launchd` job** — nothing left is time-critical.

---

## 8. L4 — landing

1. The owner commits in a workspace. Claude performs it; the owner decides when.
2. The **`post-commit` dispatcher** fires only when **all** hold: it is in a **linked** worktree
   (`--path-format=absolute --git-dir` ≠ `--git-common-dir`); the branch is a **workspace
   branch**; a manifest names that branch. It writes **zero bytes** to stdout/stderr (its output
   would otherwise land in the transcript of every commit), launches the lander **detached**, and
   exits 0. Verified: `post-commit` survives `--no-verify` (which `commit-now` uses), fires on
   plain and conflict-resolution commits, and does **not** fire on `merge --no-ff` or `rebase` —
   so there is no merge recursion.
3. The lander is **existing `greenlight`** with a new optional `--worktree`, run against **one
   dedicated landing tree** at `$HOME/kb-scratch/landing/<repo>-<hash8>` — **never** the `wt`
   pool (`greenlight:122` is an unconditional `wt get`; `MAX_TREES=8`; a land per commit would
   exhaust the pool and, under R1's no-notifications rule, commits would silently stop landing).

   **Sequence — the order is load-bearing:**
   ```
   acquire landing mutex          # held across the WHOLE land, not just the push:
                                  # pp-push's lock is taken at greenlight:389, AFTER verify
   reset --hard
   clean -fd                      # NO -x
   run bootstrap.d/<repo>.sh      # with WT_MAIN_CHECKOUT=<main checkout>
   checkout branch
   rebase onto origin/main
   verify
   detach at origin/main          # on failure only: retry once after clean -xfd
   merge --no-ff
   push via pp-push
   check-and-clear re-land flag INSIDE the mutex; loop if it was set
   release mutex
   invoke the land sweep          # AFTER releasing
   ```
   **Why `clean -fd` and the bootstrap hook:** `wt get` does *two* jobs — reset **and**
   `run_bootstrap` (`wt:159-165`), which symlinks `pipelines/.env`,
   `pipelines/credentials.json`, `.mcp.json`. `--worktree` skips `wt get`, and all of those are
   ignored, so `clean -x` would delete exactly them plus all **14** `node_modules` dirs. Verify
   *is* the app test suites, so every land would fail from the first commit, silently. And `-x`
   was never needed: `checkout --detach` is blocked by modified **tracked** files (`reset --hard`)
   or an unmerged index (greenlight's existing `merge --abort` at `385-386`), not by ignored build
   output — which is why `wt`'s own `reset_worktree` omits `-x` deliberately.

   **Coalescing, not queueing**, made atomic on both sides: the land does check-**and-clear**
   inside the mutex and loops; the trigger tries to acquire **first** and sets the flag only on
   failure, then retries acquisition once — otherwise a trigger landing between the holder's check
   and its release would set a flag nobody re-reads, and that commit would silently never land.
   N commits during one land cost **one** extra land.

   **`--worktree` also gates the new re-verify-on-forced-re-merge** (today `greenlight:380-395`
   re-merges without re-verifying). Absent the flag greenlight is **byte-identical**, enforced by
   a **golden test** asserting `wt get`/`wt return` are still called and the retry still does not
   re-verify. Greenlight is **not forked** — a duplicate lander would rot out of sync with boss's
   critical path.
4. **Success:** branch deleted; workspace removed only per L2's rules.
5. **Blocked:** writes `land-<slug>.blocked` (workspace path, branch, parked reason,
   `attempts=N`). Changes nothing else. Leaves the workspace untouched.
6. **boss owns it.** A dedicated sweep script (there is no on-demand sweep verb today):
   - runs under **`BOSS_STATE_DIR=$BOSS_HOME/state/lands`**, and **every** related call —
     the sweep, `agy.sh dispatch`/`alive`/`collect` for that slug, and the
     `.blocked`/`.dispatching` claim files — must run under that same store. A single call that
     inherits the default store would `meta_get` an absent meta and exit 1. This keeps land
     bookkeeping out of every `state/*.meta` glob, present and future: `boss_crews_running`
     (`boss-lib.sh:182-199`, which would report a land as a live crew and stall **every** boss
     merge for `BOSS_CHROME_WAIT_MIN:-45` min against `agy`'s 180 m default) and
     `boss-session-start.sh:54-59` (where `gh pr view` fails, `$st` is empty, no skip branch
     matches, and the land prints as in-flight **forever**).
   - takes **its own dispatch lock** — never the landing mutex. Sharing it would deadlock: a
     fix-up dispatched under it commits, triggers a new lander, and that lander blocks on the
     mutex its own dispatcher still holds.
   - **per-slug atomic claim:** `mv land-<slug>.blocked → land-<slug>.dispatching`; skips any
     slug where `agy.sh alive land-<slug>` returns 0.
   - writes a synthetic `land-<slug>.meta` carrying `worktree=<absolute workspace path>` and
     `model=`, and the brief at an **absolute** path (`agy.sh` `cd`s into the worktree, so a
     relative brief is unreadable — recorded lesson `boss-fixup-brief-absolute-path`), then calls
     `agy.sh dispatch land-<slug> <abs-brief>`. `agy.sh` takes `<verb> <pr#> [brief]` and resolves
     the worktree via `meta_get`, so it **cannot** be handed a path.
   - judges success by **`head_before` / HEAD-advanced**, never PR labels — there is no PR, and
     labels lie (two MERGED PRs still labelled `boss:in-progress`).
   - **acquires boss's Chrome lock** around any browser-driving verify, so hiding land metas from
     crew accounting does not reintroduce PR#134's 44-live-Chrome collision.
   - is invoked by the lander **after it releases the landing mutex**, and by
     `boss-session-start.sh` purely as the reboot / dead-sweep backstop. This is what satisfies
     R10: work is dispatched at once whether or not boss is open, and boss opening is the
     catch-up path rather than the only path.
7. **Attempt policy.**
   - **Transient — resets the counter:** landing-mutex stale-break or timeout; push rejected
     after `LAND_ATTEMPTS`; fetch/network failure; `wt`/pool exhaustion; mechanical dispatch
     failure (missing meta, `agy` not installed).
   - **Real — consumes an attempt:** verify failure (**always**, even when it smells flaky —
     auto-retrying flaky verify is how red code lands on a repo that auto-deploys in 15 min);
     lint failure; hard rebase conflict; a fix-up whose HEAD never advanced.
   - **Never auto-retries:** a `pp-push` gate refusal (a retry re-attempts publishing a secret to
     a public repo); the deploy-live-path refusal (a deliberate hold); a second
     `"cannot detach at origin/main"` *after* the one `clean -xfd` escalation.
   - **Cap: 2 real attempts, and 5 transient resets per slug per 24 h.** That cap is the
     token-blowup backstop.
8. **Auto-resolution refused** for deploy-live paths — `infra/`, `scripts/`, `.github/`,
   `apps/*/wrangler.toml`, `tooling/boss/`. The land simply waits; the entry stays visible via
   L2's claim-time count and `pp-work list`.

---

## 9. `commit-now` containment (R9)

`commit-now` is in **both** `manifest/personal.txt` and `manifest/work.txt`, so it is live in the
owner's ZluriHQ repos. Its shared rules are **not** edited. Exactly **one line** is added —
*repo-local overrides win where they exist* — and all specifics live in this repo:

- branch creation belongs to the workspace tool, not `commit-now`'s `feature/<name>` rule;
- `commit-now` still never pushes — the `post-commit` hook does;
- in the main worktree it claims a workspace rather than fighting L1;
- merge and conflict commits belong to the lander and boss, not to `commit-now`.

`--no-verify` needs no change: it skips `pre-commit`, not `post-commit` (measured).
ZluriHQ behaviour stays byte-identical.

---

## 10. Accepted residual risks

1. **Unsupervised conflict resolution then unsupervised deploy.** An agent resolves a conflict
   with no human review; greenlight re-verifies; it merges to public `main`; `vps-sync.sh` deploys
   within 15 minutes. A resolution that is wrong **but passes the tests** lands and runs. The
   deploy-live-path refusal narrows this; it does not close it. The owner was shown this and
   reaffirmed R1+R4.
2. **A revert is not a rollback.** A merge that is correct-but-unwanted may already have sent an
   email, posted a pin, or charged an API. No revert undoes that.
3. **Uncommitted work is Mac-local** until the owner commits. A dead disk loses it. Identical to
   today's exposure, so not a regression.
4. **Bash writes are unguarded.** L1 guards the commit, not the write.

---

## 11. Cut, and why

`Stop` hook (cannot fire on SIGKILL — the exact failure R2 is about) · `SessionStart` hook
(duplicates boss's surface) · the auto-commit snapshotter (R3) · all `wip/*` branches and
auto-pushes (follows R3) · the `wip:` message convention (owner rejected) · all owner
notifications (R1) · the `launchd` job (nothing time-critical remains) · `wt gc` (cannot coexist
with never-reap) · a fixed slot pool for workspaces or landing · every `git add -A` including
boss's · `cp -c` of the repo (copies secrets) · branch protection (fights R4) · a tracked
`.githooks/` and any `core.hooksPath` value (the pointer is per-clone and does not travel) ·
symlink install of the gate (branch-editable) · hardcoded checkout paths · fail-closed on tree
divergence (a stale branch would refuse every push) · raw `rev-parse` comparison (fails open in
subdirectories) · reuse of boss's Chrome lock for pushes · `wt get` from the lander ·
`boss-dispatch.sh` for blocked lands (its `checkout -B origin/$branch` would destroy the owner's
unpushed commit) · PR labels as a success signal · forking greenlight · per-site `case` patches
for the state namespace (a separate store covers every site) · pruning `state/` ·
post-merge-then-revert as the primary safety net (greenlight verifies before publishing).
