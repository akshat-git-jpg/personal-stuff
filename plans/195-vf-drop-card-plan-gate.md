---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: []
needs_prs: [154]
touches: [pipelines/video/visuals-flow/lib/card-plan.mjs, pipelines/video/visuals-flow/lib/card-plan.test.mjs, pipelines/video/visuals-flow/lib/render.mjs, pipelines/video/visuals-flow/lib/board.mjs, pipelines/video/visuals-flow/lib/board.test.mjs, pipelines/video/visuals-flow/lib/board-api.test.mjs, pipelines/video/visuals-flow/steps/037-approve-card-plan-human/step.json, pipelines/video/visuals-flow/steps/037-approve-card-plan-human/README.md, pipelines/video/visuals-flow/steps/038-build-cards-llm-and-review-human/step.json, pipelines/video/visuals-flow/board-ui/src/lib/router.ts, pipelines/video/visuals-flow/board-ui/src/App.tsx, pipelines/video/visuals-flow/board-ui/src/tabs/CardPlanTab.tsx, pipelines/video/visuals-flow/board-ui/src/tabs/CardPlanTab.css, pipelines/video/visuals-flow/board-ui/test/router.test.ts, pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs]

mutation_apply: python3 - <<'PY'
p='pipelines/video/visuals-flow/lib/card-plan.mjs'
s=open(p).read()
marker='resetStoryboardApproval'
assert marker in s, 'marker missing — plan 195 Step 3 did not land'
# Neuter the reset: a changed plan no longer invalidates the storyboard approval,
# which is exactly the safety property the deleted 037 gate used to carry.
s = s.replace('if (changed) resetStoryboardApproval(', 'if (false) resetStoryboardApproval(')
open(p,'w').write(s)
PY
mutation_command: cd pipelines/video/visuals-flow && node --test lib/card-plan.test.mjs
mutation_expect: UNREVIEWED-CARD-REACHES-RENDER
mutation_cwd:
mutation_timeout:
---

# Plan 195: visuals-flow — drop the card-plan gate; judge new cards on the storyboard

## Summary

- **Problem statement**: the pipeline asks the owner to approve the card plan
  (step 037, the board's Card Plan tab) and then asks again at the storyboard
  (080). The first approval judges cards from a **written description** — a
  proposal's `propose` object — before anything is built. The owner's repeated
  failure mode is precisely "it read fine as a description and looked like a
  placeholder on screen" (dashed sponsor wells, grey silhouettes, the loading
  arc — all approved on paper). Owner decision 2026-08-07: remove 037 and its
  tab; judge built cards in context at the storyboard instead.
- **Goals**:
  - Delete the 037 approval gate, its `/approve-card-plan` endpoint, and the
    board's Card Plan tab. `card-plan.json` survives as the **new-card list**,
    a report rather than a gate.
  - **Preserve the safety property the gate carried.** Today a changed plan
    resets `card-plan.json.approved`, so a card nobody has looked at cannot
    reach render. That reset must move to the storyboard approval, not vanish.
  - Leave a machine check proving it: `UNREVIEWED-CARD-REACHES-RENDER`.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — fully inlined; the one
  piece of real judgment (the approval-reset migration) is written out below.
- **Done criteria** (terse — full list below): `check.sh` exits 0; no
  `approve-card-plan` route or `card-plan` tab anywhere; a changed card plan
  resets `cues.json.approved`; a committed screenshot of the tab row.
- **Stop conditions** (terse — full list below): the reset property cannot be
  migrated; `board-ui` files do not match either shape described below; any
  assertion weakened to get green.
- **Test / verification for success**: `scripts/check.sh` (includes the vitest
  board-ui suite and `board-ui-smoke.mjs`) plus a mutation proving the migrated
  reset can fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2e2dd69d..HEAD -- pipelines/video/visuals-flow/board-ui pipelines/video/visuals-flow/lib/card-plan.mjs pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/lib/render.mjs pipelines/video/visuals-flow/steps`
>
> **Expect drift here and do not fight it** — see "Concurrent work" below.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 194 (removes `waivable`/`gateWaived`, which this plan's gate code still references)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `2e2dd69d`, 2026-08-07

## Why this matters

Two owner approvals cover the same decision at different fidelities. 037 shows
the plan as a list of names and descriptions; 080 shows the resolved storyboard
with real timings and, once 038 has run, the actual built cards. Approving
twice is friction, and the earlier approval is the weaker one — it is a
paper review of things that do not exist yet.

The counter-argument, and the thing this plan must not lose: 037 is where
**proposed new cards** are killed or greenlit before anyone builds them, and
`card-plan.mjs` deliberately invalidates a stale approval so that a card landing
after approval forces a re-look. `steps/038`'s summary states the invariant
outright: *"landing it flips its plan item `new` → `existing`, which resets the
037 approval by design, so a card nobody has looked at cannot reach 090."*

Deleting the gate naively deletes that invariant, and the failure is silent: a
card gets built, lands, and renders with no human ever having seen it. So the
reset moves to the gate that survives. The owner still judges every new card —
later, and against a rendered frame instead of a sentence.

## Current state

All paths relative to `pipelines/video/visuals-flow/`.

### The gate is enforced in three places

**1. `lib/render.mjs` lines ~198–209** — refuses to render an unapproved plan.
(Shown post-194: plan 194 already removed the `&& !gateWaived(...)` clause.)

```js
  const cardPlanPath = path.join(workdir, 'card-plan.json');
  if (fs.existsSync(cardPlanPath)) {
    const cardPlan = JSON.parse(fs.readFileSync(cardPlanPath, 'utf8'));
    if (cardPlan.approved !== true && !opts.force) {
      console.error('refusing to render: card-plan.json approved=false — review the Card Plan tab (node lib/board.mjs <slug>) or pass --force');
      process.exit(1);
    }
  }
```

**2. `lib/board.mjs` lines 862–866 and 1300** — the approve action and its route:

```js
  const zpPath = path.join(workdir, 'card-plan.json');
  const cardPlan = JSON.parse(fs.readFileSync(zpPath, 'utf8'));
  cardPlan.approved = true;
  fs.writeFileSync(zpPath, JSON.stringify(cardPlan, null, 2));
  recordGate(workdir, gateNumberFor('card-plan.json'), 'Owner approved the card plan — every card the video will use, body and zones.', 'card-plan.json approved=true');
```
```js
  if (req.method === 'POST' && url.pathname === '/approve-card-plan') {
```

**3. `lib/card-plan.mjs` main(), lines ~165–176** — writes the file and manages
the approval reset. This is the part that carries the invariant:

```js
  const outPath = path.join(workdir, 'card-plan.json');
  const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  // Any change to the plan invalidates a previous approval — the owner
  // approved a specific set of cards, not the file's existence.
  const changed = JSON.stringify(prev.sections ?? null) !== JSON.stringify(sections);
  const out = {
    video: path.basename(workdir),
    approved: changed ? false : (prev.approved === true),
    sections,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
```

### The step declarations

`steps/037-approve-card-plan-human/step.json` at `2e2dd69d` (post-194 it has no
`waivable`/`requires` keys):

```json
{
  "number": "037",
  "slug": "037-approve-card-plan-human",
  "title": "approve the card plan",
  "actor": "human",
  "verbs": ["card-plan"],
  "consumes": ["cues.json"],
  "produces": ["card-plan.json"],
  "gate": { "file": "card-plan.json", "field": "approved", "label": "Card Plan" },
  "tab": "card-plan",
  "external": false,
  "optional": false
}
```

`lib/steps.mjs` validates `if (s.gate !== null && s.tab === null) die('a gate needs a board tab to be approved on')` — so gate and tab must be removed **together**, and a step must still declare an effect (`produces` is non-empty here, so it stays legal).

### The board UI

`board-ui/src/lib/router.ts` owns `TAB_TABLE`, the single source of tab identity,
order and hashes. `board-ui/src/tabs/CardPlanTab.tsx` (9.0K) + `CardPlanTab.css`
(2.2K) render the tab. `board-ui/src/App.tsx` routes to it.
`board-ui/test/router.test.ts` pins the table. `scripts/board-ui-smoke.mjs`
renders fixtures headlessly and asserts on the result.

**`CardPlanTab.css` is the file that caused the mangled Storyboard banner**
(2026-08-06): it declared an unscoped `.banner { display: flex }` while
rendering no banner, and Vite bundles all CSS into one file. Deleting this file
removes that hazard permanently — but `board-ui/src/components/Banner.css` is
now the single owner of `.banner`, so **verify the Storyboard notice still
renders as a block** after deletion rather than assuming it.

### Concurrent work — read this before the drift check alarms you

A second session is editing `board-ui` in parallel (tab reorder + review-surface
width). At planning time its changes were uncommitted in the working tree:

- `router.ts` — `TAB_TABLE` reordered so **Intro precedes Card Plan**, with a
  comment citing *owner decision 2026-08-07*.
- `App.tsx`, `test/router.test.ts`, `scripts/board-ui-smoke.mjs`,
  `components/ReviewSurface.css`, `tabs/IntroTab.{tsx,css}` — the width work,
  plus a router unit test pinning the new order.
- `pipelines/video/visuals-flow/decisions.md` — its own dated entry.

That work **must land before this plan runs**. Its router test pins a table that
includes `card-plan`; this plan removes that row, so the test needs updating as
part of this plan, not reverting.

**Therefore**: do not trust the `TAB_TABLE` excerpt above as byte-exact. Re-read
`router.ts` before editing. Either shape is acceptable:
- Card Plan second (`run, card-plan, intro, storyboard, final-cut, calibrate`)
- Intro second (`run, intro, card-plan, storyboard, final-cut, calibrate`)

If it matches **neither**, STOP and report — something else changed.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exits 0, `visuals-flow check OK` |
| board-ui unit tests | `cd pipelines/video/visuals-flow/board-ui && npx vitest run` | exits 0 |
| board-ui build | `cd pipelines/video/visuals-flow/board-ui && npm run build` | exits 0, writes `dist/` |
| board-ui smoke | `cd pipelines/video/visuals-flow && node scripts/board-ui-smoke.mjs` | `board-ui smoke OK` |
| Registry doc check | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exits 0 |

`check.sh` builds `board-ui` **before** running `node --test`, because
`board.test.mjs` fetches `/` which serves `board-ui/dist`. Never reorder that.

## Scope

**In scope** (under `pipelines/video/visuals-flow/`):
- `lib/card-plan.mjs`, `lib/card-plan.test.mjs`
- `lib/render.mjs`, `lib/board.mjs`, `lib/board.test.mjs`, `lib/board-api.test.mjs`
- `steps/037-approve-card-plan-human/{step.json,README.md}`
- `steps/038-build-cards-llm-and-review-human/step.json` (summary text only)
- `board-ui/src/lib/router.ts`, `board-ui/src/App.tsx`
- `board-ui/src/tabs/CardPlanTab.tsx` + `CardPlanTab.css` (both deleted)
- `board-ui/test/router.test.ts`, `scripts/board-ui-smoke.mjs`
- `PIPELINE.md` (regenerated, never hand-edited)

**Out of scope** — looks related, do not touch:
- **The step folder NAME.** `037-approve-card-plan-human` keeps its name even
  though it no longer approves anything. `lib/run-log.mjs` derives valid ledger
  keys from step slugs, and two finished videos have ledger entries under this
  name. Plan 197 renames and migrates every slug **in one pass**; renaming here
  would mean two migrations and two chances to strand a ledger.
- **The 080 storyboard gate and the 120 final-cut gate.** Untouched.
- **`card-plan.json`'s `sections` shape.** The new-card list keeps its structure;
  only the `approved` field goes.
- **Anything under `videos/`.** Existing `card-plan.json` files keep a now-inert
  `approved` key; nothing reads it after this plan.
- **The other session's width/order work.** Land it, build on it, never revert it.

## Git workflow

- Branch: `advisor/195-vf-drop-card-plan-gate`
- Commit per step, message `plan 195 step N: <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Confirm a green baseline

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

**Verify**: exits 0. If red before you change anything, STOP.

### Step 2: `lib/render.mjs` — stop enforcing the card-plan approval

Delete the whole `cardPlanPath` block quoted in Current state (the `const
cardPlanPath` line through its closing brace), and replace it with:

```js
  // The 037 card-plan gate was removed 2026-08-07 (plan 195): approving cards
  // from a written description is the weaker of the two reviews, and the
  // storyboard gate below judges the SAME cards built and in context. The
  // safety property 037 carried — a card nobody looked at cannot reach render —
  // now lives in card-plan.mjs's resetStoryboardApproval().
```

Also update the comment above it that begins `// Both board gates here are
waivable` — after plan 194 nothing is waivable and there is only one gate here.
Replace it with:
`// The storyboard gate. The new-card look-preview is separate and earlier: it is a conversation gate before a card is ever built (DESIGN.md item 0), so nothing at render time stands in for it.`

**Verify**: `grep -c "card-plan.json approved" lib/render.mjs` → `0`

### Step 3: `lib/card-plan.mjs` — migrate the reset to the storyboard approval

This is the load-bearing edit. Add this exported function near the top of the
module (after the imports, before `buildCardPlan`):

```js
// The 037 gate used to hold this invariant: any change to the plan invalidated
// the owner's approval, so a card that landed AFTER approval could not reach
// render unseen (steps/038's summary states it outright). Plan 195 deleted that
// gate, so the reset moves to the gate that survives — the 080 storyboard.
// Deleting the reset instead of moving it is the silent-failure case: a card
// gets built, lands, and renders with nobody ever having looked at it.
export function resetStoryboardApproval(workdir, reason) {
  const touched = [];
  for (const name of ['cues.json', 'shots.json']) {
    const p = path.join(workdir, name);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data.approved !== true) continue;
    data.approved = false;
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    touched.push(name);
  }
  if (touched.length) {
    console.error(`storyboard approval reset (${touched.join(', ')}): ${reason}`);
  }
  return touched;
}
```

Then rewrite the `main()` block quoted in Current state to:

```js
  const outPath = path.join(workdir, 'card-plan.json');
  const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  const changed = JSON.stringify(prev.sections ?? null) !== JSON.stringify(sections);
  const out = {
    video: path.basename(workdir),
    sections,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  if (changed) resetStoryboardApproval(workdir, 'the card plan changed — re-approve the storyboard');
```

Note the removal of `approved` from `out` entirely, and that the trailing
`console.log('approved: ...')` line at the end of `main()` must be replaced with:

```js
  console.log(`card plan -> ${outPath}${changed ? '  (storyboard approval reset)' : ''}`);
```

**Verify**: `grep -c "approved" lib/card-plan.mjs` → a non-zero count that
appears **only** inside `resetStoryboardApproval` and its comment; `grep -n
"out.approved\|approved:" lib/card-plan.mjs` → no matches.

### Step 4: a test for the migrated invariant

Append to `lib/card-plan.test.mjs` (importing `resetStoryboardApproval` from
`./card-plan.mjs`, and `fs`/`os`/`path` if not already imported):

```js
test('a changed card plan resets the storyboard approval', () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'card-plan-reset-'));
  fs.writeFileSync(path.join(w, 'cues.json'), JSON.stringify({ approved: true, cues: [] }) + '\n');
  fs.writeFileSync(path.join(w, 'shots.json'), JSON.stringify({ approved: true, shots: [] }) + '\n');

  const touched = resetStoryboardApproval(w, 'test');

  assert.deepStrictEqual(touched.sort(), ['cues.json', 'shots.json'],
    'UNREVIEWED-CARD-REACHES-RENDER: a changed card plan must reset BOTH storyboard approvals');
  for (const f of ['cues.json', 'shots.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(w, f), 'utf8'));
    assert.strictEqual(data.approved, false,
      `UNREVIEWED-CARD-REACHES-RENDER: ${f} must be back to approved=false — the 037 gate used to carry this, and losing it lets a card nobody looked at reach render`);
  }
  fs.rmSync(w, { recursive: true, force: true });
});

test('resetStoryboardApproval is a no-op when nothing was approved', () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'card-plan-reset-noop-'));
  fs.writeFileSync(path.join(w, 'cues.json'), JSON.stringify({ approved: false, cues: [] }) + '\n');
  assert.deepStrictEqual(resetStoryboardApproval(w, 'test'), [],
    'UNREVIEWED-CARD-REACHES-RENDER: an already-unapproved file must not be rewritten');
  fs.rmSync(w, { recursive: true, force: true });
});
```

**Verify**: `node --test lib/card-plan.test.mjs` → exits 0

### Step 5: `lib/board.mjs` — remove the approve action and its route

- Delete the `/approve-card-plan` route block (line ~1300) in its entirety.
- Delete the approve function containing lines 862–866 (the `zpPath` block). If
  it is a named function reached only by that route, delete the function too;
  if it is inline in a dispatcher, delete just the branch.
- Remove the now-unused `gateNumberFor('card-plan.json')` usage. **Leave
  `gateNumberFor` itself alone** — the storyboard and final-cut gates use it.
- Update `lib/board.test.mjs` and `lib/board-api.test.mjs`: delete tests that POST
  `/approve-card-plan` or assert `card-plan.json.approved`. **Do not delete a test
  that covers something else in passing** — narrow it instead.

**Verify**: `grep -rc "approve-card-plan" lib/ board-ui/src/ | grep -v ':0' || echo NONE` → `NONE`

### Step 6: the step declarations

`steps/037-approve-card-plan-human/step.json` — set `"actor": "run"`, and set
both `"gate"` and `"tab"` to `null`. Update `title` to `"build the card plan"`
and `summary` to:

```
`cues.json` + `catalog.json` -> `card-plan.json`: every card the video will use, and which of them do not exist yet. A REPORT, not a gate (plan 195) — new cards are judged built and in context at the 080 storyboard.
```

Remove any `nextHint` mentioning approval.

`steps/038-build-cards-llm-and-review-human/step.json` — its `summary` still says
*"resets the 037 approval by design"*. Replace that clause with *"resets the 080
storyboard approval by design (plan 195)"*.

`steps/037-approve-card-plan-human/README.md` — rewrite the header and the
approval section to describe a report. Keep the file; it documents the step.

Regenerate the doc: `node scripts/gen-pipeline-table.mjs`

**Verify**: `node scripts/gen-pipeline-table.mjs --check` → exits 0, and
`node -e "import('./lib/steps.mjs').then(m=>{const s=m.loadSteps().find(x=>x.number==='037');console.log(s.gate, s.tab, s.actor)})"`
→ `null null run`

### Step 7: board-ui — remove the Card Plan tab

**Re-read `board-ui/src/lib/router.ts` first** (see "Concurrent work").

- `router.ts`: delete the `'card-plan'` member from the `Tab` union type and its
  row from `TAB_TABLE`. Change nothing else — order, hashes and the derived maps
  all follow from the table.
- Delete `board-ui/src/tabs/CardPlanTab.tsx` and `board-ui/src/tabs/CardPlanTab.css`.
- `board-ui/src/App.tsx`: delete the `CardPlanTab` import and its routing branch.
- `board-ui/test/router.test.ts`: update the expected tab list. If the other
  session's test pins the exact order, keep its shape and just drop `card-plan`.
  **Do not delete the test.**

**Verify**: `cd board-ui && npx vitest run` → exits 0; then
`grep -rc "card-plan\|CardPlanTab" src/ test/ | grep -v ':0' || echo NONE` → `NONE`

### Step 8: the smoke test, the banner check, and the screenshot

`scripts/board-ui-smoke.mjs` — remove any card-plan fixture/assertion. Then add
an assertion that the tab row no longer offers it, next to the existing tab
assertions:

```js
assert.ok(!html.includes('>Card Plan<'),
  'the Card Plan tab was removed (plan 195) — a button for a deleted tab routes nowhere');
```

**The banner regression check.** `CardPlanTab.css` declared an unscoped
`.banner { display: flex }` that mangled the Storyboard notice (2026-08-06).
`components/Banner.css` now owns `.banner`. The existing stylesheet-level guard
in this smoke script asserts `.banner` is not a flex container — confirm it still
runs and passes after the deletion; if that guard was living in
`CardPlanTab.css`'s absence rather than in `Banner.css`, fix `Banner.css`.

**Screenshot (boss requires it — `ui: true`).** Build the board, open it, and
commit one PNG under `pipelines/video/visuals-flow/docs/screenshots/` showing the
tab row **without** Card Plan and the Storyboard notice rendering as a block:

```bash
cd pipelines/video/visuals-flow && node lib/board.mjs consistent-ai-influencer
# open http://localhost:4322/?video=consistent-ai-influencer#storyboard and capture
```

**Verify**: `node scripts/board-ui-smoke.mjs` → `board-ui smoke OK`, and
`git status --porcelain` shows exactly one added `.png`.

### Step 9: full gate, then prove the migrated invariant can fail

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

Then run this plan's frontmatter mutation by hand: neuter the reset
(`if (changed)` → `if (false)`), confirm `node --test lib/card-plan.test.mjs`
**fails** printing `UNREVIEWED-CARD-REACHES-RENDER`, revert, confirm green.

**Verify**: `check.sh` exits 0; mutation fails with the expected string; revert restores green.

## Test plan

- Two new tests in `lib/card-plan.test.mjs` cover the migrated invariant in both
  directions (resets when approved; no-op when not).
- The existing board-ui vitest suite and `board-ui-smoke.mjs` cover tab removal;
  the smoke assertion is negative (no Card Plan button) because a removed tab has
  no positive surface to assert on.
- The registry doc check proves 037's declaration still loads with `gate: null`.
- The mutation proof demonstrates the invariant test is not vacuous — which
  matters more here than anywhere else in the batch, because this plan's whole
  risk is silently losing a safety property while every other gate stays green.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `grep -rn "approve-card-plan\|CardPlanTab" lib/ board-ui/src/ board-ui/test/ scripts/` returns no matches
- [ ] `ls board-ui/src/tabs/CardPlanTab.tsx board-ui/src/tabs/CardPlanTab.css 2>&1 | grep -c "No such file"` → `2`
- [ ] `node -e "import('./lib/steps.mjs').then(m=>{const s=m.loadSteps().find(x=>x.number==='037');process.exit(s.gate===null&&s.tab===null?0:1)})"` exits 0
- [ ] `node --test lib/card-plan.test.mjs` exits 0 with the two new tests passing
- [ ] The frontmatter mutation makes `card-plan.test.mjs` fail printing `UNREVIEWED-CARD-REACHES-RENDER`; reverting restores green
- [ ] One screenshot committed showing the tab row without Card Plan, and the Storyboard notice rendering as a block (not a flex row)
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0

## STOP conditions

- **Baseline red** at Step 1, before any change.
- **`router.ts` matches neither shape** described in "Concurrent work" — something
  other than the known parallel session changed it.
- **The reset cannot be migrated.** If `cues.json`/`shots.json` turn out not to be
  the right targets for `resetStoryboardApproval` (e.g. the 080 gate reads a
  different file), STOP and report rather than picking a target. Losing this
  invariant is the one outcome this plan must not produce.
- **Gate integrity.** If an assertion fails, fix the code or the fixture.
  Weakening, `skip`-ing or deleting an assertion to reach green is a STOP —
  including the board-ui router test the other session just wrote.
- **Renaming the 037 folder.** Out of scope; plan 197 owns every rename.
- **The Storyboard banner renders as a flex row** after deleting `CardPlanTab.css`
  — that means `.banner` ownership did not land where this plan assumes. STOP and
  report rather than re-adding a global `.banner` rule.

## Maintenance notes

- **Plan 2 of 4** (194 → **195** → 196 → 197). 196 promotes the loose verbs into
  steps; 197 renumbers everything and migrates the ledgers.
- **`card-plan.json` in existing videos keeps an inert `approved` key.** Nothing
  reads it after this plan. Plan 197's migration may clean it; until then a
  reviewer seeing it should know it is dead.
- **This is the only plan in the batch that touches `board-ui`,** deliberately —
  one collision point with the concurrent board session instead of three.
- **A reviewer should scrutinise**: that `resetStoryboardApproval` writes with a
  trailing newline and 2-space indent matching how these files are written
  elsewhere (a formatting-only diff on `cues.json` will show up in every
  subsequent `git status` and looks like data loss at a glance), and that Step 5
  removed the route without disturbing `gateNumberFor`'s other two callers.
