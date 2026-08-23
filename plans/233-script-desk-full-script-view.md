---
executor: claude-p
model: sonnet
test_cmd: cd apps/yt-script-desk && npm run typecheck && npm test
ui: true
deploy:
needs: ["232 lands the app shell, local server and write view"]
needs_prs: [193]
touches: [apps/yt-script-desk]

mutation_apply: perl -0pi -e "s/const LABELS_LIVE_IN_THE_MARGIN = true/const LABELS_LIVE_IN_THE_MARGIN = false/" apps/yt-script-desk/src/components/FullScript.tsx
mutation_command: cd apps/yt-script-desk && npm test
mutation_expect: LABEL_IN_PROSE
mutation_cwd:
mutation_timeout: 900
---

# Plan 233: script desk — the full script view

## Summary

- **Problem statement**: Plan 232 gives the maker a place to write, but nothing lets him (or the owner) read the finished thing as one continuous script. Today that only exists after step 3 of the yt-script skill produces `script.md`.
- **Goals**:
  - Build the `Full script` tab: no instructions, no boxes, no locks — one script, top to bottom, in the order it will be spoken.
  - Beat labels sit **outside** the text column, in a thin grey left margin, with a toggle that empties the margin for a clean read.
  - His lines and the pre-written ones render identically — once it is done, it is one script.
  - Add the finish action so the owner knows the draft is complete.
- **Executor proposed**: `claude-p` / Claude Sonnet
- **Done criteria** (terse): `npm run typecheck && npm test` exit 0; `docs/shots/full-script.png` committed.
- **Stop conditions** (terse): a beat label lands inside the prose column; a visual difference is introduced between his lines and pre-written ones.
- **Test / verification for success**: Vitest component tests plus a committed Playwright screenshot.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ca36925c..HEAD -- apps/yt-script-desk/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 232
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ca36925c`, 2026-08-23

## Why this matters

A beat heading like `2.4 · Five scenes, five tools` is a **label, never a spoken line**. In the write view it earns its size — it is how the maker knows which beat he is in and how the numbers line up with his instructions. In a read-through it is noise sitting in the middle of the sentences.

The owner's decision: do not delete it and do not grey it inside the text. **Move it out of the column.** The eye runs straight down the words; look left and you know where you are. A toggle empties the margin entirely for a pure read.

The second decision: once the script is done, it is one script. No tint, no marker, no way to tell his lines from the pre-written ones in this view. The owner was explicit about that.

## Current state

Plan 232 has landed: `apps/yt-script-desk/` exists with `src/types.ts` (`Beat`, `VideoDoc`), `src/api.ts`, `src/hooks/usePrefs.ts`, `src/styles/theme.css` (the T1 palette), a `Header` with a two-tab pill where `Full script` currently renders a placeholder, and `server/local.mjs` serving `/api/video`, `/api/beat/:num`, `/api/beat/:num/say`, `/api/beat/:num/restore`.

A beat's spoken text for this view resolves in this order:
1. `doc.says[beat.num]` if present (the maker edited a locked line);
2. else `beat.say` if `beat.mode === 'read'`;
3. else `doc.draft[beat.num]` if non-empty (what he wrote);
4. else nothing — the beat is unwritten.

`beat.verdict`, when present, is spoken and follows the beat's own lines.

`beat.angle`, `beat.show`, `beat.edit`, `beat.facts` and `beat.rules` are instructions and **never appear in this view at all**, under any toggle.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/yt-script-desk && npm run typecheck` | exit 0 |
| Unit tests | `cd apps/yt-script-desk && npm test` | exit 0, `fail 0` |
| Lint | `cd apps/yt-script-desk && npm run lint` | exit 0 |
| Run it | `cd apps/yt-script-desk && npm run dev:local` | vite 5175, api 4327 |
| Screenshots | `cd apps/yt-script-desk && npm run shot` | writes `docs/shots/*.png` |
| The merge gate | `cd apps/yt-script-desk && npm run typecheck && npm test` | exit 0 |

## Scope

**In scope**:
- `apps/yt-script-desk/src/components/FullScript.tsx` + `.css` (new)
- `apps/yt-script-desk/src/components/Header.tsx` — wire the real tab
- `apps/yt-script-desk/src/hooks/usePrefs.ts` — add the two prefs below
- `apps/yt-script-desk/server/local.mjs` — add `POST /api/finish`
- `apps/yt-script-desk/src/api.ts` — add `postFinish`
- tests and `scripts/shot.mjs`

**Out of scope**:
- The write view — it is done; touch it only to switch tabs.
- The Cloudflare Worker and D1 — plan 234. `POST /api/finish` here is local-only; 234 mirrors it.
- Pronunciation, pacing punctuation, VO polish — that is step 3 of the yt-script skill and stays there.
- `pipelines/` — nothing in it changes.

## Git workflow

- Branch: `advisor/233-script-desk-full-script-view`
- Commit: `feat(script-desk): full script view with margin beat labels` — no AI footers. Do NOT push.

## Steps

### Step 1: Two new prefs

Extend `Prefs` in `src/hooks/usePrefs.ts`:

```ts
beatLabels: boolean   // default true  — the grey margin labels in the full script view
scriptNotes: boolean  // default false — reserved; renders nothing in this plan
```

Defaults merge over whatever is already in `localStorage`, so an existing viewer with saved prefs gets the new keys without losing the old ones. Keep the try/catch fallback from 232.

**Verify**: a test asserts that a stored `{"showFacts":false}` yields `beatLabels === true` and `showFacts === false`.

### Step 2: `FullScript.tsx`

A two-column grid — a fixed-width margin and a fixed-width reading column:

```css
.doc { display: grid; grid-template-columns: 84px 592px; gap: 0 28px; padding: 34px 44px 40px; align-items: start; }
.mk  { grid-column: 1; text-align: right; font: 600 10.5px/1.9 var(--mono); letter-spacing: 1px;
       color: var(--faint); padding-top: 9px; }
.bd  { grid-column: 2; padding-bottom: 22px; }
.bd p { margin: 0 0 15px; font: 19.5px/1.72 var(--serif); color: var(--paper-ink); letter-spacing: .1px; }
.bd p:last-child { margin-bottom: 0; }
```

Each beat contributes exactly two grid children: the `.mk` label cell and the `.bd` prose cell. The label is a **sibling of** the prose, never a child of it.

```tsx
// Single mutation target: setting this to false renders the beat label inside
// the prose column, which is the exact clutter this view exists to remove.
const LABELS_LIVE_IN_THE_MARGIN = true
```

When `prefs.beatLabels` is false, render an empty `.mk` cell (keep the grid column so the prose does not shift). Do not remove the column.

Paragraph splitting: the beat's resolved lines are joined and split on blank lines, so an empty string inside `say[]` and a `\n\n` inside a typed draft both become a paragraph break. Every paragraph gets `text-wrap: pretty`.

An **unwritten** beat renders its `.bd` cell as a single italic `--faint` line: `Not written yet.` — never a blank gap, and never the beat's angle or instructions as a stand-in.

`beat.verdict` renders as one more paragraph in the same `.bd` cell, styled identically. It is spoken copy.

Every beat renders with the **same** typography and colour regardless of `mode`. There must be no class, tint, rail or marker that distinguishes a written line from a pre-written one.

**Verify**: `npm run dev:local`, open the `Full script` tab. Beat numbers sit left of the text, the text column never shifts when you toggle `Beat labels`, and nothing in the page is a coloured card.

### Step 3: The header, the subtitle and the footer

Wire the `Full script` tab to render `<FullScript>`; `Write` keeps rendering `<WriteView>`. Tab state lives in `App.tsx` and does **not** persist — a reload lands on `Write`.

In the full script view the header subtitle becomes `Full script · <n> beats · about <m> min read aloud`, where `m = Math.max(1, Math.round(totalWords / 150))`.

The toggle rail in this view shows only `Beat labels`. It must not show the recording/facts/edit chips — they control a track that does not exist here.

Below the document, a footer strip (`margin: 0 44px; padding: 18px 0 34px; border-top: 1px solid var(--rule)`):
- left, 12.5px `--note`, `font-variant-numeric: tabular-nums`: `<n> words · <k> of <m> beats written`;
- right, a primary button `Mark script finished` — `background: var(--accent)`, `color: var(--accent-ink)`, 9px radius, 10px/17px padding, `box-shadow: var(--sh-box)`, with a Lucide `Check` at 14px.

The button is **disabled with a `title` explaining why** while any beat is unwritten: `Every beat needs words before you can finish.` When enabled, clicking it calls `POST /api/finish`, then the button becomes a non-interactive `Script finished` chip and the whole document goes read-only (no Edit buttons in the write view either).

`POST /api/finish` in `server/local.mjs` sets `finished: true` in `desk-draft.json` and returns `{ok:true}`. When `doc.finished` is true, `PUT /api/beat/*` returns 409 `{error:'finished'}` and the UI shows `Script finished — ask Kushal to reopen it.`

**Verify**: with one beat blank the button is disabled and carries the title; fill every beat and it enables; click it and a reload shows the read-only state.

### Step 4: Degraded and empty states

Enumerate all of them; an un-enumerated one gets invented behaviour.

| State | Full script view renders |
|---|---|
| `/api/video` 404 (no outline) | centred `--note` message `No outline for this video yet.` and no footer |
| `/api/video` network error | centred message `Could not load the script.` and a `Try again` button |
| outline parses to zero beats | `This outline has no beats.` and a disabled finish button |
| every beat unwritten | the document renders, every `.bd` is `Not written yet.`, footer reads `0 words · 0 of N beats written`, finish disabled |
| `doc.finished` true | read-only document, `Script finished` chip instead of the button |
| `prefs.beatLabels` false | `.mk` cells empty, column width unchanged |

**Verify**: tests 5–8 in Step 5 cover the first, third, fourth and sixth rows.

### Step 5: Tests

`src/components/__tests__/fullScript.test.tsx`

1. **a beat label is never inside the prose column** — render, find the element containing the beat's first sentence, walk up to the `.bd` cell, assert its `textContent` does not contain the beat number. Assertion message must contain `LABEL_IN_PROSE`.
2. **no instruction reaches this view** — fixture with `show`, `edit`, `facts`, `angle`, `rules` all populated; assert none of those strings appear anywhere in the rendered output. Message must contain `INSTRUCTION_IN_FULL_SCRIPT`.
3. a written beat and a pre-written beat produce prose elements with **identical** `className` — assert equality directly, so any future tint fails the test.
4. `beatLabels: false` empties the label cells but keeps the same number of grid children.
5. an unwritten beat renders `Not written yet.` and not its angle text.
6. zero beats renders `This outline has no beats.`
7. a 404 renders `No outline for this video yet.`
8. `finished: true` renders the `Script finished` chip and no enabled finish button.
9. the finish button is disabled with the exact title while any beat is unwritten.
10. an empty string inside `say[]` produces two paragraphs.
11. a `verdict` renders as a paragraph with the same class as the rest.

`src/hooks/__tests__/usePrefs.test.ts` — extend with the merge test from Step 1.

**Verify**: `cd apps/yt-script-desk && npm test` → `fail 0`, and the total test count is at least 25 (14 from plan 232 plus these).

### Step 6: Screenshot

Extend `scripts/shot.mjs` to also capture `docs/shots/full-script.png` — the `Full script` tab, full page, 1280×1400. Keep the `try/finally` teardown from plan 232.

Commit the PNG.

**Verify**: `cd apps/yt-script-desk && npm run shot && ls -la docs/shots/full-script.png` → exists, over 20 KB. Open it and confirm the beat numbers sit in the left margin, the prose column is a single unbroken run of serif text, and no beat looks different from any other.

### Step 7: Fresh-tree check

This is the last plan in the UI pair, so verify from a pristine tree:

```bash
cd apps/yt-script-desk && rm -rf node_modules dist && npm install && npm run typecheck && npm run lint && npm test && npm run build
```

**Verify**: all exit 0.

## Test plan

11 new component tests plus one extended prefs test. Two invariants are mutation-shaped: labels stay in the margin (`LABEL_IN_PROSE`, exercised by boss's recipe) and no instruction reaches this view (`INSTRUCTION_IN_FULL_SCRIPT`). Test 3 asserts class equality rather than the absence of a specific tint, so it fails on any future attempt to visually separate the two kinds of line.

## Done criteria

- [ ] `cd apps/yt-script-desk && npm run typecheck` exits 0.
- [ ] `cd apps/yt-script-desk && npm test` exits 0, `fail 0`, at least 25 tests.
- [ ] `cd apps/yt-script-desk && npm run lint` exits 0.
- [ ] `cd apps/yt-script-desk && npm run build` exits 0.
- [ ] `docs/shots/full-script.png` is committed and over 20 KB.
- [ ] Flipping `LABELS_LIVE_IN_THE_MARGIN` to `false` makes `npm test` fail printing `LABEL_IN_PROSE`; reverting makes it pass.
- [ ] `grep -c LABEL_IN_PROSE` on a clean passing test run returns `0`.
- [ ] A fresh `rm -rf node_modules dist && npm install && npm run typecheck && npm run lint && npm test && npm run build` exits 0 at every step.
- [ ] `git status --porcelain pipelines/` is empty.

## STOP conditions

- **You are about to render a beat label inside the prose column**, or to drop the margin column when labels are off. Both defeat the view. Stop.
- **You are about to give written and pre-written lines different styling** — a tint, a rail, a badge, an opacity. The owner chose one uniform script. Stop.
- **You are about to render `show`, `edit`, `facts`, `angle` or `rules` in this view.** Stop.
- **If a gate assertion fails, fix the code or the fixture; weakening, swapping, or deleting the assertion is a STOP.**
- Plan 232's components or `VideoDoc` shape are missing or different — 232 has not landed. Stop.
- The finish action would delete, rewrite or reformat anything in `pipelines/`. It writes one boolean into `desk-draft.json` and nothing else. Stop.

## Maintenance notes

- Reading order is `says` → `say` → `draft`. Plan 234's Worker must resolve it the same way or the deployed read-through will differ from the local one.
- `POST /api/finish` is mirrored by plan 234 on the Worker; the 409-when-finished rule belongs to both.
- The 84px margin and 592px column are tuned to the approved design. Widening the reading column past ~600px hurts line length; if the owner wants a wider page, add outer margin, not column width.
