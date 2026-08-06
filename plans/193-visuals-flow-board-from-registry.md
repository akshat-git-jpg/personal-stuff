---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: []
needs_prs: [191]
touches: [pipelines/video/visuals-flow/lib/board.mjs, pipelines/video/visuals-flow/lib/board-data.mjs, pipelines/video/visuals-flow/board-ui/src/lib/router.ts, pipelines/video/visuals-flow/board-ui/src/components/AppHeader.tsx, pipelines/video/visuals-flow/board-ui/src/App.tsx, pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs]

mutation_apply: cd pipelines/video/visuals-flow && python3 -c "import json; p='steps/027-approve-intro-film-human/step.json'; d=json.load(open(p)); d['tab']=None; d['gate']=None; json.dump(d,open(p,'w'),indent=2)"
mutation_command: bash scripts/check.sh
mutation_expect: E-BOARD
mutation_cwd: pipelines/video/visuals-flow
mutation_timeout: 900
---

# Plan 193: the board derives its tabs and gates from the registry

## Summary

- **Problem statement**: The board renders all five tabs for every video because
  `AppHeader` maps a hardcoded `TABS` array, and `board-data.mjs` never exposes
  `run-config`, so the UI *cannot* gate even if it wanted to — an `intro: "cards"`
  video shows an Intro tab that can only render an empty state. Gate step numbers
  are hardcoded in three places in `board.mjs`, and `REVIEW_NAMESPACES` is a
  hand-maintained list whose own comment calls it "THE EXTENSION POINT for a new
  review step".
- **Goals**:
  - Tabs, gate step numbers, and review namespaces all DERIVE from the step
    registry (plan 191) plus the video's `run-config`.
  - A tab whose step does not apply to this video is not rendered.
  - `/api/board-data` exposes `runConfig` and the applicable tab list.
  - Replace the 2-second poll that fetches `/api/board-data` and discards the
    payload with a cheap `/health` probe.
  - The smoke gate asserts the derivation, so a new review step needs no board code.
- **Executor proposed**: `claude-p` / sonnet. Routing rationale: `rules.md`'s
  "quality-setting content the owner judges by taste" row, reinforced by LESSONS
  2026-07-31 — the 169–174 board-SPA batch on this exact surface shipped three
  real defects under green gates with agy (a data-loss punt, hanging server
  tests, UA-default controls). This surface has a documented executor failure
  history; it is not a place to take the cheap default.
- **Done criteria** (terse — full list below): `check.sh` exits 0; an
  `intro: "cards"` video renders no Intro tab and an `intro: "film"` video does;
  no hardcoded gate step numbers or tab list remain; `E-BOARD` fires when a
  gate's `tab` is removed from the registry.
- **Stop conditions** (terse — full list below): a tab's data contract cannot be
  derived; any gate's approve behaviour would change; a server-opening test
  cannot be given guaranteed teardown.
- **Test / verification for success**: `scripts/check.sh`, which already runs
  `board-ui` vitest + `tsc` build + `scripts/board-ui-smoke.mjs` (real server +
  headless Chrome). New smoke assertions per tab-visibility case, plus a
  committed screenshot (boss's `ui: true` gate).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b5a60bda..HEAD -- pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/lib/board-data.mjs pipelines/video/visuals-flow/board-ui pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — the board is the owner's review surface for three gates; a tab
  that wrongly disappears blocks a review.
- **Depends on**: 191 (the registry's `tab` / `gate` / `requires.intro` fields are
  this plan's input)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `b5a60bda`, 2026-08-06

## Why this matters

`decisions.md` 2026-08-06 already set the principle for this surface:

> **"A NEW STEP ADDS NO CODE HERE."** Mount `<ReviewSurface>` with your
> `namespace`, `postUrl` and slots, and add the namespace to `REVIEW_NAMESPACES`
> in `lib/board.mjs` to get edit + delete.

That refactor got the review *component* right — Final Cut and Intro now share
one `ReviewSurface` instead of two 400-line near-copies, and the cost of that
duplication is recorded in the same entry (the non-Final-Cut copy shipped with no
screenshot attach, no comment edit, dead transport, and a clock frozen at
00:00:00). But the sentence still contains an "and add the namespace to a list
in `board.mjs`" — the principle is not yet true of the board's own wiring. Four
hand-maintained things remain:

1. `board-ui/src/lib/router.ts` — `TABS`, `HASH_TAB` and `TAB_HASH`: three
   parallel structures listing the same five tabs.
2. `board-ui/src/components/AppHeader.tsx` — `TABS.map(...)` renders every tab
   unconditionally, for every video.
3. `lib/board.mjs:517` — `REVIEW_NAMESPACES = ['intro', 'final']`.
4. `lib/board.mjs:808 / :842 / :1228` — `recordGate(workdir, '037' | '120' | '027', …)`
   with the step number as a string literal.

And `lib/board-data.mjs` never reads `run-config.json` at all, so the client has
no way to know which intro flow this video uses. The visible symptom today: an
`intro: "cards"` video shows an Intro tab that renders only the "no intro film"
empty state. That is a dead surface presented as a live one — the same class of
defect as the wrong-video banner the owner reported on 2026-08-06, which
`App.tsx` now warns about explicitly.

There is also a small, real waste: `App.tsx:53-64` fetches `/api/board-data`
every 2 seconds purely to detect a dead backend and throws the response away,
while the real data only refreshes on an explicit `refetch`. `board-data.mjs`
does filesystem work on every one of those calls.

## Current state

### `board-ui/src/lib/router.ts`, in full

```ts
export type Tab = 'run' | 'card-plan' | 'intro' | 'storyboard' | 'final-cut' | 'calibrate';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'card-plan', label: 'Card Plan' },
  { id: 'intro', label: 'Intro' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'final-cut', label: 'Final Cut' },
];
const HASH_TAB: Record<string, Tab> = {
  '#card-plan': 'card-plan', '#intro': 'intro', '#storyboard': 'storyboard', '#final-cut': 'final-cut', '#calibrate': 'calibrate'
};
export const TAB_HASH: Record<Tab, string> = {
  run: '', 'card-plan': '#card-plan', intro: '#intro', storyboard: '#storyboard', 'final-cut': '#final-cut', calibrate: '#calibrate'
};
// No hash lands on Run — owner decision 2026-07-24; the Run tab exists so
// someone who has not watched the terminal can open one URL and see status.
export function tabForHash(hash: string): Tab { return HASH_TAB[hash] ?? 'run'; }
```

Note `calibrate` is reachable by hash but deliberately NOT in `TABS` (no button).
Preserve that. `run` deliberately has no hash. Preserve that too.

### `AppHeader.tsx` — the unconditional render

```tsx
        <nav className="app-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={'tab-btn' + (t.id === props.tab ? ' active' : '')}
                    onClick={() => props.onTab(t.id)}>{t.label}</button>
          ))}
        </nav>
```

### `lib/board.mjs:517` — the review namespace list

```js
// THE EXTENSION POINT for a new review step. A step names its comments
// "<namespace>:<n>" (intro:0) or "<namespace>-<variant>:<n>" (final-v1:0); add
// the namespace here and that step gets edit and delete with no route change.
//
// Deliberately a list and not a permissive "anything:<n>" pattern: cue:7 is a
// storyboard cue note owned by a different surface with its own lifecycle, and
// letting this endpoint delete one is how a comment disappears from a tab that
// never offered to delete it.
export const REVIEW_NAMESPACES = ['intro', 'final'];
```

**The "deliberately a list" reasoning is load-bearing and must survive.** Derive
the list from the registry; do NOT replace it with a permissive pattern.

### The three hardcoded gate numbers

```js
board.mjs:808   recordGate(workdir, '037', 'Owner approved the card plan …', 'card-plan.json approved=true');
board.mjs:842   recordGate(workdir, '120', `Owner approved the final cut (version ${payload.version}).`, …);
board.mjs:1228  recordGate(workdir, '027', 'Owner approved the intro film.', 'intro-film/screenplay.json approved=true');
```

`board.mjs:750-753` also documents that 080 stays `running` until BOTH the
graphics and shots approvals are in — that behaviour is out of scope, keep it.

### `App.tsx:53-64` — the discarding poll

```tsx
  useEffect(() => {
    if (!video) return;
    const timer = setInterval(async () => {
      try {
        await fetch(`/api/board-data?video=${encodeURIComponent(video)}`);
        setBackendDead(false);
      } catch (e) {
        setBackendDead(true);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [video]);
```

### The rendered-truth gate

`scripts/board-ui-smoke.mjs` (577 lines) boots a REAL server plus headless
Chrome and asserts against a `probe=layout` meta tag that `App.tsx:76-98`
injects. `decisions.md` 2026-07-31 and 2026-08-06 both name it as the gate that
pins chrome position and the shared `ReviewSurface` markers. Extend it; do not
replace it.

### Conventions to match

- Browser UI here is a Vite + React + TS component app. `decisions.md` 2026-07-31
  and the architecture contract forbid regressing to server-rendered template
  strings. `board-ui/` is itself the exemplar.
- **UA-default controls are a recurring defect class on this exact surface**
  (LESSONS 2026-07-31): the 174 crew re-introduced unstyled `select` / button
  controls because scoped CSS (`.app-tabs .tab-btn`) silently missed reused class
  names. Any control you touch must be styled in both themes.
- `check.sh` runs `board-ui` vitest + `npm run build` (which is `tsc && vite build`)
  BEFORE `node --test`, because board tests fetch `/` which serves
  `board-ui/dist`. Do not reorder those steps.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| UI unit tests | `cd pipelines/video/visuals-flow/board-ui && npx vitest run` | exit 0 |
| Typecheck + build | `cd pipelines/video/visuals-flow/board-ui && npm run build` | exit 0 |
| Rendered-truth smoke | `cd pipelines/video/visuals-flow && node scripts/board-ui-smoke.mjs` | exit 0, `board-ui smoke OK` |
| Server unit tests | `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs lib/board-api.test.mjs` | exit 0 |

## Scope

**In scope**:
- `lib/board-data.mjs` — expose `runConfig` + the applicable tab list
- `lib/board.mjs` — derive `REVIEW_NAMESPACES` and gate step numbers from the registry; add `/health`
- `board-ui/src/lib/router.ts` — one tab table, hash maps derived from it
- `board-ui/src/components/AppHeader.tsx` — render only applicable tabs
- `board-ui/src/App.tsx` — gate the tab render blocks; replace the 2s poll
- `board-ui/src/lib/api.ts` — the `BoardData` type gains the new fields
- `board-ui/test/` — new unit tests for the derivation
- `scripts/board-ui-smoke.mjs` — assert tab visibility per intro mode
- `docs/screenshots/` — the committed screenshot for boss's `ui: true` gate

**Out of scope** — looks related, do not touch:
- `pipelines/video/intro-studio/` — a DIFFERENT standalone flow the owner is NOT
  using. Do not touch, import, or reference it.
- `ReviewSurface.tsx` / `ReviewSurface.css` — landed 2026-08-06; this plan changes
  who MOUNTS them, never the component. `decisions.md`: "Nothing in the component
  may branch on which step is using it."
- The 080 two-click gate behaviour (`board.mjs:750-753`).
- `StoryboardTab.tsx` internals, `CardPlanTab.tsx` internals, timeline/minimap code.
- `lib/steps.mjs` — plan 191 owns it. Read it; do not change its schema. If a
  field you need is missing, that is a STOP.
- Adding a new tab or review step. This plan makes that free; it does not do it.

## Git workflow

- Branch: `advisor/193-visuals-flow-board-from-registry`
- Commit per step, message `refactor(vf): <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Server exposes the registry-derived tab list and run-config

In `lib/board-data.mjs`, add a function and include its result in the payload
`buildBoardData` returns:

```js
import { loadSteps } from './steps.mjs';
import { loadRunConfig } from './run-config.mjs';

// Which board tabs apply to THIS video, derived from the step registry plus the
// video's run-config. Before this, board-ui rendered all five tabs for every
// video because it had no way to know: board-data never exposed run-config, so
// an intro:"cards" video showed an Intro tab that could only render the "no
// intro film" empty state — a dead surface presented as a live one.
//
// 'run' and 'calibrate' are ALWAYS applicable: they are not step reviews. 'run'
// is the status view (owner decision 2026-07-24) and 'calibrate' is a
// hash-only card-rendering page with no tab button.
export const ALWAYS_TABS = ['run', 'calibrate'];

export function applicableTabs(workdir, { steps = null } = {}) {
  const cfg = loadRunConfig(workdir);
  const tabs = new Set(ALWAYS_TABS);
  for (const s of (steps ?? loadSteps())) {
    if (!s.tab) continue;
    if (s.requires.intro !== null && s.requires.intro !== cfg.intro) continue;
    tabs.add(s.tab);
  }
  return [...tabs];
}
```

Add `runConfig` (the loaded config) and `tabs` (the `applicableTabs` result) to
the `/api/board-data` response. Keep every existing field — this endpoint is the
SPA's contract (`decisions.md` 2026-07-31, plan 169).

**Verify**: `node --test lib/board-api.test.mjs` → exit 0; and
`node -e "import('./lib/board-data.mjs').then(m=>console.log(m.applicableTabs('videos/<a cards video>')))"` → a list WITHOUT `intro`

### Step 2: Derive REVIEW_NAMESPACES and the gate numbers

In `lib/board.mjs`, replace the literal list, keeping the "deliberately a list"
rationale:

```js
// THE EXTENSION POINT for a new review step — now derived, not maintained. A
// step declares `tab` and `gate` in its steps/<slug>/step.json; its review
// namespace is its tab id with '-' collapsed (final-cut -> final). Add the step,
// get edit + delete, change no code here (decisions.md 2026-08-06).
//
// STILL deliberately a closed list and NOT a permissive "anything:<n>" pattern:
// cue:7 is a storyboard cue note owned by a different surface with its own
// lifecycle, and letting this endpoint delete one is how a comment disappears
// from a tab that never offered to delete it.
export const REVIEW_NAMESPACES = reviewNamespacesFromRegistry();
```

Author `reviewNamespacesFromRegistry()` as: for every step with a non-null `tab`
AND a non-null `gate`, map the tab id to its namespace via this EXACT table
(inline it — do not infer a rule from two data points):

```js
const TAB_NAMESPACE = { intro: 'intro', 'final-cut': 'final' };
```

Steps whose tab has no entry contribute no namespace. This reproduces
`['intro', 'final']` today. `card-plan` and `storyboard` are deliberately absent:
their comments (`zone-*`, `card-body:*`, `cue:*`) have different lifecycles and
must not gain this endpoint's delete.

Then replace the three `recordGate` literals with registry lookups keyed by the
gate's `file`, so a renumber cannot desync them:

```js
function gateNumberFor(gateFile) {
  const hit = loadSteps().find((s) => s.gate?.file === gateFile);
  if (!hit) throw new Error(`E-BOARD no step declares a gate on "${gateFile}"`);
  return hit.number;
}
```

- `board.mjs:808` → `recordGate(workdir, gateNumberFor('card-plan.json'), …)`
- `board.mjs:842` → `recordGate(workdir, gateNumberFor('final-cut.json'), …)`
- `board.mjs:1228` → `recordGate(workdir, gateNumberFor('intro-film/screenplay.json'), …)`

Keep every `did` / `output` message string exactly as it is.

**Verify**: `node --test lib/board.test.mjs lib/board-api.test.mjs` → exit 0, with NO assertion edits

### Step 3: Add /health and replace the discarding poll

Add a `/health` route to `lib/board.mjs` that returns `200` with
`{"ok":true}` and touches no filesystem.

In `App.tsx`, change the liveness `useEffect` to poll `/health` instead of
`/api/board-data`, and raise the interval from 2000 to 5000. Keep the
`backendDead` banner and its copy exactly as-is — it is owner-facing text.

**Verify**: `curl -s -o /dev/null -w '%{http_code}' localhost:<port>/health` → `200`; and `grep -n "api/board-data" board-ui/src/App.tsx` shows it only in `fetchBoardData`/`refetch` paths, not in the interval

### Step 4: One tab table in router.ts, hash maps derived

Rewrite `router.ts` so `TABS` is the single table and both hash maps are computed
from it. Preserve exactly:

- `run` has an empty hash and no hash routes to it (`tabForHash` falls back to `run`)
- `calibrate` is reachable by `#calibrate` but is NOT a button (add a
  `button: false` flag on its row rather than omitting it, so the type and the
  hash map stay complete)
- `urlForTab` preserves `?video=`; `urlForVideo` preserves the hash — both are
  owner-reported regressions when broken

Add `export function visibleTabs(all: Tab[], applicable: string[]): {id,label}[]`
returning the button rows filtered by the server's applicable list, in table
order.

**Verify**: `cd board-ui && npx vitest run` → exit 0; add unit cases for
`tabForHash('')`, `tabForHash('#calibrate')`, `urlForTab` preserving search,
`urlForVideo` preserving hash, and `visibleTabs` filtering

### Step 5: AppHeader and App render only applicable tabs

- `AppHeader.tsx` takes a new `tabs` prop (the visible rows) and maps THAT instead
  of the module-level `TABS`. Style is unchanged — do not restyle the buttons.
- `App.tsx` passes `visibleTabs(...)` using `boardData.tabs`, in BOTH the loading
  branch and the loaded branch (the loading branch currently renders
  `AppHeader` with `videos={[video]}` to keep the chrome on screen — preserve
  that behaviour; a vanishing header reads as a broken page, owner report
  2026-07-31).
- Guard each tab's render block on applicability, and handle the case where the
  URL hash names a tab that does not apply to this video: fall back to `run` and
  show a one-line notice naming the reason. **Enumerate the degraded state
  explicitly** — an un-enumerated empty state gets invented behaviour, usually an
  enabled button that 500s.

Per-tab applicability and empty states, stated so nothing is inferred:

| tab | applicable when | if not applicable |
|---|---|---|
| `run` | always | n/a |
| `card-plan` | step 037 in registry, `requires.intro` matches | no button; `#card-plan` → `run` + notice |
| `intro` | step 027 applies (i.e. `intro: "film"`) | no button; `#intro` → `run` + notice |
| `storyboard` | step 080 applies | no button; `#storyboard` → `run` + notice |
| `final-cut` | step 120 applies | no button; `#final-cut` → `run` + notice |
| `calibrate` | always, hash-only | n/a |

**Verify**: `cd board-ui && npm run build` → exit 0; `npx vitest run` → exit 0

### Step 6: Extend the smoke gate to assert the derivation

In `scripts/board-ui-smoke.mjs`, add cases using its existing fixture-workdir
pattern (it already builds `smoke`, `smoke-intro`, `smoke-pre` fixtures):

- an `intro: "cards"` fixture: the rendered tab buttons do NOT include `Intro`
- an `intro: "film"` fixture: they DO include `Intro`
- loading `#intro` on the cards fixture lands on `run` and shows the notice
- the existing chrome y-position assertion still passes on every visible tab
  (`decisions.md` 2026-07-31 — this is the assertion the gate exists for)
- the `ReviewSurface` marker assertion still passes on both Intro and Final Cut
  for a film fixture (`decisions.md` 2026-08-06)

Extend the `probe=layout` meta in `App.tsx` with the rendered tab ids so the
smoke can read them without scraping button text.

**Every test file that opens a server needs guaranteed teardown** — a
`test.after` that force-closes tracked handles. LESSONS 2026-07-31: a `node:test`
file that opens an HTTP server hangs the whole suite forever when an assertion
fires before `server.close()`, and the failure is INVISIBLE (0% CPU, no output).

**Verify**: `node scripts/board-ui-smoke.mjs` → exit 0, `board-ui smoke OK`

### Step 7: Screenshot for the ui gate, then the full gate on a fresh checkout

Capture the board on both an `intro: "cards"` and an `intro: "film"` video showing
the different tab rows, and commit to `docs/screenshots/`. boss REJECTS a
`ui: true` branch that commits no image (enforced 2026-08-02).

**Inspect EVERY interactive control** in the screenshots, not just the tab row:
the video picker `select`, the action-slot buttons, and any notice you added.
UA-default (white-on-dark) controls are the recurring defect class on this
surface (LESSONS 2026-07-31).

Then, on a pristine tree:

```bash
cd "$(mktemp -d)" && git clone --depth 1 --single-branch --branch advisor/193-visuals-flow-board-from-registry <repo path> fresh
cd fresh/pipelines/video/visuals-flow && bash scripts/check.sh
```

This batch's last plan must prove the gate on a fresh checkout — crews verify in
worktrees carrying their own build artifacts, so `board-ui/dist` build-order
dependencies only surface on a clean tree (LESSONS 2026-07-31).

**Verify**: `bash scripts/check.sh` in the fresh clone → exit 0

## Test plan

- `board-ui/test/router.test.ts` (new/extended) — hash round-trips, URL
  preservation, `visibleTabs` filtering.
- `lib/board-api.test.mjs` (extended) — `/api/board-data` carries `runConfig` and
  `tabs`; `applicableTabs` per intro mode; `/health` returns 200 and reads no files.
- `lib/board.test.mjs` (extended) — `REVIEW_NAMESPACES` still equals
  `['intro','final']`; `gateNumberFor` resolves all three gates; an unknown gate
  file throws `E-BOARD`.
- `scripts/board-ui-smoke.mjs` (extended) — the rendered-truth assertions in Step 6.
- Existing assertions must pass UNCHANGED. If any needs editing, behaviour
  changed: that is a STOP.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `/api/board-data` includes `runConfig` and `tabs`
- [ ] An `intro: "cards"` video renders NO Intro tab button; an `intro: "film"` video renders one
- [ ] `#intro` on a cards video lands on `run` with a notice, not a broken tab
- [ ] `grep -n "recordGate(workdir, '" lib/board.mjs` returns nothing (no literal step numbers)
- [ ] `REVIEW_NAMESPACES` is derived and still evaluates to `['intro', 'final']`
- [ ] `router.ts` has ONE tab table; `HASH_TAB`/`TAB_HASH` are computed from it
- [ ] `App.tsx`'s liveness interval hits `/health`, not `/api/board-data`
- [ ] Every server-opening test file has a `test.after` force-close
- [ ] A screenshot of both tab rows is committed under `docs/screenshots/`
- [ ] Removing `tab`/`gate` from `steps/027-*/step.json` makes `check.sh` fail printing `E-BOARD` (mutation gate; boss runs it)
- [ ] `check.sh` exits 0 on a fresh clone of the branch

## STOP conditions

- **A tab's data contract cannot be derived from the registry** — e.g. a tab needs
  a field `step.json` does not carry. Stop and report the tab and the missing
  field. Do NOT add the field to `lib/steps.mjs` yourself; plan 191 owns that
  schema.
- **Any gate's approve behaviour would change.** The three `recordGate` calls must
  produce identical ledger entries, including their `did` and `output` strings.
- **`REVIEW_NAMESPACES` would become permissive.** If the derivation cannot
  reproduce exactly `['intro','final']` as a CLOSED list, stop. A pattern like
  `anything:<n>` is explicitly rejected by the existing comment's reasoning.
- **A server-opening test cannot be given guaranteed teardown.** Stop rather than
  leaving a test that can hang the suite invisibly.
- **An existing test or smoke assertion needs its expectations edited.** That means
  behaviour changed. Stop and report.
- **Gate integrity**: if a gate assertion fails, fix the code or the fixture.
  Weakening, swapping, or deleting the assertion is a STOP.
- **Do not modify `ReviewSurface.tsx` / `.css`.** If a change seems to require it,
  stop — `decisions.md` 2026-08-06 forbids the component branching on which step
  mounts it.
- **Do not touch `pipelines/video/intro-studio/`** for any reason.
- **Do not regress to server-rendered template strings** for any part of this UI
  (`decisions.md` 2026-07-31).

## Maintenance notes

- After this lands, `decisions.md` 2026-08-06's sentence becomes literally true:
  a new review step is a `steps/<slug>/step.json` with `tab` + `gate`, plus a
  `TAB_NAMESPACE` row if it wants edit/delete. No board code.
- `TAB_NAMESPACE` is the one remaining hand-maintained map, deliberately: the
  tab-id → namespace relation is not derivable from two data points, and guessing
  a rule from `final-cut → final` would break the next tab. Adding a row is a
  conscious act; the guard test asserts every gated tab has one.
- Reviewer should scrutinise: the loading-branch `AppHeader` still renders (a
  vanishing header reads as broken), the `calibrate` hash-only route survived,
  and every interactive control is styled in both themes rather than UA-default.
- `ALWAYS_TABS` is where `run` and `calibrate` are exempted from registry
  derivation. If a third always-on tab appears, it goes there — not into a step
  folder invented to satisfy the derivation.
