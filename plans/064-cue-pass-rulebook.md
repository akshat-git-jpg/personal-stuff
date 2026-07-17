---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/card-library && node flow/check-rulebook.mjs
ui:
deploy:
needs: ["062 (catalog.json)", "063 (cues.json schema in flow/README.md)"]
---

# Plan 064: Cue-pass rulebook + prompt (the one LLM step)

## Summary

- **Problem statement**: The graphics flow's single per-video LLM step (transcript → cues.json) has no operating manual: no density rules, no card-selection guidance, no anchor-quoting rules, no reusable prompt. Without it every video re-derives judgment and quality drifts.
- **Goals**:
  - `flow/RULEBOOK.md` — the rulebook a Claude/agy/Antigravity session follows to produce cues.json.
  - `flow/cue-pass-prompt.md` — the exact model-agnostic prompt with `{{TRANSCRIPT}}` / `{{CATALOG}}` placeholders.
  - `flow/check-rulebook.mjs` — structural gate (sections present, prompt placeholders present, schema matches flow/README.md).
  - One-line pointer added to the step-135 stub.
- **Executor proposed**: claude-p / sonnet (content is quality-setting → Sonnet per decisions.md 2026-07-05)
- **Done criteria** (terse): check script exit 0; rubric self-check passes on a worked example.
- **Stop conditions** (terse): schema conflicts with flow/README.md; urge to add a second LLM step; touching anything beyond the 4 files.
- **Test / verification for success**: `node flow/check-rulebook.mjs` + verify-time rubric scoring by a cheap subagent.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 02f536f..HEAD -- pipelines/video/card-library/flow/RULEBOOK.md pipelines/video/card-library/flow/cue-pass-prompt.md`
> (must be empty; plans 062/063 landing other files is expected)

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: 062, 063
- **Category**: feature
- **Difficulty**: standard (writing judgment content against fixed constraints)
- **Planned at**: commit `02f536f`, 2026-07-17

## Why this matters

The design (docs/specs/2026-07-17-motion-graphics-beat-sync-design.md) makes the executor of the cue pass pluggable — Sonnet, agy, or Antigravity fill the same form. That only works if the form and the judgment rules live in files, not in anyone's chat history. The rulebook is also where quality is controlled once instead of per-video, and it fulfils (for final-workflow videos) what the step-135 rulebook stub in tutorial-pipeline-2 was going to specify.

## Current state

- `pipelines/video/card-library/flow/README.md` (plan 063) holds the authoritative cues.json schema — RULEBOOK.md must reference and match it, never fork it.
- `pipelines/video/card-library/catalog.json` (plan 062) — 37 cards with `slug`, `kind`, `placement`, `purpose`, `variables`, `beat_shape`, `default_duration`. The prompt embeds this file's content as `{{CATALOG}}`.
- `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` — a 14-line stub; gets ONE pointer line, nothing else.
- Final-workflow context: VO-first — the transcript comes from the locked script's TTS audio, so wording in the transcript matches the script nearly verbatim.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Structural gate | `cd pipelines/video/card-library && node flow/check-rulebook.mjs` | `rulebook ok`, exit 0 |

## Scope

**In scope**:
- `pipelines/video/card-library/flow/RULEBOOK.md` (new)
- `pipelines/video/card-library/flow/cue-pass-prompt.md` (new)
- `pipelines/video/card-library/flow/check-rulebook.mjs` (new)
- `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` (append one pointer line)

**Out of scope**: everything else — no card edits, no flow script edits, no changes to the cues.json schema.

## Git workflow

- Branch: `advisor/064-cue-pass-rulebook`
- Commit per step, e.g. `docs(card-library): cue-pass rulebook`. No AI footers. Do NOT push.

## Steps

### Step 1: flow/RULEBOOK.md

Required sections (exact H2 titles — check-rulebook.mjs greps them):

1. `## Inputs and outputs` — inputs: `transcript.json` (word timestamps) + `catalog.json`; output: `cues.json` ONLY, schema per flow/README.md (link it; restate fields in one table). The model never writes timestamps, durations, or file paths.
2. `## Cue density` — these are the defaults (write them as numbered rules): a fullframe cue at each natural section boundary, targeting one per 60–120s of runtime; overlays sparse — at most one per minute, only where a spoken point benefits from reinforcement; never two fullframe cues whose spoken coverage overlaps; no cue in the first 15s or the last 20s; a 30-min video lands roughly 18–28 cues total. When the script structure fights a rule, follow the script — these are defaults, not physics.
3. `## Choosing a card` — route by what the VO is DOING, using catalog `purpose` lines: enumerating advantages/drawbacks → pros-cons; walking an ordered list → checklist or bullet-points; comparing tools feature-by-feature → feature-matrix or summary-table; delivering a final judgment → a verdict card; opening a section → a section/title card; a single reinforced claim or number → an overlay card. If NOTHING fits, set `"flagged": true` with `card` = closest slug and a `note` field saying what's missing — never force a bad fit.
4. `## Anchors` — anchors are VERBATIM quotes from the transcript words: ≥3 consecutive words, copied exactly (contractions and all); pick phrases unlikely to repeat; anchors must appear in script order (the resolver matches forward-only — an out-of-order anchor is a hard error); the cue anchor is where the card APPEARS (the sentence that introduces the topic), each beat anchor is the phrase that begins that specific point.
5. `## Beats` — one beat per spoken point, at the phrase that starts the point; `reveal` follows the card's `beat_shape` from the catalog; reveal text is a 2–6 word summary of the point, never the transcript sentence; a beat-card cue with fewer than 2 beats should usually be a single card instead.
6. `## Variables` — fill every non-beat variable in the card's catalog `variables`; text is sentence-case; product names spelled as the script spells them.
7. `## Worked example` — a ~120-word sample transcript excerpt (write one: a pros/cons passage about a fictional tool) followed by the complete correct cues.json for it (2 cues: one pros-cons with 4 beats, one overlay), valid against the schema.
8. `## Novel cards (flagged cues)` — flagged cues are reviewed on the storyboard board; approved flags get a new card authored INTO the library following README's Beat contract section + a catalog.json entry (this grows the catalog so future videos flag less). Authoring executor: Sonnet by default; Antigravity only under the recorded render+visual-inspection mitigation (decisions.md 2026-07-07).
9. `## Rubric` — 10 pass/fail checks a reviewer scores the cues.json against: (1) valid JSON matching the schema; (2) every anchor is a verbatim ≥3-word transcript quote; (3) anchors in script order; (4) density within Section-2 bounds for the runtime; (5) no overlapping fullframe coverage; (6) every card slug exists in catalog.json; (7) beat reveals match `beat_shape`; (8) reveal text ≤6 words; (9) no cue in first 15s / last 20s; (10) flagged cues carry a `note`.

**Verify**: `grep -c '^## ' flow/RULEBOOK.md` -> `9`

### Step 2: flow/cue-pass-prompt.md

The prompt any executor pastes/loads, structured as: role line ("you produce motion-graphic cues for a voiceover-driven video; output ONLY cues.json content"), the schema table, the density/anchor/beat/variable rules compressed from RULEBOOK.md (do not link — inline them; the model running this may have no repo access), then:

```
CATALOG (the only cards you may use):
{{CATALOG}}

TRANSCRIPT (verbatim word sequence with your quoting source):
{{TRANSCRIPT}}
```

Ends with: output rules — raw JSON only, no markdown fences, no commentary; `flagged` cues allowed; when unsure between two cards prefer the one whose `purpose` line matches the VO's action.

**Verify**: `grep -c '{{CATALOG}}\|{{TRANSCRIPT}}' flow/cue-pass-prompt.md` -> `2`

### Step 3: flow/check-rulebook.mjs

Node stdlib script, exit 0 + `rulebook ok` when: RULEBOOK.md exists and contains all 9 exact H2 titles; cue-pass-prompt.md contains both placeholders and the words "raw JSON"; the worked example's JSON block in RULEBOOK.md parses and each cue has `id`, `card`, `anchor` and each beat has `reveal` + `anchor`; every card slug in the worked example exists in catalog.json. Exit 1 with the failing check named otherwise.

**Verify**: `node flow/check-rulebook.mjs` -> `rulebook ok`

### Step 4: pointer from the 135 stub

Append to `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md`:

```
For final-workflow videos this is superseded by the beat-sync flow rulebook: pipelines/video/card-library/flow/RULEBOOK.md (plan 064).
```

**Verify**: `tail -1 pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` contains `flow/RULEBOOK.md`

## Test plan

`check-rulebook.mjs` is the machine gate. Content quality is verified at review time by a subagent scoring the worked example against the Section-9 rubric (all 10 must pass) — the rubric is in the artifact itself, so the check is reproducible.

## Done criteria

- [ ] `cd pipelines/video/card-library && node flow/check-rulebook.mjs` exits 0 printing `rulebook ok`
- [ ] Worked example passes its own rubric (self-apply all 10 checks; note the result in the commit message)
- [ ] 135 stub has the pointer line and no other change
- [ ] `git diff --stat 02f536f..HEAD` limited to the 4 in-scope files (plus plans/README.md status row)

## STOP conditions

- Any mismatch between flow/README.md's cues.json schema and what you're writing — the README wins; report if it seems wrong, don't fork it.
- The design is ONE LLM call per video: if a rule seems to need a second pass (e.g. "then review the cues with another model"), leave it out and note it — don't add stages.
- catalog.json or flow/README.md missing (062/063 not landed) — stop; this plan cannot go first.

## Maintenance notes

- Density numbers (60–120s, 18–28 cues) are starting defaults; tune them from real videos by editing RULEBOOK.md Section 2 only — the prompt compresses from it, so update both.
- When new cards land via the novel-cue loop, no rulebook change is needed — the prompt embeds catalog.json at run time.
