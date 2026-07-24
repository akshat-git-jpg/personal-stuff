---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 142: v2 enact enforcement gate + density-constant coherence

## Summary

- **Problem statement**: test-01's first v2 run (2026-07-24) produced 18/19 legacy cards and shipped 13 "labelled" audit verdicts straight to the board — the mute-test audit measures but nothing enforces, the audit prompt hallucinated non-existent card slugs in its fixes, bespoke escalation never fired (0 flagged), and v1's spacing constants (W1 35–60s, W3 ≤1.9/min) contradict v2's ≤20s narration bar, yielding choppy 5-second card pops with warnings both ways.
- **Goals**: (1) a deterministic audit gate — labelled FULLFRAME cues block the board until re-authored; (2) audit prompt constrained to real catalog slugs or `bespoke`; (3) cue-pass prompt flips to enacted-first with a stated reason required for legacy reveal cards, and earlier bespoke escalation; (4) one coherent density constant set.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — standard, fully inlined.
- **Done criteria**: check.sh green; gate fixture tests pass; check-rulebook clean after regeneration.
- **Stop conditions**: gate logic conflicts with feedback-status pre-flight semantics; any card-library/board.mjs/v1 edit.
- **Test / verification for success**: `node --test` fixtures for the gate + updated lint band; check-rulebook.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cbb1cbb..HEAD -- pipelines/video/visuals-flow-2/lib pipelines/video/visuals-flow-2/steps pipelines/video/visuals-flow-2/run.sh`
> NOTE: `pipelines/video/visuals-flow-2/videos/test-01/` may exist UNTRACKED in the tree (a live run) — never stage, edit, or delete anything under `videos/`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (135/136 already landed)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `cbb1cbb`, 2026-07-24

## Why this matters

Loop Studio's discipline works because its self-audit FAILS a video that labels instead of enacting; the v2 port (plan 136) made the audit advisory and the first real run proved advisory ≈ ignored. Same run proved the density constants incoherent: W7 (≤20s narration bar, plan 135) forces ~4 cues/min while W1/W3 still encode v1's 0.55–1.9/min world — the model satisfied W7 with many short static pops and collected W1/W2/W3 warnings it was told to treat as advisory. Owner verdict on the output: "looks bad, similar to visuals-flow 1."

## Current state (paths in `pipelines/video/visuals-flow-2/`)

- `lib/cue-constants.mjs` values today: `CAP_FULLFRAME 3`, `CAP_STAT_HIT 3`, `SPACING_STAT_HIT 90`, `ZONE_END 20`, `GAP_FULLFRAME_MIN 35`, `GAP_FULLFRAME_MAX 60`, `DENSITY_OVERLAY_MAX 3`/`60s window`, `TARGET_RATE_MIN 1.0`, `TARGET_RATE_MAX 1.9`, `BARE_GAP_MAX 50`, plus plan-135/136/138 additions `HOLD_EXTEND_CAP 20`, `GAP_ABSORB 4`, `NARRATION_BARE_GAP_MAX 20`, `MOTIF_MIN 2`, `VARIANT_REPEAT_WINDOW 1`. The header rule: "Never restate a number in prose — add it here and regenerate" (`node lib/build-prompt.mjs`; `lib/check-rulebook.mjs` gates the sync).
- `steps/035-cue-audit-llm/audit-prompt.md` (plan 136): asks for `verdict: "enacted"|"labelled"` + `fix` per cue; today `fix` is free text — the first run's audit invented `overlay/spotlight-click` (no such card).
- `audit.json` shape: `{ "video": "<slug>", "items": [ { "id": "c01", "verdict": "labelled", "fix": "..." } ] }`.
- `steps/020-cue-pass-llm/cue-pass-prompt.md`: bespoke is described as "a deliberate escalation, never the model's first move" (plan 137) — in practice it never fires.
- `run.sh` `board)` dispatches `steps/040-storyboard-review-owner/run.sh`; pre-flight pattern to copy: `node lib/feedback-status.mjs` must exit 0 before cue/shot passes.
- Evidence run (untracked): `videos/test-01/` — 19 cues, audit 6 enacted / 13 labelled, fullframe durations 5–6s with 9–14s holes (resolved.json), lint exit 0 with W1/W2/W3 warnings.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Rulebook sync | `node lib/build-prompt.mjs && node lib/check-rulebook.mjs` | exit 0 |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/`):
- `lib/audit-gate.mjs` (new) + `lib/audit-gate.test.mjs` (new)
- `lib/cue-constants.mjs`, `lib/lint-cues.mjs`, `lib/lint.test.mjs`
- `steps/035-cue-audit-llm/audit-prompt.md` + README, `steps/020-cue-pass-llm/cue-pass-prompt.md` + `RULEBOOK.md`
- `steps/040-storyboard-review-owner/run.sh` (pre-flight hook), `run.sh` (audit-gate wiring), `scripts/check.sh`, `PIPELINE.md`

**Out of scope**: `lib/board.mjs` (plan 144 owns it), card-library (143), v1, `videos/**` (live data).

## Git workflow

- Branch: `advisor/142-vf2-enact-gate-density-coherence`. Commit per step. Do NOT push.

## Steps

### Step 1: the audit gate

New `lib/audit-gate.mjs` — CLI `node lib/audit-gate.mjs <slug-or-path>`; exported pure `auditGate({audit, resolved})` → `{errors, warnings}`:
- **Error** per cue that is `placement === 'fullframe'` in resolved.json AND `verdict === 'labelled'` in audit.json, EXCEPT cues whose audit item carries `"accepted": true` (the owner's explicit override, set on the board or by hand) — message: `"<id>: labelled fullframe — re-author (enacted device or bespoke) or mark accepted:true in audit.json"`.
- **Warning** per labelled OVERLAY cue (nameplates/demo markers are legitimate labels — surfaced, never blocking).
- Missing audit.json → error `"run the 035 audit first"`. Missing resolved.json → error.
- CLI exit 1 on any error.

Wire it: `steps/040-storyboard-review-owner/run.sh` runs `node lib/audit-gate.mjs "$slug"` FIRST and refuses to start the board on exit 1 (echo the errors + `AUDIT GATE: re-author labelled fullframe cues, re-run resolve + audit, then board`). Add `audit-gate` as its own `run.sh` verb too.
Update `PIPELINE.md`: audit.json item schema gains optional `"accepted": true`; the flow table's 040 row notes the gate.

Test `lib/audit-gate.test.mjs` (fixtures inline): labelled fullframe errors; accepted:true passes; labelled overlay warns only; enacted all-clean passes; missing audit errors.

**Verify**: `node --test lib/audit-gate.test.mjs` → pass.

### Step 2: audit prompt — real slugs only

`steps/035-cue-audit-llm/audit-prompt.md`:
- New placeholder `{{CATALOG_SLUGS}}` (the flat slug list; update `run.sh audit`'s heredoc to include a `node -e` one-liner printing every catalog slug, one per line).
- Rule: every `fix` naming a card MUST use a slug verbatim from that list; when no listed card enacts the clause, the fix is the literal word `bespoke` plus one sentence describing the enactment to author. Inventing slugs is a defect.
- `fix` becomes structured: `"fix": { "card": "<catalog-slug>" | "bespoke", "how": "<one sentence>" }`. Update the README, the audit.json schema in PIPELINE.md, and `lib/audit-gate.mjs`'s reading of items (gate logic unchanged — it reads verdicts).

**Verify**: `grep -n "CATALOG_SLUGS" steps/035-cue-audit-llm/audit-prompt.md run.sh` → present in both.

### Step 3: cue-pass goes enacted-first + earlier bespoke

`steps/020-cue-pass-llm/cue-pass-prompt.md` (hand sections only):
- Routing order becomes explicit: for each planned cue, FIRST scan the `enacted/` family (and other cards whose `intent` matches) for a device that DOES the clause; only when none fits may a legacy reveal/text card be used, and then the cue must carry `"legacy_why": "<one line>"` (new optional field — document in PIPELINE.md cues.json schema).
- Bespoke escalation moves earlier: when the audit WOULD call it labelled (apply the mute test yourself while authoring) and no device fits, set `flagged: true` immediately with a `fix`-style note — do not place a filler text card.
- `steps/020-cue-pass-llm/RULEBOOK.md`: dated entry recording the first-run failure mode (18/19 legacy, audit ignored) as the WHY.

`lib/lint-cues.mjs`: **W10** — a fullframe cue on a non-structural legacy (non-`enacted/`) card without `legacy_why` warns. Constant `ENACTED_FIRST: 1` (prose-only rule carrier) in cue-constants; regenerate prompt.

**Verify**: `node --test lib/lint.test.mjs && node lib/check-rulebook.mjs` → pass (add a W10 fixture test).

### Step 4: density coherence — one constant set

In `lib/cue-constants.mjs` (update values AND their rule prose; regenerate prompt after):
- `GAP_FULLFRAME_MIN`: 35 → **12** ("breathing room, not sparsity — fullframe starts at least 12s apart").
- `GAP_FULLFRAME_MAX`: 60 → **45**.
- `TARGET_RATE_MIN`: 1.0 → **1.5**; `TARGET_RATE_MAX`: 1.9 → **4.0** (the W7 world: ~2–4 cues/min).
- `GAP_ABSORB`: 4 → **12** (fullframe holds reach the next event across gaps ≤12s on base:screen — kills the 9–14s hole-then-pop rhythm; demos longer than 12s still show through).
- `DENSITY_OVERLAY_MAX`: 3 → **4** (the demo-punctuation reality of the first run).
- Unchanged: `ZONE_END`, caps, `NARRATION_BARE_GAP_MAX 20`, `BARE_GAP_MAX 50`, `HOLD_EXTEND_CAP 20`.

Update `lib/lint.test.mjs` fixtures that encode old band values. Then `node lib/build-prompt.mjs`.

**Verify**: `node --test lib/lint.test.mjs && node lib/check-rulebook.mjs` → pass; `grep -n "GAP_ABSORB" lib/cue-constants.mjs` shows 12.

### Step 5: register + gate

`scripts/check.sh` gains `lib/audit-gate.test.mjs`.

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

Fixture-driven `node --test` for the gate and every lint change; check-rulebook guards prompt/constants sync; no LLM calls, no `videos/` reads.

## Done criteria

- [ ] check.sh green; `node lib/check-rulebook.mjs` exit 0
- [ ] `node lib/audit-gate.mjs` blocks a labelled-fullframe fixture and passes an accepted one
- [ ] `grep -n "legacy_why\|W10" lib/lint-cues.mjs` → present
- [ ] cue-constants show 12/45/1.5/4.0/12/4 for the Step-4 keys
- [ ] `grep -n "CATALOG_SLUGS" steps/035-cue-audit-llm/audit-prompt.md` → present

## STOP conditions

- The 040 pre-flight hook cannot run the gate without restructuring the step script — report.
- Any edit outside the Scope list (esp. board.mjs, card-library, videos/).

## Maintenance notes

- The 060 fold tunes these constants from real runs; this plan sets the coherent starting point.
- `accepted: true` is the owner's escape hatch — plan 144's board exposes it as a per-cue button; until then it's a hand-edit.
- When plan 143's ambient-motion cards land, the "static pops" half of the density complaint shrinks further; constants may warrant another pass after video #2.
