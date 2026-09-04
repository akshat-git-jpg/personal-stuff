<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test -- --run && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck
ui: true
deploy:
needs: []
needs_plans: []
needs_prs: []
touches:
  - apps/yt-script-desk/src/App.tsx
  - apps/yt-script-desk/src/types.ts
  - apps/yt-script-desk/src/api.ts
  - apps/yt-script-desk/src/components/Header.tsx
  - apps/yt-script-desk/src/components/ToggleRail.tsx
  - apps/yt-script-desk/src/components/AvatarMode.tsx
  - apps/yt-script-desk/src/components/AvatarMode.css
  - apps/yt-script-desk/src/components/__tests__/avatarMode.test.tsx
  - apps/yt-script-desk/src/lib/selectionsFile.ts
  - apps/yt-script-desk/server/local.mjs
  - apps/yt-script-desk/server/__tests__/heygenSelections.test.mjs
  - apps/yt-script-desk/CLAUDE.md
  - tooling/cli/pp-land/verify-map.tsv

mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 266: yt-script-desk avatar mode (editor selection view)

## Summary

- **Problem statement**: The video editor has no way to tell the pipeline WHICH parts of a locked script he wants generated as HeyGen avatar clips. Today he manually chops the voiceover and drives HeyGen's UI himself per clip, which is 30+ minutes of button-clicking per video.
- **Goals**:
  - Add an "avatar" mode to the yt-script desk that shows the final script with drag-to-highlight range selection.
  - Each highlight becomes a queued card with a per-selection III/IV engine picker.
  - A single header-level "default engine" dropdown sets the default; each card can override.
  - On Submit, save all selections to `videos/<key>/heygen-selections.json` — the queue file plan 267's CLI reads.
  - Hide the whole mode unless `?role=editor` is in the URL AND every section in `script.json` has `tts.locked === true`.
  - The writer never sees the tab (writer keeps loading with default `?key=<key>` and no role param).
- **Decisions confirmed** (Step 2.5):
  - Split into how many plans -> 2 plans (this = plan A: desk UI + selections write; plan 267 = plan B: CLI runner)
  - Avatar-mode gate -> `?role=editor` AND every section `tts.locked=true` in `script.json`
  - Default III/IV picker location -> header dropdown "Default: IV" above script + per-card override
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — standard difficulty, fully inlined
- **Done criteria** (terse): `npm test` and `npm run typecheck` green in `apps/yt-script-desk`; new UI test asserts avatar mode hidden when gate not met; new server test asserts `PUT /api/heygen-selections` writes the expected JSON atomically.
- **Stop conditions** (terse): if any assertion needs weakening to pass, STOP; if `pipelines/youtube/yt-script/lib/beats.mjs` needs editing, STOP (out of scope).
- **Test / verification for success**: vitest unit tests for the React component and the server endpoint (both use the existing test conventions in this app).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the "STOP conditions" section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86266059..HEAD -- apps/yt-script-desk/ tooling/cli/pp-land/verify-map.tsv`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `86266059`, 2026-09-04

## Why this matters

The freelancer video editor spends real time slicing the final voiceover per script part, uploading each slice to HeyGen, and downloading each avatar clip. That work is deterministic — the tool can do it. The load-bearing gap is a SELECTION interface: the editor is the only one who knows which script ranges he wants as avatar clips. Once the selections are captured to a queue file, the CLI in plan 267 does everything else. The desk already renders the script and is the natural place to add this — reusing it means the editor uses a UI he already knows and there is nothing new to host or authenticate.

## Current state

### `apps/yt-script-desk/` — Vite + React 19 + TypeScript SPA (verified 2026-09-04)

- Local dev: `npm run dev:local` runs `node server/local.mjs` on port `4327` and `vite --port 5175` concurrently. Vite proxies `/api/*` to the local server.
- Frontend entry: `src/main.tsx` -> `src/App.tsx`.
- Tab state: `src/App.tsx:59` `const [tab, setTab] = useState<'write' | 'full'>('write')`.
- URL key: `src/App.tsx:27` `getKeyFromUrl()` reads `?key=`.
- Existing role/mode gates: `src/App.tsx:47` `const MARKDOWN_EDIT_MODE = new URLSearchParams(window.location.search).get('edit') === '1'` — the exact pattern to mirror for `?role=editor`.
- Existing tab UI: `src/components/ToggleRail.tsx` and `src/components/Header.tsx` render the write/full toggle.
- Existing tab render block: `src/App.tsx` around lines 274–331 renders one of `WriteView` / `EditView` / `FullScript`.
- Read-through view analog: `src/components/FullScript.tsx` — walks `doc.beats` and renders one paragraph per beat via `resolveBeatParagraphs(beat, doc)`. AvatarMode will reuse this same walk to render the same script text.

### Server: `apps/yt-script-desk/server/local.mjs`

- Reads `pipelines/youtube/yt-script/videos/<key>/script-plan.md` via `buildBeats()` from `pipelines/youtube/yt-script/lib/beats.mjs`.
- `buildVideoDoc(key)` at lines 118–143 assembles the `VideoDoc`. Adds `approval`, `beats`, `draft`, `edits`, `says`, `notes`, `noteEdits`, `finished`.
- Draft writes go through `writeDraft(key, doc)` — atomic temp-file + `renameSync` (see `writeDraftRaw` at line 83).
- Existing PUT endpoint pattern: `PUT /api/beat/:num/notes` at lines 270–295 — validates the key with `isSafeKey`, reads/mutates/writes the draft atomically.
- The `.gitignore` at `apps/yt-script-desk/.gitignore` and `pipelines/youtube/yt-script/.gitignore` already ignore `desk-draft.json` — we will add `heygen-selections.json` to the same ignore lists (out of scope for this plan; it lives in a maker's directory that is already ignored via the `videos/**/*.json` rule set — verify below).

### `script.json` at `videos/<key>/script.json`

Section shape (from `pipelines/youtube/yt-script/videos/ai-avatar-generators/script.json`, verified 2026-09-04):

```json
{
  "sections": [
    { "id": "s01", "spoken_text": "...", "tts": { "locked": false, "take": null } }
  ]
}
```

- `tts.locked === true` per section is the VO-lock signal. AvatarMode requires every section to be locked.
- The wav on disk lives at `videos/<key>/audio/<id>.wav` (e.g. `audio/s01.wav`). Not consumed by this plan — the runner (plan 267) uses it.

### `tooling/cli/pp-land/verify-map.tsv`

- Currently 24 rows. Neither `apps/yt-script-desk/` nor `tooling/cli/pp-heygen-batch/` has coverage. This plan adds the row for `apps/yt-script-desk/`; plan 267 adds the CLI row.
- Adding coverage means `pp-land` runs the test suite before merging a change to that path — the merge gate the executor's `test_cmd` also runs.

### Node 22 requirement

`vitest` in this app must run on Node 22 (documented in `apps/yt-script-desk/CLAUDE.md:14-23`). The exact prefix: `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`. Node 20 fails at vitest startup.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Vitest unit tests | `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test -- --run` | exit 0, all tests pass |
| Typecheck | `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck` | exit 0 |
| Local dev (manual sanity only, not required) | `cd apps/yt-script-desk && npm run dev:local` | Vite on :5175, API on :4327 |

## Scope

**In scope**:
- `apps/yt-script-desk/src/App.tsx` — add `?role=editor` URL gate; extend `tab` state to include `'avatar'`; render `AvatarMode` when gate is met.
- `apps/yt-script-desk/src/types.ts` — extend `VideoDoc` with `voLocked: boolean` and `heygenSelections: HeygenSelectionsFile | null`.
- `apps/yt-script-desk/src/api.ts` — add `putHeygenSelections(key, payload)`.
- `apps/yt-script-desk/src/components/Header.tsx` — surface the "avatar" tab pill only when `role === 'editor'` and the doc is VO-locked.
- `apps/yt-script-desk/src/components/ToggleRail.tsx` — add the "avatar" tab entry.
- `apps/yt-script-desk/src/components/AvatarMode.tsx` (NEW) — the selection UI.
- `apps/yt-script-desk/src/components/AvatarMode.css` (NEW) — its styles (match the existing script.html tokens).
- `apps/yt-script-desk/src/lib/selectionsFile.ts` (NEW) — pure helpers: build a `HeygenSelection` from a DOM range, compute total seconds, split section+word offsets.
- `apps/yt-script-desk/server/local.mjs` — read `script.json` for `voLocked`; add `GET/PUT /api/heygen-selections` endpoint; expose `voLocked` and `heygenSelections` on the `VideoDoc` from `buildVideoDoc`.
- Test files (NEW): `apps/yt-script-desk/src/components/__tests__/avatarMode.test.tsx`, `apps/yt-script-desk/server/__tests__/heygenSelections.test.mjs`.
- `apps/yt-script-desk/CLAUDE.md` — one paragraph explaining `?role=editor` and the VO-locked gate.
- `tooling/cli/pp-land/verify-map.tsv` — add row for `apps/yt-script-desk/`.

**Out of scope**:
- `pipelines/youtube/yt-script/lib/beats.mjs` — do NOT touch. AvatarMode consumes `doc.beats` as-is.
- Any changes to the hosted Worker code in `src/worker/` — the writer's link never renders the editor role.
- The pp-heygen-batch CLI itself — plan 267.
- Word-level timestamps or Whisper — the runner does that; the desk stores TEXT selections only.
- Any change to `script.json` shape.

## Git workflow

- Branch: `work/plan-266-yt-script-desk-avatar-mode` (created by pp-work)
- Commit: `feat(yt-script-desk): avatar selection mode` — no AI footers. Do NOT push.

## Selections file shape (the plan's contract with plan 267)

Write to `pipelines/youtube/yt-script/videos/<key>/heygen-selections.json`. The runner in plan 267 reads it. The exact JSON schema, non-negotiable:

```json
{
  "version": 1,
  "video_key": "<key>",
  "channel": "<channel id from vreg>",
  "submitted_at": "<ISO 8601 UTC>",
  "default_engine": "heygen3" | "heygen4",
  "selections": [
    {
      "id": "sel-01",
      "section_id": "s03",
      "engine": "heygen3" | "heygen4",
      "text": "<verbatim selected text as it appears in the rendered script>",
      "text_word_count": 42
    }
  ]
}
```

- `id` is `sel-<NN>` zero-padded to two digits, order = order in the queue as displayed.
- `section_id` is one section id from `script.json` (the section the selection FALLS IN; a selection that would span two sections is not allowed — see step 3).
- `text` is what the runner will match against the whisper word list. It is the verbatim script prose from the rendered paragraph after our normalization (see `selectionsFile.ts` step 4).
- `channel` is read from `pipelines/video-registry/videos.json` via `channelOf(key, reg)` (server-side; the client never resolves this).
- `default_engine` records the header dropdown's value at submit time (used for per-selection override telemetry only; the runner reads `engine` on each selection).

## Steps

### Step 1: Extend the local server to expose `voLocked` and the selections file

Edit `apps/yt-script-desk/server/local.mjs`.

1. At the top, after the existing imports, add:

   ```js
   import { join } from 'node:path'
   // (already imported: existsSync, readFileSync, writeFileSync)
   ```

2. Add a helper below `outlinePath`:

   ```js
   function scriptJsonPath(key) {
     return join(VIDEOS_ROOT, key, 'script.json')
   }
   function heygenSelectionsPath(key) {
     return join(VIDEOS_ROOT, key, 'heygen-selections.json')
   }
   function readScriptJson(key) {
     const p = scriptJsonPath(key)
     if (!existsSync(p)) return null
     try {
       return JSON.parse(readFileSync(p, 'utf8'))
     } catch {
       return null
     }
   }
   function voLockedFrom(scriptJson) {
     if (!scriptJson || !Array.isArray(scriptJson.sections) || scriptJson.sections.length === 0) return false
     return scriptJson.sections.every((s) => s?.tts?.locked === true)
   }
   function readHeygenSelections(key) {
     const p = heygenSelectionsPath(key)
     if (!existsSync(p)) return null
     try {
       return JSON.parse(readFileSync(p, 'utf8'))
     } catch {
       return null
     }
   }
   function writeHeygenSelectionsAtomic(key, payload) {
     const p = heygenSelectionsPath(key)
     const tmp = `${p}.tmp`
     writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n')
     // renameSync is atomic on POSIX
     renameSync(tmp, p)
   }
   ```

   `renameSync` is imported from `node:fs` in the existing import block; confirm it is there and add it if not.

3. Read `pipelines/video-registry/lib/registry.mjs`'s `channelOf` and `pipelines/video-registry/videos.json`. Add near the top:

   ```js
   import { channelOf } from '../../../pipelines/video-registry/lib/registry.mjs'
   const VREG_PATH = join(REPO_ROOT, 'pipelines', 'video-registry', 'videos.json')
   function channelForKey(key) {
     try {
       const reg = JSON.parse(readFileSync(VREG_PATH, 'utf8'))
       return channelOf(key, reg)
     } catch {
       return null
     }
   }
   ```

   Confirm `REPO_ROOT` already exists near the top of the file; if not, derive it as `join(new URL('.', import.meta.url).pathname, '../../../..')` or equivalent — check the surrounding code and match its style.

4. Extend `buildVideoDoc(key)` (line 118):

   ```js
   function buildVideoDoc(key) {
     const outPath = outlinePath(key)
     if (!existsSync(outPath)) return null
     const md = readFileSync(outPath, 'utf8')
     const { title, beats } = buildBeats(md)
     const doc = readDraft(key)
     const beatsWithEdits = effectiveBeats(beats, doc)
     const approval = approvalState(doc.approved, fingerprint(title, beatsWithEdits))
     const scriptJson = readScriptJson(key)
     const voLocked = voLockedFrom(scriptJson)
     const heygenSelections = readHeygenSelections(key)
     return {
       key,
       title,
       approval,
       beats: beatsWithEdits,
       draft: doc.draft,
       edits: doc.edits,
       says: doc.says,
       notes: doc.notes,
       noteEdits: doc.noteEdits,
       finished: doc.finished,
       voLocked,
       heygenSelections,
     }
   }
   ```

5. Add a `PUT /api/heygen-selections?key=<key>` handler. Place it alongside the existing `PUT /api/beat/:num/notes` handler at line 270. Use the exact same key-safety and atomic-write pattern:

   ```js
   // PUT /api/heygen-selections?key=<key> — writes the editor's queued avatar selections.
   // Independent of the desk-draft.json approval path: writing this file does NOT void
   // script approval. It is a separate output consumed by tooling/cli/pp-heygen-batch (plan 267).
   if (req.method === 'PUT' && url.pathname === '/api/heygen-selections') {
     if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
     const body = await readBody(req)
     if (!body || !Array.isArray(body.selections)) {
       return sendJson(res, 400, { error: 'selections[] required' })
     }
     if (!['heygen3', 'heygen4'].includes(body.default_engine)) {
       return sendJson(res, 400, { error: 'default_engine must be heygen3 or heygen4' })
     }
     const scriptJson = readScriptJson(key)
     if (!voLockedFrom(scriptJson)) {
       return sendJson(res, 409, { error: 'VO is not locked; every section must have tts.locked=true' })
     }
     const validSectionIds = new Set(scriptJson.sections.map((s) => s.id))
     for (const sel of body.selections) {
       if (typeof sel !== 'object' || sel === null) return sendJson(res, 400, { error: 'selection is not an object' })
       if (typeof sel.text !== 'string' || sel.text.trim().length === 0) return sendJson(res, 400, { error: 'selection.text empty' })
       if (!validSectionIds.has(sel.section_id)) return sendJson(res, 400, { error: `unknown section_id ${sel.section_id}` })
       if (!['heygen3', 'heygen4'].includes(sel.engine)) return sendJson(res, 400, { error: 'selection.engine invalid' })
     }
     const payload = {
       version: 1,
       video_key: key,
       channel: channelForKey(key),
       submitted_at: new Date().toISOString(),
       default_engine: body.default_engine,
       selections: body.selections.map((sel, i) => ({
         id: `sel-${String(i + 1).padStart(2, '0')}`,
         section_id: sel.section_id,
         engine: sel.engine,
         text: sel.text,
         text_word_count: sel.text.trim().split(/\s+/).length,
       })),
     }
     writeHeygenSelectionsAtomic(key, payload)
     return sendJson(res, 200, { ok: true, savedAt: payload.submitted_at, count: payload.selections.length })
   }
   ```

6. Add a `GET /api/heygen-selections?key=<key>` handler that returns the current queue file (or null). Same key-safety.

**Verify**: `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" node -e "const {default:s}=await import('./server/local.mjs')" 2>&1 | head -5` — expected: exits without a syntax error. (The module is not directly exported; this is only a parse check.)

### Step 2: Type extensions

Edit `apps/yt-script-desk/src/types.ts`.

Add to `VideoDoc`:

```ts
export type HeygenEngine = 'heygen3' | 'heygen4'

export type HeygenSelection = {
  id: string           // sel-01, sel-02, ...
  section_id: string
  engine: HeygenEngine
  text: string
  text_word_count: number
}

export type HeygenSelectionsFile = {
  version: 1
  video_key: string
  channel: string | null
  submitted_at: string
  default_engine: HeygenEngine
  selections: HeygenSelection[]
}

// Extend VideoDoc:
export type VideoDoc = {
  // ...existing fields unchanged...
  voLocked?: boolean                       // absent on hosted-mode responses (Worker never sends it)
  heygenSelections?: HeygenSelectionsFile | null  // absent on hosted-mode; null in local mode when no file yet
}
```

Both new fields optional so the hosted-mode `normalizeDoc` (in `src/api.ts:51-70`) does not fail when the Worker's response lacks them.

**Verify**: `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck` — expected: exit 0.

### Step 3: Pure helpers in `src/lib/selectionsFile.ts` (NEW)

The trickiest logic in this plan. Extracted so it can be unit-tested with no DOM.

Write these exact functions:

```ts
import type { Beat, VideoDoc, HeygenSelection, HeygenEngine } from '../types'

// A rendered paragraph in the AvatarMode view.
export type RenderedParagraph = {
  section_id: string      // e.g. 's01' — must match script.json section ids
  beat_num: string        // beat.num like '2.4' or 'A1'
  text: string            // one paragraph of spoken text
}

// Map a beat.num to a script.json section id.
// script.json ids look like 's01', 's02'; beat.section names look like
// '2 · BODY' or 'Cold Open'. The mapping rule is POSITIONAL: beats.mjs
// emits sections in the same order as script.json, so we group beats into
// script.json sections by walking both in order.
//
// The AvatarMode component owns this mapping (it has both arrays) and passes
// (beat, sectionIndex) into this helper. section_id comes from script.json.
export function selectionsFromRanges(
  ranges: DraftRange[],
  paragraphs: RenderedParagraph[],
  defaultEngine: HeygenEngine,
  overrides: Record<string, HeygenEngine>,
): HeygenSelection[] {
  // ranges are in DOM-selection order (top of document to bottom of document).
  // Each range names a start paragraph index + start char offset and an end
  // paragraph index + end char offset. We reject any range that spans more
  // than one paragraph — a selection that crosses a paragraph boundary is
  // ambiguous (the paragraph break is often a section break too).
  const results: HeygenSelection[] = []
  ranges.forEach((r, i) => {
    if (r.startParaIdx !== r.endParaIdx) return  // caller should have blocked this in the UI
    const p = paragraphs[r.startParaIdx]
    const text = p.text.slice(r.startOffset, r.endOffset).trim()
    if (text.length === 0) return
    const id = `sel-${String(i + 1).padStart(2, '0')}`
    const engine = overrides[id] ?? defaultEngine
    results.push({
      id,
      section_id: p.section_id,
      engine,
      text,
      text_word_count: text.split(/\s+/).length,
    })
  })
  return results
}

export type DraftRange = {
  startParaIdx: number
  startOffset: number
  endParaIdx: number
  endOffset: number
}

// Total spoken word count across all selections. The header meter uses this
// as a proxy for total seconds (real seconds come from the runner's whisper
// pass, but the desk cannot see that — see the runner's plan 267).
export function totalWords(selections: HeygenSelection[]): number {
  return selections.reduce((n, s) => n + s.text_word_count, 0)
}

// Group selections by engine. Header meter uses this to say "N will use pool".
export function countByEngine(selections: HeygenSelection[]): { heygen3: number; heygen4: number } {
  const out = { heygen3: 0, heygen4: 0 }
  for (const s of selections) out[s.engine]++
  return out
}
```

**Verify**: `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck` — expected: exit 0.

### Step 4: The `AvatarMode` component

Create `apps/yt-script-desk/src/components/AvatarMode.tsx`. Reuse `resolveBeatParagraphs` from `FullScript.tsx` — either export it from FullScript.tsx (preferred, one shared helper) or duplicate its behavior. Prefer exporting.

The component renders:

- A top strip with the video key, the "editor view" chip, and the "Default engine" dropdown (`heygen3` / `heygen4`, default `heygen4`).
- A left column: the resolved paragraphs in order, wrapped in one paragraph element per beat. Each paragraph is contentEditable = false but selectable. A `mouseup` handler reads `window.getSelection()`, computes the range within the paragraph, and calls `setDraftRanges((r) => [...r, range])`. If the selection spans two `<p>` elements (paragraphs), reject it with a small inline toast "highlight one paragraph at a time" — do not queue it.
- A right column: the queue. For each selection card, show the section id + word count, the excerpt (first 90 chars ...), an engine toggle (III / IV) that overrides the default, and a × remove button.
- A footer strip: total selections, total spoken words, breakdown "X on III, Y on IV", and a "Submit" button. Submit calls `putHeygenSelections(key, { default_engine, selections })`. On success, show a "saved" toast and disable further mutation until the editor reloads.

The DOM structure of the paragraph list must let the `mouseup` handler locate which paragraph a range is in. The simplest approach: each `<p>` carries `data-para-idx={idx}` and the handler walks up from the selection anchor node to that `<p>` and reads the attr. The handler also reads the selection's `startOffset` and `endOffset` against the paragraph's text content.

**Do not use** contentEditable on the paragraphs — HTML editing changes the DOM and breaks the offset math. The paragraphs are read-only and selectable only.

Copy visual tokens from `pipelines/youtube/yt-script/videos/character-consistency-ai/script.html` (the existing script render). Warm cream `--ground:#f6f7f8`, teal `--show:#0d6068`, warm brown `--say:#8a5a0a`. Highlighted range: `background: #fff2c2; box-shadow: inset 0 -2px 0 #eec96c` — matches the design mock.

Follow the AvatarMode.css style-sheet path. Import it once from AvatarMode.tsx. Existing components in this app scope styles by class prefix `.avatar-mode__…` — mirror that (see `src/components/FullScript.css` for the exact convention).

**Verify**: `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck` — expected: exit 0.

### Step 5: Wire the tab into App.tsx

In `apps/yt-script-desk/src/App.tsx`:

1. Below the existing `MARKDOWN_EDIT_MODE` line (47), add:

   ```ts
   const EDITOR_ROLE = new URLSearchParams(window.location.search).get('role') === 'editor'
   ```

2. Change the `tab` state's type:

   ```ts
   const [tab, setTab] = useState<'write' | 'full' | 'avatar'>('write')
   ```

3. The gate for showing avatar: `EDITOR_ROLE && doc?.voLocked === true`. Compute a memoized `showAvatar` boolean each render.

4. Pass `showAvatar` down to `Header` (add a `showAvatarTab: boolean` prop) so it can render the extra pill in the toggle rail. When `showAvatar` is false, `avatar` is not a reachable value for `setTab` — enforce with a guard in a `useEffect`: if `!showAvatar && tab === 'avatar'`, `setTab('write')`.

5. In the render block (around lines 274–331), when `tab === 'avatar' && showAvatar`, render:

   ```tsx
   <AvatarMode doc={doc} onSubmitted={fetchDoc} />
   ```

   Otherwise fall through to the existing write / full logic.

**Verify**: `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck` — expected: exit 0.

### Step 6: Server unit test — `heygenSelections.test.mjs`

Create `apps/yt-script-desk/server/__tests__/heygenSelections.test.mjs`. Use the existing conventions from `apps/yt-script-desk/server/__tests__/` — check one existing test in that folder to match the style. If none exists, mirror the shape of `apps/yt-script-desk/bin/__tests__/applyStaged.test.mjs` (a `node --test` style file).

Tests to write:

1. **Refuses when VO is not locked**: fixture `videos/<test-key>/script.json` with `tts.locked=false` on one section. Call `PUT /api/heygen-selections` with a valid body. Expect HTTP 409, body `{ error: /VO is not locked/ }`. Assert `heygen-selections.json` is NOT written.
2. **Writes with correct shape when locked**: fixture with every `tts.locked=true`. Body: `{ default_engine: 'heygen4', selections: [{ section_id: 's01', engine: 'heygen4', text: 'hello world' }] }`. Assert HTTP 200. Read the written file. Assert:
   - `version === 1`
   - `selections[0].id === 'sel-01'`
   - `selections[0].text_word_count === 2`
   - `submitted_at` is a valid ISO string
   - `channel` matches what `channelOf` would return for the test key (fixture the video-registry too)
3. **Rejects unknown section_id**: valid VO-locked fixture, body with `section_id: 's99'`. Assert HTTP 400.
4. **Rejects invalid engine**: body with `engine: 'heygen5'`. Assert HTTP 400.
5. **GET returns null when file absent, returns file when present**: two calls in sequence.

Use a temp dir for `VIDEOS_ROOT` — if the server module hard-codes it, refactor to allow an override via `process.env.YTS_VIDEOS_ROOT`. Check the current code before deciding: if `VIDEOS_ROOT` is already env-overridable, use that; otherwise ADD the override and reference it in the test.

**Verify**: `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" node --test server/__tests__/heygenSelections.test.mjs` — expected: all tests pass.

### Step 7: Component unit test — `avatarMode.test.tsx`

Create `apps/yt-script-desk/src/components/__tests__/avatarMode.test.tsx`. Follow `apps/yt-script-desk/src/components/__tests__/fullScript.test.tsx` as the exemplar.

Tests to write:

1. **Renders paragraphs from doc.beats**: pass a mock `doc` with two beats containing spoken text. Assert both paragraphs are in the DOM with `data-para-idx` attrs.
2. **Rejects cross-paragraph selection**: simulate a range spanning `data-para-idx="0"` to `data-para-idx="1"`. Assert the queue length does NOT increase and a toast/error message appears.
3. **Default engine dropdown changes new selections' engine**: default `heygen4`, add one selection, assert its rendered engine label is `IV`. Change default to `heygen3`, add another, assert its label is `III`. The first selection's engine does NOT change.
4. **Per-card override**: click the `III` pill on card 1. Assert only card 1's engine changed.
5. **Submit calls the api function**: mock `putHeygenSelections`, click Submit. Assert the api mock was called with the expected payload.
6. **App-level gate hides the tab**: render `<App>` (or the appropriate subtree) with `voLocked=false` and `?role=editor`. Assert no avatar tab pill in the header.
7. **App-level gate hides the tab when role missing**: `voLocked=true` and no `?role`. Assert no avatar tab pill.

Use `vitest`'s `describe` / `it` API and the existing `@testing-library/react` calls the app already uses (check `fullScript.test.tsx` for imports).

**Verify**: `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test -- --run src/components/__tests__/avatarMode.test.tsx` — expected: all tests pass.

### Step 8: Documentation

Append to `apps/yt-script-desk/CLAUDE.md` a section:

```markdown
## Editor role and avatar mode (2026-09-04, plan 266)

The desk carries a hidden "avatar" mode for the video editor. Reach it with
`?role=editor` on the local URL, and only if every section in `script.json`
has `tts.locked === true` (VO is locked at step 120). Otherwise the mode is
not rendered and its tab pill is not shown.

Selections are queued to `videos/<key>/heygen-selections.json` (gitignored,
same folder as `desk-draft.json`). The `tooling/cli/pp-heygen-batch` runner
reads that file to slice VO and call HeyGen. See plan 266 and plan 267 for
the design.

The writer's default link (no `?role`) is unchanged. The hosted Worker code
in `src/worker/` does not know about this mode — writer freelancer links
still show only the write/full tabs.
```

Also confirm the ignore rule: check `apps/yt-script-desk/.gitignore` and `pipelines/youtube/yt-script/.gitignore`. If neither ignores `heygen-selections.json` (they should — the folder ignores `desk-draft.json`), add an explicit rule to `pipelines/youtube/yt-script/.gitignore`:

```
videos/*/heygen-selections.json
```

**Verify**: `git status --short | grep heygen-selections.json` returns nothing (there are no such files yet).

### Step 9: Add verify-map row

Edit `tooling/cli/pp-land/verify-map.tsv`. Add:

```
apps/yt-script-desk/	cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test -- --run && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck
```

Preserve the existing rows exactly (TAB-separated, one row per line). Match the column separator style used by neighbors — verify by opening the file and counting tabs (`cat -A tooling/cli/pp-land/verify-map.tsv | head -3`).

**Verify**: `cd tooling/cli/pp-land && bash test-pp-land.sh` — expected: exit 0. (The pp-land test does a sanity check on the map.)

## Test plan

- Unit tests for the server endpoint (7 cases in `heygenSelections.test.mjs`) — cover VO-lock refusal, valid-write path, invalid inputs, GET semantics.
- Unit tests for the React component (7 cases in `avatarMode.test.tsx`) — cover rendering, selection queuing, engine defaults + override, submit, and both gate paths.
- Typecheck must remain green with the new types.
- No pipelines/ or worker/ code changes.

## Done criteria

- [ ] `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm test -- --run` exits 0.
- [ ] `cd apps/yt-script-desk && PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run typecheck` exits 0.
- [ ] `bash tooling/cli/pp-land/test-pp-land.sh` exits 0 (verify-map still valid).
- [ ] All 7 server test cases in `heygenSelections.test.mjs` are asserted.
- [ ] All 7 component test cases in `avatarMode.test.tsx` are asserted.
- [ ] `apps/yt-script-desk/CLAUDE.md` documents `?role=editor` and the VO-locked gate.
- [ ] `pipelines/youtube/yt-script/.gitignore` ignores `videos/*/heygen-selections.json`.
- [ ] Commit `feat(yt-script-desk): avatar selection mode` on branch `work/plan-266-yt-script-desk-avatar-mode`, ONE screenshot committed of the avatar mode view (see `pipelines/.claude/skills/yt-video-edit/references/` for the screenshot convention in this repo; a PNG in `apps/yt-script-desk/docs/screens/avatar-mode.png` works).

## STOP conditions

- Any test needing an assertion weakened to pass — STOP and report. Fix the code or the fixture, never the assertion. This applies to gate-integrity too: `voLockedFrom(scriptJson)` returning `true` when `tts.locked` is `false` for one section is a bug in the helper, not the test.
- `pipelines/youtube/yt-script/lib/beats.mjs` needs a change to make anything work — STOP. That file is owner-owned and out of scope.
- `src/worker/` needs a change — STOP. The hosted Worker never handles the editor role.
- Node 22 is unavailable on the executor's machine — STOP and report. Every command in this plan requires it.
- `channelOf` returns `null` for every test key you try — verify the video-registry fixture is correct before working around it.
- The DOM `Selection` API is not fully implemented in the test environment (jsdom limitation) — STOP and report; do not delete the cross-paragraph test. Use `@testing-library/react` + a manual dispatch of a mouseup event with a synthetic range if jsdom's selection is limited (this is a real known gap — mirror how existing tests handle it).

## Maintenance notes

- The selections file is a CONTRACT with plan 267. Any shape change must update BOTH plans and the runner. `version: 1` is deliberately fixed here; increment it if the shape changes.
- If the desk ever gains a role beyond writer/editor (e.g. "reviewer"), the URL param pattern extends by another guarded string, not by a new `?edit=1`-style boolean.
- The "cross-paragraph selection is rejected" rule keeps the mapping from selection to section unambiguous. If future work wants cross-paragraph selection (a range that spans a section break), the shape must change to record multiple `text` fragments per selection or split into two selections — do not silently allow it.
- If plan 267 later needs sub-word timing accuracy the desk cannot provide, the runner will re-run whisper on the wav; the desk never claims timing accuracy.

