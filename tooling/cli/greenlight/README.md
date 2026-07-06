# greenlight

A validation pipeline that takes a finished change on a branch and lands it on main hands-free when it deserves it.

## Contract

`greenlight run --branch <name> [--repo <path>] [--intent "<text>"] [--verify "<cmd>" ...] [--review] [--skip <stage,stage>] [--no-land] [--reviewer-model sonnet]`
`greenlight status <run-id>`

The default gate is **deterministic**: `rebase -> verify -> lint -> land`. No LLM sits in the critical path. Deep whole-repo LLM auditing is advisory and belongs to the `improve` skill, not the land gate.

- `--verify "<cmd>"` — a deterministic check run in the worktree. Repeatable; any non-zero exit parks. Pass the project test command plus the brief's verify steps. **No `--verify` means no test gate ran** (the caller owns supplying them).
- `--review` — opt-in LLM code-review pass before verify. Parks on `risk_level: high` or unresolved `error`/`ask-user` findings. Off by default. Use it for risky diffs where a deterministic check can't catch the failure mode.
- `--skip <stage,stage>` — skip named stages. Stage names: `review`, `verify`, `lint`.

Token economy: the review pass (when opted in) passes `--model <model>` to `claude -p`, defaulting to `sonnet`.

## Stages (in order)

1. **rebase**: Fetch and rebase onto `origin/main`. Empty diff short-circuits to `landed`.
2. **review** (opt-in, `--review` only): Agent reviews the branch diff for bugs and risks. Assigns `risk_level` (low/medium/high) and actions (`auto-fix`, `ask-user`, `no-op`); up to 3 auto-fix rounds. `risk_level: high` always parks.
3. **verify**: Runs each `--verify` command in the worktree. Any non-zero exit parks. No LLM.
4. **lint**: Runs `bash -n` and `py_compile` on changed shell/python files. A failure parks (no fix round — the crewmate owns fixing its own syntax).

## Land Conditions

**Land** iff ALL of the following are true:
- (if `--review`) review left no unresolved `error`/`ask-user` findings and risk is `low` or `medium`
- every `--verify` command exited zero
- lint is green
- `--no-land` is not set
- the main checkout is clean and on `main`

Landing does `git merge --no-ff <branch>` followed by `git push origin main`, then notifies via `notify`.

## Park Semantics

**Park**: if any land condition fails, state becomes `parked`, a `parked-reason` file is written, and `notify` is called.
`risk_level: high` ALWAYS parks (under `--review`).
If the main checkout is busy, it parks with `main checkout busy` (never stashes or switches).

Notifications go through tooling/cli/notify (Telegram-first, ntfy fallback).

## Evidence Location

State and evidence live in `~/kb-scratch/greenlight/<run-id>/`.

## Design Provenance

Adapted from `kunchenguid/no-mistakes` (studied 2026-07-06).
- Kept: fresh one-shot agent per stage, `auto-fix`/`ask-user`/`no-op` finding triage, reviewer-assigned risk (high always parks), empty-diff short-circuit.
- Dropped: remote proxy, daemon, SQLite, PR machinery, CI babysitting.
- Changed: local merge + push instead of PR; intent from commits instead of transcripts.
- Changed (2026-07-06): the gate is deterministic by default (`--verify` commands + syntax lint); LLM review became opt-in (`--review`). The old always-on LLM `test`/`docs` stages, plus a JSON-envelope extractor that choked on fenced reviewer replies (falsely parking every land), were what motivated this — see `decisions.md`.
