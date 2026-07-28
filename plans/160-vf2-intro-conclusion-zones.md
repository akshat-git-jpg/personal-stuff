---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: false
deploy:
needs: [plan 159 writes the `structure` field this reads; plan 156 owns W12/W13 which this retargets]
---

# Plan 160: Treat the intro and conclusion as high-stakes zones

## Summary

- **Problem statement**: Once plan 159 lands, the pipeline knows where the intro and conclusion are — but nothing uses it. The cue pass still judges the opening by the same generic density rules as minute twelve, and a conclusion with zero graphics passes every check.
- **Goals**:
  - Pass the intro/conclusion boundaries into the cue-pass prompt so the model knows which stretch it is authoring.
  - Add a rulebook entry saying these two zones carry the most weight — **as guidance, not a checklist**.
  - Retarget plan 156's `W12` from a fixed 15s window to the real measured intro.
  - Add `W14 zone-underserved`: an intro or conclusion with no graphics at all is objectively wrong.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High).
- **Done criteria** (terse): `bash scripts/check.sh` exits 0; W12 uses measured intro bounds; W14 fires on a conclusion with no cues.
- **Stop conditions** (terse): any required editorial slot structure gets encoded; `structure` is absent.
- **Test / verification for success**: unit tests in `lib/lint-cues.test.mjs` plus a run against `videos/test-03`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12646f6..HEAD -- pipelines/video/visuals-flow-2/lib/lint-cues.mjs pipelines/video/visuals-flow-2/lib/cue-rules.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plan 159 (the `structure` field), plan 156 (W12/W13)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `12646f6`, 2026-07-28

## Why this matters

The owner's constraint, verbatim (2026-07-28): *"Intro and Conclusion are most important and I want best quality there"* — and, on encoding a required intro formula: *"its subjective. Pls dont make this hardcoded."*

Both are satisfied by the same move: tell the model **where** the high-stakes zones are and that they matter, and let it decide **what** goes in them. What gets enforced mechanically is limited to facts that are not matters of taste — an intro that never shows the presenter, and a conclusion with no graphics at all. Everything editorial stays the cue pass's judgment.

This is the difference between a gate that improves quality and one that just makes the model fill boxes. A required five-slot intro would produce five cards on a video whose topic has no rival to contrast against — worse, not better.

## Current state

**After plan 159**, `videos/<slug>/segments.json` carries:

```json
{
  "video": "test-03",
  "confirmed": false,
  "structure": [
    { "part": "intro", "start": 0, "end": 117.567 },
    { "part": "body", "start": 117.567, "end": 997.3 },
    { "part": "conclusion", "start": 997.3, "end": 1076.533 }
  ],
  "segments": [ { "kind": "narration", "start": 0, "end": 190 }, { "kind": "demo", "start": 190, "end": 300.23 } ]
}
```

**`lib/lint-cues.mjs`** signature (line 30):

```js
export function lintCues({ cuesFile, resolved, words, catalog, segmentsData, manifest, conceptData }) {
```

`segmentsData` is the parsed `segments.json`, so `segmentsData.structure` is available without a signature change.

**Plan 156's W12**, as that plan specifies it, uses a fixed window:

```js
    const BY = CUE_CONSTANTS.HOST_VISIBLE_BY.value;
```

That fixed 15s was a stand-in precisely because the real intro bounds were unknown. With `structure` present they are known: test-03's intro is **117.567s**, not 15s — so the presenter-visibility question applies across the whole opening, not just its first quarter.

**`lib/cue-rules.mjs`** — routing rules as `{ rule, why }`; `lib/build-prompt.mjs` renders `r.rule` (never the key) into `steps/020-cue-pass-llm/cue-pass-prompt.md` between generated markers, and `lib/check-rulebook.mjs` fails if the prompt is stale.

**Measured motivation** (v3 of test-03): mean frame-to-frame delta of 0.01 — a still image — for 20 consecutive seconds inside the intro, and the presenter first visible at 0:54.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Lint tests | `cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs` | all pass |
| Lint test-03 | `cd pipelines/video/visuals-flow-2 && node lib/lint-cues.mjs test-03` | warnings, exit 0 |
| Rebuild prompt | `cd pipelines/video/visuals-flow-2 && node lib/build-prompt.mjs && node lib/check-rulebook.mjs` | `rulebook ok` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow-2/lib/lint-cues.mjs`
- `pipelines/video/visuals-flow-2/lib/cue-rules.mjs`
- `pipelines/video/visuals-flow-2/lib/lint-cues.test.mjs`
- `pipelines/video/visuals-flow-2/steps/020-cue-pass-llm/cue-pass-prompt.md` (regenerated only)
- `pipelines/video/visuals-flow-2/lib/build-prompt.mjs` (only if the structure must be surfaced to the prompt — see Step 1)

**Out of scope**:
- **Any required slot / formula for the intro.** Explicitly forbidden by the owner. No rule may say "the intro must contain a hook card", "must contain a promise card", or enumerate required card types for a zone.
- `lib/source-structure.mjs` — plan 159 owns it.
- `lib/resolve.mjs`.
- Re-cueing test-03.

## Git workflow

- Branch: `advisor/160-vf2-intro-conclusion-zones`
- Commit: `feat(vf2): intro and conclusion become high-stakes zones for cueing and lint` — no AI footers. Do NOT push.

## Steps

### Step 1: Surface the zones to the cue pass

The cue-pass prompt is assembled per-video. Find where the per-video context (transcript, segments) is written into the prompt for the 020 step, and include a short structure block, e.g.:

```
VIDEO STRUCTURE (measured from the source files — these are exact):
  intro       0.0s - 117.6s
  body        117.6s - 997.3s
  conclusion  997.3s - 1076.5s
```

If the prompt is assembled from `segments.json` already, extend that; if it is assembled elsewhere, add it there. Do not invent a new file.

**Verify**: run whatever produces the per-video prompt for test-03 and confirm the rendered prompt contains the literal text `VIDEO STRUCTURE`. Report the command you used.

### Step 2: Add the rulebook entry

In `lib/cue-rules.mjs`, after `R_OPENING` (added by plan 156), add:

```js
  R_ZONES: {
    rule: 'Intro and conclusion carry the most weight (mandatory): the video structure block names the exact intro, body and conclusion spans, measured from the source files. Author the intro and the conclusion FIRST and give them your strongest devices — an enacted card that DOES the point beats a text slate everywhere, and it matters most here, because the opening decides whether anyone stays and the conclusion is the payoff the opening promised. Neither zone may be left without graphics. There is deliberately NO required structure for either: what an intro needs is a judgment call about THIS script, not a checklist to fill. Do not add a card to a zone because a slot exists; add it because the narration gives you something to enact.',
    why: 'owner 2026-07-28: "Intro and Conclusion are most important and I want best quality there" — and, on encoding a required intro formula, "its subjective. Pls dont make this hardcoded". test-03 measured 0.01 mean frame delta (a still image) for 20 consecutive seconds inside the intro, with the presenter first visible at 0:54; its conclusion was never cut at all',
  },
```

Then regenerate.

**Verify**: `cd pipelines/video/visuals-flow-2 && node lib/build-prompt.mjs && node lib/check-rulebook.mjs && grep -c "carry the most weight" steps/020-cue-pass-llm/cue-pass-prompt.md` -> `rulebook ok` then `1`

### Step 3: Retarget W12 to the measured intro

In `lib/lint-cues.mjs`, change plan 156's W12 so its window is the intro span from `segmentsData.structure` when available, falling back to `CUE_CONSTANTS.HOST_VISIBLE_BY.value` when `structure` is absent (pre-convention workdirs):

```js
    const introPart = (segmentsData?.structure ?? []).find((s) => s.part === 'intro');
    const BY = introPart ? introPart.end : CUE_CONSTANTS.HOST_VISIBLE_BY.value;
```

Keep the rest of the W12 block as plan 156 wrote it, and keep `OPENING_HOST_MIN` as the minimum free time. Update the warning text to say `the intro` rather than `the first Ns` when the measured span was used.

**Verify**: `cd pipelines/video/visuals-flow-2 && node lib/lint-cues.mjs test-03 2>&1 | grep "W12"` -> one line referring to the intro

### Step 4: Add W14 zone-underserved

After the W13 block, add:

```js
  // W14 zone-underserved (owner 2026-07-28). Not an editorial rule — a zone
  // the owner recorded and named, carrying no graphics at all, is a gap
  // rather than a style choice. test-03's conclusion had zero cues because
  // the cut never reached it. What goes IN the zone stays the cue pass's call.
  for (const part of (segmentsData?.structure ?? [])) {
    if (part.part === 'body') continue;
    const inZone = sortedResolved.filter((r) => r.start >= part.start && r.start < part.end);
    if (inZone.length === 0) {
      warnings.push(`W14 zone-underserved: the ${part.part} (${part.start.toFixed(1)}s-${part.end.toFixed(1)}s) has no cues at all — it is the part of the video that matters most and it is carrying no graphics`);
    }
  }
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node lib/lint-cues.mjs test-03 2>&1 | grep -c "W14 zone-underserved"` -> `1` (test-03's conclusion is outside its 300s cut, so it has no cues)

### Step 5: Tests

Append to `lib/lint-cues.test.mjs`, reusing the file's existing argument-building helper:

1. W14 fires for a conclusion zone with no cues in range
2. W14 stays silent when the conclusion zone contains at least one cue
3. W14 never fires for `body`
4. W12 uses the measured intro end when `structure` is present (a cue covering 0–100s of a 117s intro leaves under `OPENING_HOST_MIN` free -> fires)
5. W12 falls back to `HOST_VISIBLE_BY` when `structure` is absent (no crash, previous behaviour)

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs 2>&1 | tail -4` -> `# fail 0`

### Step 6: Full gate

**Verify**: `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` -> exit 0, ends `visuals-flow check OK`

## Test plan

Five unit tests (Step 5), weighted toward the negative cases — a lint that fires on everything is ignored within a week, which is already true of W1 and W7 in this pipeline. Test 5 matters for safety: `structure` is absent on every pre-convention workdir and the linter must not throw there.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` exits 0
- [ ] `node --test lib/lint-cues.test.mjs` reports `# fail 0`
- [ ] the rendered cue-pass prompt contains `VIDEO STRUCTURE` and the `R_ZONES` rule text
- [ ] `node lib/lint-cues.mjs test-03` prints one `W14` line naming the conclusion
- [ ] `node lib/check-rulebook.mjs` prints `rulebook ok`
- [ ] `grep -riE "required slot|must contain a (hook|promise|roadmap)" lib/cue-rules.mjs lib/lint-cues.mjs` returns nothing

## STOP conditions

- Any rule or lint you are about to write enumerates required card types for the intro. The owner has ruled this out. Stop and report.
- `segmentsData.structure` is undefined for test-03 — plan 159 has not landed. STOP; do not compute structure here or the two plans will disagree.
- W14 fires for the body zone. It must not — the body's density is already governed by W6/W7.
- Any existing lint test changes result. Report which.

## Maintenance notes

- The split to hold onto: **where** the zones are is mechanical and enforced; **what** belongs in them is editorial and free. Every future request to "make intros better" should be checked against that line before it becomes a rule.
- W12's fallback exists only for pre-convention workdirs. Once every video carries the three source files, the `HOST_VISIBLE_BY` constant becomes dead and can be removed.
- W14 is a floor, not a quality measure. One card in a 79s conclusion silences it while still being a weak conclusion. That is intentional — the alternative is scoring taste, which the owner has ruled out.
