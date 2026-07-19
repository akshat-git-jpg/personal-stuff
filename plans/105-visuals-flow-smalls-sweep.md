---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 105: visuals-flow smalls sweep — GFX-03/04/13 + defuse and wire effects.test.mjs

## Summary

- **Problem statement**: Four small hygiene items are queued against visuals-flow: contradictory reveal-wording between RULEBOOK and prompt (GFX-03), no timestamp validation in the Groq transcriber (GFX-04), edit-delta cannot diff shot plans (GFX-13), and `lib/effects.test.mjs` is orphaned from check.sh — and as written is destructive (it rewrites the real `videos/test-01/effects.json` and spawns a full multi-minute draft assembly that clobbers the kb-scratch final-draft.mp4; this actually bit on 2026-07-20).
- **Goals**: align the rubric wording to "2–6 words"; assert monotonic non-negative word timestamps before transcript.json is written; add a shots mode to edit-delta; rewrite effects.test.mjs against a temp fixture workdir with no assembly spawn and wire it into check.sh.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — mechanical, fully inlined.
- **Done criteria** (terse): check.sh green WITH effects.test.mjs in its list and finishing in seconds; `videos/test-01/` byte-identical before/after the suite.
- **Stop conditions** (terse): only the in-scope files; never run the old effects.test.mjs as-is; stop after 2 failed attempts at any verify.
- **Test / verification for success**: node --test suites via check.sh + a clean `git status` on `videos/` after the run.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c82b552..HEAD -- pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md pipelines/video/visuals-flow/lib/transcribe-groq.mjs pipelines/video/visuals-flow/lib/edit-delta.mjs pipelines/video/visuals-flow/lib/edit-delta.test.mjs pipelines/video/visuals-flow/lib/effects.test.mjs pipelines/video/visuals-flow/scripts/check.sh`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plan 104; either order lands cleanly)
- **Category**: tech-debt
- **Difficulty**: mechanical
- **Planned at**: commit `c82b552`, 2026-07-20

## Why this matters

Each item is too small to plan alone (the backlog says "fold into the next touch") but together they close real gaps: a garbage Groq response can silently poison every downstream anchor (GFX-04); the 060 fold loop is blind to owner edits on shot plans (GFX-13); the rulebook contradicts the prompt AND the lint on reveal length (GFX-03); and an orphaned test that is never run is worse than no test — this one destroys committed per-video data when someone runs it by hand (it did, 2026-07-20).

## Current state

All paths relative to `pipelines/video/visuals-flow/` unless noted.

- **GFX-03** — verified at `c82b552`:
  - `steps/020-cue-pass-llm/RULEBOOK.md:125`: `- Reveal text is a 2–6 word summary of the point — never the transcript` (correct)
  - `steps/020-cue-pass-llm/RULEBOOK.md:229`: `8. Every reveal \`text\` is 6 words or fewer.` (the contradiction — lint warns below 2 words per plan 072)
  - `steps/020-cue-pass-llm/cue-pass-prompt.md:100`: `…reveal text is a 2–6 word` (correct; do NOT edit the prompt)
  - `lib/check-rulebook.mjs` validates RULEBOOK section headers exist — the edit keeps all `## ` sections intact so it stays green.
- **GFX-04** — `lib/transcribe-groq.mjs:64` writes the words array: `fs.writeFileSync(outPath, JSON.stringify(words));`. Nothing validates the words. Downstream (resolve.mjs anchor matching, board segments) assumes numeric, non-negative, `end >= start`, non-decreasing `start`s.
- **GFX-13** — `lib/edit-delta.mjs` exports `editDelta(llmCues, approvedCues)` + `formatDelta(summary)`, and its CLI resolves `<slug>` → `cues.llm.json` vs `cues.json`. Shot files exist since plan 078: `shots.llm.json` (immutable LLM snapshot) vs `shots.json` (owner-approved). Verified span shape (from `videos/test-01/shots.json`): `{"id":"s01","kind":"avatar-full","from_anchor":"…","to_anchor":"…","note":"…","flagged":false}`; top-level keys `video, approved, engineMode, spans`. Existing tests: `lib/edit-delta.test.mjs` (1.8K) — follow its style.
- **effects.test.mjs hazard** — `lib/effects.test.mjs` at `c82b552`:
  - `resolveWorkdir('test-01')` → operates on the REAL committed `videos/test-01/effects.json`: deletes it, regenerates via `node lib/effects-plan.mjs test-01`, writes scratch overrides (`enabled:false`, `fontPx:99`, an `unknown-999` instance), and deletes it again at the end.
  - Spawns `node lib/assemble.mjs test-01 --draft` — a full multi-minute draft render that overwrites `~/kb-scratch/video/visuals-flow/test-01/final-draft.mp4`.
  - It is absent from `scripts/check.sh`'s explicit `node --test` list (every other `lib/*.test.mjs` is present), so it never runs in the merge gate.
  - What it MEANT to cover (keep this coverage): effects-plan CLI writes ≥ N instances from a resolved timeline; per-id overrides (`enabled`, param like `fontPx`) survive regeneration.
  - What it also asserted via the assembly spawn (consciously DROPPED by this plan, do not re-add an assembly spawn): the runtime "warning: ignoring effects.json instance with unknown id" stderr line.
- **Fixtures available**: `lib/fixtures/board/` has `cues.json`, `resolved.json`, `transcript.json` (+ generated `vo.mp3`) — a small ~30s timeline. `lib/effects-plan.mjs` needs `resolved.json` (required), `transcript.json` (optional), `vo.mp3` (optional — falls back to last word end for total). Temp-dir convention: `lib/.test-tmp/<suite>/` via `fs.mkdtempSync` (see `lib/board.test.mjs` `makeWorkdir()` — the exemplar).
- `scripts/check.sh` (verbatim at `c82b552`):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs lib/logos.test.mjs lib/lint.test.mjs lib/edit-delta.test.mjs lib/feedback-status.test.mjs lib/resolve-shots.test.mjs lib/lint-shots.test.mjs lib/avatar-render.test.mjs lib/assemble.test.mjs lib/transcript-text.test.mjs lib/captions.test.mjs lib/reference-moments.test.mjs lib/whip.test.mjs lib/bubble.test.mjs
node lib/check-rulebook.mjs
echo "visuals-flow check OK"
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full verify (the merge gate) | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0, `visuals-flow check OK` |
| One suite while iterating | `cd pipelines/video/visuals-flow && node --test lib/effects.test.mjs` | passes in seconds |
| Data-safety check | `git status --porcelain pipelines/video/visuals-flow/videos/` | empty |

## Scope

**In scope** (the ONLY files to touch):
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md` (one line)
- `pipelines/video/visuals-flow/lib/transcribe-groq.mjs`
- `pipelines/video/visuals-flow/lib/edit-delta.mjs`
- `pipelines/video/visuals-flow/lib/edit-delta.test.mjs`
- `pipelines/video/visuals-flow/lib/effects.test.mjs` (full rewrite)
- `pipelines/video/visuals-flow/scripts/check.sh` (add one filename)

**Out of scope** (do NOT touch):
- `steps/020-cue-pass-llm/cue-pass-prompt.md` — already correct; rule surfaces beyond the single RULEBOOK line are 060-fold territory.
- `lib/effects-plan.mjs`, `lib/board.mjs`, `lib/assemble.mjs`, `lib/effects/*` — plan 104's surface; this plan only TESTS effects-plan behavior that already exists.
- `videos/test-01/**` — committed per-video data; nothing may read-write it. (Reading committed files for reference is fine; the test suite must not touch the directory.)
- `lib/lint-cues.mjs` — the 2–6 rule is already encoded there (plan 072).

## Steps

### Step 1 — GFX-03: fix the rubric line

In `steps/020-cue-pass-llm/RULEBOOK.md` line 229, change:

`8. Every reveal \`text\` is 6 words or fewer.` → `8. Every reveal \`text\` is 2–6 words.`

(Keep the en dash, matching line 125.)

**Verify:** `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` → exit 0; `grep -c "6 words or fewer" steps/020-cue-pass-llm/RULEBOOK.md` → 0.

### Step 2 — GFX-04: timestamp assert in transcribe-groq

In `lib/transcribe-groq.mjs`, immediately before the `fs.writeFileSync(outPath, JSON.stringify(words));` at line ~64, insert a validation pass; on failure print the index and offending values and exit 1 WITHOUT writing:

```js
// A garbage API response (NaN/negative/backwards timestamps) would poison
// every downstream anchor — refuse to write transcript.json (GFX-04).
let prevStart = -Infinity;
for (let i = 0; i < words.length; i++) {
  const w = words[i];
  const bad =
    typeof w.start !== 'number' || typeof w.end !== 'number' ||
    !Number.isFinite(w.start) || !Number.isFinite(w.end) ||
    w.start < 0 || w.end < w.start || w.start < prevStart;
  if (bad) {
    console.error(`transcript rejected: word[${i}] has invalid timing (start=${w.start}, end=${w.end}, prevStart=${prevStart})`);
    process.exit(1);
  }
  prevStart = w.start;
}
```

Export a pure helper instead if the file already has an exports section — otherwise keep it inline exactly as above (the file is a CLI; match its local style).

**Verify:** `node --check lib/transcribe-groq.mjs` → exit 0.

### Step 3 — GFX-13: shots mode for edit-delta

In `lib/edit-delta.mjs`:

1. Add and export `shotsDelta(llmShots, approvedShots)` diffing `spans` by `id` over the fields `['kind', 'from_anchor', 'to_anchor', 'note', 'flagged']`, with the same added/removed/edited + totals shape as `editDelta` (totals keys: `llmSpans, approvedSpans, edited, added, removed`). Reuse the structure of `editDelta` — a simple per-field `!==` compare is sufficient (all five fields are scalars).
2. Add and export `formatShotsDelta(summary)` mirroring `formatDelta` (list added/removed span ids, per-span changed fields with from → to for the two anchor fields and `note`, one totals line).
3. CLI: after printing the cues delta, if `<workdir>/shots.llm.json` AND `<workdir>/shots.json` both exist, print a `\n## Shots\n` header followed by `formatShotsDelta(shotsDelta(...))`. Missing either file = silently skip (videos without shot plans stay noise-free). The two-explicit-paths CLI form (`edit-delta.mjs <llm.json> <cues.json>`) stays cues-only — do not extend it.

**Verify:** `node --test lib/edit-delta.test.mjs` → passes (with Step 5's new cases).

### Step 4 — defuse and rewrite effects.test.mjs

Replace the ENTIRE contents of `lib/effects.test.mjs`. **Never run the old version.** New suite (follow `lib/board.test.mjs` conventions — `.test-tmp` temp dirs, `test.before` cleanup):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures', 'board');
const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'effects');

function makeWorkdir() {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'fx-'));
  for (const f of ['resolved.json', 'transcript.json']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  return dir;
}

function runPlan(dir) {
  const res = spawnSync('node', [path.join(import.meta.dirname, 'effects-plan.mjs'), dir], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(fs.readFileSync(path.join(dir, 'effects.json'), 'utf8'));
}

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

test('effects-plan writes default instances for a fresh workdir', () => {
  const dir = makeWorkdir();
  const manifest = runPlan(dir);
  assert.ok(Array.isArray(manifest.instances));
  assert.ok(manifest.instances.length >= 1, 'expected at least one planned instance');
  assert.ok(manifest.instances.every((i) => typeof i.id === 'string' && typeof i.type === 'string' && typeof i.enabled === 'boolean'));
});

test('per-id overrides survive regeneration', () => {
  const dir = makeWorkdir();
  const first = runPlan(dir);
  const target = first.instances[0];
  const manifestPath = path.join(dir, 'effects.json');
  const edited = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  edited.instances.find((i) => i.id === target.id).enabled = false;
  fs.writeFileSync(manifestPath, JSON.stringify(edited, null, 2));
  const second = runPlan(dir);
  assert.equal(second.instances.find((i) => i.id === target.id).enabled, false, 'enabled override preserved on regen');
});
```

Adjust ONLY if the fixture's `resolved.json` yields zero planned instances (e.g. no captions/drift defaults on a tiny timeline): in that case relax the first test's `>= 1` to assert the manifest structure (`video` key + `instances` array) and add a comment naming why. Do NOT add an assembly spawn, and do NOT reference `videos/test-01` anywhere in the file.

**Verify:** `cd pipelines/video/visuals-flow && node --test lib/effects.test.mjs` → passes in < 30s. Then `git status --porcelain videos/` → empty.

### Step 5 — tests for steps 2–3

1. `lib/edit-delta.test.mjs` — add cases following the file's existing style:
   - `shotsDelta detects edited/added/removed spans`: llm `{spans:[{id:'s01',kind:'avatar-full',from_anchor:'a',to_anchor:'b',note:'n',flagged:false},{id:'s02',kind:'avatar-full',from_anchor:'c',to_anchor:'d',flagged:false}]}` vs approved with `s01.to_anchor` changed to `'bb'`, `s02` removed, `s03` added → totals `{edited:1, added:1, removed:1}`, and the `s01` change lists `to_anchor` from `'b'` to `'bb'`.
   - `formatShotsDelta prints the totals line` — output matches `/1 edited, 1 added, 1 removed/`.
2. Timestamp validation (GFX-04) is CLI-exit behavior; cover it structurally: if `transcribe-groq.mjs` got a pure exported validator, unit-test it here in a new small block of `lib/edit-delta.test.mjs`? **No** — keep suites honest: put a `spawnSync`-based test in NO suite; instead assert the guard exists statically in Step 6's done criteria (grep). Groq CLI tests would need network mocking — explicitly out of scope, note it in the test file only if you added an exported validator (then unit-test the validator inline in `lib/effects.test.mjs`? also no). Final decision, obey it: if you kept the guard inline (recommended), it gets NO unit test — the grep in Done criteria is the check. If you exported a `validateWords(words)` helper, add `lib/edit-delta.test.mjs` cases for it (valid → true; negative start / end<start / non-monotonic / NaN → each false or throws per your signature).

**Verify:** `node --test lib/edit-delta.test.mjs` → passes.

### Step 6 — wire effects.test.mjs into check.sh

In `scripts/check.sh`, append ` lib/effects.test.mjs` to the end of the existing `node --test …` list (single line edit; keep everything else byte-identical).

**Verify:** `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0, ends `visuals-flow check OK`, and completes without any multi-minute stall. Then `git status --porcelain pipelines/video/visuals-flow/videos/` → empty.

## Test plan

Steps 4–6: rewritten `lib/effects.test.mjs` (fixture-workdir, no assembly), new `shotsDelta`/`formatShotsDelta` cases in `lib/edit-delta.test.mjs`, and the suite wired into check.sh so the merge gate runs it forever after.

## Done criteria

- `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 with `lib/effects.test.mjs` in its list.
- `git status --porcelain pipelines/video/visuals-flow/videos/` → empty after a full check.sh run.
- `grep -c "6 words or fewer" pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md` → 0; `grep -c "2–6 words" …/RULEBOOK.md` ≥ 2.
- `grep -c "transcript rejected" pipelines/video/visuals-flow/lib/transcribe-groq.mjs` → 1.
- `grep -c "shotsDelta" pipelines/video/visuals-flow/lib/edit-delta.mjs` ≥ 2 (definition + CLI use).
- `grep -c "test-01" pipelines/video/visuals-flow/lib/effects.test.mjs` → 0; `grep -c "assemble" pipelines/video/visuals-flow/lib/effects.test.mjs` → 0.
- `git diff c82b552..HEAD --stat` touches only the six in-scope files.

## STOP conditions

- NEVER execute the pre-rewrite `lib/effects.test.mjs` (directly or via check.sh before Step 4 lands) — it destroys `videos/test-01/effects.json` and kicks off a multi-minute render.
- Any need to touch `lib/effects-plan.mjs` itself (e.g. the fixture yields a crash) — stop and report; fixing the planner is plan-104/fold territory.
- Any file outside the in-scope list, or any write under `videos/` — stop.
- The same verify failing after 2 fix attempts — stop and report output.

## Maintenance notes

- Plan 104 also lands effects-plan `approved`-carry behavior with its own tests in `board.test.mjs`; this suite stays override-focused. If 104 landed first, the regenerated manifest will contain a top-level `approved` key — the rewritten tests here assert nothing about it, so both orders pass.
- The dropped unknown-id-warning assertion belongs with assemble's own tests if anyone re-adds it — never via a real render in a unit suite.
- check.sh's explicit file list is the single registration point for suites; any future test file must be added there or it silently never runs (this plan exists because that happened).
