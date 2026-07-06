# Captain backlog

Owner-visible. Printed at session start.

## Landed 2026-07-06 / 07

- The five items from the 2026-07-06 greenlight review of cap/link-clis — all
  fixed and on `main`: yt-claude relay token + dropped CORS; escrow-backup trap
  wipes the tarball; cap-session-start whole-field tmux match + `stat -c %Y`
  fallback; `wt get` auto-resets & reclaims dirty orphaned slots.
- `cap/land-plumbing` — parallel-dispatch plumbing: cap-spawn per-lane model
  default (agy → Gemini, no more forced sonnet); new `bin/cap-land.sh`
  (detach → greenlight → teardown in one command); `decisions.md merge=union`;
  greenlight untracked-tolerant busy-check. See `decisions.md` 2026-07-07.

## Open

- **cap-watch fragility (observed 2026-07-07).** The in-session background
  `cap-watch.sh` was killed twice this session — the wake watcher doesn't stay
  alive reliably in this harness. Folds into the `captain-lifecycle` officer's
  Fix 2 (a watchdog that outlives the session). Until then: poll `cap-state`
  directly when actively watching a task.

## Parked (ready to spawn)

- **`captain-lifecycle` (officer)** — crash-recovery & multi-instance, per the
  Fable-corrected spec at `data/captain-lifecycle/fable-review.md`. Planning →
  owner `/plan-review` gate → implement. Owner parked it 2026-07-06; resume on
  owner's word.
