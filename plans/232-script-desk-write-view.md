---
executor: claude-p
model: sonnet
test_cmd: cd apps/yt-script-desk && npm run typecheck && npm test
ui: true
deploy:
needs: ["231 lands lib/beats.mjs"]
needs_prs: [192]
touches: [apps/yt-script-desk]

mutation_apply: perl -0pi -e "s/const LOCKED_LINES_NEED_CONFIRM = true/const LOCKED_LINES_NEED_CONFIRM = false/" apps/yt-script-desk/src/components/SayCard.tsx
mutation_command: cd apps/yt-script-desk && npm test
mutation_expect: LOCK_BYPASSED
mutation_cwd:
mutation_timeout: 900
---

# Plan 232: script desk — app shell, local server, write view

## Summary

- **Problem statement**: The remote tutorial maker works from two documents at once (`outline.pdf` to read, `script-worksheet.md` to type into), and the PDF is one vertical stream mixing spoken copy, recording notes, edit notes and facts. He cannot tell content from instruction at a glance and cannot hide what he does not need.
- **Goals**:
  - Scaffold `apps/yt-script-desk/` — Vite + React + TypeScript, following `apps/tutorial-tracker-app`.
  - A **local Node server** that reads `pipelines/youtube/yt-script/videos/<key>/outline.md` through plan 231's `buildBeats()` and persists typed answers to `videos/<key>/desk-draft.json`.
  - The **write view**: two tracks. Left is the only words that matter — locked spoken copy and empty boxes. Right is instructions on a tinted panel. Either track collapses; per-lane toggles persist per viewer.
  - Locked spoken copy is editable only behind a confirmation, and the original is kept and restorable.
- **Executor proposed**: `claude-p` / Claude Sonnet
- **Done criteria** (terse): `npm run typecheck && npm test` exit 0; screenshots of the write view and the confirm dialog committed under `docs/shots/`.
- **Stop conditions** (terse): you are about to put a SHOW/EDIT/FACTS line into the left track; you are about to weaken a test.
- **Test / verification for success**: Vitest component tests + a Playwright screenshot script whose output is committed.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ca36925c..HEAD -- apps/ pipelines/youtube/yt-script/`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 231
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ca36925c`, 2026-08-23

## Why this matters

The owner reviewed four candidate layouts on a design canvas and picked the two-track one. The approved design is at <https://claude.ai/code/artifact/beedb449-ee0c-496e-be3b-56931fb49915> — open it if you want to see the target, but **this plan is the specification**; where they disagree, the plan wins.

The governing rule, and the reason the app exists at all: **only two things are content.** Lines the maker reads as written, and lines he writes himself. Facts, recording notes and edit notes are instructions. Instructions never enter the left track. If you find yourself rendering a `show`/`edit`/`facts` string anywhere in the left column, you have rebuilt the problem.

## Current state

### What plan 231 gives you

`pipelines/youtube/yt-script/lib/beats.mjs` exports `buildBeats(md)` returning:

```ts
{ title: string, beats: Beat[] }

type Beat = {
  num: string            // '2.4', 'A1' — from the outline heading, verbatim
  title: string          // 'Five scenes, five tools'
  part: string | null    // '2 · BODY'
  partKind: 'intro' | 'body' | 'outro'
  section: string | null
  mode: 'read' | 'write' // read = spoken copy already written; write = he writes it
  say: string[] | null   // raw quote lines; '' means a paragraph break. Only when mode==='read'
  angle: string[] | null // the body SAY draft, as an INSTRUCTION. Only when mode==='write'
  show: string[]
  edit: string[]
  facts: string[]
  rules: string[]        // section-level rules
  verdict: string | null
}
```

`angle` is an instruction and belongs in the **right** track. It is never spoken copy — that is decisions.md 2026-08-18 and plan 231's mutation gate.

### Exemplar app

`apps/tutorial-tracker-app` — Vite 8, React 19, TypeScript ~6.0, Vitest 4, Playwright, wrangler 4, `concurrently` for the two-process dev script. Copy its `tsconfig.*.json` split (`tsconfig.json` references `tsconfig.app.json` + `tsconfig.node.json`), its `eslint.config.js` shape, and its `scripts` block idiom.

**Do NOT copy its Tailwind setup.** This app uses plain CSS with custom properties, because the approved design is a token system and every value is inlined in this plan. Mixing a utility framework in would mean retranslating all of it. This is a deliberate deviation, recorded here.

### Repo conventions that apply

- Root `CLAUDE.md`: every new folder gets `README.md` + `CLAUDE.md` from day one. (Plan 235 writes the full versions; this plan writes stubs.)
- Media policy: screenshots under `docs/shots/` ARE committed here — they are the `ui: true` merge gate, not render output.
- `npm ci` on the shared cache can fail `EACCES`. If it does, retry with `npm ci --cache .npm-cache` (and add `.npm-cache/` to the app's `.gitignore`). Never run `npm cache clean`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `cd apps/yt-script-desk && npm install` | exit 0 |
| Typecheck | `cd apps/yt-script-desk && npm run typecheck` | exit 0, no output |
| Unit tests | `cd apps/yt-script-desk && npm test` | exit 0, `fail 0` |
| Lint | `cd apps/yt-script-desk && npm run lint` | exit 0 |
| Run it | `cd apps/yt-script-desk && npm run dev:local` | vite on 5175, api on 4327 |
| Screenshots | `cd apps/yt-script-desk && npm run shot` | writes `docs/shots/*.png`, exit 0 |
| The merge gate | `cd apps/yt-script-desk && npm run typecheck && npm test` | exit 0 |

## Scope

**In scope**: everything under `apps/yt-script-desk/`.

**Out of scope**:
- `pipelines/youtube/yt-script/` — plan 231 owns `lib/beats.mjs`; do not edit it, only import it. The one exception is adding `desk-draft.json` handling, which is plan 234's job, not yours: in this plan the local server writes that file and nothing else reads it.
- The Cloudflare Worker, `wrangler.toml`, D1 — plan 234.
- The full script view and the finish action — plan 233.
- `tooling/cli/local-apps-dashboard/apps.json`, `my-hosted-sites.md`, `INFRA.md` — plan 235.
- `render-worksheet.mjs` and `outline.pdf` — they stay working as the fallback until the owner retires them.

## Git workflow

- Branch: `advisor/232-script-desk-write-view`
- Commit: `feat(script-desk): write view, local server and app shell` — no AI footers. Do NOT push.

## Steps

### Step 1: Scaffold

Create `apps/yt-script-desk/` with this `package.json`:

```json
{
  "name": "yt-script-desk",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5175",
    "dev:api": "node server/local.mjs",
    "dev:local": "concurrently -k -n api,web -c blue,magenta \"npm:dev:api\" \"npm:dev\"",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "test": "vitest run",
    "shot": "node scripts/shot.mjs"
  },
  "dependencies": {
    "lucide-react": "^1.22.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.61.1",
    "@testing-library/react": "^17.0.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "concurrently": "^10.0.3",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "globals": "^17.6.0",
    "jsdom": "^28.0.0",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.59.2",
    "vite": "^8.0.12",
    "vitest": "^4.1.7"
  }
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: { '/api': 'http://localhost:4327' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

Copy `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` and `eslint.config.js` from `apps/tutorial-tracker-app`, adjusting only paths/names. `index.html` with `<div id="root">` and `<title>Script desk</title>`. `.gitignore` with `node_modules`, `dist`, `.npm-cache`. Stub `README.md` and `CLAUDE.md` (one paragraph each — plan 235 fills them).

**Verify**: `cd apps/yt-script-desk && npm install && npm run typecheck` → exit 0.

### Step 2: `src/styles/theme.css` — the approved palette (T1 · warm paper)

Write this file **exactly**. Every value is owner-approved; do not adjust, round, or "improve" a colour.

```css
:root {
  --bg: #f6f3ee;
  --hdr: #fbf9f6;
  --panel: #f1ede6;
  --border: #e2ddd4;
  --rule: #e9e4db;

  --text: #6a655e;
  --text-h: #1f1c18;
  --faint: #a9a297;
  --note: #7d776e;

  --paper: #fffdf7;
  --paper-brd: #eae3d2;
  --paper-rail: #cbb87c;
  --paper-ink: #221e18;

  --box-bg: #ffffff;
  --box-ink: #1f1c18;
  --box-ph: #b3ada3;
  --box-ft: #f0e9f7;

  --accent: #9a2fe8;
  --accent-ink: #ffffff;
  --accent-bg: rgba(154, 47, 232, 0.09);
  --accent-brd: rgba(154, 47, 232, 0.38);

  --chip-bg: #ffffff;
  --sw-off: #ddd7cd;
  --sw-knob: #ffffff;

  --tag-say-bg: #f0e9d8;
  --tag-say-ink: #7b6a35;
  --tag-write-bg: rgba(154, 47, 232, 0.1);
  --tag-write-ink: #7623b8;

  --warm-bg: #fbf7ec;
  --warm-brd: #e2d7b4;
  --warm-ink: #836f2f;
  --warm-say: #fffcf2;

  --scrim: rgba(60, 45, 30, 0.34);
  --sh-sm: 0 1px 2px rgba(30, 20, 10, 0.05);
  --sh-box: 0 1px 2px rgba(30, 20, 10, 0.05), 0 10px 24px -14px rgba(154, 47, 232, 0.35);
  --sh-mod: 0 2px 6px rgba(30, 20, 10, 0.08), 0 24px 56px -18px rgba(30, 20, 10, 0.32);

  --sans: system-ui, 'Segoe UI', Roboto, sans-serif;
  --serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --mono: ui-monospace, Consolas, monospace;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.5 var(--sans);
  letter-spacing: 0.15px;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); }
a:hover { opacity: 0.8; }
```

Import it once from `src/main.tsx`.

**Verify**: `grep -c '^  --' apps/yt-script-desk/src/styles/theme.css` → `36` or more.

### Step 3: `src/types.ts` and `src/api.ts`

`types.ts` carries the `Beat` type from "Current state" above verbatim, plus:

```ts
export type Edit = { original: string[]; at: string }

export type VideoDoc = {
  key: string
  title: string
  beats: Beat[]
  draft: Record<string, string>        // beat.num -> the maker's typed text
  edits: Record<string, Edit>          // beat.num -> the original spoken lines, kept
  says: Record<string, string[]>       // beat.num -> current spoken lines, when edited
  finished: boolean
}
```

`api.ts` exposes exactly these calls. **This shape is the contract plan 234's Worker must also serve** — do not change it there or here without changing both.

```ts
const base = '/api'
export const getVideo   = (key: string) => j<VideoDoc>(`${base}/video?key=${encodeURIComponent(key)}`)
export const putDraft   = (key: string, num: string, text: string) => j(`${base}/beat/${num}?key=${key}`, 'PUT', { text })
export const putSay     = (key: string, num: string, lines: string[]) => j(`${base}/beat/${num}/say?key=${key}`, 'PUT', { lines })
export const restoreSay = (key: string, num: string) => j<{ lines: string[] }>(`${base}/beat/${num}/restore?key=${key}`, 'POST')
```

where `j` is a small `fetch` wrapper that throws on a non-2xx and parses JSON.

**Verify**: `cd apps/yt-script-desk && npm run typecheck` → exit 0.

### Step 4: `server/local.mjs` — the local backend

A zero-dependency Node `http` server on port 4327 (override with `API_PORT`). It:

1. Resolves the yt-script videos root as `../../pipelines/youtube/yt-script/videos` relative to the app folder, and refuses to start if that directory is missing (exit 1 with a clear message).
2. `GET /api/video?key=<key>` — reads `<key>/outline.md`, calls `buildBeats` imported from `../../pipelines/youtube/yt-script/lib/beats.mjs`, merges in `<key>/desk-draft.json` if it exists, returns a `VideoDoc`. 404 with `{error}` if the outline is missing.
3. `PUT /api/beat/:num?key=` — merges `{text}` into `draft[num]`, writes `desk-draft.json`, returns `{ok:true, savedAt}`.
4. `PUT /api/beat/:num/say?key=` — **the first time** a beat's spoken lines are edited, copy the parsed `say` into `edits[num] = {original, at}`; then set `says[num] = lines`. On a later edit, leave `edits[num].original` alone — the original is the *first* version, not the previous one.
5. `POST /api/beat/:num/restore?key=` — delete `says[num]` and `edits[num]`, return the parsed `say` lines.
6. Rejects any `key` containing `/`, `\` or `..` with 400. Never joins an unsanitised key into a path.

`desk-draft.json` shape:

```json
{ "draft": { "2.4": "…" }, "says": { "2.9": ["…"] }, "edits": { "2.9": { "original": ["…"], "at": "2026-08-23T10:00:00.000Z" } }, "finished": false }
```

Writes are atomic: write `desk-draft.json.tmp`, then rename.

`desk-draft.json` is **tracked in git**. It is the maker's own words, not a build artifact — do not gitignore it.

**Verify**:
```bash
cd apps/yt-script-desk && node server/local.mjs & sleep 2
curl -s 'http://localhost:4327/api/video?key=character-consistency-ai' | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.beats.length>5, typeof d.title)"
kill %1
```
→ prints `true string`.

### Step 5: `src/hooks/usePrefs.ts` — per-viewer toggles

```ts
export type Prefs = {
  showRecording: boolean
  showEdit: boolean
  showFacts: boolean
  notesTrack: boolean      // the whole right track
}
const DEFAULTS: Prefs = { showRecording: true, showEdit: false, showFacts: true, notesTrack: true }
```

Persist under `localStorage['script-desk:prefs']`. **Every read and write is wrapped in try/catch** and falls back to `DEFAULTS` — a private window or blocked site data must not break the page.

**Verify**: a Vitest test asserts that a throwing `localStorage` still yields `DEFAULTS` and the hook does not throw.

### Step 6: The write view

`src/components/WriteView.tsx` renders a CSS grid, two content columns with a 1px rail between:

```css
.tracks { display: grid; grid-template-columns: 1fr 1px 400px; align-items: start; }
.rail   { grid-column: 2; grid-row: 1 / -1; background: var(--border); }
.rowL   { grid-column: 1; padding: 20px 40px 26px; border-top: 1px solid var(--rule); }
.rowR   { grid-column: 3; padding: 20px 32px 26px; border-top: 1px solid var(--rule); background: var(--panel); }
```

When `prefs.notesTrack` is false, the grid collapses to `grid-template-columns: 1fr` and the right cells are not rendered at all (not merely hidden).

Per beat, **left cell** contains only:
- the beat number in `--mono` 11px uppercase `--faint`, then the title at 14.5px 600 `--text-h`;
- a tag chip — `Read as written` (`--tag-say-*`) or `You write this` (`--tag-write-*`);
- for `mode: 'read'`, a `<SayCard>`; for `mode: 'write'`, a `<WriteBox>`;
- a `<SayCard>` for `beat.verdict` when present.

Per beat, **right cell** contains, each only when its toggle is on: `rules`, `angle` (labelled **Angle**), `show` (**Recording**), `facts` (**Facts**), `edit` (**Edit**). An empty right cell renders the italic `--faint` line `No instructions for this beat.`

`SayCard`:

```css
.say { background: var(--paper); border: 1px solid var(--paper-brd); border-left: 3px solid var(--paper-rail);
       border-radius: 10px; padding: 18px 22px 18px 22px; box-shadow: var(--sh-sm); position: relative; }
.say p { margin: 0 0 11px; font: 19px/1.62 var(--serif); color: var(--paper-ink); letter-spacing: .1px; }
```
An empty string in `say[]` ends a paragraph. The Edit button sits absolutely at `top:10px; right:10px` and the card gets `padding-right: 96px` to clear it.

`WriteBox`: `border: 1.5px solid var(--accent-brd); border-radius: 10px; background: var(--box-bg); box-shadow: var(--sh-box)`. Inside, an auto-growing `<textarea>` at `font: 19px/1.62 var(--serif)`, placeholder `Write what you saw…` in `--box-ph`, and a footer strip (`border-top: 1px solid var(--box-ft)`, 12px, `font-variant-numeric: tabular-nums`) showing `<n> words` on the left and a save state on the right. **No word target, no limit** — owner decision; a plain count only.

Autosave: debounce 600 ms after the last keystroke, `PUT /api/beat/:num`. Footer states: `Saved` → `Saving…` → `Saved`, and on failure `Not saved — retrying` with a retry every 5 s until it succeeds.

**Verify**: `npm run dev:local`, open `http://localhost:5175/?key=character-consistency-ai`. Left column contains no `show`/`edit`/`facts` text; toggling `Recording notes` off empties those blocks; typing in a box and reloading keeps the text.

### Step 7: The confirmation before editing a locked line

`src/components/ConfirmDialog.tsx` — a modal over a `--scrim` overlay, 430px wide, `background: var(--box-bg)`, `border-radius: 14px`, `box-shadow: var(--sh-mod)`.

Content, and **nothing else**:
- a 34px rounded lock icon tile (`background: var(--tag-say-bg)`, `color: var(--tag-say-ink)`, Lucide `Lock`, 16px);
- the heading, verbatim: **`Are you sure you want to make these changes?`**
- a footer strip (`background: var(--hdr)`, `border-top: 1px solid var(--rule)`) with two right-aligned buttons: `No` (ghost) and `Yes` (accent fill, `--accent` / `--accent-ink`).

No explanation paragraph, no preview of the line, no reason field. Owner reduced it to exactly this.

Behaviour, in `SayCard.tsx`:

```ts
// Single mutation target: setting this to false lets the pencil unlock the card
// with no confirmation at all, which is the defect the gate must catch.
const LOCKED_LINES_NEED_CONFIRM = true
```

Pressing Edit while `LOCKED_LINES_NEED_CONFIRM` opens the dialog. `No` closes it and leaves the card locked. `Yes` closes it and switches the card to an editable `contentEditable`/textarea at the same serif metrics. On blur, `PUT /api/beat/:num/say`.

Once a beat has an `edits[num]` entry the card renders in its edited state — `border-color: var(--warm-brd)`, `border-left-color: var(--paper-rail)`, `background: var(--warm-say)`, `border-radius: 10px 10px 0 0` — with a strip attached underneath (`background: var(--warm-bg)`, `border: 1px solid var(--warm-brd)`, no top border, `border-radius: 0 0 10px 10px`, 12px `--warm-ink`) reading `You changed this line` on the left and a `Restore original` button (Lucide `RotateCcw`, 12px) on the right. Restore calls the restore endpoint and returns the card to locked.

Keyboard: Escape is `No`, Enter is `Yes`, focus traps inside the dialog, and focus returns to the Edit button on close.

**Verify**: `npm test` — the tests in Step 9 cover this.

### Step 8: Header and toggle rail

`Header`: 18px/40px padding, `background: var(--hdr)`, bottom border. Left is the video title (19px 600 `--text-h`, `letter-spacing: -.3px`) with a 12.5px `--faint` subtitle `Beats 1–N · voiceover script`. Centre is a two-tab pill (`background: var(--panel)`, 9px radius, 3px pad; the active tab gets `background: var(--box-bg)`, `--text-h`, 600, `--sh-sm`) reading `Write` and `Full script`. **In this plan `Full script` renders a one-line placeholder** — plan 233 builds it. Right is `<n> of <m> written` plus a 112×5px progress bar filled with `--accent`.

`ToggleRail`: a row under the header, `background: var(--hdr)`, with an 11px uppercase `--faint` label `Show me` and one chip per pref. Chip: pill, `border: 1px solid var(--border)`, `background: var(--chip-bg)`; on state `border-color: var(--accent-brd)`, `background: var(--accent-bg)`, `color: var(--tag-write-ink)`. Each chip carries a 22×13px switch that slides its 9px knob from `left:2px` to `left:11px`. Chips are real `<button role="switch" aria-checked>` elements with a visible `:focus-visible` ring.

**Verify**: `npm run lint` → exit 0. Tab to each chip and confirm a visible focus ring.

### Step 9: Tests

`src/test/setup.ts` imports `@testing-library/jest-dom` equivalents as needed. Then:

`src/components/__tests__/writeView.test.tsx`
1. **the left track never contains an instruction** — render a fixture with `show`, `edit`, `facts` and `angle` all populated, query the left column subtree, assert none of those strings appear in it. Message must contain `INSTRUCTION_IN_SCRIPT_TRACK`.
2. a `mode: 'read'` beat renders its `say` paragraphs and no textarea.
3. a `mode: 'write'` beat renders a textarea and no `say` text.
4. an empty string inside `say[]` produces a second `<p>`.
5. turning `showFacts` off removes the facts block; turning `notesTrack` off removes the right cells from the DOM entirely.
6. the word count updates as you type and shows no target or limit — assert the footer text matches `/^\d+ words$/`.

`src/components/__tests__/sayCard.test.tsx`
7. **pressing Edit opens the confirmation and does NOT make the card editable** — assert the dialog is present and no `textarea` exists yet. Message must contain `LOCK_BYPASSED`.
8. `No` closes the dialog and the card stays locked — still no textarea. Message must contain `LOCK_BYPASSED`.
9. `Yes` closes the dialog and makes the card editable.
10. the dialog heading is exactly `Are you sure you want to make these changes?` and the dialog contains no `textarea` and no `input`.
11. Escape acts as `No`.
12. a beat with an `edits` entry renders the edited strip with a `Restore original` control.

`src/hooks/__tests__/usePrefs.test.ts`
13. a throwing `localStorage` yields `DEFAULTS` without throwing.
14. a toggle round-trips through `localStorage`.

**Verify**: `cd apps/yt-script-desk && npm test` → `fail 0`, at least 14 tests.

### Step 10: Screenshots (the `ui: true` gate)

`scripts/shot.mjs` — Playwright. It starts `server/local.mjs`, runs `vite build` then `vite preview` (or drives the dev server), navigates to `?key=character-consistency-ai`, and writes:

- `docs/shots/write-view.png` — full page, 1280×1400 viewport
- `docs/shots/confirm-dialog.png` — after clicking the first Edit button

Guaranteed teardown: wrap in `try/finally` and kill both child processes in `finally`, so a failed assertion never leaves the runner alive.

Commit both PNGs.

**Verify**: `cd apps/yt-script-desk && npm run shot && ls -la docs/shots/` → two PNG files, each larger than 20 KB. Open `write-view.png` and confirm the page is warm off-white, the right track is a slightly deeper panel, and the empty write box is the brightest element on the page.

### Step 11: Fresh-tree check

```bash
git clean -xdn apps/yt-script-desk
```
Confirm nothing tracked would be removed, then from a clean install:
```bash
cd apps/yt-script-desk && rm -rf node_modules dist && npm install && npm run typecheck && npm test && npm run build
```

**Verify**: all exit 0.

## Test plan

14+ Vitest tests as enumerated in Step 9, plus a Playwright screenshot script that is itself the visual gate. The two mutation-guarded invariants are "no instruction reaches the left track" (`INSTRUCTION_IN_SCRIPT_TRACK`) and "a locked line cannot be edited without confirming" (`LOCK_BYPASSED`); boss's mutation recipe exercises the second.

## Done criteria

- [ ] `cd apps/yt-script-desk && npm run typecheck` exits 0.
- [ ] `cd apps/yt-script-desk && npm test` exits 0 with at least 14 passing tests and `fail 0`.
- [ ] `cd apps/yt-script-desk && npm run lint` exits 0.
- [ ] `cd apps/yt-script-desk && npm run build` exits 0.
- [ ] `docs/shots/write-view.png` and `docs/shots/confirm-dialog.png` exist, are committed, and are each over 20 KB.
- [ ] `curl -s 'http://localhost:4327/api/video?key=character-consistency-ai'` with the local server running returns JSON whose `beats` array is longer than 5.
- [ ] The confirm dialog's only text is the heading, `No` and `Yes` — assert with `grep -L 'reason' src/components/ConfirmDialog.tsx` returning the file.
- [ ] Flipping `LOCKED_LINES_NEED_CONFIRM` to `false` makes `npm test` fail printing `LOCK_BYPASSED`; reverting makes it pass.
- [ ] `git status --porcelain pipelines/` is empty — this plan touches no pipeline file.

## STOP conditions

- **You are about to render a `show`, `edit`, `facts` or `angle` value inside the left track.** That is the bug this app exists to remove. Stop and report.
- **If a gate assertion fails, fix the code or the fixture; weakening, swapping, or deleting the assertion is a STOP.**
- `buildBeats` is missing or its shape differs from "Current state" — plan 231 has not landed. Stop; do not write your own parser.
- You want to add a word target, a word limit, or a "minimum words" warning. The owner removed these explicitly. Stop.
- You want to add Tailwind, a component library, or a CSS framework. Stop — the palette is the design system.
- A test opens a server or a browser and you cannot guarantee teardown. Stop and restructure with `try/finally` rather than shipping a suite that can hang.

## Maintenance notes

- `src/api.ts`'s call shapes are a contract shared with plan 234's Cloudflare Worker. Changing one without the other breaks the deployed app silently, because local mode will still work.
- `LOCKED_LINES_NEED_CONFIRM` and the `INSTRUCTION_IN_SCRIPT_TRACK` assertion message exist as mutation targets. Do not tidy them away.
- `desk-draft.json` holds the maker's typed words and is tracked. It is not regenerable from anything.
- The palette is owner-approved as "T1 · warm paper" against three alternatives. Changing a colour is an owner decision, not a polish pass.
