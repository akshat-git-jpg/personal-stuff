# wt (Worktree Pool Manager)

A simple, bash-based managed pool of git worktrees. This provides detached-HEAD worktrees with durable leases for isolated agent and executor runs.

## Policy: Managed Runs Only

**Owner interactive sessions, deploys, VPS/cron ops, and skill edits stay on the main checkout.**
The `wt` tool is strictly for parallel agent runs (e.g., plan validation, captain orchestrators) which require isolation.

## Commands

- **`wt get`**: Acquire a worktree lease, reset it, run bootstrap hook, and print its path.
  ```bash
  path=$(wt get --holder captain)
  ```
- **`wt return <path> [--force-dirty]`**: Release a lease and reset the worktree, marking it free. Refuses a dirty worktree unless `--force-dirty`.
  ```bash
  wt return /Users/kbtg/kb-scratch/worktrees/personal-stuff-hash/1/personal-stuff
  ```
- **`wt status`**: Show the pool status (N, state, holder, age).
  ```bash
  wt status
  ```
- **`wt prune`**: Delete free and clean worktrees.
  ```bash
  wt prune --yes
  ```
- **`wt reap`**: Free leases nobody is coming back for — older than the TTL (default 24h) **and** clean. Dry-run by default.
  ```bash
  wt reap             # report what would be freed
  wt reap --yes       # free the clean ones
  ```
- **`wt release --holder <label>`**: Free the slot held by one holder, with no TTL wait. For a caller that *knows* the holder is finished.
  ```bash
  wt release --holder boss-152
  ```

### Leases leak, and that is what `reap` / `release` exist for

A lease is created by `wt get` and removed only by an explicit `wt return`. There is no
owner-liveness signal (lease-only model, by design), and `wt get`'s only test was *"does
the lease file exist"* — so a holder that dies never gives its slot back and the leak is
**permanent**. The pool only ever shrinks.

This was not theoretical. On 2026-08-22 four of eight slots were held by boss crews whose
PRs had merged or closed weeks earlier (one held for 25 days), and the pool was one leak
away from `ERROR: pool full` starving every future dispatch.

Three layers now stop it:

1. **`wt status`** shows a lease's age in hours and marks it `STALE` / `STALE/DIRTY`, so a
   leak is visible instead of reading as a normal `leased`.
2. **`wt get`** reaps stale-and-clean leases before reporting the pool full, so one leak can
   never permanently cost a slot.
3. **boss sweeps on its own behalf.** `boss-session-start.sh` maps each `boss-<pr>` holder to
   its GitHub PR and calls `wt release` for any PR that is no longer `OPEN`. Note it keys on
   the PR's **state**, never its labels: PR#152 and #153 were both `MERGED` and still
   labelled `boss:in-progress`, so a label check would have called them live.

**A dirty worktree is never freed silently.** All four commands that reset a worktree —
`get`, `return`, `reap` and `release` — refuse one that holds uncommitted work; they name the
path and stop. A mid-flight kill routinely leaves a complete-but-uncommitted implementation
(see `decisions.md` 2026-08-02), and losing a slot is far cheaper than losing that work.
`--force-dirty` is the explicit opt-in that discards it, on every one of the four.

Until 2026-08-23 only `reap` and `release` honoured that rule. `wt return` printed
`WARNING: worktree is dirty` and then wiped the tree anyway, and `wt get` reclaimed an
unleased-but-dirty slot with the message `uncommitted work discarded`. Both now stop instead:
`return` exits non-zero, and `get` skips that slot and moves to the next one.

**The pool lock can no longer wedge the tool.** The lock is a `mkdir` on `.lock.d` released
by an `EXIT` trap, and `SIGKILL` skips traps — so one killed `wt` used to make every later
`wt` call spin forever with no timeout and no message. `lock_pool` now records its pid in the
lock, breaks a lock whose recorded holder is gone (or that has no pid and is older than
`LOCK_WAIT_SECS`, 30s), and after `LOCK_WAIT_SECS` of a provably *live* holder it fails
loudly with the lock path rather than hanging. `unlock_pool` only removes a lock this process
actually owns.

## Bootstrap Hook (`bootstrap.d`)

When a worktree is acquired, `wt get` automatically runs the hook `bootstrap.d/<repo-basename>.sh` (with `$WT_MAIN_CHECKOUT` set to the main checkout path). This allows repo-specific linking of runtime files like `.env`, `credentials.json`, and `.mcp.json` into the isolated worktree without committing secrets.

## Design Provenance

Adapted from `kunchenguid/treehouse` (studied 2026-07-06). We use a simpler bash version with:
- Lease-only model (no PID owner-tracking).
- Detached HEAD and resetting on acquire/return.
- Marker files for state (no JSON/`jq` dependencies).
- Dropped: repo-level hooks, process cwd scanning.
