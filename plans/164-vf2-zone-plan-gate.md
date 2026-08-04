---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh && node lib/zone-plan.mjs test-03
ui: true
deploy:
needs: [plan 159 landed the `structure` field this reads]
---

# Plan 164: Zone Plan — approve the intro/conclusion card choices before anything renders

## Summary

- **Problem statement**: The owner reviews card choices only at the storyboard stage, mixed in with the whole video, and by then the cue pass has already settled on cards for the intro and conclusion. There is no point at which the owner can see — and approve — *which cards those two zones will use, and which of them do not exist yet*. New-card proposals from `R_CHOOSING` are buried in per-cue `fix` notes.
- **Goals**:
  - A new **Zone Plan** review stage: for the intro and conclusion only, every cue's chosen card, marked EXISTING or **NEW (to build)**.
  - A board tab to review and approve it, matching how every other gate works.
  - `render.mjs` refuses until it is approved, using the same pattern as `assemble`/`avatar-render`.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High).
- **Done criteria** (terse): `zone-plan.mjs test-03` emits both zones; the board tab approves; `render.mjs` refuses when unapproved.
- **Stop conditions** (terse): the gate blocks a pre-convention workdir with no `structure`; approval is auto-set by any code path.
- **Test / verification for success**: unit tests on the plan builder, plus a live board screenshot of the tab.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c37f2aa..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/run.sh`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 159 (landed)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `c37f2aa`, 2026-07-28

## Why this matters

Owner request, 2026-07-28: *"First I want to review the motion graphics which we are planning to use in intro and conclusion, whether we are planning to use existing motion graphics or we are using some new motion graphic which we'll be making. Once that is approved, we can go with our usual review flow."*

This is the cheapest possible moment to catch a wrong card. Today the first time the owner sees intro card choices is the storyboard, after the cue pass has committed to them; and if a zone needs a card that does not exist, that only surfaces as a `fix` note nobody reads until something looks wrong in the cut. The build-vs-reuse decision is exactly the kind of call the owner wants to make **before** effort is spent, not after.

It also gives `R_CHOOSING`'s propose-a-new-card clause somewhere to land. That clause is mandatory and live in the prompt, but a proposal currently has no review surface — so the practical outcome is still "use the nearest existing card".

The review model becomes four stages: **Zone Plan** (this) → Storyboard → Unattended Cut → Final Cut.

## Current state

**Approval is a flag in a JSON file that a downstream step refuses to pass.** `lib/assemble.mjs` (lines 837–838), verbatim:

```js
  if (cuesFile.approved !== true && !opts.force) {
    console.error('refusing to render: cues.json approved=false — review on the board (node lib/board.mjs <slug>) or pass --force');
```

and `lib/avatar-render.mjs` (121–122):

```js
    if (shotsFile.approved !== true && !opts.force) {
      console.error('refusing to render: shots.json approved=false — review on the board or pass --force');
```

Mirror this exactly — same `!== true`, same `--force` escape, same message shape.

**Zone boundaries already exist** (plan 159). `videos/<slug>/segments.json` carries:

```json
"structure": [
  { "part": "intro", "start": 0, "end": 117.567 },
  { "part": "body", "start": 117.567, "end": 997.3 },
  { "part": "conclusion", "start": 997.3, "end": 1076.533 }
]
```

**A proposed new card lives in a cue's `fix` note.** `R_CHOOSING`, verbatim: *"PROPOSE A NEW CARD (mandatory): when no existing card enacts the clause, the answer is a NEW TEMPLATE, not the nearest existing one. Name the card you would build and give a one-line spec of what it DOES, in the cue's `fix` note."* Cues also carry `flagged: true` in that situation.

**The board is a two-tab dashboard.** From `lib/board.mjs`:

```js
    document.getElementById('tab-final-cut').style.display = target === 'tab-final-cut' ? 'block' : 'none';
...
          <button data-target="tab-final-cut" class="tab-btn" onclick="switchTab(this)">Final Cut</button>
```

Tabs are plain divs toggled by `switchTab`, with a hash (`#final-cut`) for deep links. Add a third the same way.

**Board approval POSTs and rewrites the JSON** — see how the storyboard approve path writes `cues.json`'s `approved`; reuse that request/handler shape rather than inventing one.

**`run.sh` verbs** run: `concept-pass`, `cue-pass`, `resolve`, `audit`, `audit-gate`, `board`, `render`, … The new verb sits between `audit` and `board`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |
| Build the zone plan | `cd pipelines/video/visuals-flow && node lib/zone-plan.mjs test-03` | writes `videos/test-03/zone-plan.json` |
| Board | `cd pipelines/video/visuals-flow && node lib/board.mjs test-03` | serves on 4322 |
| Tests | `cd pipelines/video/visuals-flow && node --test lib/zone-plan.test.mjs` | `# fail 0` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/zone-plan.mjs` (new)
- `pipelines/video/visuals-flow/lib/zone-plan.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/board.mjs` (third tab + approve handler)
- `pipelines/video/visuals-flow/lib/render.mjs` (the refusal)
- `pipelines/video/visuals-flow/run.sh` (new `zone-plan` verb; `status` line)
- `pipelines/video/visuals-flow/scripts/check.sh` (register the new test file)
- `pipelines/video/visuals-flow/PIPELINE.md` (document the stage)

**Out of scope**:
- `lib/cue-rules.mjs` — this plan adds a review surface, not a rule. It does not change what the cue pass chooses.
- Building any new card. Approving a plan that names a new card produces a card-library plan; that is separate work.
- The body zone. The owner asked for intro and conclusion.
- `lib/lint-cues.mjs`.

## Git workflow

- Branch: `advisor/164-vf2-zone-plan-gate`
- Commit: `feat(visuals-flow): Zone Plan gate — approve intro/conclusion cards before render` — no AI footers. Do NOT push.

## Steps

### Step 1: `lib/zone-plan.mjs`

Inline source — place and wire it:

```js
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

// The intro and conclusion get approved on their own, before anything renders
// (owner 2026-07-28). The build-vs-reuse call is cheapest here — after that it
// is paid for in renders and re-cuts.
export const ZONE_PARTS = ['intro', 'conclusion'];

export function buildZonePlan({ structure, resolved, cues, catalogSlugs }) {
  const bySlug = new Set(catalogSlugs);
  const cueById = Object.fromEntries((cues ?? []).map((c) => [c.id, c]));
  const zones = [];
  for (const part of ZONE_PARTS) {
    const span = (structure ?? []).find((s) => s.part === part);
    if (!span) continue;
    const items = (resolved ?? [])
      .filter((r) => r.start >= span.start && r.start < span.end)
      .sort((a, b) => a.start - b.start)
      .map((r) => {
        const cue = cueById[r.id] ?? {};
        const exists = bySlug.has(r.card);
        return {
          id: r.id,
          at: +r.start.toFixed(2),
          card: r.card,
          status: exists ? 'existing' : 'new',
          placement: r.placement ?? null,
          flagged: cue.flagged === true,
          // R_CHOOSING puts a proposed new card's one-line spec in `fix`.
          proposal: cue.fix ?? null,
        };
      });
    zones.push({ part, start: span.start, end: span.end, items });
  }
  return zones;
}

export function summarize(zones) {
  const items = zones.flatMap((z) => z.items);
  return {
    cues: items.length,
    existing: items.filter((i) => i.status === 'existing').length,
    toBuild: items.filter((i) => i.status === 'new').length,
    flagged: items.filter((i) => i.flagged).length,
  };
}

function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node lib/zone-plan.mjs <slug-or-path>'); process.exit(1); }
  const workdir = resolveWorkdir(arg);
  const read = (f) => JSON.parse(fs.readFileSync(path.join(workdir, f), 'utf8'));
  const segments = read('segments.json');
  if (!segments.structure) {
    console.error('no `structure` in segments.json — this workdir predates the intro/body/conclusion convention; run the segments step first');
    process.exit(1);
  }
  const resolvedFile = read('resolved.json');
  const cuesFile = read('cues.json');
  const catalogPath = path.resolve(import.meta.dirname, '..', '..', 'card-library', 'catalog.json');
  const cat = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const catalogSlugs = (cat.cards ?? cat).map((c) => c.slug);

  const zones = buildZonePlan({
    structure: segments.structure,
    resolved: resolvedFile.resolved,
    cues: cuesFile.cues,
    catalogSlugs,
  });

  const outPath = path.join(workdir, 'zone-plan.json');
  const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  // Any change to the plan invalidates a previous approval — the owner
  // approved a specific set of cards, not the file's existence.
  const changed = JSON.stringify(prev.zones ?? null) !== JSON.stringify(zones);
  const out = {
    video: path.basename(workdir),
    approved: changed ? false : (prev.approved === true),
    zones,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  const s = summarize(zones);
  console.log(`zone plan: ${s.cues} cues across ${zones.length} zones — ${s.existing} existing, ${s.toBuild} to build, ${s.flagged} flagged`);
  console.log(`approved: ${out.approved} -> ${outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

**Verify**: `cd pipelines/video/visuals-flow && node lib/zone-plan.mjs test-03` -> prints a summary line and writes `videos/test-03/zone-plan.json` with `approved: false`.

(test-03's conclusion is outside its 300s cut, so expect the intro zone populated and the conclusion zone empty. That is correct and is itself useful signal.)

### Step 2: `run.sh` verb

Add a `zone-plan)` case between `audit)` and `board)` that runs `node lib/zone-plan.mjs "$slug"`, and add a `zone-plan.json` line to the `status)` output showing `approved` state.

**Verify**: `cd pipelines/video/visuals-flow && bash run.sh test-03 zone-plan && bash run.sh test-03 status | grep -i zone` -> the verb runs and status shows the zone-plan state.

### Step 3: Board tab

Add a third tab, **Zone Plan**, as the FIRST tab (it is the first gate). Follow the existing tab pattern exactly — a `tab-zone-plan` div, a `switchTab` button, and a `#zone-plan` hash.

Contents, per zone:

- a heading with the part name and its span
- one row per item: time, cue id, card slug, and a clear badge — `EXISTING` or **`NEW — to build`**
- for a `new` item, render its `proposal` text prominently (that is the one-line spec of what the card would DO)
- a `flagged` marker where present
- a summary line: *N cues · N existing · N to build*

Then an **Approve zone plan** button that POSTs to a new route setting `approved: true` in `zone-plan.json`, plus a banner when already approved, mirroring the existing storyboard banner:

```js
      ${cuesFile.approved ? '<div class="banner ok">…approved — ready for <code>node lib/render.mjs</code></div>' : ''}
```

**The button must be the only way `approved` becomes true.** No code path may set it.

**Verify**: run `node lib/board.mjs test-03`, open `http://localhost:4322/#zone-plan`, confirm the intro zone lists its cues with badges, click Approve, then `node -e "console.log(require('./videos/test-03/zone-plan.json').approved)"` -> `true`. **Attach a screenshot of the tab to the PR** (`ui: true`).

### Step 4: Gate `render.mjs`

At the top of `render.mjs`'s main flow, refuse when the zone plan is unapproved — mirroring `assemble.mjs` exactly:

```js
  const zonePlanPath = path.join(workdir, 'zone-plan.json');
  if (fs.existsSync(zonePlanPath)) {
    const zonePlan = JSON.parse(fs.readFileSync(zonePlanPath, 'utf8'));
    if (zonePlan.approved !== true && !opts.force) {
      console.error('refusing to render: zone-plan.json approved=false — review the Zone Plan tab (node lib/board.mjs <slug>) or pass --force');
      process.exit(1);
    }
  }
```

**Absent file = no gate**, so every pre-convention workdir keeps working. Support the same `--force` escape.

**Verify**:
```bash
cd pipelines/video/visuals-flow
node -e "const f='videos/test-03/zone-plan.json';const d=require('./'+f);d.approved=false;require('fs').writeFileSync(f,JSON.stringify(d,null,2))"
node lib/render.mjs test-03 --only c01; echo "exit=$? (expect non-zero)"
node lib/render.mjs test-03 --only c01 --force >/dev/null 2>&1; echo "force exit=$? (expect 0)"
```

### Step 5: Tests + registration

Create `lib/zone-plan.test.mjs`:

1. a cue inside the intro span appears in the intro zone; one in the body does not
2. a card slug absent from `catalogSlugs` is marked `status: 'new'`
3. a cue's `fix` note surfaces as `proposal`
4. `summarize` counts existing / toBuild / flagged correctly
5. an empty zone (no cues in span) yields `items: []` rather than being dropped

**`scripts/check.sh` enumerates its test files explicitly** — add `lib/zone-plan.test.mjs` or it never runs.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/zone-plan.test.mjs 2>&1 | tail -4` -> `# fail 0`, and `grep -c "zone-plan.test.mjs" scripts/check.sh` -> `1`

### Step 6: Document the stage

In `PIPELINE.md`, record the review model as four stages — **Zone Plan → Storyboard → Unattended Cut → Final Cut** — and note that re-running `zone-plan` after a cue change resets `approved` to false.

**Verify**: `cd pipelines/video/visuals-flow && grep -c "Zone Plan" PIPELINE.md` -> at least `1`

### Step 7: Full gate

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh && node lib/zone-plan.mjs test-03` -> both exit 0

## Test plan

Five unit tests on the pure builder (Step 5) plus the live board check in Step 3. Case 5 matters more than it looks: an empty conclusion zone must still be shown, because "the conclusion has no graphics planned" is precisely what the owner needs to see at this gate — dropping it would hide the failure this stage exists to catch.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `node lib/zone-plan.mjs test-03` writes `zone-plan.json` with both zones present
- [ ] `node --test lib/zone-plan.test.mjs` reports `# fail 0`; `scripts/check.sh` lists it
- [ ] the board serves a Zone Plan tab at `#zone-plan` with EXISTING / NEW badges — screenshot attached to the PR
- [ ] `render.mjs` exits non-zero when `approved` is false, and 0 with `--force`
- [ ] re-running `zone-plan.mjs` after editing a cue's card resets `approved` to `false`
- [ ] a workdir with no `zone-plan.json` renders exactly as before

## STOP conditions

- Any code path sets `approved: true` other than the board button. The entire value of this gate is that a human made the call.
- The gate blocks a workdir that has no `zone-plan.json` (pre-convention videos must be unaffected).
- `segments.json` has no `structure` for test-03 — plan 159 has not landed or the segments step was not re-run. Stop and report; do not compute structure here.
- You are about to build a new card because the plan named one. Out of scope — this stage produces a decision, not cards.

## Maintenance notes

- The invalidation rule is the load-bearing part: **any change to the zone plan resets `approved` to false.** The owner approves a specific set of cards, and a stale approval on a changed plan is worse than no gate.
- The gate is at `render.mjs` because that is the first expensive step after cueing. If a cheaper step ever precedes it, move the check rather than adding a second one.
- Expect the conclusion zone to be empty for any video whose cut is shorter than its source (test-03 today). That is not a bug in this tool — it is the "recorded but never used" condition plan 159 warns about, surfaced where the owner will actually see it.
