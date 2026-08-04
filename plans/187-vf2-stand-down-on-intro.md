---
executor: claude-p
model: opus
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["BLOCKED: branch chore/boss-hardening-2026-08-02 must merge first — it holds lint-shots.mjs and export-timeline.mjs, which this plan edits", "185 must land (PR #144)"]
needs_prs: [144, 145]
touches: [pipelines/video/visuals-flow/lib/zone-constants.mjs, pipelines/video/visuals-flow/lib/zone-rules.mjs, pipelines/video/visuals-flow/lib/lint-cues.mjs, pipelines/video/visuals-flow/lib/lint-shots.mjs, pipelines/video/visuals-flow/lib/assemble.mjs, pipelines/video/visuals-flow/lib/export-timeline.mjs, pipelines/video/visuals-flow/lib/build-zone-prompt.mjs]

mutation_apply: cd pipelines/video/visuals-flow && sed -i '' "s/introOwnedByFilm(workdir)/false/" lib/lint-cues.mjs
mutation_command: cd pipelines/video/visuals-flow && node --test lib/lint-cues.test.mjs
mutation_expect: E13 must not fire when the intro film owns the opening
mutation_timeout: 600
---

# Plan 187: visuals-flow — stand down on the intro when the film owns it

## Summary

- **Problem statement**: With plans 185 and 186 landed, a video configured `intro: "film"` has a bespoke authored intro film — and visuals-flow still authors cards, lints, and assembles that same span as if nothing had changed. Five surfaces double-treat the intro. One of them is worse than redundant: `R_ZONE_LINK_CTA` picks the link-CTA card *positionally across the whole video*, so if the film owns the first "link in the description" mention, the conclusion silently gets the wrong card.
- **Goals**:
  - Introduce ONE predicate, `introOwnedByFilm(workdir)`, and route every intro-owning surface through it. No surface may test `run-config` directly.
  - `035` authors the CONCLUSION ONLY when the film owns the intro.
  - Re-derive the link-CTA position so the conclusion switches from scrim to pills.
  - Suppress the intro-specific lint rules that presume the intro has cues (E13 open-cover, W15 zone-gap) and re-anchor `lint-shots` E8 `INTRO_HOST`.
  - `assemble.mjs` and `export-timeline.mjs` splice `intro-film/out/intro.mp4` over the intro span.
- **Executor proposed**: `claude-p` / `opus` — this is the `tricky` row: it edits four gates and two builders at once, and the failure mode is silent wrong output rather than a crash.
- **Done criteria** (terse — full list below): `scripts/check.sh` green; a `intro: "cards"` video's lint output and assembly are byte-identical to before; a `intro: "film"` fixture produces conclusion-only cues, pills in the conclusion, and an assembly whose first segment is the film.
- **Stop conditions** (terse — full list below): starting before the concurrent branch merges; any surface testing run-config directly instead of the predicate; weakening a lint assertion.
- **Test / verification for success**: paired fixtures — the same video linted and assembled under both `intro` modes, asserting the cards mode is unchanged and the film mode stands down.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6817afed..HEAD -- pipelines/video/visuals-flow`
> **This plan expects significant drift** — the concurrent branch must have merged.
> If `lib/lint-shots.mjs` and `lib/export-timeline.mjs` are unchanged since
> 6817afed, that branch has NOT merged: STOP and report.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: **HIGH** — this is the first plan in the chain that changes what a
  normal video produces. Every edit is inside a gate or a builder that today's
  videos depend on.
- **Depends on**: plan 185 (PR #144), plan 186, and the merge of branch
  `chore/boss-hardening-2026-08-02`
- **Category**: feature
- **Difficulty**: tricky
- **Planned at**: commit `6817afed`, 2026-08-03

## Why this matters

The owner's requirement, stated 2026-08-03: *"make sure you are generic making
changes in visual flow 2 so that if this intro step is on, then it doesn't get
reprocessed by visual flow intro steps."*

Plans 185 and 186 are deliberately inert — the film is produced, reviewed and
approved, and then nothing reads it. This plan is where it actually takes over,
and it is the risky one, because every edit lands inside a gate that working
videos depend on.

The subtle failure is worth stating up front, because it has already happened
once in this codebase. `R_ZONE_LINK_CTA` in `lib/zone-rules.mjs` reads:

> the FIRST description mention anywhere in the script uses
> `link-in-description/link-scrim` (full-frame dim scrim), and EVERY later
> mention uses `link-in-description/link-in-description` (transparent pill
> overlay) […] The first mention is usually in the INTRO, so the intro normally
> owns the scrim and the conclusion owns pills.

The count is across the **whole video**, not within a zone. When the film owns
the intro it owns the first mention, so the conclusion must flip from scrim to
pills. The owner already caught this exact rule inverted once (fold 2026-08-01:
*"the intro used the pill for the FIRST mention (85s) and the conclusion used the
scrim for a later one (1903s), exactly inverted"*), and the reason it was missed
then was that a rule folded into the body rulebook never reached the zone
rulebook. The same class of miss is available here.

## Current state

### The five surfaces

**1. `lib/zone-constants.mjs`** — `export const ZONE_PARTS = ['intro', 'conclusion'];`
Consumed by `lib/card-plan.mjs`:
```js
return ZONE_PARTS.includes(zone) ? zone : 'body';
```
The 035 pass authors both parts against `lib/zone-rules.mjs`, whose first rule
says *"You are authoring the INTRO and the CONCLUSION only."*

**2. `lib/zone-rules.mjs` `R_ZONE_LINK_CTA`** — quoted above.

**3. `lib/lint-cues.mjs`** — two intro-presuming rules:
```js
// E13 open-cover — the video must open on a fullframe card or the full-screen
errors.push(`E13 open-cover: nothing covers the opening — the first fullframe card or avatar span starts at ${...} (the video must open on a card or the host, not bare screen recording)`);
...
// W15 zone-gap — measured from the zone OPENING, not just between cards.
warnings.push(`W15 zone-gap: the ${part.part} runs ${firstGap.toFixed(1)}s before its first fullframe cue ${zoneFulls[0].id} (max ${ZONE_GAP_FULLFRAME_MAX}s from the zone opening)`);
```
Both fire when the intro legitimately has no cues because the film covers it.

**4. `lib/lint-shots.mjs` E8** — `const INTRO_HOST_BY = SC.INTRO_HOST.value;` (15s).
`lib/shot-constants.mjs` states the rule: *"The host must be ON SCREEN within the
first 15 seconds (mandatory, lint E8)."* The film contains the host, but it is
not a visuals-flow avatar span, so E8 sees nothing and fails.

**5. `lib/assemble.mjs` / `lib/export-timeline.mjs`** — build the cut and the
Resolve export over the intro span.

### The concurrent-branch hazard, and why this plan is blocked

Branch `chore/boss-hardening-2026-08-02` holds unmerged commits on
`lib/lint-shots.mjs` (+test) and `lib/export-timeline.mjs` (+test) — including
`35648954 feat(visuals-flow): host must be on screen by 15s — INTRO_HOST becomes a real gate (E8)`,
which is precisely the rule this plan modifies. Starting before that merges
guarantees a conflict on the exact lines in play.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Repo gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |
| Lint one video's cues | `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs <slug>` | exit 0 |
| Confirm the blocker cleared | `git log --oneline origin/main \| grep -c "INTRO_HOST becomes a real gate"` | 1 (0 → STOP) |

## Scope

**In scope**: `lib/intro-film/owns-intro.mjs` (NEW), `lib/zone-constants.mjs`,
`lib/zone-rules.mjs`, `lib/build-zone-prompt.mjs`, `lib/lint-cues.mjs`,
`lib/lint-shots.mjs`, `lib/assemble.mjs`, `lib/export-timeline.mjs`, their tests,
`PIPELINE.md`.

**Out of scope**: `card-library/**` (read-only); `board-ui/**` (plan 186);
anything under `pipelines/video/intro-studio/` (the standalone POC stays working).

## Git workflow

- Branch: `advisor/187-vf2-stand-down-on-intro`
- Commit per step. Do NOT push.

## Steps

### Step 0: Confirm the blocker has cleared

```sh
git fetch -q origin main
git log --oneline origin/main | grep -c "INTRO_HOST becomes a real gate"
```

**Verify**: `1`. If `0`, branch `chore/boss-hardening-2026-08-02` has not merged —
**STOP and report**. Do not proceed; you would be editing files another session
is holding.

### Step 1: One predicate, used everywhere

Create `lib/intro-film/owns-intro.mjs`:

```js
import { loadRunConfig } from '../run-config.mjs';

// The SINGLE source of truth for "the bespoke film owns the intro span".
// Five surfaces stand down on this; if any of them tests run-config directly
// instead, they drift apart and the failure is silent wrong output, not a
// crash. That is the same shape as the 2026-08-01 link-CTA inversion, where a
// rule folded into one rulebook never reached the pass that actually authored
// the thing it governed.
export function introOwnedByFilm(workdir) {
  return loadRunConfig(workdir).intro === 'film';
}
```

Add `lib/intro-film/owns-intro.test.mjs`: true only for `intro: 'film'`; false
for absent config, for `{}`, and for `intro: 'cards'`.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/intro-film/owns-intro.test.mjs` → exit 0.

### Step 2: 035 authors the conclusion only

`ZONE_PARTS` is currently a module constant. Add a function beside it, keeping
the constant for callers that legitimately want both:

```js
export const ZONE_PARTS = ['intro', 'conclusion'];
export function zonePartsFor(workdir) {
  return introOwnedByFilm(workdir) ? ['conclusion'] : ZONE_PARTS;
}
```

Route `lib/build-zone-prompt.mjs` and `lib/card-plan.mjs` through `zonePartsFor`.
In the 035 prompt, when the intro is film-owned, state it explicitly rather than
silently omitting it:

> The INTRO of this video is authored as a bespoke film (step 025) and is NOT
> yours. Author the CONCLUSION only. Do not emit any cue with `zone: "intro"`.

**Verify**: `node --test lib/card-plan.test.mjs` → exit 0, plus a new case asserting `zonePartsFor` returns `['conclusion']` under `intro: 'film'` and both parts otherwise.

### Step 3: Re-derive the link-CTA position

This is the highest-risk edit in the plan.

In `lib/zone-rules.mjs`, `R_ZONE_LINK_CTA` currently instructs the pass to count
description mentions across the whole video and give the FIRST one the scrim.
When the film owns the intro, add this to the rule text:

> **When the intro is authored as a film (step 025), the film owns every mention
> inside the intro span, including the first.** Count mentions across the whole
> transcript as always, but treat every mention before the intro's end as already
> taken. In practice this means the conclusion uses the PILL
> (`link-in-description/link-in-description`) and never the scrim, because the
> scrim belongs to the film. Do not "reclaim" the scrim for the conclusion just
> because your zone has no earlier mention — the count is across the video, not
> your zone.

Add a machine check in `lib/lint-cues.mjs`: when `introOwnedByFilm(workdir)` and
a conclusion cue uses `link-scrim`, that is an error, not a warning.

**Verify**: a new `lint-cues.test.mjs` case — a fixture with `intro: 'film'` and a conclusion `link-scrim` cue fails with a message naming `link-scrim`; the same fixture under `intro: 'cards'` passes.

### Step 4: Suppress the intro-presuming lint rules

In `lib/lint-cues.mjs`:

- **E13 open-cover**: skip when `introOwnedByFilm(workdir)` — the film covers
  second zero. The skip must be explicit and commented, not a silent early
  return. The failure message the mutation gate looks for is
  `E13 must not fire when the intro film owns the opening`; put that string in
  the TEST's assertion message.
- **W15 zone-gap**: evaluate only for parts in `zonePartsFor(workdir)`.

In `lib/lint-shots.mjs`:

- **E8 INTRO_HOST**: when the film owns the intro, the 15s deadline is measured
  from the END of the intro span, not from t=0 — the host must be on screen
  within 15s of the BODY starting. Keep the rule; move its origin. Do not delete
  it: the owner's reason for E8 (*"I don't want to put a hard rule that avatar
  should be the first thing, but it should be in the starting"*) still applies to
  the body.

**Verify**: `node --test lib/lint-cues.test.mjs lib/lint-shots.test.mjs` → exit 0. **Verify the gate fires**: replace `introOwnedByFilm(workdir)` with `false` in `lib/lint-cues.mjs` → `node --test lib/lint-cues.test.mjs` must FAIL printing `E13 must not fire when the intro film owns the opening`.

### Step 5: Splice the film into the cut

In `lib/assemble.mjs`, when `introOwnedByFilm(workdir)`:

- the first segment of the assembly is `intro-film/out/intro.mp4`, occupying
  exactly `[intro.start, intro.end)` from `segments.json`;
- no card, avatar span, or effect is placed inside that span;
- if the file is missing, **throw with an actionable message** naming
  `run.sh <slug> intro-render` — never silently fall back to cards, which would
  produce a video that looks fine and is not what was configured.

Mirror the same in `lib/export-timeline.mjs` so the Resolve export matches the
assembly. These two have diverged before — commit `5cdbf0ea fix(visuals-flow): the Resolve
export had diverged from assemble in four places` is on the branch this plan
waits for. Add a test asserting both produce the same intro-span treatment.

**Verify**: `node --test lib/assemble.test.mjs lib/export-timeline.test.mjs` → exit 0, including the new cross-check case.

### Step 6: Prove the default path is untouched

The whole chain's safety claim is that a `intro: "cards"` video is unaffected.
Prove it with a paired fixture rather than by inspection:

- Lint and assemble a fixture video under `intro: 'cards'`; snapshot the outputs.
- Repeat with the intro-film code paths present but unconfigured.
- Assert the two are identical.

**Verify**: the new paired test passes, and `node lib/lint-cues.mjs best-ai-video-generator` produces the same output as on `origin/main`.

### Step 7: Fresh-checkout gate

```sh
cd "$(git rev-parse --show-toplevel)"
git worktree add --detach /tmp/187-fresh HEAD
cd /tmp/187-fresh/pipelines/video/visuals-flow && bash scripts/check.sh
git worktree remove --force /tmp/187-fresh
```

**Verify**: exit 0.

## Test plan

- `lib/intro-film/owns-intro.test.mjs` — NEW, the predicate.
- `lib/card-plan.test.mjs` — `zonePartsFor` under both modes.
- `lib/lint-cues.test.mjs` — E13 suppression, W15 scoping, the conclusion-scrim error.
- `lib/lint-shots.test.mjs` — E8 origin moves to the body start.
- `lib/assemble.test.mjs` + `lib/export-timeline.test.mjs` — the splice, the
  missing-file throw, and the assemble/export agreement.
- The paired unchanged-default fixture (Step 6).

## Done criteria

- [ ] Step 0's blocker check returns `1`
- [ ] `bash scripts/check.sh` exits 0
- [ ] A `intro: 'cards'` fixture's lint and assembly outputs are identical to `origin/main`
- [ ] A `intro: 'film'` fixture: 035 emits no `zone: "intro"` cue; the conclusion uses the pill and a `link-scrim` there is an ERROR; E13 and W15 do not fire on the intro; E8 measures from the body start
- [ ] `assemble` and `export-timeline` both place the film across `[intro.start, intro.end)` and agree with each other
- [ ] A missing `intro-film/out/intro.mp4` throws naming `intro-render`, and never falls back to cards
- [ ] Replacing `introOwnedByFilm(workdir)` with `false` in `lint-cues.mjs` makes the suite FAIL printing `E13 must not fire when the intro film owns the opening`
- [ ] No surface tests `loadRunConfig(...).intro` directly: `grep -rn "\.intro ===" lib/ | grep -v owns-intro` returns nothing
- [ ] The fresh-checkout gate passes

## STOP conditions

- **Step 0 returns `0`.** The concurrent branch has not merged. Stop immediately.
- **Any surface testing `run-config` directly** instead of `introOwnedByFilm`.
  That is the drift this plan exists to prevent.
- **Deleting E8 rather than re-anchoring it.** The rule still applies to the body.
- **A silent fallback to cards** when the film is missing. Fail loudly.
- Gate integrity: if an assertion fails, fix the code or the fixture. Weakening,
  swapping or deleting it is a STOP.
- Any live HeyGen or paid API call.

## Maintenance notes

After this lands, `intro: "film"` is a real production mode and the owner can run
a whole video through it. The remaining gap is sound: the film carries voice over
silence, with no music or SFX, while the body goes through `lib/sound/`. Whether
the intro should join that mix is an open design question, not a defect.

The riskiest ongoing coupling is `assemble.mjs` ↔ `export-timeline.mjs`. They
have diverged before (commit `5cdbf0ea`). The cross-check test added in Step 5 is
the only thing keeping them honest; do not delete it when one of them is
refactored.
