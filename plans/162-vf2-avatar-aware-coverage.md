---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh && node lib/lint-cues.mjs test-03
ui: false
deploy:
needs: [unblocks plan 158 / PR#116 — land this first]
---

# Plan 162: Coverage and absorption must see the avatar

## Summary

- **Problem statement**: `lib/lint-cues.mjs` contains zero references to avatar. On `base:"none"`, `E7 uncovered-second` counts only fullframe cards as coverage, so it demands card coverage of seconds where the presenter is already on screen; and `extendExposure`'s `base === 'none'` branch absorbs the whole gap to the next fullframe with no awareness that an avatar span sits inside it, burying the presenter under a held card — exactly what `W12 opening-host-coverage` exists to catch.
- **Goals**:
  - E7 treats an avatar span as covered. A second is only "uncovered" if it would render as a freeze frame.
  - `extendExposure` on `base:"none"` stops absorbing at the next avatar span instead of swallowing it.
  - Both fixes are driven by `avatar-jobs.json`, passed in explicitly — no new inference.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — pure logic plus unit tests, fully inlined.
- **Done criteria** (terse): `check.sh` exits 0; `lint-cues.mjs test-03` exits 0; new tests pin both behaviours.
- **Stop conditions** (terse): E4, E9 or any exclusion-zone rule is weakened; test-03's lint output changes.
- **Test / verification for success**: unit tests in `lib/lint-cues.test.mjs` and `lib/resolve.test.mjs`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1c28cdc..HEAD -- pipelines/video/visuals-flow-2/lib/lint-cues.mjs pipelines/video/visuals-flow-2/lib/resolve.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `1c28cdc`, 2026-07-28

## Why this matters

Plan 158's crew hit `E4` and `E9` on a 79.2s `base:"none"` conclusion and proposed exempting `base:"none"` from exclusion zones or letting overlays sit on cards. Both were rejected (`decisions.md`, 2026-07-28): the rules are correct, and the conflict came from a conclusion workdir that had **no footage at all** because the avatar step was never run.

But judging that surfaced a real latent bug. `base:"none"` does not mean "no presenter" — it means "no screen recording", and `fillGapsWithFreeze` only converts segments of kind `screen`; avatar segments pass through untouched and show the presenter. E7 does not know this. The moment a `base:"none"` video carries avatar spans — which plan 158 will now do — E7 will demand card coverage over seconds the presenter already fills, and absorption will stretch a card straight over the presenter.

This is the fourth instance this week of the same shape: a fact computed on one surface (`avatar-jobs.json` → avatar segments in `assemble.mjs`) never reaching the next (`lint-cues.mjs`, `resolve.mjs`).

## Current state

**`lib/lint-cues.mjs`**, E7 (lines 297–318), verbatim:

```js
  // E7 uncovered-second
  if (manifest?.base === 'none') {
    const extended = extendExposure(sortedResolved, { base: 'none', total: T });
    const fulls = extended.filter(c => bySlug[c.card]?.placement === 'fullframe').sort((a, b) => a.start - b.start);
    if (fulls.length > 0) {
      const activeStart = fulls[0].start;
      const activeEnd = T - ZONE_END;
      let cursor = activeStart;
      for (const f of fulls) {
        if (f.start > cursor) {
          const gapEnd = Math.min(f.start, activeEnd);
          if (cursor < gapEnd) {
            errors.push(`E7 uncovered-second: base is none, but [${cursor.toFixed(1)}–${gapEnd.toFixed(1)}] is not covered by a fullframe card`);
          }
        }
        cursor = Math.max(cursor, f.start + f.duration);
      }
      if (cursor < activeEnd) {
        errors.push(`E7 uncovered-second: base is none, but [${cursor.toFixed(1)}–${activeEnd.toFixed(1)}] is not covered by a fullframe card`);
      }
    }
  }
```

`grep -c avatar lib/lint-cues.mjs` returns **0**.

**`lib/resolve.mjs`**, `extendExposure` (line 407), verbatim:

```js
    let wanted = base === 'none' ? gap : (gap <= CUE_CONSTANTS.GAP_ABSORB.value ? gap : 0);
```

**`lib/assemble.mjs`** — where avatar spans become base segments (lines 102–106), verbatim:

```js
  // Base selection must stay full-only — a panel must not replace the base.
  for (const j of avatarJobs.filter((j) => j.kind === 'avatar-full')) {
    repl.push({ kind: 'avatar', id: j.id, start: j.start,
      end: Math.min(j.end, total) });
  }
```

Only `kind === 'avatar-full'` replaces the base. `panel`, `side` and corner-bubble jobs composite ON TOP of the base and therefore do **not** count as coverage — a second under a panel avatar is still a screen second and would still freeze. This distinction is load-bearing; mirror it exactly.

**`videos/test-03/avatar-jobs.json`** shape:

```json
{ "video": "test-03", "template": "specs-man", "engineMode": "test",
  "jobs": [ { "id": "s02", "kind": "avatar-full", "start": 54, "end": 82.8, "duration": 28.8, ... } ] }
```

**`lib/assemble.mjs`**, `fillGapsWithFreeze` (line 132–133): `if (base !== 'none') return segments;` then only `s.kind === 'screen'` becomes `freeze`. This is the proof that avatar seconds are not frozen and therefore need no card.

**test-03 is `base:"screen"`**, so its lint output must not change at all — it is the regression control for this plan.

**Convention to imitate**: `lib/lint-cues.test.mjs` and `lib/resolve.test.mjs` — `node:test` + `node:assert/strict`, argument objects built inline.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Per-video lint | `cd pipelines/video/visuals-flow-2 && node lib/lint-cues.mjs test-03` | exit 0 |
| Lint tests | `cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs` | `# fail 0` |
| Resolve tests | `cd pipelines/video/visuals-flow-2 && node --test lib/resolve.test.mjs` | `# fail 0` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow-2/lib/lint-cues.mjs`
- `pipelines/video/visuals-flow-2/lib/resolve.mjs`
- `pipelines/video/visuals-flow-2/lib/lint-cues.test.mjs`
- `pipelines/video/visuals-flow-2/lib/resolve.test.mjs`

**Out of scope**:
- **E4 / `ZONE_END` / `ENDCARD_SLUG_PREFIXES`** — the exclusion zone stays exactly as it is. Owner-adjacent ruling in `decisions.md` 2026-07-28: it is not to be weakened or exempted for `base:"none"`.
- **E9 / `R_OVERLAY_ON_FOOTAGE`** — overlays may not sit on cards. Unchanged.
- `lib/assemble.mjs` — it already does the right thing; this plan teaches the other two surfaces what it knows.
- `videos/test-03-conclusion/` — plan 158 owns it.
- Panel / side / bubble avatar handling — only `avatar-full` counts, exactly as in `assemble.mjs`.

## Git workflow

- Branch: `advisor/162-vf2-avatar-aware-coverage`
- Commit: `fix(vf2): E7 and exposure absorption account for avatar-full spans` — no AI footers. Do NOT push.

## Steps

### Step 1: A shared helper for avatar-full spans

In `lib/lint-cues.mjs`, add near the top (exported so the resolve side and tests can reuse it):

```js
// Only `avatar-full` REPLACES the base — panel/side/bubble composite on top of
// it, so a second under a panel avatar is still a screen second and would
// still freeze. Mirrors the filter in assemble.mjs's base selection.
export function avatarFullSpans(avatarJobs) {
  return (avatarJobs?.jobs ?? [])
    .filter((j) => j.kind === 'avatar-full' && Number.isFinite(j.start) && Number.isFinite(j.end))
    .map((j) => [j.start, j.end])
    .sort((a, b) => a[0] - b[0]);
}
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node --check lib/lint-cues.mjs && echo SYNTAX_OK` -> `SYNTAX_OK`

### Step 2: Pass `avatarJobs` into `lintCues`

Add `avatarJobs` to the destructured argument object in `lintCues({ ... })`, defaulting to `null`. Update the CLI entry point in the same file to read `videos/<slug>/avatar-jobs.json` when it exists and pass it. **Do not change the order or names of existing keys** — several tests build this object literally.

**Verify**: `cd pipelines/video/visuals-flow-2 && node lib/lint-cues.mjs test-03; echo "exit=$?"` -> `exit=0`

### Step 3: Make E7 avatar-aware

Replace the E7 block's coverage walk so an avatar-full span counts as covered. Build one merged interval list from fullframe cards AND avatar-full spans, then look for holes:

```js
  // E7 uncovered-second. "Uncovered" means the second would render as a FREEZE
  // frame — assemble.mjs only freezes segments of kind `screen`, and an
  // avatar-full span replaces the base, so a second under the presenter needs
  // no card. Without this, E7 demanded card coverage over the presenter and
  // pushed cards into the end-exclusion zone (plan 158, 2026-07-28).
  if (manifest?.base === 'none') {
    const extended = extendExposure(sortedResolved, { base: 'none', total: T });
    const fulls = extended.filter(c => bySlug[c.card]?.placement === 'fullframe').sort((a, b) => a.start - b.start);
    if (fulls.length > 0) {
      const activeEnd = T - ZONE_END;
      const spans = [
        ...fulls.map(f => [f.start, f.start + f.duration]),
        ...avatarFullSpans(avatarJobs),
      ].sort((a, b) => a[0] - b[0]);
      let cursor = spans[0][0];
      for (const [s, e] of spans) {
        if (s > cursor) {
          const gapEnd = Math.min(s, activeEnd);
          if (cursor < gapEnd) {
            errors.push(`E7 uncovered-second: base is none, but [${cursor.toFixed(1)}–${gapEnd.toFixed(1)}] is covered by neither a fullframe card nor the presenter`);
          }
        }
        cursor = Math.max(cursor, e);
      }
      if (cursor < activeEnd) {
        errors.push(`E7 uncovered-second: base is none, but [${cursor.toFixed(1)}–${activeEnd.toFixed(1)}] is covered by neither a fullframe card nor the presenter`);
      }
    }
  }
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node lib/lint-cues.mjs test-03; echo "exit=$?"` -> `exit=0` and output byte-identical to before this plan (test-03 is `base:"screen"`, so E7 never runs for it).

### Step 4: Stop absorption swallowing the presenter

In `lib/resolve.mjs`, `extendExposure` currently takes `{ base, total }`. Add an optional `avatarSpans = []` and clamp the gap so a card never extends across the start of an avatar-full span:

```js
export function extendExposure(resolved, { base, total, avatarSpans = [] }) {
```

and inside the loop, after `nextStart` is computed and before `gap`:

```js
    // A card must not be held over the presenter. On base:'none' the whole gap
    // is absorbed by default, which silently buried an avatar span — the same
    // defect W12 (plan 156) exists to catch on the opening.
    const nextAvatar = avatarSpans.find(([s]) => s > end + 0.001);
    const limit = nextAvatar ? Math.min(nextStart, nextAvatar[0]) : nextStart;
    const gap = +(limit - end).toFixed(2);
```

Remove the old `const gap = +(nextStart - end).toFixed(2);` line. Then update `resolve.mjs`'s own call site (line ~447) and `lib/board.mjs` (line 37) and the E7 call in `lint-cues.mjs` to pass `avatarSpans` where available; passing nothing keeps today's behaviour, so a caller that has no avatar data is unaffected.

**Verify**: `cd pipelines/video/visuals-flow-2 && node --check lib/resolve.mjs && node lib/resolve.mjs test-03 && node -e "const r=require('./videos/test-03/resolved.json').resolved;const c=r.find(q=>q.id==='c10');console.log(+(c.start+c.duration).toFixed(2))"` -> `176.23` (unchanged from plan 155 — test-03 is `base:"screen"` so absorption is already bounded)

### Step 5: Tests

Append to `lib/lint-cues.test.mjs`:

1. `base:"none"`, one card 0–30s, avatar-full 30–60s, `T` 80 -> **no** E7 error (the presenter covers the middle)
2. same but with no avatar jobs -> **one** E7 error naming the uncovered span
3. `base:"none"` with a `kind:"panel"` avatar job over the gap -> **one** E7 error (panel does not replace the base)
4. `base:"screen"` -> E7 never fires regardless of avatar jobs

Append to `lib/resolve.test.mjs`:

5. `extendExposure` on `base:'none'` with a card ending at 10s, next fullframe at 60s, and an avatar-full span starting at 20s -> the card's duration extends to at most 20s, not 60s
6. the same call with `avatarSpans` omitted -> today's behaviour (extends toward 60s, capped by `HOLD_EXTEND_CAP`)

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/lint-cues.test.mjs lib/resolve.test.mjs 2>&1 | tail -4` -> `# fail 0`

### Step 6: Full gate

**Verify**: `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh && node lib/lint-cues.mjs test-03` -> both exit 0

## Test plan

Six tests. Cases 3 and 6 are the ones that matter most: case 3 pins that only `avatar-full` counts (a panel avatar leaves a freezing second), and case 6 pins that a caller which passes no avatar data is completely unaffected — which is what keeps every existing video's output identical.

test-03 itself is the regression control: it is `base:"screen"`, so its lint output and `resolved.json` must be byte-identical after this plan.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` exits 0
- [ ] `node lib/lint-cues.mjs test-03` exits 0 with output unchanged from before the plan
- [ ] `node --test lib/lint-cues.test.mjs lib/resolve.test.mjs` reports `# fail 0`
- [ ] `grep -c avatar lib/lint-cues.mjs` is greater than 0
- [ ] c10 in `videos/test-03/resolved.json` still ends at `176.23`
- [ ] `git diff` shows NO change to `ZONE_END`, `ENDCARD_SLUG_PREFIXES`, the E4 block, or the E9 block

## STOP conditions

- You are about to weaken E4, E9, or exempt `base:"none"` from the exclusion zone. All three were explicitly rejected (`decisions.md`, 2026-07-28). Stop and report.
- test-03's `lint-cues` output or `resolved.json` changes in any way. This plan must be behaviour-neutral for `base:"screen"` videos. Report the diff.
- Panel / side / bubble avatar jobs end up counting as coverage. Only `avatar-full` replaces the base.
- Any existing test changes result. Report which.

## Maintenance notes

- The invariant: **"covered" means "will not render as a freeze frame."** `assemble.mjs` decides what freezes; E7 and `extendExposure` must agree with it. If `fillGapsWithFreeze` ever learns a new segment kind, all three move together.
- `avatarSpans` is optional everywhere on purpose, so no caller is forced to have avatar data and no existing video's output shifts.
- This unblocks plan 158 / PR#116, which must then run the avatar step so the conclusion actually has a presenter. A conclusion with no avatar spans remains correctly impossible to satisfy.
