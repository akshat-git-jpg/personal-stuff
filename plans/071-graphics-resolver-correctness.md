---
executor: agy
model:
test_cmd: bash pipelines/video/graphics-flow/scripts/check.sh
ui:
deploy:
needs: ["lands before 072 (both touch resolve.mjs)"]
---

# Plan 071: Graphics-flow resolver correctness — non-adjacent fullframe overlap + cursor past the whole anchor phrase

## Summary

- **Problem statement**: `resolveCues` misses fullframe-overlap errors whenever an overlay cue sits between two fullframes (it only compares against the immediately previous output cue), and the match cursor advances just one word past an anchor's START, so a beat anchor can match inside its own cue's anchor phrase — violating the folded lesson "beat anchors must come AFTER the cue anchor".
- **Goals**: overlap checked against the last *fullframe* cue regardless of adjacency; cursor advances past the full matched phrase; `videos/test-01/resolved.json` stays byte-identical.
- **Executor proposed**: agy (standard — small, but semantics-sensitive; the test-01 diff gate is the safety net).
- **Done criteria** (terse): both behaviors changed + tested; test-01 resolves clean with an unchanged resolved.json; `scripts/check.sh` green.
- **Stop conditions** (terse): test-01 resolution changes at all; any existing test's intent conflicts with the new semantics.
- **Test / verification for success**: new resolver tests + `node lib/resolve.mjs test-01` + `git diff --exit-code videos/test-01/resolved.json`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8e48c2f..HEAD -- pipelines/video/graphics-flow/lib/resolve.mjs pipelines/video/graphics-flow/lib/resolve.test.mjs`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (changes matching semantics; mitigated by the test-01 byte-diff gate)
- **Depends on**: none; must land BEFORE 072 (same file)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `8e48c2f`, 2026-07-18

## Why this matters

The resolver (`lib/resolve.mjs`) is the flow's only defense between the LLM cue
pass and rendering. Two holes:

**1. Overlap check only sees the adjacent cue.** Current code (lines 117-121):

```js
const prev = out[out.length - 1];
if (prev && cat.placement === 'fullframe' && prev.placement === 'fullframe' && start < prev.start + prev.duration) {
  errors.push(`${cue.id}: overlaps previous fullframe cue ${prev.id} (...)`);
  continue;
}
```

Sequence: fullframe A (0–30s) → overlay B at 10s → fullframe C at 20s. When C
is processed, `prev` is B (an overlay), the condition is false, and C lands on
top of A. Real cue lists interleave overlays and fullframes constantly
(test-01 v2 has 12 overlays among 15 fullframes), so this is a live hole — the
RULEBOOK's "never let two fullframe cues' spoken coverage overlap" is only
enforced for adjacent pairs. (Overlay-vs-anything overlap is allowed by
design; do not add checks for it.)

**2. Cursor advances one word, not one phrase.** Lines 101-113:

```js
const a = findFrom(cue.anchor, cursor);
...
cursor = a.idx + 1;
...
for (const b of cue.beats ?? []) {
  const m = findFrom(b.anchor, cursor);
  ...
  cursor = m.idx + 1;
```

After matching cue anchor "let's look at the pros" at word i, the cursor is
i+1 — so a beat anchor like "look at the pros and" matches INSIDE the cue's
own anchor phrase. tests/TESTS.md records the folded lesson from the v2 run:
"beat anchors must come AFTER the cue anchor" — the resolver should encode it
(machine-enforced surfaces beat prose, per this flow's own philosophy).
Advancing `cursor = idx + phraseLength` does exactly that, for cue anchors and
beat anchors alike.

## Current state

- `pipelines/video/graphics-flow/lib/resolve.mjs` (168 lines). Key internals:
  - `findFrom(phrase, from)` returns `{ idx, start }` or `{ err }`; `idx` is the
    index of the phrase's FIRST word in the normalized word array `W`.
  - `resolveCues` walks cues in order with a single forward-only `cursor`.
  - Output entries: `{ id, card, placement, start, duration, variables }`.
- `lib/resolve.test.mjs` (233 lines) — `node:test`; helpers `wordsFrom(text)`
  and a small inline catalog at the top; follow that style. The existing test
  `'monotonicity: beat phrase only before the cue anchor is not found (forward search only)'`
  (line ~93) and `'overlapping fullframe cues error; overlay overlapping fullframe does not'`
  (line ~139) are the two closest exemplars.
- Real-data gate: `videos/test-01/` — 27 cues, all resolving clean at commit
  `8e48c2f`; its resolved.json is committed and must not change.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Resolver tests | `cd pipelines/video/graphics-flow && node --test lib/resolve.test.mjs` | all pass |
| Real-data regression gate | `cd pipelines/video/graphics-flow && node lib/resolve.mjs test-01 && git diff --exit-code videos/test-01/resolved.json` | exit 0, no diff |
| Flow gate | `bash pipelines/video/graphics-flow/scripts/check.sh` | exit 0 |

## Scope

**In scope**:
- `lib/resolve.mjs`: `findFrom` return value, cursor advancement, overlap tracking.
- `lib/resolve.test.mjs`: new cases.
- One line in `steps/020-cue-pass-llm/RULEBOOK.md` Anchors section noting the
  beat-after-cue-anchor rule is now resolver-enforced.

**Out of scope**:
- `validateCues` (072 extends validation separately).
- `render.mjs`, `board.mjs` (they import `resolveCues`/`normWord` — the export
  signatures must not change).
- Any change to `videos/test-01/` data.

## Git workflow

- Branch: `advisor/071-graphics-resolver-correctness`
- Commit: `fix(graphics-flow): resolver tracks last fullframe for overlap; cursor advances past whole anchor phrase` — no AI footers. Do NOT push.

## Steps

### Step 1: `findFrom` returns the phrase length

Have `findFrom` return `{ idx, start, len: p.length }` on success. Update the
two call sites to `cursor = a.idx + a.len;` and `cursor = m.idx + m.len;`.

**Verify**: `node --test lib/resolve.test.mjs` -> the existing monotonicity and
repeated-phrase tests still pass.

### Step 2: Track the last fullframe cue for overlap

Replace the `prev = out[out.length - 1]` logic with a `lastFullframe` variable
maintained across the loop:

```js
let lastFullframe = null;
...
if (cat.placement === 'fullframe' && lastFullframe && start < lastFullframe.start + lastFullframe.duration) {
  errors.push(`${cue.id}: overlaps fullframe cue ${lastFullframe.id} (${start.toFixed(2)} < ${(lastFullframe.start + lastFullframe.duration).toFixed(2)})`);
  continue;
}
...
out.push(entry);
if (entry.placement === 'fullframe') lastFullframe = entry;
```

Keep the error message shape close to the current one (board surfaces these
strings verbatim in its banner).

**Verify**: `node --test lib/resolve.test.mjs` -> existing overlap test passes.

### Step 3: New tests

Add to `lib/resolve.test.mjs`:

1. **Sandwich overlap**: fullframe A, overlay B inside A's span, fullframe C
   starting before A ends -> error mentioning A's id; with C after A ends -> no error.
2. **Beat anchor inside cue anchor phrase now fails**: cue anchor
   `"alpha beta gamma delta"`, beat anchor `"beta gamma delta"` (present only
   inside the cue anchor) -> beat error "anchor not found". A beat anchored on
   the phrase immediately AFTER the cue anchor still resolves.
3. **Consecutive cues sharing boundary words**: cue 1 anchor ends at word i,
   cue 2 anchor starts at word i+1 -> both resolve (cursor lands exactly past
   the phrase, not beyond it).

**Verify**: `node --test lib/resolve.test.mjs` -> all pass.

### Step 4: Real-data regression gate + rulebook line

Run the regression gate (must be pristine):

```
cd pipelines/video/graphics-flow
node lib/resolve.mjs test-01
git diff --exit-code videos/test-01/resolved.json
```

Then add to `steps/020-cue-pass-llm/RULEBOOK.md` under `## Anchors`:
`- A beat's anchor must begin after its cue's anchor phrase ends — the resolver enforces this (it will report "anchor not found").`

**Verify**: both commands exit 0; `bash pipelines/video/graphics-flow/scripts/check.sh` -> exit 0 (also re-checks the rulebook's required sections).

## Test plan

Unit tests (Step 3), the untouched existing suite, and the test-01 byte-diff
regression gate — the strongest possible evidence the semantics change doesn't
move any real timing.

## Done criteria

- [ ] Non-adjacent fullframe overlap errors; overlay-between case covered by a test.
- [ ] Cursor advances past the full matched phrase for cue and beat anchors; covered by tests.
- [ ] `node lib/resolve.mjs test-01` exits 0 and `videos/test-01/resolved.json` is unchanged.
- [ ] `scripts/check.sh` exits 0.

## STOP conditions

- The test-01 regression gate shows ANY diff — stop and report the differing
  cue ids; do not commit a changed resolved.json.
- An existing test asserts behavior that the new semantics intentionally flip
  (other than ones this plan lists) — stop and report instead of rewriting it.

## Maintenance notes

- `resolveCues` is imported by `board.mjs` and (after plan 070) `render.mjs`;
  its signature and output shape are unchanged here — keep it that way.
- If a future card ever legitimately needs a beat ON the cue anchor phrase,
  the rulebook workaround is a beat anchor slightly later in the sentence; do
  not weaken the cursor rule for it.
