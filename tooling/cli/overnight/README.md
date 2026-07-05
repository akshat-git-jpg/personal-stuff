# overnight

An orchestrator for capped autonomous improvement loops. `overnight` lets an agent work iteratively on an objective while you sleep, making one verifiable change per iteration.

## Contract

```
overnight run --repo <path> --objective "<text>" [--max-iterations 10] [--max-tokens 1500000] [--stop-when "<condition>"] [--max-consecutive-failures 3]
```

## Cap Semantics

- **`max-iterations`**: Hard limit on the number of loop iterations (default 10). Stops with `iteration-cap`.
- **`max-tokens`**: Hard limit on cumulative input+output tokens (default 1.5M). Stops with `token-cap`.
- **`max-consecutive-failures`**: Loop aborts if this many iterations fail in a row to make a verifiable change (default 3). Stops with `failed`.
- **`stop-when`**: An explicit condition evaluated by the agent. When fully met on a successful iteration, stops with `stop-condition-met`.

## The Morning-Review Protocol

Read `notes.md` and `run.log` as claims, not evidence — review the actual commits.

The agent is FORBIDDEN from committing code. The orchestrator makes commits on its behalf ONLY when the agent claims success, and atomic resets on failure. This ensures the branch history is a clean sequence of incremental changes.

## Recommended First Objectives

- `tutorial-tracker-app`: "find the first usability problem a 7-year-old would hit, fix it, repeat"
- `probe-sites`: DOWN_SITES fixes

## Landing Guidance

After your morning review, land the branch by either:
1. `greenlight run --branch overnight/<slug>-<hash>` for the full validation pipeline.
2. Cherry-picking the commits you want to keep.

## Design Provenance

Adapted from `kunchenguid/gnhf` (studied 2026-07-06).
- Kept: orchestrator-owned git, atomic success/failure resets, externalized memory (`notes.md`), `should_fully_stop` self-evaluation.
- Dropped: moon-phase TUI (replaced by `run.log` and `pp-ntfy`), multi-agent adapters (we just use `claude`), commit-failure repair loop (aborted to preserve work instead).
