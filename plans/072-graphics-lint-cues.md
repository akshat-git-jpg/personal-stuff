---
executor: agy
model:
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui:
deploy:
needs: ["071 lands first (resolve.mjs ordering); board banner wiring rebases on 069/070"]
---

# Plan 072: lint-cues — machine-enforce the cue-pass rubric (caps, spacing, zones, density)

## Summary

- **Problem statement**: Most of the cue-pass rulebook is enforced only by prompt obedience. The resolver checks anchors/shapes/overlap, but the stat-hit cap, same-card repetition cap, 90s spacing, first-15s/last-20s exclusion zones, reveal word counts, and density cadence are checked by nobody — the owner's eyes catch violations (the 5×stat-hit tic proved it). This blocks trusting cheaper cue-pass executors (the agy trial).
- **Goals**: a deterministic `lib/lint-cues.mjs` (errors = the mandatory caps/zones; warnings = density defaults), CLI + library, surfaced in the board's Save response, documented as the fix-loop gate for step 020.
- **Executor proposed**: agy (standard — every rule is specified with its threshold below).
- **Done criteria** (terse): lint CLI exits 1 on cap/zone violations; test-01 v2 lints with 0 errors; board Save shows warnings; docs updated.
- **Stop conditions** (terse): test-01 v2 fails any HARD rule — report, don't self-downgrade thresholds.
- **Test / verification for success**: new `lib/lint.test.mjs` + lint run on test-01 + `scripts/check.sh`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow/lib pipelines/video/graphics-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 071 (same-file ordering in `lib/`); 069/070 for board.mjs rebase
- **Category**: feature (quality infrastructure)
- **Difficulty**: standard
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

This flow's stated philosophy (steps/060 README, HANDOFF.md): "machine-enforced
surfaces beat prose — prefer encoding a lesson in catalog.json + resolver
validation over a rulebook sentence." Yet the rulebook's own 10-point rubric
(`steps/020-cue-pass-llm/RULEBOOK.md`, "## Rubric") is mostly prose-only:

| Rubric check | Enforced today by |
|---|---|
| 1 valid JSON/schema, 6 slugs exist, 7 beat shapes | resolver `validateCues` ✓ |
| 2 verbatim anchors, 3 script order | resolver `findFrom` ✓ |
| 5 fullframe overlap | resolver ✓ (071 fixes a hole) |
| 4 density bounds | **nobody** |
| 8 reveal ≤6 words | **nobody** (only `max_reveal_chars`) |
| 9 no cue in first 15s / last 20s | **nobody** |
| stat-hit ≤3, ≥90s apart (prompt, "mandatory") | **nobody** |
| same fullframe card ≤3 uses (prompt, "mandatory") | **nobody** |

The gap matters doubly because the cue pass is pluggable (Sonnet default, agy
trial queued — HANDOFF open item 6). A deterministic linter turns every
executor's output into a fix-loop against hard checks instead of relying on
the owner to spot a tic on the board.

## Current state

- `pipelines/video/graphics-flow/lib/resolve.mjs` — exports `validateCues`,
  `resolveCues`, `normWord`. resolveCues output entries:
  `{ id, card, placement, start, duration, variables }`.
- `steps/020-cue-pass-llm/cue-pass-prompt.md` lines 59-65 carry the mandatory
  caps verbatim: "Repetition cap: the same fullframe card at most 3 times per
  video. overlay/stat-hit: max 3 per video, >=90s apart".
- `RULEBOOK.md` "## Cue density" items 1-5: fullframe per 60–120s; overlays ≤1/min;
  no overlap; no cue in first 15s / last 20s; ~18–28 cues per 30 min. The
  section header says these are "starting defaults, not physics" — hence the
  error/warning split below.
- Catalog: `../card-library/catalog.json` — `{ cards: [{ slug, kind, placement, ... }] }`.
- Transcript: flat `[{text, start, end}]`; total runtime = last word's `end`.
- Test exemplars: `lib/resolve.test.mjs` (inline mini-catalog + `wordsFrom` helper).
- Real data: `videos/test-01/` — v2 cues.json (27 cues) which the owner
  considers rule-conforming (stat-hit tic already fixed in v2); it is the
  calibration corpus for this linter.
- Board: `lib/board.mjs handleSave()` responds `{ ok: true, errors: [] }` on
  success; the client `showBanner` displays err banners; ok currently just reloads.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Lint the real video | `cd pipelines/video/graphics-flow && node lib/lint-cues.mjs test-01` | exit 0; warnings allowed on stdout |
| Unit tests | `cd pipelines/video/graphics-flow && node --test lib/lint.test.mjs` | all pass |
| Flow gate | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0 |

## Scope

**In scope**:
- New `lib/lint-cues.mjs` (library + CLI) and `lib/lint.test.mjs`.
- `scripts/check.sh`: add `lib/lint.test.mjs` to the `node --test` list.
- `lib/board.mjs`: include lint warnings in the Save success response; client
  shows them in an ok-banner instead of a bare reload.
- Docs: `steps/020-cue-pass-llm/README.md` (fix-loop), `RULEBOOK.md` Rubric
  note, `steps/060-feedback-fold-opus/README.md` surface list, `PIPELINE.md`
  flow table (030 row mentions lint or a new row — keep it one line).

**Out of scope**:
- Changing any threshold's VALUE beyond what's written here (they belong to the owner via 060).
- `validateCues` / `resolveCues` internals.
- The cue-pass prompt content (no rule text changes needed — the rules exist; this enforces them).

## Git workflow

- Branch: `advisor/072-graphics-lint-cues`
- Commit: `feat(graphics-flow): lint-cues — machine-enforced rubric (caps, spacing, zones, density warnings)` — no AI footers. Do NOT push.

## Steps

### Step 1: `lib/lint-cues.mjs` — the rules

```js
export function lintCues({ cuesFile, resolved, words, catalog }) → { errors: [], warnings: [] }
```

Skip flagged cues everywhere (same convention as the resolver). `byId` join:
lint operates on resolved entries (timing) joined with cues.json entries
(reveal text, card). Total runtime `T = words.at(-1).end`.

**Errors (hard, from the prompt's "mandatory" rules + rubric 9):**

- E1 `stat-hit-cap`: cues with `card === 'overlay/stat-hit'` > 3.
- E2 `stat-hit-spacing`: any two consecutive stat-hit cues (by start) closer
  than 90s.
- E3 `card-repetition`: any FULLFRAME card slug (catalog `placement === 'fullframe'`)
  used more than 3 times.
- E4 `exclusion-zones`: any resolved cue with `start < 15` or
  `start + duration > T - 20`.

**Warnings (density defaults — "starting defaults, not physics"):**

- W1 `fullframe-cadence`: largest gap between consecutive fullframe starts
  > 180s, or two fullframe starts < 45s apart (loose brackets around the
  60–120s target so normal variation stays quiet).
- W2 `overlay-density`: more than 2 overlay cues starting within any rolling
  60s window (the rule says ~1/min; warn at 3 to reduce noise).
- W3 `total-count`: cue count outside `[18, 28] * (T / 1800)` scaled bounds,
  rounded outward (floor/ceil).
- W4 `reveal-wordcount`: any beat reveal `text` field over 6 words or a
  single word (target is 2–6).

Every message names the cue id(s) and the rule key, e.g.
`E2 stat-hit-spacing: c14 starts 41.0s after c12 (minimum 90s)` — these
strings surface on the board banner and in the 020 fix-loop, so they must say
what to change.

CLI (same `resolveWorkdir` slug-or-path convention as the other libs): reads
`cues.json`, `resolved.json`, `transcript.json`, and the catalog; prints
warnings to stdout, errors to stderr; exit 1 iff errors.

**Verify**: `node lib/lint-cues.mjs test-01` -> exit 0 (see STOP conditions if not); warnings, if any, are sensible when read aloud.

### Step 2: Tests

`lib/lint.test.mjs`, using an inline mini-catalog (a fullframe beat card, an
`overlay/stat-hit`-slugged overlay, a plain overlay) and hand-built
resolved/word arrays — no fixtures needed. One test per rule key, positive and
negative:

1. 4 stat-hits -> E1; 3 -> clean.
2. Two stat-hits 60s apart -> E2; 95s apart -> clean.
3. Same fullframe slug 4× -> E3; a 4×-used OVERLAY slug (non-stat-hit) -> no E3.
4. Cue at 10s -> E4; cue ending at T-10 -> E4; comfortably inside -> clean.
5. W3 scaling: T=900s (15 min) with 30 cues -> warning; 12 cues -> clean.
6. W4: 7-word reveal text -> warning.
7. Flagged cues are ignored by every rule.

**Verify**: `node --test lib/lint.test.mjs` -> all pass.

### Step 3: Wire into check.sh and the board

- `scripts/check.sh`: add `lib/lint.test.mjs` to the `node --test` line.
- `board.mjs handleSave()`: after a successful resolve+write, run `lintCues`
  and return `{ ok: true, errors: [], warnings }`. Client: on ok with
  non-empty warnings, `showBanner(warnings.map(escapeForBanner).join('<br>'), 'ok')`
  and delay the reload (e.g. render banner into the reloaded page instead:
  simplest is to skip auto-reload when warnings exist and show the banner with
  a "saved — N lint warnings" prefix; a manual refresh keeps them visible).
  Lint ERRORS do not block a Save (the resolver's errors already gate) — they
  appear in the same banner marked `error:`; blocking stays the render gate's job.

**Verify**: `bash pipelines/video/graphics-flow/scripts/check.sh` -> exit 0.

### Step 4: Docs — make lint the 020 fix-loop gate

- `steps/020-cue-pass-llm/README.md`: after "step 030 resolves", add the loop:
  `node lib/resolve.mjs <slug> && node lib/lint-cues.mjs <slug>` — feed any
  errors back to the same executor and re-run, up to 3 rounds; errors after
  round 3 go to the owner.
- `RULEBOOK.md` "## Rubric": one line noting checks 3–9 and the repetition/
  stat-hit caps are machine-checked by `lib/lint-cues.mjs` (reviewer runs it
  instead of eyeballing those).
- `steps/060-feedback-fold-opus/README.md` step 2: add the surface
  `quantitative selection rule (caps, spacing, zones, density) → lib/lint-cues.mjs thresholds`.
- `PIPELINE.md` flow table: extend the 030 row's out to "… (+ lint gate)".

**Verify**: `node lib/check-rulebook.mjs` (run via check.sh) still passes — required section headings unchanged.

## Test plan

Unit tests per rule (Step 2); calibration run on test-01 v2 (must be 0 errors —
this is the "does the linter agree with owner-approved content" gate); flow
gate `scripts/check.sh`.

## Done criteria

- [ ] `node lib/lint-cues.mjs test-01` exits 0.
- [ ] Each rule E1–E4, W1–W4 has passing positive+negative tests.
- [ ] Board Save surfaces warnings without blocking.
- [ ] 020 README documents the resolve+lint fix-loop; RULEBOOK rubric and 060 surface list updated.
- [ ] `scripts/check.sh` exits 0.

## STOP conditions

- test-01 v2 produces any E-level violation — stop and report the exact
  finding. Either the threshold is wrong or test-01 has a latent rule breach;
  that call is the owner's (via 060), not yours.
- The board client changes conflict structurally with what 069/070 landed —
  stop and report rather than force-merging.

## Maintenance notes

- Thresholds live ONLY in `lib/lint-cues.mjs` as named constants at the top of
  the file; 060 folds future owner feedback by editing those constants + the
  rulebook prose together.
- When the agy cue-pass trial runs (HANDOFF open item 6), compare executors on
  lint output (errors + warnings count) as the objective half of the rubric.
