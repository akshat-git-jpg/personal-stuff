<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["Independent of 124/125/126"]
---

# Plan 127: One front door — `run.sh <slug> <step>` dispatches the whole pipeline

## Summary

- **Problem statement**: There is no `package.json`, no Makefile and no driver. `lib/` holds 26 non-test modules, 17 of them separately runnable CLI entrypoints, and `PIPELINE.md` names a runnable command exactly once. Operating the pipeline means opening the right one of ten step READMEs and copying a command out of it.
- **Goals**:
  - Add `visuals-flow/run.sh`: one dispatcher with named steps, wrapping the per-step `run.sh` scripts that already exist.
  - Make it print the pipeline's real state for a slug (which artifacts exist, which gate is next) so an operator can see where a video is.
  - Exercise every entrypoint on every run, closing the class of bug where a shipped CLI block has never once executed.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — fully inlined shell work against existing scripts, the default row in `tooling/boss/data/rules.md`.
- **Done criteria** (terse — full list below): `bash run.sh test-02 status` reports state; every named step dispatches the right existing script; unknown step exits 2 with usage; `bash scripts/check.sh` green.
- **Stop conditions** (terse — full list below): suite red before starting; any step's underlying script needs modifying; anything under `videos/` gets written outside an explicitly requested step.
- **Test / verification for success**: a bats-free shell test asserting dispatch mapping and the status output, run from `scripts/check.sh`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat be36087..HEAD -- pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/scripts pipelines/video/visuals-flow/PIPELINE.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `be36087`, 2026-07-22

## Why this matters

This is the part the owner feels daily. It also has a concrete failure record: `lib/plan-skeleton.mjs` shipped in PR#78 with a path bug in its CLI block that made the command fail on every invocation. Its tests covered the exported functions and passed. The CLI block had never been executed even once, and nothing in the repo forced it to be. Found and fixed on 2026-07-22, commit `88c2f71`.

With 17 independent front doors, that will happen again. One driver that operators actually use means every entrypoint gets exercised on every real run.

## Current state

### The per-step scripts already exist

```
steps/010-transcribe-run/run.sh
steps/030-resolve-run/run.sh
steps/040-storyboard-review-owner/run.sh
steps/050-render-run/run.sh
steps/080-avatar-render-run/run.sh
steps/090-assemble-run/run.sh
steps/095-resolve-export-run/run.sh
```

Each is a thin wrapper, verbatim examples:

```sh
node lib/resolve.mjs "$@"
node lib/board.mjs "$@"
node lib/render.mjs "$@"
exec node lib/assemble.mjs "$@"
exec node lib/avatar-render.mjs "$@"
exec node lib/export-timeline.mjs "$@"
```

`steps/010-transcribe-run/run.sh` wraps `node lib/transcribe-groq.mjs "$workdir"`.

Steps 020, 060 and 070 have NO `run.sh` and must not get one: they are LLM/owner steps, not commands.

### The steps with no script, and what they need instead

- `020-cue-pass-llm` — an LLM step. The driver's job is to print the three inputs the operator must assemble (`node lib/plan-skeleton.mjs <slug>`, `node lib/transcript-text.mjs <slug>`, the catalog) and stop.
- `040-storyboard-review-owner` — has a `run.sh` (the board) but is a HUMAN gate. The driver starts the board and stops; it must never mark the gate passed.
- `060-feedback-fold-opus` — Opus-class owner step. The driver prints the pre-flight (`node lib/feedback-status.mjs`) and stops.
- `070-shot-pass-llm` — an LLM step, same handling as 020.

### The fix-loops documented in the step READMEs, verbatim

- 030: `node lib/resolve.mjs <slug> && node lib/lint-cues.mjs <slug>`
- 070: `node lib/resolve-shots.mjs <slug> && node lib/lint-shots.mjs <slug>`

### The artifacts that mark progress, per `PIPELINE.md`

Inside `videos/<slug>/`: `transcript.json`, `segments.json`, `cues.json` (with `approved`), `cues.llm.json`, `resolved.json`, `shots.json`, `effects.json`, `renders/`, `manifest.md`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, ends `visuals-flow check OK` |
| Driver status on a finished video | `cd pipelines/video/visuals-flow && bash run.sh test-02 status` | exit 0, prints a per-artifact table |
| Driver usage | `cd pipelines/video/visuals-flow && bash run.sh` | exit 2, prints step list |
| Unknown step | `cd pipelines/video/visuals-flow && bash run.sh test-02 bogus` | exit 2, names the bad step |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/run.sh` (new)
- `pipelines/video/visuals-flow/scripts/test-run-sh.sh` (new)
- `pipelines/video/visuals-flow/scripts/check.sh` (wire the new test in)
- `pipelines/video/visuals-flow/PIPELINE.md` (document the driver as the entry point)

**Out of scope**:
- Every file under `lib/`. This plan adds a dispatcher; it changes no module.
- Every existing `steps/*/run.sh`. Wrap them, do not edit them.
- Step READMEs. They stay as the detailed per-step docs; the driver does not replace them.
- Adding a `package.json`. The repo runs these as plain scripts; introducing npm here is a separate decision the owner has not made.
- `videos/**` — the driver reads workdirs for `status`, and only writes when a step is explicitly requested.

## Git workflow

- Branch: `advisor/127-visuals-flow-driver`
- Commit: `visuals-flow: single driver script for the whole step chain` — no AI footers. Do NOT push.

## Steps

### Step 1: Write `run.sh`

Create `pipelines/video/visuals-flow/run.sh`, executable, `set -euo pipefail`, resolving its own directory so it works from any cwd:

```sh
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
```

Usage: `run.sh <slug> <step>`. With no arguments, or with `-h`/`--help`, print the step list and exit 2.

Implement these steps exactly:

| step | action |
|---|---|
| `status` | print the artifact table (Step 2) |
| `transcribe` | `bash steps/010-transcribe-run/run.sh "$slug"` |
| `cue-pass` | print the 020 input recipe (Step 3), exit 0 |
| `resolve` | `node lib/resolve.mjs "$slug" && node lib/lint-cues.mjs "$slug"` |
| `board` | `bash steps/040-storyboard-review-owner/run.sh "$slug"` |
| `render` | `bash steps/050-render-run/run.sh "$slug"` |
| `fold` | `node lib/feedback-status.mjs`, then print that 060 is an owner step, exit 0 |
| `shot-pass` | print the 070 input recipe (Step 3), exit 0 |
| `shots` | `node lib/resolve-shots.mjs "$slug" && node lib/lint-shots.mjs "$slug"` |
| `avatar` | `bash steps/080-avatar-render-run/run.sh "$slug"` |
| `assemble` | `bash steps/090-assemble-run/run.sh "$slug"` |
| `export` | `bash steps/095-resolve-export-run/run.sh "$slug"` |
| `qc` | `bash scripts/qc-video.sh "$slug"` |

Any other value: print `unknown step: <value>` plus the step list, exit 2.

Do NOT add an `--all` or `all` step. The chain has three human gates (owner approval at 040, the Opus-only fold at 060, live HeyGen at 080) and a driver that walks past them would be actively dangerous. State this in a comment at the top of the file so nobody adds it later.

**Verify**: `cd pipelines/video/visuals-flow && bash run.sh` -> exit 2, prints every step name above

### Step 2: Implement `status`

For the given slug, print one line per artifact: present or missing, and for `cues.json` also whether `approved` is true. Read `approved` with node, not grep:

```sh
node -e "const c=require('./videos/$slug/cues.json');console.log(c.approved?'approved':'NOT approved')"
```

End with one line naming the next action, chosen by the first unmet condition in this order:

1. no `transcript.json` -> `next: run.sh <slug> transcribe`
2. no `segments.json` -> `next: create segments.json (see steps/020-cue-pass-llm/README.md)`
3. no `cues.json` -> `next: run.sh <slug> cue-pass`
4. no `resolved.json` -> `next: run.sh <slug> resolve`
5. `cues.json` not approved -> `next: run.sh <slug> board  (OWNER GATE)`
6. no `renders/` -> `next: run.sh <slug> render`
7. no `shots.json` -> `next: run.sh <slug> shot-pass`
8. otherwise -> `next: run.sh <slug> assemble`

If the workdir does not exist, print `no workdir: videos/<slug>` and exit 1.

**Verify**: `cd pipelines/video/visuals-flow && bash run.sh test-02 status` -> exit 0, table plus a `next:` line. Then `bash run.sh nosuchvideo status` -> exit 1, prints `no workdir: videos/nosuchvideo`

### Step 3: The LLM-step recipes

For `cue-pass`, print exactly these lines (they are the real 020 inputs, taken from `steps/020-cue-pass-llm/README.md` and `cue-pass-prompt.md`):

```
020 is an LLM step, not a command. Assemble the prompt:
  1. steps/020-cue-pass-llm/cue-pass-prompt.md   (the prompt; fill its placeholders)
  2. node lib/plan-skeleton.mjs <slug>           -> {{SKELETON}}
  3. node lib/transcript-text.mjs <slug>         -> {{TRANSCRIPT}}
  4. ../card-library/catalog.json                -> {{CATALOG}}
Pre-flight: node lib/feedback-status.mjs must exit 0.
After the cue pass: run.sh <slug> resolve
```

For `shot-pass`, print the equivalent for `steps/070-shot-pass-llm/shot-pass-prompt.md`, noting the fix-loop is `run.sh <slug> shots`.

Substitute the real slug into these lines.

**Verify**: `cd pipelines/video/visuals-flow && bash run.sh test-02 cue-pass` -> exit 0, prints the recipe with `test-02` substituted

### Step 4: Write the dispatch test

Create `scripts/test-run-sh.sh`, plain bash, no framework, exiting non-zero on the first failure. Assert:

- `bash run.sh` exits 2
- `bash run.sh test-02 bogus` exits 2 and its output contains `unknown step`
- `bash run.sh nosuchvideo status` exits 1
- `bash run.sh test-02 status` exits 0 and its output contains `next:`
- `bash run.sh test-02 cue-pass` exits 0 and its output contains `plan-skeleton`
- for each dispatching step name, `run.sh` contains the expected underlying command. Grep the script text rather than executing these; running `render` or `avatar` in a test would burn real time and, for `avatar`, real money.

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` -> exit 0

### Step 5: Wire the test in and document the driver

Add `bash scripts/test-run-sh.sh` to `scripts/check.sh`, matching its existing style.

In `PIPELINE.md`, add a short section immediately after the step-chain description: the driver is the entry point, `bash run.sh <slug> status` shows where a video is, and each step's README remains the detailed reference. Do not restate the step table.

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` -> exit 0, output includes the run.sh test

## Test plan

`scripts/test-run-sh.sh` is the product's guard. It deliberately tests dispatch by inspecting the script rather than executing expensive steps, which keeps it fast enough to sit in the merge gate.

## Done criteria

- [ ] `run.sh` exists, is executable, and works from any cwd
- [ ] Every step in the table dispatches to the listed command
- [ ] No `all` step exists, and a comment explains why
- [ ] `bash run.sh test-02 status` prints the artifact table and a `next:` line
- [ ] `bash run.sh nosuchvideo status` exits 1
- [ ] Unknown step exits 2 naming the bad step
- [ ] `bash scripts/test-run-sh.sh` exits 0
- [ ] `scripts/check.sh` runs it
- [ ] `PIPELINE.md` names the driver as the entry point

## STOP conditions

- `bash scripts/check.sh` is already red before you start. Report and stop.
- A step needs its underlying `lib/` module or `steps/*/run.sh` changed to work through the driver. Stop and report: that is a bug worth seeing on its own, not something to paper over inside a dispatcher.
- You are about to run `render`, `avatar`, `assemble` or `export` against a real slug while testing. Do not. `avatar` submits to live HeyGen and costs money, and the pipeline rule is that live HeyGen is owner-triggered only.
- You are about to add an `all` / `--all` step. It is forbidden by this plan.
- Anything under `videos/` changes while you are testing. Stop and revert: `videos/opusclip-tutorial/` in particular is mid-review by the owner.

## Maintenance notes

- A new step means one row in the dispatch table plus one assertion in the test. Keep the driver a dispatcher: any real logic belongs in `lib/`.
- The `next:` ordering in Step 2 encodes the pipeline's gate order. If the chain changes, that ladder is the thing to update.
