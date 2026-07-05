# greenlight

A validation pipeline that takes a finished change on a branch and lands it on main hands-free when it deserves it.

## Contract

`greenlight run --branch <name> [--repo <path>] [--intent "<text>"] [--skip <stage,stage>] [--no-land] [--reviewer-model sonnet]`
`greenlight status <run-id>`

Token economy: agent stages pass `--model <model>` to `claude -p`, defaulting to `sonnet`. `--skip review` is a first-class path for plan-verified work so verification is not double-paid.

## Stages (in order)

1. **rebase**: Fetch and rebase onto `origin/main`. Empty diff short-circuits to `landed`.
2. **review**: Agent scans codebase for bugs and risks. Assigns `risk_level` (low/medium/high) and actions (`auto-fix`, `ask-user`, `no-op`). Up to 3 auto-fix rounds.
3. **test**: Runs repo checks (`./scripts/check-apps.sh` and app-specific tests) and end-to-end intent verification. Collects evidence into `$EVIDENCE_DIR`. Up to 1 auto-fix round.
4. **docs**: Updates stale documentation (READMEs, CLAUDE.md, global infra docs) mechanically.
5. **lint**: Runs `bash -n` and `py_compile` on changed files. Up to 1 fix round.

## Land Conditions

**Land** iff ALL of the following are true:
- review left no unresolved `error` or `ask-user` findings
- risk is `low` or `medium`
- test `passed: true`
- docs `unresolved` is empty
- lint is green
- `--no-land` is not set
- The main checkout is clean and on `main` branch.

Landing does `git merge --no-ff <branch>` followed by `git push origin main`, then notifies via `pp-ntfy`.

## Park Semantics

**Park**: If any land condition fails, state becomes `parked`. A `parked-reason` file is written, and `pp-ntfy` is called.
`risk_level: high` ALWAYS parks regardless of findings.
If the main checkout is busy, it parks with `main checkout busy` (never stashes or switches).

## Evidence Location

State and evidence live in `~/kb-scratch/greenlight/<run-id>/`.

## Design Provenance

Adapted from `kunchenguid/no-mistakes` (studied 2026-07-06).
- Kept: fresh one-shot agent per stage, `auto-fix`/`ask-user`/`no-op` finding triage, reviewer-assigned risk (high always parks), empty-diff short-circuit, evidence artifacts.
- Dropped: remote proxy, daemon, SQLite, PR machinery, CI babysitting.
- Changed: local merge + push instead of PR, intent from commits instead of transcripts.
