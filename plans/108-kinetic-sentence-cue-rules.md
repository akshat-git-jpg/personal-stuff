---
executor: claude-p
model: sonnet
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: ["107 must land first — it adds the card, the catalog entry, and the resolver that makes these cues resolvable"]
---

# Plan 108: teach the cue pass to write kinetic-sentence cues

## Summary

- **Problem statement**: Plan 107 adds the `slate/kinetic-sentence` card and the resolver that times it, but the cue-pass LLM has no rule telling it WHEN to reach for the card or HOW to choose the accent phrase — so the card would sit unused, exactly like the candidate did between 2026-07-19 and now.
- **Goals**:
  - Add a RULEBOOK rule for the kinetic-sentence interstitial: when it fires, how the sentence is quoted, how the accent phrase is chosen, and its interaction with the shot pass.
  - Update `cue-pass-prompt.md`'s Schema + Rules so the LLM emits the `word-sync` cue shape correctly.
  - Keep `check-rulebook.mjs` passing.
- **Executor proposed**: `claude-p` / `sonnet` — this is quality-setting prompt+rulebook content the owner judges by taste, which `tooling/boss/data/rules.md` routes away from the agy default.
- **Done criteria** (terse — full list below): `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0 (includes `check-rulebook.mjs`); RULEBOOK and prompt both describe the card, the accent rule, and the verbatim-quoting constraint.
- **Stop conditions** (terse — full list below): do not touch the card, catalog, resolver, or lint from 107; do not invent a second emphasis mechanism.
- **Test / verification for success**: `check-rulebook.mjs` structural gate + a rubric-scored read of the new rule (rubric inlined below).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d46bcb1..HEAD -- pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plan 107
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `d46bcb1`, 2026-07-20

## Why this matters

The kinetic-sentence interstitial is, per `references/-vwHldNaGPI.md` rule 2, what *replaces* a jump-cut talking head for many bridges — a high-frequency structural choice. A card the LLM never selects is worth nothing, and this exact failure already happened once: the candidate was correctly logged on 2026-07-19 and then implemented as a caption track, so the reference behaviour never reached a video.

The emphasis choice is the part that cannot be automated. The reference highlights "more credits wasted" and "cool technical features" — semantic phrases carrying the sentence's point. No lexical rule can infer that, which is precisely why the owner decided (2026-07-20) the LLM marks it in the cue and rejected widening `markKeyword`. That decision makes this plan's prompt wording load-bearing rather than cosmetic.

## Current state

### Files

| File | Role |
|---|---|
| `pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md` | the durable rules the cue pass follows; sections: `## Inputs and outputs`, `## Cue density`, `## Choosing a card`, `## Anchors`, `## Beats`, `## Variables`, `## Worked example`, `## Novel cards (flagged cues)`, `## Rubric` |
| `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` | the prompt itself; sections: `## Schema`, `## Rules`, `## Output rules` |
| `pipelines/video/visuals-flow/lib/check-rulebook.mjs` | structural gate asserting the RULEBOOK's REQUIRED_SECTIONS still exist; run by `scripts/check.sh` |

Read all three before editing. `check-rulebook.mjs` asserts a list of required section headings — **do not rename or remove any existing heading**; add content inside existing sections, or add a new section without disturbing the required ones.

### What 107 established (treat as fixed)

The card is `slate/kinetic-sentence`, catalog `kind: "word-sync"`, `placement: "fullframe"`, `max_beats: 18`.

Its cue shape:

```json
{
  "id": "c07",
  "card": "slate/kinetic-sentence",
  "anchor": "because picking the wrong",
  "lead": 0.2,
  "hold": 2.0,
  "variables": {
    "text": "Because picking the wrong model just burns credits",
    "accent": "burns credits"
  },
  "beats": []
}
```

Hard constraints the resolver enforces (a violation is a step-030 error, not a silent miss):
- `variables.text` must quote the voiceover **verbatim** — the resolver matches each word forward in `transcript.json` with a lookahead of 8 words and errors on a word it cannot find.
- `variables.accent` must appear **verbatim and contiguously inside** `variables.text`.
- The cue must author **no beats** — timings are derived.
- `anchor` must be the **opening words of the sentence itself** (≥3 words, the existing anchor rule), because word matching starts at the anchor.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `bash pipelines/video/visuals-flow/scripts/check.sh` | exits 0, `visuals-flow check OK` |
| Rulebook structure only | `node pipelines/video/visuals-flow/lib/check-rulebook.mjs` | prints `rulebook ok` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md`
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md`

**Out of scope** (looks related — do not touch):
- Everything plan 107 owns: the card, `catalog.json`, `lib/resolve.mjs`, `lib/kinetic-sentence.mjs`, `lib/lint-cues.mjs`. If one of them seems wrong, STOP and report — do not fix it here.
- `steps/070-shot-pass-llm/*` — the shot pass decides full-screen avatar spans. This plan only NOTES the interaction; changing shot-pass rules is separate work.
- `lib/captions.mjs` — captions are a different artifact and stay as they are.

## Steps

### Step 1 — Add the rule to RULEBOOK.md

In `## Choosing a card`, add a subsection for the kinetic-sentence interstitial. It must state, in the RULEBOOK's existing voice:

1. **When it fires** — a narration bridge where there is no footage, UI, or data worth showing, and the point is a single spoken assertion. It is the alternative to letting the host carry the bridge on camera.
2. **How often** — it is a frequent device in the reference, not a once-per-video special. Give a concrete rate consistent with the existing `## Cue density` numbers (read that section and express the rate in the same units it uses; do NOT invent a different unit).
3. **Quoting** — `variables.text` is the voiceover **verbatim**, one sentence, ≤18 words. If the spoken sentence is longer, either pick the clause carrying the point or use two consecutive cues. Paraphrasing breaks resolution at step 030.
4. **The accent phrase** — the 2–4 words carrying the sentence's *point*, not merely its nouns. Worked contrasts to include:
   - "Because picking the wrong model just **burns credits**" → the consequence.
   - "It highlights some of the **cool technical features**" → the substance, not "It highlights".
   - Wrong: accenting a brand name or a number just because it stands out — those are already handled by caption keyword accent; this is a semantic choice.
   - The accent must appear verbatim and contiguously inside `text`.
5. **No beats** — the cue authors `"beats": []`; per-word timings are derived from the transcript.
6. **Anchor** — the anchor is the sentence's own opening words (≥3), not a phrase earlier in the narration.
7. **Interaction with the shot pass** — this card occupies a bridge the shot pass might otherwise fill with a full-screen host span; note that it is `fullframe` and therefore cannot overlap another fullframe cue (the resolver rejects overlaps).

Also add one entry to `## Worked example` showing a real cue in this shape, using the transcript excerpt style already used there.

**Verify**: `node pipelines/video/visuals-flow/lib/check-rulebook.mjs` prints `rulebook ok`.

### Step 2 — Update the prompt

In `cue-pass-prompt.md`:

- `## Schema` — document the `word-sync` cue variant: `variables.text`, optional `variables.accent`, and `"beats": []`. Match the section's existing formatting exactly.
- `## Rules` — add a short, imperative rule mirroring RULEBOOK Step 1 items 3, 4, 5 and 6. The prompt is the operational surface; keep it terse and directive, with the RULEBOOK holding the reasoning. Do not duplicate the full rationale here (`decisions.md`: keep one authoritative home, reference rather than recopy).

**Verify**: `grep -c "word-sync\|kinetic-sentence" pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` returns ≥ 2.

### Step 3 — Full gate

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0 and prints `visuals-flow check OK`.

## Test plan

No new unit tests — this plan changes prose consumed by an LLM. Verification is:
1. `check-rulebook.mjs` structural gate (automated, in `check.sh`).
2. The rubric below, scored by a reviewer reading the diff.

## Rubric (score the RULEBOOK + prompt diff; all must be YES)

| # | Criterion |
|---|---|
| 1 | A reader can tell WHEN to use the card without seeing the reference video. |
| 2 | The verbatim-quoting constraint is stated with its consequence (step-030 resolution failure), not as a style preference. |
| 3 | The accent-phrase rule gives at least two worked examples AND one explicit wrong example. |
| 4 | It is unambiguous that the cue authors no beats and no per-word anchors. |
| 5 | The anchor rule states the anchor is the sentence's own opening words. |
| 6 | Density is expressed in the same units as the existing `## Cue density` section. |
| 7 | No existing RULEBOOK section heading was renamed or removed. |
| 8 | The prompt is terse and directive; the reasoning lives in the RULEBOOK, not duplicated. |

## Done criteria

1. `bash pipelines/video/visuals-flow/scripts/check.sh` exits 0, printing `visuals-flow check OK`.
2. `node pipelines/video/visuals-flow/lib/check-rulebook.mjs` prints `rulebook ok`.
3. `grep -c "word-sync\|kinetic-sentence" pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md` ≥ 2.
4. `grep -c "word-sync\|kinetic-sentence" pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` ≥ 2.
5. All 8 rubric rows score YES.
6. `git diff --stat d46bcb1..HEAD` touches only the two in-scope files.

## STOP conditions

- **Plan 107 has not landed** (no `slate/kinetic-sentence` in `catalog.json`) → STOP. Writing rules for a card that does not exist produces cues that fail at step 030.
- **A required RULEBOOK section would have to be renamed or removed** to fit the new content → STOP; `check-rulebook.mjs` will fail and the fix is a plan decision, not an executor one.
- **The rule seems to need a second emphasis mechanism** (a per-word marker, a lexicon, regex) → STOP. The owner chose exactly one mechanism — an LLM-chosen contiguous phrase in `variables.accent`.
- **The existing `## Cue density` numbers appear to contradict the frequency you would write** → STOP and report the contradiction rather than silently picking one; density was deliberately retuned on 2026-07-20 (plan 106).

## Maintenance notes

- The RULEBOOK is the durable home for the reasoning; `cue-pass-prompt.md` is the operational surface. When this rule changes, change the RULEBOOK first.
- If real videos show the LLM over- or under-using the card, that is a `060-feedback-fold-opus` tuning job against these two files — the same relationship plan 099 had to cue density and 106 to shot cadence.
- The accent-phrase rule is the part most likely to need iteration; it is a taste judgment and the first videos are the evidence.
