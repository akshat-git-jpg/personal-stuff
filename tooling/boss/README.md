# boss — PR-driven implementation orchestrator

The successor to `captain` (frozen/deprecated). Three roles:

| Role | Is a… | Job |
|---|---|---|
| **orchestrate** | skill | brainstorm + write a self-contained plan into `plans/` |
| **secretary** | skill | `raise` a `boss:ready` PR carrying the plan; `groom` open PRs |
| **boss** | session here | route ready PRs → dispatch crew → verify → merge → deploy |

Boss reads only the plan's YAML frontmatter (never the prose), dispatches a crew
(executor) in an isolated `wt` worktree, verifies via the plan's `test_cmd`, and
lands via `greenlight`. It holds routing state only — never brainstorm or
implementation context.

## File map

```
tooling/boss/
  CLAUDE.md              # boss's operating manual (session reads this)
  README.md              # this file (human orientation)
  bin/
    boss-lib.sh          # shared helpers (sourced by every script)
    boss-session-start.sh  # ledger + list boss:ready + reconcile in-flight
    boss-dispatch.sh     # flip label, merge main, lease wt, invoke executor
    boss-state.sh        # status of one/all in-flight PRs
    boss-merge.sh        # rebase + test_cmd re-run + greenlight merge + notify
    boss-deploy.sh       # gated post-merge deploy on main checkout + notify
  executors/
    claude-p.sh          # backgrounded claude -p (default model: sonnet)
    agy.sh               # Antigravity CLI (default model: Gemini 3.1 Pro (High))
  data/
    rules.md             # task-type → executor+model defaults (secretary input)
  state/                 # gitignored: PID cache only
```

## Reused tools (not boss code — standalone CLIs in `tooling/cli/`)

- **greenlight** — `greenlight run --branch <b> --verify "<cmd>"`. Rebase, verify, land.
- **wt** — `wt get --holder <h>` leases an isolated worktree; `wt return <path>` releases.
- **notify** — `notify send "<msg>"` (Telegram-first).

## Design

Full spec: `docs/specs/2026-07-07-boss-design.md`.

Boss shares **no code** with captain (`tooling/captain/` is frozen, not deleted).
