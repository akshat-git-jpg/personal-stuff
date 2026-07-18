---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: true
deploy:
needs: ["078 (shots schema + resolver + lint)"]
---

# Plan 079: Board — shot spans as a reviewable third block kind

## Summary

- **Problem statement**: shots.json (plan 078) has no review surface. The board (localhost:4322) was built with this seam in mind — gap blocks are deliberately untyped — but today it renders only cue and gap blocks and saves/approves only cues.
- **Goals**:
  - Board renders shot spans: a shot lane in the minimap, shot blocks in the timeline (editable JSON + feedback box), an `in-shot` tint on covered segments, an engineMode chip.
  - Save round-trips shots: canon-compare approval reset for shots, shot lint results in the Save banner, `shots.resolved.json` rewritten.
  - Editing cues after shot approval un-approves the shots (staleness cascade).
  - Separate "Approve shots" gate; boards without shots.json behave exactly as today.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High, agy default) — owner-directed; algorithms and merge semantics fully inlined below.
- **Done criteria** (terse): check.sh green incl. new board tests; a no-shots board byte-identical in behavior; shots board screenshot attached to the PR.
- **Stop conditions** (terse): no cue-flow behavior changes beyond the specified cascade; board must never crash on missing/broken shots.json.
- **Test / verification for success**: `node --test lib/board.test.mjs` (extended) via check.sh + a manual board run on a fixture workdir with a screenshot (ui: true).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b40a207..HEAD -- pipelines/video/visuals-flow/lib/board.mjs pipelines/video/visuals-flow/lib/board.test.mjs`
> Expect only the 077 rename move; other diffs → report first.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the owner's main review surface; mitigated by the no-shots-unchanged rule + tests)
- **Depends on**: 078
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `b40a207`, 2026-07-18

## Why this matters

The board is the single owner gate of the whole pipeline: cue review, feedback capture, and approval all happen there, and its feedback lifecycle feeds the 060 fold loop. Shot spans must ride the SAME surfaces — one timeline, one Save, one feedback.json — or the avatar phase forks into a second review workflow (explicitly rejected in the design doc, `docs/specs/2026-07-18-avatar-shot-plan-design.md`).

## Current state

All in `pipelines/video/visuals-flow/lib/board.mjs` (~900 lines; line numbers pre-077, content identical):

- `buildSegments(words, resolved, {gapMinWords=8})` (line 225) — cue segments + untyped gap segments, small gaps merged forward (lines 271–280). **Do not modify it** — the shot lane is computed independently from absolute span times.
- `renderBoardPage(cuesFile, resolved, words, feedbackItems = {})` (line 294) — builds: `fbBox(ref, placeholder)` feedback textareas (line 299), minimap (lines 314–330, one `minimap-seg` div per segment, `flex-grow:<duration>`), timeline blocks (gap blocks lines 341–348 with `fbBox('gap-<timecode>')`; cue tiles line 393 with `data-id`, editable `.frag` JSON textarea, `fbBox(cue.id)`), topbar with Approve/Save buttons (lines 419–420), approved banner (line 423), client JS: Save collects `.tile` frags + all `textarea.feedback` values and POSTs `{video, approved, cues, feedback}` to `/save` (lines 468–509); Approve POSTs `/approve` (511–514).
- `handleSave(req, res, workdir, cardLibraryRoot)` (~line 536) — merges incoming into cues.json; **canon-compare** (lines 546–552: key-order-insensitive stringify) resets `approved` when cues actually changed; writes feedback.json items `{text, added, context?, folded?}` with gap/cue context (lines 560–597); re-resolves, lints, writes resolved.json, returns `{ok, errors, warnings}`.
- `handleApprove` (line 614) — sets `cuesFile.approved = true`.
- Request routing (lines ~806–812): `POST /save` → handleSave, `POST /approve` → handleApprove.
- `lib/board.test.mjs` (556 lines) — the exemplar for testing this file's exports.
- From plan 078: `resolveShots(shotsFile, words)` and `lintShots({shotsResolved, resolvedCues, words})` in `lib/resolve-shots.mjs` / `lib/lint-shots.mjs`; `shots.json` schema in PIPELINE.md.
- Colors: CSS vars `--accent` (fullframe), `--accent-light` (overlay), `--err`, `--line`, `--dim` in `BOARD_CSS`. Add `--shot` (pick `#eab308` gold — matches the card-library gold-chip winner pattern in DESIGN.md).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |
| Board tests | `node --test lib/board.test.mjs` | all pass |
| Manual board (fixture) | `node lib/board.mjs videos/test-01` | serves on 127.0.0.1:4322 (walks ports) |

## Scope

**In scope**:
- `lib/board.mjs`, `lib/board.test.mjs`, `BOARD_CSS` additions (inside board.mjs).
- `plans/README.md` status row for 079.

**Out of scope**:
- `buildSegments` internals, `/calibrate`, slices/audio playback for shot spans (future nicety, not now).
- `lib/resolve-shots.mjs` / `lib/lint-shots.mjs` (plan 078 owns them — consume as-is).
- Rendering (plan 080), any cue schema/lint change.
- test-01's committed data files (manual check may create a THROWAWAY copy under `videos/_board-fixture/` — gitignored media rules apply; delete it before finishing).

## Git workflow

- Branch: `advisor/079-board-shot-spans`
- Commit per step: `feat(visuals-flow): board — <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Load + pure helpers

In `board.mjs`, add module-level pure functions (exported, for tests):

```js
// Reads shots.json + computes resolved spans; null when the video has no shot
// plan yet — every caller must handle null and render the pre-078 board.
export function loadShots(workdir, words) {
  const p = path.join(workdir, 'shots.json');
  if (!fs.existsSync(p)) return null;
  let shotsFile;
  try { shotsFile = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { shotsFile: null, spans: [], errors: [`shots.json unreadable: ${e.message}`] }; }
  const { spans, errors } = resolveShots(shotsFile, words);
  return { shotsFile, spans, errors };
}

// Merge semantics mirror handleSave's cue merge: key-order-insensitive
// compare; a real change to spans resets approval.
export function mergeShots(prevShotsFile, incomingSpans) {
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object')
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
  const merged = { ...prevShotsFile, spans: incomingSpans };
  const changed = JSON.stringify(canon(prevShotsFile.spans ?? [])) !== JSON.stringify(canon(incomingSpans ?? []));
  if (prevShotsFile.approved === true && changed) merged.approved = false;
  return { merged, changed };
}
```

(`resolveShots` imported from `./resolve-shots.mjs`.)

**Verify**: `node --test lib/board.test.mjs` still passes (nothing wired yet).

### Step 2: Render — minimap shot lane, shot blocks, tint, chips

Extend `renderBoardPage(cuesFile, resolved, words, feedbackItems = {}, shots = null)`:

1. **Shot lane** (only when `shots?.spans?.length || shots?.errors?.length`): directly under the existing `.minimap` div, add `<div class="minimap minimap-shots">` built from the sorted spans over `[0, totalDuration]`: alternate filler divs (`background:var(--line)`, flex-grow = gap seconds) and span divs (`background:var(--shot)`, flex-grow = span duration, `title="<timecode> · <id> · avatar-full"`, onclick scrolls to `shot-<id>`).
2. **Shot blocks**: interleave into the timeline — after computing `timelineHtml` segments array, build one block per span and splice each into the HTML stream before the first segment whose `start >= span.start` (append at end if none). Block shape (imitate the gap block's classes):

```html
<div class="timeline-block shot-block" id="shot-<id>">
  <div class="shot-header">🧍 <b><id></b> avatar-full · <timecode(start)> → <timecode(end)> · <duration s> — <note></div>
  <textarea class="shot-frag">{JSON of the ORIGINAL shots.json span (from_anchor/to_anchor/kind/note/flagged), pretty-printed}</textarea>
  ${fbBox('<id>', 'feedback on this shot span (read by the next Claude session)')}
</div>
```

3. **Tint**: cue/gap blocks whose segment midpoint `(seg.start+seg.end)/2` falls inside any span get class `in-shot` (CSS: `border-left: 3px solid var(--shot)`).
4. **Topbar**: when shots present, add `<span class="usage-chip">engineMode: <engineMode></span>` and a second button `<button id="approveShotsBtn">Approve shots</button>`; banner area shows `shots approved` state alongside the cue banner (same `.banner ok` pattern, text `shot plan approved — ready for the avatar render step`). Unresolved-shot errors (from `shots.errors`) render as a `.banner err` listing them.
5. **CSS**: add `--shot: #eab308;`, `.minimap-shots{height:6px; margin-top:2px}`, `.shot-block{border-left:3px solid var(--shot)}`, `.in-shot{border-left:3px solid var(--shot)}` to `BOARD_CSS`.

When `shots === null`, every one of these is skipped — output must be byte-identical to today's page.

**Verify**: `node --test lib/board.test.mjs` passes; add a temporary render check later in Step 4's tests (no manual check yet).

### Step 3: Save + approve wiring

1. **Client JS**: in the Save handler, after collecting cues, collect spans when shot blocks exist:
   ```js
   const shotBroken = [];
   const spans = [...document.querySelectorAll('.shot-block')].map((b) => {
     try { return JSON.parse(b.querySelector('.shot-frag').value); }
     catch (e) { shotBroken.push(b.id + ': ' + e.message); return null; }
   }).filter(Boolean);
   ```
   Abort with the same "invalid fragment JSON" banner when `shotBroken.length`. Include `spans` in the POST body only when shot blocks exist: `{video, approved, cues, feedback, spans}`.
2. **`handleSave`**: after the existing cue merge + feedback write, when `shots.json` exists:
   - If the request carried `spans`, run `mergeShots(prevShotsFile, spans)` and use the result; otherwise keep `prevShotsFile` as merged.
   - **Staleness cascade**: if the CUE canon-compare found a real cue change (reuse the existing comparison's outcome — hoist its boolean into `const cuesChanged`) and the merged shots file has `approved === true`, set `approved = false` and push `'shots: un-approved — cues changed after shot approval (re-review the shot plan)'` into the returned warnings.
   - `resolveShots(mergedShots, words)`: on errors, return them prefixed `shots: ` in the response `errors` (shot resolve errors must NOT block the cue save — cues.json is already written by this point; only the shots write is skipped when spans fail to resolve… write shots.json with the merged content regardless, skip only `shots.resolved.json`).
   - On success: write `shots.json` (pretty, 2-space), write `shots.resolved.json` `{video, offset, engineMode, spans}`, run `lintShots({shotsResolved, resolvedCues: resolved, words})` and append its errors/warnings to the response, each prefixed `shots: `.
   - Feedback context for span refs: when a feedback ref matches a span id, `item.context = { start: span.start, end: span.end, note: span.note }` (extend the existing ref-context branch — span ids are looked up before the cue-id branch).
3. **`/approve-shots`**: new POST route + handler — sets `approved: true` in shots.json (mirror `handleApprove`). Client button POSTs it and reloads. The existing `/approve` stays cues-only.

**Verify**: `node --test lib/board.test.mjs` passes.

### Step 4: Tests (extend `lib/board.test.mjs`)

Imitate the file's existing patterns (temp workdirs, direct function calls). Cases:

1. `mergeShots`: (a) approved + changed spans → `approved:false`; (b) approved + identical spans reordered keys → stays approved (canon compare); (c) unapproved + change → merged, no flag invented.
2. `loadShots`: (a) missing file → null; (b) valid file → spans resolved; (c) corrupt JSON → `{shotsFile:null, errors:[…]}` and no throw.
3. `renderBoardPage` with `shots = null` → output contains NO `minimap-shots`, NO `shot-block`, NO `approveShotsBtn` (the no-shots board is unchanged).
4. `renderBoardPage` with 2 spans → contains 2 `shot-block` divs in start order, the shot lane, the engineMode chip, and `in-shot` on a block whose midpoint is covered.
5. Save-path integration (follow how existing tests exercise handleSave, if they do; else test the exported pieces): cue change with approved shots → shots `approved` flips false and warning emitted.

**Verify**: `bash scripts/check.sh` → exit 0.

### Step 5: Manual check + screenshot (ui gate)

Create a throwaway fixture `videos/_board-fixture/` by copying test-01's `transcript.json`, `cues.json`, `resolved.json` and adding a minimal `shots.json` (2 spans with anchors quoted verbatim from that transcript, `engineMode: "test"`, `approved: false`). Run `node lib/board.mjs videos/_board-fixture`, open the printed URL, screenshot the full board showing the shot lane + a shot block + the engineMode chip, attach to the PR. Then delete `videos/_board-fixture/`.

**Verify**: screenshot exists in the PR; `git status` shows no `_board-fixture` files.

## Test plan

Step 4 — extended board tests covering merge semantics, null-shots invariance, render output, and the staleness cascade; plus the Step 5 visual check (this is the `ui: true` plan — the verifier LOOKS at the board, agy never self-certifies visuals).

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 (incl. new board tests).
- [ ] A workdir WITHOUT shots.json renders a board with zero shot UI (test-asserted).
- [ ] A workdir WITH shots.json shows lane + blocks + chip + Approve shots; Save round-trips span edits and resets approval on change; cue edits after shot approval un-approve shots (test-asserted).
- [ ] Screenshot on the PR.
- [ ] `plans/README.md` row for 079 flipped to DONE.

## STOP conditions

- Any change to `buildSegments`, cue merge semantics, or the cue approve flow beyond hoisting `cuesChanged` — that machinery is proven; report instead.
- Board throws on missing/corrupt shots.json in any code path — fix within Step 1's contract; if that contract can't hold somewhere, stop and report.
- The no-shots render diverges from today's output in Step 4 case 3 — report, don't loosen the assertion.

## Maintenance notes

- Span feedback rides feedback.json under span ids (`s01`…) — 060's fold loop picks them up with zero changes; ids must never collide with cue ids (`c…` vs `s…` prefixes are load-bearing).
- The shot lane reads `shots.resolved.json` semantics but recomputes live via `resolveShots` — same freshness philosophy as cue segments.
- Plan 080's render gate reads `shots.json` `approved` + recomputes staleness the same way `render.mjs` does for cues; the cascade here is the board-side half of that guarantee.
