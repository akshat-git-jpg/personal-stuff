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
- **`wt return`**: Release a lease and reset the worktree, marking it free.
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

## Bootstrap Hook (`bootstrap.d`)

When a worktree is acquired, `wt get` automatically runs the hook `bootstrap.d/<repo-basename>.sh` (with `$WT_MAIN_CHECKOUT` set to the main checkout path). This allows repo-specific linking of runtime files like `.env`, `credentials.json`, and `.mcp.json` into the isolated worktree without committing secrets.

## Design Provenance

Adapted from `kunchenguid/treehouse` (studied 2026-07-06). We use a simpler bash version with:
- Lease-only model (no PID owner-tracking).
- Detached HEAD and resetting on acquire/return.
- Marker files for state (no JSON/`jq` dependencies).
- Dropped: repo-level hooks, process cwd scanning.
