# pp-land — a commit lands on main by itself

`pp-land <workspace-path>` takes a `pp-work` workspace whose branch is ahead of
`origin/main`, verifies it, and publishes it. Nothing else has to happen: the owner commits
when they choose, and the commit reaches `main` with no further action and **no
notification**.

That last part is why every ordering rule below is load-bearing. A failure nobody is told
about is a commit that silently never arrives, so the design is chosen to make silent loss
impossible rather than merely unlikely.

```
pp-land <workspace>          land now (this is what the post-commit hook calls)
pp-land <workspace> --wait   block for the mutex instead of coalescing
```

The trigger is a `post-commit` hook installed by `scripts/lib/guard-install.sh`. It fires
only from a **linked** worktree, only on a `subject/*` or `work/*` branch, and only when a
`pp-work` manifest names that branch. It writes **zero bytes** and launches detached — it
runs on every commit the owner makes, so any output there would enter the session
transcript forever, and a land takes minutes so a commit must never block on one.

## The sequence, and why each step is where it is

```
acquire the landing mutex     held across the WHOLE land
reset the landing tree        reset --hard, then clean -fd  (never -x routinely)
provision the landing tree    bootstrap.d/<repo>.sh, with WT_MAIN_CHECKOUT=<main>
snapshot                      update-ref refs/heads/land/<slug> = the workspace HEAD
greenlight run --branch land/<slug> --worktree <landing> --verify <each matched cmd>
  on land  -> pp-work remove <workspace>   (it refuses unless clean AND merged)
  on park  -> write land-<slug>.blocked
coalesce_check_and_clear      INSIDE the mutex; loop if the flag was set
release the mutex
invoke the land sweep         AFTER releasing
```

**The mutex spans the whole land, not the push.** `pp-push` has its own lock, but it is
taken at the push — which is *after* a verify that takes minutes. Two lands started a
minute apart would both verify, both reach the push, and serialise only there, having
already raced through the landing tree. The mutex has to be older than the verify to be
worth anything.

**A dedicated landing tree, never a pool slot.** `greenlight` used to lease a slot from
`wt`'s pool of 8 for every run. One land per commit against 8 slots exhausts the pool, and
landing would then starve boss's dispatches — invisibly, given the no-notification rule.
So the landing tree lives in its own root and `pp-land` never touches the pool.

**Reset, then provision — in that order.** The pool lease was quietly doing both jobs. It
reset the slot *and* ran the bootstrap hook, which symlinks `pipelines/.env`,
`pipelines/credentials.json`, `.mcp.json` and every `apps/*/.dev.vars`. `--worktree` skips
the lease, so `pp-land` has to do both itself or the very first land verifies inside a tree
with no credentials — a failure no fix-up crew can repair, because the branch is fine.

**`clean -fd`, and `-x` only as an escalation.** The gitignored files in the landing tree
are exactly the ones the bootstrap hook just linked, plus every `node_modules`. `clean -fd`
leaves them; `clean -xfd` deletes them, so making `-x` routine would break every verify
from the first land onward. `-x` is also not needed for its supposed purpose:
`checkout --detach` is blocked by modified **tracked** files (handled by `reset --hard`) or
by an unmerged index (handled by the `merge --abort` above it), not by ignored build output.
It appears exactly once, as a retry-once escalation after a failed detach.

**A snapshot ref, not the branch itself.** `greenlight` is pointed at
`refs/heads/land/<slug>`, a copy of the workspace HEAD, for two reasons. The workspace has
its own branch checked out, so no other tree is allowed to check it out. And a commit made
mid-land must **not** be swept in invisibly — it has to surface as an explicit coalesced
re-run that is verified on its own.

## Coalescing, not queueing

N commits arriving during one land cost one extra land, not N. Both sides of that are
atomic against the mutex, and the order is the whole point.

The holder, at the end and still **inside** the mutex, reads and clears the flag, and loops
if it was set. Checking and *then* releasing leaves a window: a trigger arriving between
the check and the release finds the mutex held, sets the flag and exits — and the holder has
already passed its check, so nobody re-runs. That commit reaches `main` only if some later
commit happens to start a fresh land, and with no notifications it is indistinguishable
from success. That exact window is the mutation the gate applies.

The trigger side is the mirror image: **acquire first**, flag only on failure, then retry
acquisition **once**. Flag-then-exit would race the holder's own check, and without the
retry a holder that released in between would leave the commit for nobody to land.

## The three roots

```
$HOME/kb-scratch/worktrees/<repo>-<hash8>   wt pool      reapable, reset on acquire
$HOME/kb-scratch/workspaces/<repo>-<hash8>  workspaces   NEVER reset
$HOME/kb-scratch/landing/<repo>-<hash8>     landing      ALWAYS reset
```

The landing tree is the only worktree in this system that is always reset. That is safe
**only** because no owner work ever lives there. If anything ever writes owner state into
it, the reset becomes data loss.

## `verify-map.tsv`

A path prefix, a tab, and the command whose exit 0 gates a land touching that prefix. Every
command whose prefix matches at least one changed path runs, de-duplicated.

The map is **append-only**: adding a prefix narrows nothing, it only adds coverage. A land
whose changed paths match no prefix logs `no verify suite matched` and proceeds — that is
deliberate. There is no repo-wide suite, the owner chose full auto-merge, and refusing here
would mean a doc-only commit never arrives.

## A blocked land

On a park, `pp-land` writes `tooling/boss/state/lands/land-<slug>.blocked` with
`workspace=`, `branch=`, `reason=`, `attempts=` and `at=`, changes nothing else, and leaves
the workspace alone. `pp-work claim` and `pp-work list` both surface the count.

If the park was a conflict and any conflicted path is under `infra/`, `scripts/`,
`.github/`, `tooling/boss/`, or matches `apps/*/wrangler.toml`, the entry records
`reason=deploy-live-conflict` and `no_auto_resolve=1`. Those paths reach production through
`vps-sync.sh`'s 15-minute pull, so an automatic resolution would publish a guess. The land
simply waits.

## Environment

| Variable | Default | Use |
|---|---|---|
| `PPLAND_LANDING` | `$HOME/kb-scratch/landing/<repo>-<hash8>` | the landing tree |
| `PPLAND_STATE_ROOT` | `$HOME/.local/state/pp-land` | mutex, coalesce flag, `land.log` |
| `PPLAND_LANDS_DIR` | `<main>/tooling/boss/state/lands` | blocked entries |
| `PPLAND_VERIFY_MAP` | `<main>/tooling/cli/pp-land/verify-map.tsv` | the map |
| `PPLAND_GREENLIGHT` | `<main>/tooling/cli/greenlight/greenlight` | the gate |
| `PPLAND_PPWORK` | `<main>/tooling/cli/pp-work/pp-work` | workspace removal |
| `PPLAND_SWEEP` | unset | executable run after the mutex is released |
| `PPLAND_MAX_CYCLES` | `12` | coalesce-loop backstop |

## The gate

```
bash tooling/cli/pp-land/test-pp-land.sh
```

Eight behavioural cases against a real bare remote in a `mktemp -d` sandbox with a
sandboxed `HOME`; it never touches the real origin. `PPLAND_TEST_KEEP=1` leaves the sandbox
behind, which is the only way to read a detached land's log after a failure.

Cases 6 and 7 are the load-bearing pair. Case 6 is the coalescing window above. Case 7 is a
golden test: it runs `greenlight` **without** `--worktree` against a stub pool and asserts
the lease was taken *and* returned and that the retry path did **not** re-verify. boss
depends on that path for every merge, and the re-verify-on-retry is gated on `--worktree` on
purpose — making it unconditional would change boss's merge timing without anyone asking.

Case 5 is the one most likely to regress under a future "tidy the landing tree" change: it
proves `-x` did not run, which is what keeps credentials and `node_modules` present for the
verify.
