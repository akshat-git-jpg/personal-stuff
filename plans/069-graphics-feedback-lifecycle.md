---
executor: agy
model:
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui: true
deploy:
needs: ["first of the board.mjs chain 069 -> 070 -> 073 -> 074 (shared file)"]
---

# Plan 069: Graphics-flow feedback lifecycle — folded state must survive board Saves

## Summary

- **Problem statement**: The board rewrites `feedback.json` from its textareas on every Save, and step 060 (feedback-fold) marks items `folded` in the same file with an incompatible shape. The first Save after a fold wipes the folded markers and resurfaces already-folded feedback — silently breaking the "never repeat a mistake" guarantee.
- **Goals**: One `feedback.json` schema both writers agree on; folded items are read-only on the board and immune to Save; legacy string items still load.
- **Executor proposed**: agy (standard difficulty — mechanical once the schema is specified).
- **Done criteria** (terse — full list below): folded items survive a board Save; board shows folded items dimmed/read-only; tests cover the merge; 060 README documents the schema.
- **Stop conditions** (terse — full list below): schema conflicts with an existing non-empty feedback.json in any workdir; board tests can't reproduce the flow.
- **Test / verification for success**: new cases in `lib/board.test.mjs` + `scripts/check.sh` green.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow/lib/board.mjs pipelines/video/graphics-flow/lib/board.test.mjs pipelines/video/graphics-flow/steps/060-feedback-fold-opus/README.md`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but lands BEFORE 070/073/074, which touch the same file)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

`pipelines/video/graphics-flow` is a beat-synced motion-graphics pipeline. Its
learning loop is step 060 (`steps/060-feedback-fold-opus/README.md`): owner
feedback typed into the review board lands in `videos/<slug>/feedback.json`, an
Opus session folds each item into the rule surfaces (RULEBOOK, DESIGN.md,
catalog.json), then marks the item folded:

> 4. Mark each folded item in its feedback.json: `"folded": "<date> — <where the rule landed>"`

But the board (`lib/board.mjs`) treats `items` as a flat `{ref: "text string"}`
map. On page load it pre-fills every item back into an editable textarea
(`board.mjs` line 194: `const fb = (ref) => escapeHtml(feedbackItems[ref] ?? '')`),
and on Save it rebuilds the whole file from only the current textareas:

```js
// board.mjs lines 410-418 (current)
if (feedback && typeof feedback === 'object') {
  const items = Object.fromEntries(
    Object.entries(feedback).filter(([, v]) => String(v ?? '').trim() !== ''),
  );
  fs.writeFileSync(
    path.join(workdir, 'feedback.json'),
    JSON.stringify({ video: merged.video, updated: new Date().toISOString().slice(0, 10), items }, null, 2),
  );
}
```

Two failure modes:

1. If 060 stores folded state as an object (`{text, folded}`), the board's
   prefill renders `[object Object]` and the next Save writes that garbage back.
2. If 060 stores folded state any other way, the next Save simply discards it
   (items are rebuilt purely from textareas), and the already-folded text sits
   in an editable textarea looking like fresh unfolded feedback forever.

Today every `feedback.json` is empty, so this is latent — it bites on the first
real fold + re-review cycle. Fix it before video #2.

## Current state

- `pipelines/video/graphics-flow/lib/board.mjs` — local review server (port 4322).
  Relevant pieces: `renderBoardPage()` (prefill via `fb(ref)` / `fbBox(ref, ...)`,
  lines ~194-196), `handleSave()` (lines ~390-435, excerpt above).
- `pipelines/video/graphics-flow/steps/060-feedback-fold-opus/README.md` — the
  fold procedure (doc only, no code).
- `pipelines/video/graphics-flow/lib/board.test.mjs` — node:test suite using a
  temp copy of `lib/fixtures/board/`; the test
  `'save: feedback goes to feedback.json; offset survives; page renders saved feedback'`
  (line ~204) is the exemplar to extend — follow its structure (start server on
  port 0, `fetch` against it, assert on files and page HTML).
- Feedback refs are: cue ids (`c01`), `gap-<mm:ss>`, and `_global`.
- Repo conventions: plain node ESM `.mjs`, no dependencies, `node:test` +
  `assert`, tests run via `scripts/check.sh`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate (tests + rulebook check) | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0, `graphics-flow check OK` |
| Just the board tests | `cd pipelines/video/graphics-flow && node --test lib/board.test.mjs` | all pass |

## Scope

**In scope**:
- `lib/board.mjs` (feedback read/merge/write + folded rendering)
- `lib/board.test.mjs` (new cases)
- `steps/060-feedback-fold-opus/README.md` (schema documented in step 4)
- `PIPELINE.md` (the one bullet describing board feedback, if wording changes)

**Out of scope**:
- Everything else in `board.mjs` (Save/approve mechanics, slices, segments) —
  plans 070/073/074 own those.
- `resolve.mjs`, `render.mjs`, the card-library.
- Writing any actual feedback or performing a fold.

## Git workflow

- Branch: `advisor/069-graphics-feedback-lifecycle`
- Commit: `fix(graphics-flow): feedback.json item schema + folded state survives board saves` — no AI footers. Do NOT push.

## Steps

### Step 1: Define the item schema and a legacy-tolerant reader

In `board.mjs`, introduce a normalizer used everywhere feedback is read:

```js
// items: { [ref]: { text, added?, folded? } } — legacy plain-string values
// are upgraded to { text } on read.
function normalizeFeedbackItems(raw) {
  const items = {};
  for (const [ref, v] of Object.entries(raw ?? {})) {
    if (typeof v === 'string') items[ref] = { text: v };
    else if (v && typeof v === 'object' && typeof v.text === 'string') items[ref] = v;
  }
  return items;
}
```

Use it in the GET `/` handler where `feedback.json` is loaded (currently
`JSON.parse(...).items ?? {}`).

**Verify**: `cd pipelines/video/graphics-flow && node --test lib/board.test.mjs` -> existing tests still pass.

### Step 2: Render folded items read-only; prefill only unfolded text

In `renderBoardPage()`:

- `fb(ref)` returns `items[ref]?.folded ? '' : (items[ref]?.text ?? '')` — folded
  text never enters a textarea.
- `fbBox(ref, placeholder)` additionally renders, when `items[ref]?.folded`, a
  dimmed read-only line under the textarea, e.g.
  `<div class="feedback-folded">✓ folded ${escapeHtml(items[ref].folded)} — "${escapeHtml(items[ref].text)}"</div>`
  with a small CSS rule in `BOARD_CSS` (12px, `var(--dim)`, no border).

All user-derived strings go through the existing `escapeHtml()`.

**Verify**: `node --test lib/board.test.mjs` -> still green (new assertions come in Step 4).

### Step 3: Save merges over existing items and never touches folded ones

Rewrite the feedback block of `handleSave()`:

```js
const fbPath = path.join(workdir, 'feedback.json');
const existing = fs.existsSync(fbPath)
  ? normalizeFeedbackItems(JSON.parse(fs.readFileSync(fbPath, 'utf8')).items)
  : {};
const items = { ...existing };
const today = new Date().toISOString().slice(0, 10);
for (const [ref, v] of Object.entries(feedback ?? {})) {
  const text = String(v ?? '').trim();
  if (items[ref]?.folded) continue;            // folded items are immutable here
  if (!text) delete items[ref];                // cleared box removes an unfolded item
  else if (items[ref]?.text !== text) items[ref] = { text, added: today };
}
fs.writeFileSync(fbPath, JSON.stringify({ video: merged.video, updated: today, items }, null, 2));
```

Note the client already sends only non-empty textareas (`board.mjs` client
script filters on `t.value.trim()`); change the client to send ALL feedback
textareas including empty ones, so clearing a box deletes the item:
in the save onclick, replace the `if (t.value.trim())` filter with an
unconditional `feedback[t.dataset.ref] = t.value;`.

**Verify**: `node --test lib/board.test.mjs` -> green.

### Step 4: Tests

Add to `lib/board.test.mjs`, following the existing save/feedback test's
structure:

1. **Folded survives Save**: seed the temp workdir's `feedback.json` with
   `items: { c01: { text: 'old lesson', folded: '2026-07-18 — RULEBOOK' }, _global: { text: 'still open' } }`;
   POST `/save` with `feedback: { _global: 'updated note', c02: 'new item' }`;
   assert the written file still has `c01` intact with its `folded` value,
   `_global.text === 'updated note'`, and `c02.text === 'new item'`.
2. **Folded is read-only in the page**: GET `/`; assert the `c01` textarea is
   empty and the page contains `folded 2026-07-18` and `old lesson` outside a
   textarea (e.g. in a `feedback-folded` div).
3. **Legacy string upgrade**: seed `items: { c01: 'plain old string' }`;
   GET `/` shows it in the textarea; POST `/save` echoing it back; assert the
   file now stores `{ text: 'plain old string', ... }`.
4. **Clearing deletes unfolded**: seed an unfolded `c01`; save with `c01: ''`;
   assert `c01` gone from the file.

**Verify**: `bash pipelines/video/graphics-flow/scripts/check.sh` -> exit 0.

### Step 5: Document the schema where 060 reads it

In `steps/060-feedback-fold-opus/README.md` step 4, replace the ambiguous
instruction with the concrete shape:

```
4. Mark each folded item in its feedback.json by setting `folded` on the item
   object: `"c05": { "text": "...", "added": "2026-07-18", "folded": "2026-07-19 — RULEBOOK section 2" }`.
   The board treats folded items as read-only history — they can never be
   edited or deleted from the board again.
```

Also update the feedback bullet in `PIPELINE.md` (cues.json schema section,
"Board feedback" bullet) to mention items are objects `{text, added, folded?}`.

**Verify**: `grep -n 'folded' pipelines/video/graphics-flow/steps/060-feedback-fold-opus/README.md` shows the object form.

## Test plan

All via `node:test` in `lib/board.test.mjs` (cases in Step 4) plus the flow
gate `scripts/check.sh`. Attach a screenshot of a board tile showing a dimmed
"✓ folded" line to the PR (ui gate) — seed the fixture workdir feedback.json
by hand, run `node lib/board.mjs lib/fixtures/board`, screenshot.

## Done criteria

- [ ] `feedback.json` items are `{text, added?, folded?}` objects; legacy strings load fine.
- [ ] A board Save preserves folded items byte-for-byte and never re-surfaces them in textareas.
- [ ] Clearing a textarea deletes the (unfolded) item; folded items cannot be deleted from the board.
- [ ] New tests from Step 4 pass; `scripts/check.sh` exits 0.
- [ ] 060 README and PIPELINE.md document the schema.

## STOP conditions

- Any `videos/*/feedback.json` in the repo is non-empty at execution time with
  a shape that contradicts this schema — stop and report (migration decision is the owner's).
- The existing board tests fail BEFORE your changes (baseline broken) — stop and report.

## Maintenance notes

- Step 060's fold procedure and the board are now coupled through this schema;
  if 060 ever wants richer state (e.g. `rejected`), extend the item object and
  keep the board's "folded = immutable" rule.
- Plans 070/073/074 also edit `board.mjs` — land this first, rebase them.
