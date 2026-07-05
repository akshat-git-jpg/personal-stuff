---
name: personal-stuff-validation-and-qa
description: Use before claiming any work in personal-stuff is done, fixed, or shippable — deciding what to run (typecheck, guard tests, smoke test, site probe), whether new code needs tests at all, how to verify a deploy or an executor's diff, or when tempted to skip checks because the change "is tiny". Also use when adding a config/def to a generic engine.
---

# Validation and QA

## Overview

The bar here is **"verified working", not "tests pass"** — this repo skips TDD by design but never skips evidence. Claiming done without running the thing is the violation. (General discipline: `superpowers:verification-before-completion`; this skill is what "verify" concretely means HERE.)

## The verification ladder (run what applies, in order)

| Level | Command | Applies to |
|---|---|---|
| 1. Static | `./scripts/check-apps.sh` — runs each app's `typecheck` (`tsc -b` on TS), `check` (`node --check` on JS), `lint`, `test` if present, + `bash -n` on shell scripts | any app change; CI-equivalent gate |
| 2. Unit/guard | the app's `npm test` (vitest: tutorial-tracker-app ~64 tests incl. `engine.test.ts` as of 2026-07-05; lists-app; founders-tracker; redirector `--passWithNoTests`) | apps with suites |
| 3. Smoke | run it and do one real user action (`npm run dev:local`, or the cron's `run.sh`, or the pipeline script on real input) | everything |
| 4. Deploy | `./scripts/probe-sites.sh` + a real action on the live URL | after any deploy — see **personal-stuff-deploy-and-operate** |

`KNOWN_FAILING` in check-apps.sh (analytics-app:lint, tutorial-tracker-app:lint) is deliberate — don't "fix" the mask without fixing the lint.

## The guard-test rule (the one mandatory test class)

**Any generic/data-driven layer — an engine that renders from configs, defs, or rule sheets — MUST have invariant tests that loop over ALL configs**, so adding a config can't silently break rendering. The owner is not the test harness.

- Model: `apps/tutorial-tracker-app/` — `engine.test.ts` + plan 022's round-trip/routing guard over every `PipelineDef`.
- Hard-won sub-rule (runs ledger LESSONS.md): **the guard's schema must derive from the engine itself**, not a hand-copied schema — a hand copy produced a false-positive BLOCKED in the workflow-audit run.
- Adding a new system/def and NOT extending/running the guard = incomplete work, full stop.

## Verifying executor output (orchestrate runs)

You review a diff, not a claim. From `plans/WORKFLOW.md` + the `orchestrate` skill:
1. Verify criteria must be **machine-checkable**; run them, don't trust the ledger's DONE line blindly.
2. **Scope check**: changed file names ⊆ the plan's in-scope list.
3. Subjective output? Score against the plan's explicit rubric — never taste.
4. **Baseline-red STOP** (LESSONS.md): if verification fails before the executor's change, stop and fix the baseline first — don't let the executor chase a pre-existing failure.
5. Cap discipline: surface to the human once the caps are hit (the numbers live in **personal-stuff-change-control** Gate 1).

## Pre-commit

Use the existing `commit-now` skill (prettier/lint/tsc/build gate + conventional commit; never pushes). Commit format in use: `type(scope): subject`; plan completions as `chore(plans): mark Plan NNN DONE`.

## Rationalization table

| Excuse | Reality |
|---|---|
| "Change is too small to smoke test" | Level 3 takes a minute; the gym-app/kushal-docs route-strip bug ships invisibly on "small" deploys |
| "Typecheck passed, so it works" | Typecheck is level 1 of 4; the stale-`dist/` gotcha makes even a running app lie to you |
| "The executor's ledger says DONE" | Ledgers record claims; run the Verify commands yourself |
| "I'll add the guard case later" | The engine exists precisely so configs can't ship unguarded; later = never |
| "Lint was already failing, not my problem" | Correct — that's the KNOWN_FAILING mask. But baseline-red on typecheck/tests = STOP |

## When NOT to use this skill

- Writing the plan's Verify section → `orchestrate` skill (readiness gate)
- Deploy mechanics → **personal-stuff-deploy-and-operate**
- A check fails and you don't know why → **personal-stuff-debugging-playbook**

## Provenance and maintenance

Verified against `scripts/check-apps.sh`, app package.json test scripts, `plans/WORKFLOW.md`, `plans/runs/LESSONS.md`, and decisions.md (2026-07-04 uniform verification; 2026-07-05 orchestrate v2.2 rubric rule) on 2026-07-05. Re-verify:
- Ladder level 1: `sed -n '1,30p' scripts/check-apps.sh`
- Test suites: `grep '"test"' apps/*/package.json`
- Executor rules: `grep -n "rubric\|scope check\|self-fix" decisions.md`
