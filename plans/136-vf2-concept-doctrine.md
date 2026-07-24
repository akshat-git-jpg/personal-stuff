---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui:
deploy:
needs: [after 134-vf2-scaffold]
---

# Plan 136: v2 concept/through-line pre-pass + doctrine rules + storyboard self-audit

## Summary

- **Problem statement**: v1's cue pass is purely local — it never asks "what is this video's one argument, and what recurs?" — and nothing checks that a chosen graphic ENACTS its clause rather than labelling it. These are Loop Studio's Law 0 and the enact-don't-label discipline (spec deltas A + D), ported here as prompts + machine gates, not prose taste.
- **Goals**: (1) new step `018-concept-pass-llm` producing `concept.json` (thesis, frame, through-line, register spans) with a deterministic linter; (2) cue-pass prompt consumes the concept and emits per-cue `register`; (3) new lint rules E8/W8; (4) new step `035-cue-audit-llm` — the "mute test" self-audit writing `audit.json` before the owner board.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — owner directive 2026-07-24 (all-agy), overriding the rules.md prompt-content→claude-p default.
- **Done criteria**: check.sh green with 2 new test files; run.sh gains `concept-pass` + `audit` verbs; check-rulebook still passes.
- **Stop conditions**: schema conflicts with cues.json consumers; any v1/card-library edit.
- **Test / verification for success**: `node --test` fixtures for lint-concept + new cue-lint rules; run.sh smoke.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`; report status in your run summary.
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/visuals-flow-2/steps pipelines/video/visuals-flow-2/lib`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 134 (folder); coexists with 135 (merge-order safe: touches different lint rule IDs; if both edit `lib/lint-cues.mjs`/`cue-constants.mjs`, boss resolves the concat at rebase per the check.sh-collision precedent)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

Loop Studio's craft comes from front-loading judgment: name the ONE core idea + a recurring motif BEFORE authoring, then make every graphic DO the idea (creative-standard "Law 0" + the 10 laws), gated by a falsifiable self-audit ("mute the audio, hide captions — do the moving objects still communicate?"). visuals-flow's advantage is that its rules are machine-enforced. This plan ports the doctrine INTO that enforcement: the concept is a linted artifact, registers are validated data, and the audit is a cheap LLM pass whose output the board surfaces. Reference for the plan author was `~/.claude-personal/skills/loop-studio/editors/creative-standard.md` (proprietary — ideas ported, no text copied).

## Current state (paths in `pipelines/video/visuals-flow-2/`)

- LLM steps are prompt files the session fills and pastes: `steps/020-cue-pass-llm/cue-pass-prompt.md` opens with a schema block, then `<!-- BEGIN GENERATED CONSTRAINTS ... -->` rendered by `node lib/build-prompt.mjs` from `lib/cue-constants.mjs`; `lib/check-rulebook.mjs` fails when they drift. `run.sh cue-pass` prints prompt-assembly instructions (see the `cue-pass)` case in run.sh — mirror that pattern for new verbs).
- `cues.json` schema is owned by `PIPELINE.md` ("change it in one place only"). Cue fields today: id, card, anchor, lead, hold, variables, beats[], flagged.
- Anchor resolution: `lib/resolve.mjs#findPhrase(W, phrase, from)` — forward-only ≥3-word verbatim match; reuse it for concept register spans.
- Pre-flight: `node lib/feedback-status.mjs` must exit 0 before any cue/shot pass (unfolded feedback blocks new passes).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Rulebook sync | `node lib/build-prompt.mjs && node lib/check-rulebook.mjs` | exit 0 |
| Verb smoke | `bash run.sh test concept-pass` | prints prompt-assembly instructions, exit 0 |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/`):
- `steps/018-concept-pass-llm/` (new: README.md + concept-pass-prompt.md)
- `steps/035-cue-audit-llm/` (new: README.md + audit-prompt.md)
- `lib/lint-concept.mjs` + test (new); `lib/lint-cues.mjs`, `lib/cue-constants.mjs`, `lib/lint.test.mjs`
- `steps/020-cue-pass-llm/cue-pass-prompt.md` (add {{CONCEPT}} section + register/marker rules; regenerate GENERATED block)
- `steps/020-cue-pass-llm/RULEBOOK.md` (append the doctrine rules with WHY)
- `run.sh` (verbs `concept-pass`, `audit`), `scripts/check.sh` (register tests), `PIPELINE.md` (schemas)

**Out of scope**: v1, card-library (register VARIANTS of cards are plan 137), board display of audit.json (plan 140), `lib/resolve.mjs` timing.

## Git workflow

- Branch: `advisor/136-vf2-concept-doctrine`. Commit per step. Do NOT push.

## Steps

### Step 1: concept.json schema + linter

Schema (add to `PIPELINE.md`):

```json
{
  "video": "<slug>",
  "thesis": "one-sentence ARGUMENT (not the topic) the whole video makes",
  "frame": "the plain-language analogy that makes the hardest idea digestible",
  "throughline": {
    "name": "short id, e.g. the-race-track",
    "description": "the recurring visual object/motif",
    "evolution": "how it changes from first to last appearance"
  },
  "registers": [
    { "from_anchor": "verbatim >=3 words", "to_anchor": "verbatim >=3 words", "register": "dark" }
  ]
}
```

`lib/lint-concept.mjs` (CLI: `node lib/lint-concept.mjs <slug-or-path>`, uses `resolveWorkdir`): errors when — a required field is missing/empty; `thesis` > 200 chars or lacks a verb-bearing claim (heuristic: reject if it has no space, or is only a noun phrase ending without any of a small stop-set of copulas/verbs — implement as: must contain at least 6 words); `register` not `dark|light`; any anchor unresolvable via `findPhrase` (import from `./resolve.mjs`) or spans out of order/overlapping. Exit 1 with messages, 0 clean.

Test `lib/lint-concept.test.mjs` with an inline words fixture: clean pass; missing throughline; bad register; overlapping spans; unresolvable anchor.

**Verify**: `node --test lib/lint-concept.test.mjs` → pass.

### Step 2: concept-pass prompt + verb

`steps/018-concept-pass-llm/concept-pass-prompt.md` — self-contained (no repo access), placeholders `{{TRANSCRIPT}}` and `{{SEGMENTS}}`. Content to author (own wording, these exact rules):
- Output ONLY concept.json content matching the schema (inline the schema).
- Thesis = the argument with tension, never "an overview of X".
- Frame = one plain-language analogy that decides how the hardest section gets shown.
- Through-line = ONE concrete visual object that can recur and EVOLVE across the video; name what changes at each recurrence.
- Registers: segment the video into dark (problem/tension) and light (solution/win) spans using verbatim anchors from the transcript; spans must be ordered, non-overlapping, and cover at least 80% of narration.

`steps/018-concept-pass-llm/README.md`: inputs (`transcript.json`, `segments.json`), output `concept.json` (committed), gate `node lib/lint-concept.mjs <slug>` must exit 0 before 020.

`run.sh`: add `concept-pass)` case printing assembly instructions (pattern-match the existing `cue-pass)` heredoc: prompt path, `node lib/transcript-text.mjs $slug`, `cat videos/$slug/segments.json`; post-step: `node lib/lint-concept.mjs $slug`). Keep the case list in usage() updated.

**Verify**: `bash run.sh test concept-pass` prints the instructions and exits 0; `bash scripts/test-run-sh.sh` → pass.

### Step 3: cue pass consumes the concept

`steps/020-cue-pass-llm/cue-pass-prompt.md` (hand-edited sections only; never touch the GENERATED block by hand):
- New placeholder section `## Whole-video concept` containing `{{CONCEPT}}` (the concept.json content) with rules: every cue must serve the thesis (drop decorative cues); the through-line motif should recur — when a cue hosts the motif, say so in a new optional cue field `"motif": true`; each cue carries `"register": "dark" | "light"` matching the register span its anchor falls in (deviate only with a one-line reason in a new optional `"register_why"`).
- Marker rule: cards whose catalog entry declares `marker` support (plan 137 adds them; the rule is forward-compatible) take at most ONE `variables.marker` word, verbatim from the clause.
- Update `run.sh cue-pass` heredoc to list `videos/$slug/concept.json → {{CONCEPT}}` as input #5 and `node lib/lint-concept.mjs $slug` as an added pre-flight beside feedback-status.

`PIPELINE.md` cues.json schema: add optional `register`, `register_why`, `motif`, `marker` (in variables) field docs.

`lib/cue-constants.mjs` + `lib/lint-cues.mjs`:
- **E8** (error): cue `register` present but not `dark|light`; or `concept.json` exists and a cue's anchor-resolved start falls inside a register span whose register ≠ cue.register AND no `register_why` given.
- **W8** (warning): `concept.json` exists but fewer than 2 cues carry `motif: true` (the through-line never recurs).
- Add constants `MOTIF_MIN: 2` with rule prose; regenerate prompt (`node lib/build-prompt.mjs`).
- lint-cues loads `concept.json` when present; all new checks are no-ops when it's absent (backwards compatible with old workdirs).

`steps/020-cue-pass-llm/RULEBOOK.md`: append a dated section "2026-07-24 doctrine port (spec delta A)" recording WHY: enact-don't-label, one argument per video, registers, single marker word — 4 short entries in the file's existing style.

Tests in `lib/lint.test.mjs`: E8 mismatch fires; register_why suppresses it; W8 fires at 1 motif cue, quiet at 2; all quiet with no concept.json.

**Verify**: `node --test lib/lint.test.mjs && node lib/check-rulebook.mjs` → pass.

### Step 4: storyboard self-audit (mute test)

`steps/035-cue-audit-llm/audit-prompt.md` — self-contained; placeholders `{{TRANSCRIPT}}`, `{{CUES}}` (resolved.json content), `{{CATALOG_PURPOSES}}` (slug→purpose lines). Instructions to author: for EVERY cue, answer the mute test — "with audio muted and captions hidden, would the moving object alone communicate this clause's idea?" — as `verdict: "enacted" | "labelled"`, plus `fix` (one sentence: the enacted alternative, naming a catalog slug when one fits, else `bespoke`). Output ONLY:

```json
{ "video": "<slug>", "items": [ { "id": "c01", "verdict": "labelled", "fix": "..." } ] }
```

`steps/035-cue-audit-llm/README.md`: runs AFTER 030 resolve+lint, BEFORE the 040 owner board; output `audit.json` committed; a `labelled` verdict is advisory (owner decides on the board — plan 140 displays it).

`run.sh`: add `audit)` verb printing assembly instructions (inputs: resolved.json, transcript text, `node -e` one-liner extracting slug+purpose pairs from `../card-library/catalog.json` — inline the exact one-liner in the heredoc).

**Verify**: `bash run.sh test audit` exits 0; `bash scripts/test-run-sh.sh` → pass.

### Step 5: register + gate

Add `lib/lint-concept.test.mjs` to `scripts/check.sh`'s list.

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

Fixture-driven `node --test` for lint-concept and the new E8/W8 rules; run.sh smoke via existing `scripts/test-run-sh.sh`; check-rulebook guards prompt/constants sync. No LLM calls in tests — prompts are artifacts, their linters are the testable surface.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0
- [ ] `ls steps/018-concept-pass-llm steps/035-cue-audit-llm` → prompt + README each
- [ ] `bash run.sh x concept-pass; bash run.sh x audit` → both print instructions, exit 0
- [ ] `grep -n "E8\|W8" lib/lint-cues.mjs` → both present; `node lib/check-rulebook.mjs` → exit 0
- [ ] `grep -n "register" PIPELINE.md` → cues.json schema documents the new fields

## STOP conditions

- A cues.json field addition breaks an existing consumer test (board/resolve/edit-delta) in a way not fixable by treating the field as optional — report, don't redesign the schema.
- Any edit needed in v1 or card-library.

## Maintenance notes

- Plan 137's catalog `register`/`marker` metadata is what makes E8 enforceable at the card level; until then E8 checks the cue field against concept spans only.
- Plan 140 renders audit.json verdicts on the board; keep the items array keyed by cue id.
- The 060 fold owns RULEBOOK evolution; this plan seeds the doctrine entries.
