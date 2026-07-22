<!-- boss frontmatter -->
---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["Blocks 125 and 128; independent of 126 and 127"]
---

# Plan 124: Single-source the cue ROUTING rules — extend plan 118's pattern from numbers to prose

## Summary

- **Problem statement**: Plan 118 single-sourced the numeric constraints, but the *routing* rules (which card fires when, structural consistency, pricing consolidation, demo punctuation, verdict/cold-open mandates) are still hand-written prose in TWO places: `cue-pass-prompt.md` and `steps/020-cue-pass-llm/RULEBOOK.md`. Nothing checks they agree, and they have already diverged from a third copy in `EDITOR-STYLE-GUIDE.md`.
- **Goals**:
  - Move every cross-card arbitration rule into one exported module, `lib/cue-rules.mjs`.
  - **Generate** those rules into `cue-pass-prompt.md` inside a second marker pair, exactly like the constraints block.
  - Fail `check-rulebook.mjs` when RULEBOOK.md restates a governed rule instead of citing it.
  - Reduce RULEBOOK.md's routing sections to dated provenance (the WHY), which is what its own header already claims it is.
- **Executor proposed**: `claude-p` / `sonnet` — the prompt and RULEBOOK are quality-setting content the owner judges by taste (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): `CUE_RULES` is the only home for routing-rule text; `node lib/build-prompt.mjs --check` passes; an induced rule edit fails `check-rulebook.mjs`; `bash scripts/check.sh` green.
- **Stop conditions** (terse — full list below): suite red before starting; any change to a rule's MEANING; `cue-pass-prompt.md` stops being self-contained.
- **Test / verification for success**: a drift test that mutates one `CUE_RULES` entry and asserts the rulebook gate fails naming that rule id.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat be36087..HEAD -- pipelines/video/visuals-flow/lib/build-prompt.mjs pipelines/video/visuals-flow/lib/check-rulebook.mjs pipelines/video/visuals-flow/lib/cue-constants.mjs pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (118 already landed)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `be36087`, 2026-07-22

## Why this matters

The cue pass runs with NO repo access. The model gets one prompt and nothing else. That design only works if the prompt is the complete, current ruleset.

Plan 118 proved the fix for numbers: one module, generated into the prompt, gated against drift. The routing prose never got the same treatment, and the consequences are already visible in the repo:

1. `EDITOR-STYLE-GUIDE.md:76-92` still teaches the PRE-2026-07-21 density philosophy ("The default is NO graphic", "one fullframe beat every 45 to 90 seconds", "If in doubt during demo stretches, skip the graphic"). Root `decisions.md:157` reversed that stance. Nobody updated the guide because nothing forced them to.
2. The same routing rule for a card is written in `catalog.json`'s `purpose`, in RULEBOOK.md, and again in the prompt. Three copies, one generator, zero checks.
3. RULEBOOK.md's own header says it is the "judgment archive", yet it carries operative rule text that the prompt must also carry. Two live copies of the same rule is the exact failure 118 was built to remove.

Rules the model never sees, or sees in a stale form, produce defects the model cannot be blamed for.

## Current state

### The existing pattern to copy, `lib/cue-constants.mjs` lines 1-20 verbatim

```js
// Single source of truth for cue-pass constraints.
// lib/lint-cues.mjs enforces these; lib/build-prompt.mjs renders them into
// steps/020-cue-pass-llm/cue-pass-prompt.md; lib/check-rulebook.mjs fails if
// the rendered block and these values disagree. Never restate a number in
// prose — add it here and regenerate.
export const CUE_CONSTANTS = {
  CAP_FULLFRAME:          { value: 3,    rule: 'Any non-structural fullframe card may be used at most 3 times per video (lint E3). Structural cards (catalog `structural: true`) are exempt.' },
  ...
};
```

### `lib/build-prompt.mjs` lines 5-8 and 36-45 verbatim

```js
export const BEGIN_MARKER = '<!-- BEGIN GENERATED CONSTRAINTS — edit lib/cue-constants.mjs, then run node lib/build-prompt.mjs -->';
export const END_MARKER = '<!-- END GENERATED CONSTRAINTS -->';

export const PROMPT_PATH = path.resolve(import.meta.dirname, '..', 'steps', '020-cue-pass-llm', 'cue-pass-prompt.md');
```

```js
function withGeneratedBlock(promptText, block) {
  const beginIdx = promptText.indexOf(BEGIN_MARKER);
  const endIdx = promptText.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`cue-pass-prompt.md is missing the generated-constraints markers`);
  }
  const before = promptText.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = promptText.slice(endIdx);
  return `${before}\n${block}\n${after}`;
}
```

`withGeneratedBlock` is module-private and hard-codes one marker pair. It must be generalised to take a marker pair as arguments so a second block can reuse it.

### `lib/check-rulebook.mjs` lines 59-77 — the gate to imitate

Drift gate 1 compares the prompt's generated block against a fresh render and, on mismatch, names the offending constant keys via `renderConstraintLines`. Your new gate follows the same shape for rules.

### Which rules move, and which do NOT

**Move to `CUE_RULES`** (cross-card arbitration — decisions about relationships BETWEEN cards). From `cue-pass-prompt.md`, the current section headings and mandates:

- the density philosophy paragraph (lines 58-62)
- "Never two overlapping fullframe cues." (line 81)
- "Cold-open beat allowed in the first 15s" (lines 82-83)
- "Choosing a card" routing list (lines 85-89)
- "Specificity wins (mandatory)" (lines 91-94)
- "Result-review overlays" (lines 96-106)
- "Kinetic-sentence interstitial (mandatory)" (lines 122-133)
- "Structural consistency (mandatory)" (lines 135-138)
- "Repetition cap (non-structural cards)" (lines 140-143)
- "Demos & step narration (mandatory)" (lines 145-149)
- "Pricing (mandatory)" (lines 151-154)
- "Cold open (mandatory for comparison videos)" (lines 156-158)
- "Verdicts (mandatory)" (lines 160-161)
- "Units (mandatory)" (lines 163-164)
- "Beat cards must not idle" (lines 166-168)

**Do NOT move** (output-format mechanics, not routing — they belong to the prompt as prose):

- the whole `## Schema` section (lines 14-54)
- "Anchors:" (lines 170-175), "Beats:" (lines 177-180), "Capacity (hard limits):" (lines 182-185), "Variables:"/"Logos:" (lines 187-191)
- the `## Output rules` section (lines 209-215)

**Do NOT move** the "New cards (2026-07-21)" per-card block (lines 108-121). Those are per-card "fire me when X" rules and belong on the card itself. Plan 125 moves them to a `when` field in `catalog.json`. Leave them exactly where they are; 125 removes them.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, ends `visuals-flow check OK` |
| Unit tests only | `cd pipelines/video/visuals-flow && node --test lib/` | 0 failures |
| Regenerate the prompt | `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs` | prints `prompt constraints up to date` |
| Check without writing | `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs --check` | exit 0 |
| Rulebook gate alone | `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` | prints `rulebook ok` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/cue-rules.mjs` (new)
- `pipelines/video/visuals-flow/lib/cue-rules.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/build-prompt.mjs`
- `pipelines/video/visuals-flow/lib/check-rulebook.mjs`
- `pipelines/video/visuals-flow/lib/check-rulebook.test.mjs`
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md`
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md`

**Out of scope**:
- `lib/cue-constants.mjs` — 118 already owns the numbers; do not move numbers into the new module.
- `card-library/catalog.json` — plan 125 owns the per-card `when` field.
- `lib/lint-cues.mjs` — no lint code changes here. These rules are prose the linter cannot evaluate; do not invent new lint codes.
- `EDITOR-STYLE-GUIDE.md`, `HANDOFF.md`, `visuals-flow/decisions.md` — plan 128 owns those.
- `videos/**` — never touch a video workdir. `videos/opusclip-tutorial/` is mid-review by the owner.

## Git workflow

- Branch: `advisor/124-cue-routing-rules-single-source`
- Commit: `visuals-flow: single-source cue routing rules into lib/cue-rules.mjs` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `lib/cue-rules.mjs`

Create the module with this exact header and shape. Each entry is `{ rule, why }`: `rule` is the operative text rendered into the prompt, `why` is a short provenance note that is NOT rendered (it exists so the fold has a home for the reason next to the rule).

```js
// Single source of truth for cue-pass ROUTING rules (which card fires when,
// and how cards relate to each other). Numbers live in lib/cue-constants.mjs;
// per-card "fire me when X" lives on the card's catalog.json entry.
// lib/build-prompt.mjs renders these into steps/020-cue-pass-llm/cue-pass-prompt.md;
// lib/check-rulebook.mjs fails if RULEBOOK.md restates one instead of citing it.
// Never restate a rule in prose — add it here and regenerate.
export const CUE_RULES = {
  R_DENSITY: {
    rule: '...',
    why: 'owner recalibration 2026-07-21 — earlier videos had multi-minute bare stretches',
  },
  ...
};
```

Populate it by MOVING the text of each rule listed under "Which rules move" above, verbatim, from `cue-pass-prompt.md`. Use these exact keys, in this order:

`R_DENSITY`, `R_NO_OVERLAP`, `R_COLD_OPEN_ZONE`, `R_CHOOSING`, `R_SPECIFICITY`, `R_RESULT_REVIEW`, `R_KINETIC`, `R_STRUCTURAL`, `R_REPETITION`, `R_DEMOS`, `R_PRICING`, `R_COLD_OPEN_TITLE`, `R_VERDICTS`, `R_UNITS`, `R_NO_IDLE`.

Copy the rule text VERBATIM. Do not reword, tighten, or "improve" any rule. This plan is a move, not a rewrite. Rewording a rule silently changes pipeline behaviour.

For `why`, use the dated provenance already present in `RULEBOOK.md` where one exists (for example `R_DEMOS` cites "owner fold 2026-07-18, test-01 c06/c09/c15"). Where RULEBOOK has no dated note, write `'unattributed — predates the fold log'`.

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/cue-rules.mjs').then(m=>console.log(Object.keys(m.CUE_RULES).length))"` -> `15`

### Step 2: Generalise `withGeneratedBlock` and add the rules block to `build-prompt.mjs`

Change the signature to `withGeneratedBlock(promptText, block, beginMarker, endMarker)` and pass the existing markers at the call site. Add:

```js
export const RULES_BEGIN_MARKER = '<!-- BEGIN GENERATED ROUTING RULES — edit lib/cue-rules.mjs, then run node lib/build-prompt.mjs -->';
export const RULES_END_MARKER = '<!-- END GENERATED ROUTING RULES -->';

// One entry per rendered rule, tagged with its rule id — lets
// check-rulebook.mjs name the offending rule on drift.
export function renderRuleLines(cueRules = CUE_RULES) {
  return Object.entries(cueRules).map(([key, r]) => ({ key, text: r.rule }));
}

export function renderRulesBlock(cueRules = CUE_RULES) {
  return renderRuleLines(cueRules).map((l) => l.text).join('\n\n');
}
```

In `main()`, apply BOTH blocks before the write/compare, so `--check` covers both.

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/build-prompt.mjs').then(m=>console.log(typeof m.renderRulesBlock))"` -> `function`

### Step 3: Replace the moved prose in `cue-pass-prompt.md` with the marker pair

In the `## Rules` section, delete the moved rule text and insert:

```
<!-- BEGIN GENERATED ROUTING RULES — edit lib/cue-rules.mjs, then run node lib/build-prompt.mjs -->
<!-- END GENERATED ROUTING RULES -->
```

Place it immediately after the existing `<!-- END GENERATED CONSTRAINTS -->` line, so the prompt reads: schema, then hard constraints, then routing rules, then the mechanics prose (Anchors/Beats/Capacity/Variables) that stays hand-written.

Then run the generator to fill it.

**Verify**: `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs && node lib/build-prompt.mjs --check` -> exit 0

### Step 4: Add drift gate 4 to `check-rulebook.mjs`

Mirror drift gate 1 for the rules block: compare the prompt's generated rules block against a fresh `renderRulesBlock()`, and on mismatch name the stale rule ids via `renderRuleLines`.

Then add drift gate 5: RULEBOOK.md must not restate a governed rule. Implement it as:

```js
// Drift gate 5: RULEBOOK.md holds PROVENANCE, not rule text. A verbatim
// restatement is a second live copy that will drift from lib/cue-rules.mjs.
for (const { key, text } of renderRuleLines(cueRules)) {
  const probe = text.split(/\s+/).slice(0, 8).join(' ');
  if (probe.length > 20 && rulebook.includes(probe)) {
    fail(`RULEBOOK.md restates governed rule ${key} verbatim — RULEBOOK holds the WHY and cites the rule id; the rule text lives in lib/cue-rules.mjs`);
  }
}
```

**Verify**: `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` -> prints `rulebook ok`

### Step 5: Reduce RULEBOOK.md's routing sections to provenance

For each section whose rule text moved, replace the operative sentences with the dated reasoning plus a citation of the rule id. Keep every dated owner-fold entry: that history is the reason RULEBOOK exists.

Example shape for the demos section:

```md
### Demos and walkthroughs

Rule: `R_DEMOS` in `lib/cue-rules.mjs`.

Owner fold 2026-07-18 (test-01 c06/c09/c15): a `process/step-flow` that
re-labelled steps already visible on screen was rejected as redundant. The
correction is punctuation with the SPOKEN layer, not blanking the stretch.
```

Do NOT delete these `REQUIRED_SECTIONS` headings, `check-rulebook.mjs:19-29` asserts they exist: `## Inputs and outputs`, `## Cue density`, `## Choosing a card`, `## Anchors`, `## Beats`, `## Variables`, `## Worked example`, `## Novel cards (flagged cues)`, `## Rubric`.

Do NOT touch the `## Worked example` section. `check-rulebook.mjs:112-144` parses it.

Also delete `RULEBOOK.md:21-33`, the cues.json field table. `RULEBOOK.md:5-7` already declares "Schema is owned by `PIPELINE.md` ... never forks it", and the restated copy omits `logo`, `productLogos` and the `kind: "word-sync"` semantics that `PIPELINE.md:73-122` documents. Replace it with one line: `Schema: see PIPELINE.md's cues.json section.`

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` -> exit 0, ends `visuals-flow check OK`

### Step 6: Write the drift regression tests

Add `lib/cue-rules.test.mjs`:

- every `CUE_RULES` entry has a non-empty `rule` and a non-empty `why`
- `renderRulesBlock()` output contains every rule's text

Extend `lib/check-rulebook.test.mjs` with two cases, following the existing fixture style in that file (it already points `checkRulebook` at temp fixtures via explicit paths):

- mutating one `CUE_RULES` entry and re-running `checkRulebook` against the unmodified prompt fails with a message naming that rule id
- a fixture RULEBOOK containing the first 8 words of a governed rule fails with the "restates governed rule" message

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/` -> 0 failures

## Test plan

The two new `check-rulebook` cases are the real product of this plan: they are what make the single source enforceable rather than aspirational. Follow the fixture pattern already used in `lib/check-rulebook.test.mjs`, which passes explicit `rulebookPath` / `promptPath` / `catalogPath` so tests never touch the real repo files.

## Done criteria

- [ ] `lib/cue-rules.mjs` exists and exports 15 keyed rules, each with `rule` and `why`
- [ ] `cue-pass-prompt.md` contains the routing-rules marker pair and no hand-written copy of any moved rule
- [ ] `node lib/build-prompt.mjs --check` exits 0
- [ ] `node lib/check-rulebook.mjs` prints `rulebook ok`
- [ ] Mutating one `CUE_RULES` entry makes `check-rulebook.mjs` fail naming that rule id
- [ ] RULEBOOK.md keeps all nine required sections and every dated owner-fold entry
- [ ] RULEBOOK.md no longer contains the cues.json field table
- [ ] `bash scripts/check.sh` exits 0

## STOP conditions

- `bash scripts/check.sh` is already red before you start. Report and stop; do not fix unrelated breakage.
- Moving a rule would change its MEANING. This plan is a verbatim move. If a rule reads ambiguously, move it as-is and note it; do not rewrite it.
- A rule cannot be expressed without a number. Numbers belong in `lib/cue-constants.mjs`. Do not duplicate a number into `cue-rules.mjs`: `check-rulebook.mjs:10-17` STRAY_NUMBER_PATTERNS will fail the build, and that is correct behaviour.
- Any change would make `cue-pass-prompt.md` depend on reading another file at cue time. The prompt must stay self-contained; generation is allowed, linking is not.
- You find yourself editing anything under `videos/`. Stop immediately.

## Maintenance notes

- After this lands, the sequence for changing a routing rule is: edit `lib/cue-rules.mjs`, run `node lib/build-prompt.mjs`, add the dated why to RULEBOOK.md citing the rule id. Three files, one source.
- Plan 125 depends on this: it moves the per-card `when` text out of the prompt and into `catalog.json`, and expects the routing marker pair to already exist.
- A reviewer should scrutinise Step 5 hardest. The risk is losing a dated owner judgment while trimming, which would destroy the archive this file exists to be.
