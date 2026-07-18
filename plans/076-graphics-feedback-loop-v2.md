---
executor: agy
model:
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui: true
deploy:
needs: ["069 must land first (extends its feedback.json schema); 072 soft (metrics read lint output when present)"]
---

# Plan 076: Graphics feedback loop v2 — apply/fold lifecycle, edit-delta mining, unfolded pre-flight, convergence metrics

## Summary

- **Problem statement**: The feedback loop tracks only one lifecycle state (`folded` = a rule changed) and only explicit typed feedback. It conflates "fix this video" with "change the rules" (an item can be folded while the actual cue was never fixed), loses meaning across re-passes (items keyed by cue id / gap timecode with no context), never sees the owner's richest signal (the silent board edits between the LLM's output and the approved cues.json), lets a new video's cue pass run while lessons sit unfolded, and measures nothing — so nobody knows if the loop is converging.
- **Goals**: two lifecycle states (`applied` + `folded`) with context snapshots on every item; an immutable `cues.llm.json` per video plus a `lib/edit-delta.mjs` summarizer so step 060 mines the owner's edits as feedback; a `lib/feedback-status.mjs` pre-flight that blocks a new cue pass while items are pending; a per-video metrics line in TESTS.md.
- **Executor proposed**: agy (standard — every behavior specified; the judgment work stays in step 060's procedure, which this plan only documents).
- **Done criteria** (terse — full list below): schema extended + board snapshots context; edit-delta and feedback-status CLIs tested; 020/060 procedures updated; `scripts/check.sh` green.
- **Stop conditions** (terse — full list below): 069 not landed; feedback.json shape on disk contradicts 069's schema.
- **Test / verification for success**: new unit tests for both CLIs + board test for context snapshot; flow gate.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow/lib pipelines/video/graphics-flow/steps pipelines/video/graphics-flow/PIPELINE.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 069 (hard — extends its `{text, added, folded?}` item schema); 072 (soft — metrics include lint warnings when the linter exists)
- **Category**: feature (quality infrastructure)
- **Difficulty**: standard
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

graphics-flow's learning loop (step 060, `steps/060-feedback-fold-opus/README.md`)
is the flow's core promise: "a correction given once is never needed twice."
Four structural holes keep that promise leaky:

1. **Apply vs fold are conflated.** Board feedback like "reveal 3 too wordy"
   needs BOTH an edit to this video's cues.json (apply) and possibly a rule
   change (fold). Only `folded` exists as a state, so an item can be folded
   into a rule while the cue it complained about ships unfixed — or fixed but
   never generalized. Nothing records which happened.
2. **Items lose meaning across re-passes.** Items are keyed `c05` /
   `gap-03:12`. A v3 cue pass or a timing shift re-assigns those keys to
   different content, silently pointing old feedback at the wrong cue.
3. **The richest feedback is invisible.** When the owner silently fixes 9
   reveals and 3 holds on the board, that diff between the LLM's cues.json and
   the approved cues.json is ground-truth signal — systematically more honest
   than typed boxes. Today the LLM's output is overwritten in place; "v1 is in
   git history" (tests/TESTS.md) is archaeology, not a mechanism.
4. **No fold deadline, no scoreboard.** 060 fires only when the owner says
   "fold the feedback"; a new video's cue pass can run first and repeat known
   mistakes. And nothing measures convergence (edits per video should trend
   toward zero — nobody can currently see whether it does).

## Current state

- **Plan 069 (landed before this plan)** gives `feedback.json` this shape,
  with the board's Save merging over existing items and treating folded items
  as immutable/read-only:

```json
{
  "video": "test-01",
  "updated": "2026-07-18",
  "items": {
    "c05":       { "text": "...", "added": "2026-07-18" },
    "gap-03:12": { "text": "...", "added": "2026-07-18", "folded": "2026-07-19 — RULEBOOK section 2" },
    "_global":   { "text": "..." }
  }
}
```

- `lib/board.mjs handleSave()` builds/merges items (069's merge logic); it has
  `merged.cues` and the recomputed `resolved` array in scope at write time —
  everything needed to snapshot context server-side.
- Step 020 (`steps/020-cue-pass-llm/README.md`): the LLM writes
  `videos/<slug>/cues.json`; after plan 072 its README documents the
  resolve+lint fix-loop (≤3 rounds). There is no immutable copy of the LLM's
  final output.
- Step 060 procedure: collect unfolded feedback → decide where each lesson
  lives → edit surface → mark folded → log provenance in `tests/TESTS.md`
  under `## Folded lessons`.
- `PIPELINE.md` owns the `videos/<slug>/` layout table (which files are
  committed) and the cues.json schema.
- Conventions: plain node ESM `.mjs`, zero deps, `node:test`; CLIs use the
  shared slug-or-path `resolveWorkdir` pattern (see `lib/resolve.mjs` bottom);
  tests run via `scripts/check.sh` (`node --test lib/*.test.mjs` list + rulebook check).
- Real data: `videos/test-01/` (27-cue cues.json, resolved.json, transcript).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0 |
| Edit-delta on real data (self-diff) | `cd pipelines/video/graphics-flow && cp videos/test-01/cues.json /tmp/llm.json && node lib/edit-delta.mjs /tmp/llm.json videos/test-01/cues.json` | exit 0, "0 cues edited" |
| Pre-flight | `cd pipelines/video/graphics-flow && node lib/feedback-status.mjs` | exit 0 while no pending items exist |

## Scope

**In scope**:
- `lib/board.mjs`: context snapshot on feedback items at Save (small addition to 069's merge logic).
- New `lib/edit-delta.mjs` + `lib/edit-delta.test.mjs`.
- New `lib/feedback-status.mjs` + `lib/feedback-status.test.mjs`.
- `scripts/check.sh`: add the two new test files.
- Docs: `steps/020-cue-pass-llm/README.md` (cues.llm.json + pre-flight),
  `steps/060-feedback-fold-opus/README.md` (applied state, delta mining, metrics),
  `PIPELINE.md` (workdir layout row for cues.llm.json; feedback bullet).

**Out of scope**:
- Board edit affordances (card swap, delete cue, add-cue-in-gap, lead editing) —
  recorded as backlog `GFX-05` in `plans/README.md`; separate UI plan.
- Editor (downstream) feedback channel — deferred until the first real editor
  handoff (backlog `GFX-06`).
- Any change to 069's folded-immutability rules or 072's lint thresholds.
- Running an actual fold; changing RULEBOOK/prompt content.

## Git workflow

- Branch: `advisor/076-graphics-feedback-loop-v2`
- Commit: `feat(graphics-flow): feedback loop v2 — apply/fold lifecycle, edit-delta mining, unfolded pre-flight, metrics` — no AI footers. Do NOT push.

## Steps

### Step 1: Context snapshot + `applied` state in the schema

Extend the item object (069's shape) with two fields; document both in the 060
README's schema block and PIPELINE.md's feedback bullet:

```json
"c05": {
  "text": "reveal 3 too wordy",
  "added": "2026-07-18",
  "context": { "card": "pros-cons/pros-cons", "anchor": "let's look at the pros", "start": 312.4 },
  "applied": "2026-07-19 — shortened reveal 3 in cues.json",
  "folded":  "2026-07-19 — RULEBOOK Beats: reveal wording rule"
}
```

- `context` — written by the BOARD at Save time, server-side in `handleSave`,
  for any item whose ref matches a cue id (from `merged.cues` + the recomputed
  `resolved` entry: card, anchor, resolved start) or a gap ref (from the gap's
  start/end and its first ~8 words). `_global` gets no context. Context is
  written once when the item is created and never overwritten on later Saves
  (it snapshots what the owner was looking at).
- `applied` — set by whoever performs the this-video edit (usually the next
  Claude session or 060 itself), same free-text dated format as `folded`.
- Lifecycle meaning, documented in the 060 README: an item is DONE only when
  it carries `applied`, `folded`, or an explicit `"applied": "<date> — not needed"` /
  `"folded": "<date> — instance-only, no rule"` marker. Items needing both get both.
  The board's read-only rendering (069) keys off `folded` exactly as before.

**Verify**: new board test — Save feedback on a cue ref and a gap ref; assert the written items carry correct `context` (card/anchor/start for the cue; start/end/excerpt for the gap); a second Save editing the text preserves the original `context`.

### Step 2: `cues.llm.json` — the immutable LLM output

Docs-only convention plus one guard:

- `steps/020-cue-pass-llm/README.md`: after the fix-loop converges, the
  executor copies the final cues.json to `videos/<slug>/cues.llm.json` BEFORE
  any human/board edit. This file is committed and never edited afterward —
  it is the baseline the owner's edits are measured against.
- `PIPELINE.md` workdir layout: add the row
  `cues.llm.json   # step 020's final output, pre-owner-edits — committed, immutable`.
- Guard in `lib/feedback-status.mjs` (Step 4): warn when a workdir has
  cues.json but no cues.llm.json (older videos like test-01 predate the
  convention — warning, not error).

**Verify**: `grep -n 'cues.llm.json' pipelines/video/graphics-flow/PIPELINE.md pipelines/video/graphics-flow/steps/020-cue-pass-llm/README.md` -> both hits present.

### Step 3: `lib/edit-delta.mjs` — summarize the owner's edits

```
node lib/edit-delta.mjs <slug-or-path>          # uses <workdir>/cues.llm.json vs cues.json
node lib/edit-delta.mjs <llm.json> <cues.json>  # explicit two-file mode
```

Export `editDelta(llmCues, approvedCues)` returning a structured summary; the
CLI prints it as compact markdown (this output is pasted into 060's session,
so it must be small and readable — never dump full JSON):

- **Per changed cue** (joined by id): which fields changed (`anchor`, `hold`,
  `lead`, `card`, `variables.<key>`, `flagged`), and for beat reveals the
  text before → after (`"Unlimited free tier for teams" -> "Unlimited free tier"`).
- **Added / removed cues** by id + card.
- **Totals footer**: `N cues from LLM, M approved, K edited, A added, R removed, T reveal texts changed`.
- Exit 0 always in two-file mode; in workdir mode exit 2 with a clear message
  when `cues.llm.json` is missing.

**Verify**: unit tests — identical files -> "0 cues edited" + zero totals; a
fixture pair with one reveal-text change, one hold change, one added cue, one
removed cue -> each appears in the summary with correct before/after; the
self-diff command from the commands table -> "0 cues edited".

### Step 4: `lib/feedback-status.mjs` — the pre-flight

Scans `videos/*/feedback.json` (all workdirs; also accepts a single
slug-or-path argument):

- Lists every item lacking BOTH `applied` and `folded`, grouped by video, with
  its ref, text (first ~80 chars), and age in days (from `added`).
- Warns (stderr, non-fatal) for workdirs with cues.json but no cues.llm.json.
- Exit 1 iff pending items exist; exit 0 otherwise. Output is designed to be
  read by the session about to run a cue pass.

Wire it as the documented step 0 of the 020 procedure
(`steps/020-cue-pass-llm/README.md`): "Before running a cue pass for ANY
video: `node lib/feedback-status.mjs` — if it exits 1, fold first (step 060).
Do not run a new cue pass over pending lessons." Do NOT add it to
`scripts/check.sh` as a gate — pending feedback must not fail unrelated boss
merges; check.sh only gets its unit tests.

**Verify**: unit tests — temp videos dir with one pending item -> exit 1 and the item listed; all items carrying `applied` or `folded` -> exit 0; missing cues.llm.json -> stderr warning, exit unaffected.

### Step 5: 060 procedure — delta mining + metrics line

Edit `steps/060-feedback-fold-opus/README.md`:

- Procedure step 1 becomes two inputs: (a) explicit — pending items from
  `node lib/feedback-status.mjs`; (b) implicit — `node lib/edit-delta.mjs <slug>`
  for each video reviewed since the last fold; treat systematic edits (the
  same kind of change 3+ times — e.g. reveals consistently shortened, holds
  consistently raised) as feedback items to fold, and one-off edits as
  already-applied instance fixes needing no rule.
- New procedure step: after folding, append ONE metrics line per video to
  `tests/TESTS.md` under a `## Convergence` section:
  `- <date> <slug>: llm=<N> approved=<M> edited=<K> added=<A> removed=<R> typed=<count of feedback items> flags=<flagged count> lint-warnings=<count or n/a>`
  (numbers come from edit-delta's totals, feedback.json, cues.json, and — when
  072 is present — `node lib/lint-cues.mjs <slug>`). The trend everyone watches:
  `edited` and `typed` falling video over video.
- Marking items: set `applied` and/or `folded` per Step 1's lifecycle meaning.

**Verify**: `node lib/check-rulebook.mjs` (via check.sh) still passes; read the 060 README top-to-bottom once — the procedure must be executable by a fresh Opus session without this plan in context.

### Step 6: Wire tests into the gate

Add `lib/edit-delta.test.mjs lib/feedback-status.test.mjs` to the `node --test`
line in `scripts/check.sh`.

**Verify**: `bash pipelines/video/graphics-flow/scripts/check.sh` -> exit 0.

## Test plan

Unit tests for both new CLIs (Steps 3-4), the board context-snapshot test
(Step 1), the real-data self-diff smoke, and the flow gate. UI evidence for
the PR (ui gate): screenshot of a board tile's feedback area after a Save,
plus the written feedback.json showing the `context` field.

## Done criteria

- [ ] Feedback items carry `context` (snapshotted once at creation) and support `applied` alongside `folded`; 060 README documents the lifecycle.
- [ ] `cues.llm.json` convention documented in 020 README + PIPELINE.md layout.
- [ ] `node lib/edit-delta.mjs` produces the compact summary; tested incl. self-diff = zero.
- [ ] `node lib/feedback-status.mjs` exits 1 on pending items and is step 0 of the 020 procedure; NOT part of check.sh's gate.
- [ ] 060 README mines the delta and appends the `## Convergence` metrics line per video.
- [ ] `scripts/check.sh` exits 0 with the two new test files included.

## STOP conditions

- Plan 069 has not landed (feedback.json items are still plain strings in
  `lib/board.mjs`) — stop and report; this plan extends 069's schema, it must
  not reimplement it.
- Any on-disk `videos/*/feedback.json` at execution time has a shape that
  neither 069's schema nor its legacy-string upgrade explains — stop and report.
- The 060 README has structurally changed since `8e48c2f` in a way that makes
  Step 5's edits ambiguous — stop and report with the conflict.

## Maintenance notes

- `cues.llm.json` is the convergence baseline — if a video legitimately gets a
  fresh cue pass (v2/v3), overwrite BOTH cues.llm.json and cues.json at that
  moment; the delta always measures owner edits since the LAST LLM pass.
- The `## Convergence` metrics only mean something if the fold cadence holds:
  feedback-status's exit-1 is the enforcement point; keep it in the 020
  procedure whenever that README is rewritten.
- Backlog `GFX-05` (board edit affordances) will reduce `typed` feedback in
  favor of direct edits — after it lands, expect `edited` to carry more of the
  signal and adjust 060's mining emphasis accordingly.
