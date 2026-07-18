---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["077 must land first (folder is pipelines/video/visuals-flow)"]
---

# Plan 078: Shot plan — schema, LLM pass (step 070), resolver + lint

## Summary

- **Problem statement**: visuals-flow plans graphics only; nothing decides which stretches of a video show full-screen avatar vs screen recording. Design doc: `docs/specs/2026-07-18-avatar-shot-plan-design.md` (owner-approved 2026-07-18).
- **Goals**:
  - `shots.json` schema documented in PIPELINE.md (sibling of cues.json; anchored spans; `engineMode` gate).
  - `steps/070-shot-pass-llm/` — README + RULEBOOK.md + shot-pass-prompt.md (full text inlined below; place verbatim).
  - `lib/resolve-shots.mjs` — anchors → absolute times, writing `shots.resolved.json` (code inlined below).
  - `lib/lint-shots.mjs` — budget/overlap/U-curve rules as named constants (code inlined below).
  - Tests for both libs, wired into `scripts/check.sh`.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High, agy default) — owner-directed for this batch; all judgment content (rulebook, prompt, algorithms) is authored in this plan.
- **Done criteria** (terse): check.sh green including 2 new test files; resolve-shots + lint-shots run clean on the inlined fixture; PIPELINE.md documents the schema in exactly one place.
- **Stop conditions** (terse): don't touch cues machinery behavior; don't invent rules not in this plan; baseline red = stop.
- **Test / verification for success**: `node --test` on the two new test files via `scripts/check.sh`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b40a207..HEAD -- pipelines/video/visuals-flow`
> Expect only plan-077 rename changes; anything else in `lib/` → report before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (new schema surface; mitigated by fully-inlined code + tests)
- **Depends on**: 077
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `b40a207`, 2026-07-18

## Why this matters

This is the data layer of GFX-07, the owner's stated next phase: the shot plan decides where the paid full-screen avatar appears, aware of the already-approved graphics. Downstream, plan 079 reviews these spans on the board and plan 080 renders them via HeyGen. The schema and rules here are the contract both build on — and the rulebook joins the 060 feedback-fold loop, so every rule must live in exactly one editable place.

## Current state

All paths relative to `pipelines/video/visuals-flow/` (post-077 name).

- `lib/resolve.mjs` — cue resolver. `normWord` (line 4) normalizes words; inside `resolveCues` (line 81) a closure `findFrom(phrase, from)` (lines 88–97) does forward-only anchor matching over `W` (normalized words) and returns `{idx, start, len}` or `{err}`. This exact matcher must be shared with the shot resolver (Step 1 extracts it — behavior-preserving).
- `lib/lint-cues.mjs` — the pattern to imitate: named constants at top (lines 4–14), `lintCues({cuesFile, resolved, words, catalog})` returning `{errors, warnings}`, error codes `E1…`/`W1…` with self-explanatory messages, CLI `main()` that prints warnings to stdout, errors to stderr, exits 1 on errors. `resolveWorkdir` (lines 148–152) resolves a slug to `videos/<slug>` or accepts a path.
- `lib/resolve.mjs` CLI `main()` (lines 139–166): reads workdir files, exits 1 printing errors, else writes the resolved JSON. Follow the same shape.
- `resolved.json` shape: `{video, offset, resolved: [{id, card, placement, start, duration, variables}]}` — fullframe cues are `placement === 'fullframe'`; that's what shot spans must not overlap.
- `transcript.json` shape: flat `[{text, start, end}]` word timestamps.
- `scripts/check.sh` (post-077):
  ```bash
  node --test lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs lib/logos.test.mjs lib/lint.test.mjs lib/edit-delta.test.mjs lib/feedback-status.test.mjs
  node lib/check-rulebook.mjs
  echo "visuals-flow check OK"
  ```
- `steps/020-cue-pass-llm/` — the exemplar step folder: `README.md` (purpose, in→out, fix-loop ≤3 rounds), `RULEBOOK.md` (judgment detail), `cue-pass-prompt.md` (model-agnostic, fully inlined, "Output ONLY cues.json content"). Step 070 mirrors this trio.
- `PIPELINE.md` — owns the cues.json schema ("Change it in one place only — this README"); the flow table lists steps 010–060. Gains the 070 row + the shots.json schema section.
- Snapshot convention (HANDOFF.md): the LLM's final output is snapshotted to `cues.llm.json` (committed, immutable) BEFORE owner edits. Same convention for `shots.llm.json`.
- Pre-flight rule: `node lib/feedback-status.mjs` must exit 0 before any new LLM pass (unfolded feedback = unapplied lessons).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |
| New tests only | `node --test lib/resolve-shots.test.mjs lib/lint-shots.test.mjs` (from the flow folder) | all pass |
| Existing suite untouched | `node --test lib/resolve.test.mjs` | all pass (proves Step 1 preserved behavior) |

## Scope

**In scope**:
- `lib/resolve.mjs` — ONLY the `findFrom` → exported `findPhrase` extraction (Step 1).
- New: `lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/resolve-shots.test.mjs`, `lib/lint-shots.test.mjs`.
- New: `steps/070-shot-pass-llm/README.md`, `RULEBOOK.md`, `shot-pass-prompt.md`.
- `PIPELINE.md` (flow-table row, `videos/<slug>/` layout additions, shots.json schema section), `scripts/check.sh` (add the 2 test files).
- `plans/README.md` status row for 078.

**Out of scope**:
- `lib/board.mjs` and anything UI (plan 079).
- Rendering/HeyGen (plan 080).
- `lib/edit-delta.mjs` shots support (backlog row GFX-13 — registered by this batch, not built).
- Running the shot pass on test-01 (owner-driven pilot AFTER 079 lands the review surface).
- Any change to cue lint rules, RULEBOOK.md of step 020, or catalog.

## Git workflow

- Branch: `advisor/078-shot-plan-schema-and-pass`
- Commit per step: `feat(visuals-flow): <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Extract the anchor matcher (behavior-preserving)

In `lib/resolve.mjs`, lift the `findFrom` closure out of `resolveCues` into a module-level export, keeping the algorithm byte-identical:

```js
// Forward-only phrase matcher over normalized words. Shared by the cue
// resolver and the shot resolver — one matching semantics, one place.
export function findPhrase(W, phrase, from) {
  const p = phrase.split(/\s+/).map(normWord).filter(Boolean);
  if (p.length < 3) return { err: `anchor has fewer than 3 words: "${phrase}"` };
  for (let i = from; i <= W.length - p.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (W[i + j].n !== p[j]) { ok = false; break; }
    if (ok) return { idx: i, start: W[i].start, len: p.length };
  }
  return { err: `anchor not found (searching forward from word ${from}): "${phrase}"` };
}
```

Inside `resolveCues`, replace the closure with `const findFrom = (phrase, from) => findPhrase(W, phrase, from);` (smallest diff; call sites unchanged).

**Verify**: `node --test lib/resolve.test.mjs` → all pass, zero test-file edits.

### Step 2: `lib/resolve-shots.mjs`

Create with this content (adjust nothing but whitespace/lint):

```js
import fs from 'node:fs';
import path from 'node:path';
import { normWord, findPhrase } from './resolve.mjs';

export const ENGINE_MODES = ['test', 'production'];

// Spans are matched with the same forward-cursor discipline as cues: each
// span's from_anchor is searched after the previous span's to_anchor, so
// repeated phrases resolve in transcript order.
export function resolveShots(shotsFile, words) {
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  const errors = [];
  const out = [];
  let cursor = 0;

  if (!ENGINE_MODES.includes(shotsFile.engineMode)) {
    errors.push(`engineMode "${shotsFile.engineMode}" invalid — must be one of: ${ENGINE_MODES.join(', ')}`);
  } else if (shotsFile.engineMode === 'production') {
    // heygen-web is Avatar III-only and its heygen4 path is an unimplemented
    // TODO (design doc 2026-07-18). The owner flips this explicitly, together
    // with the heygen-web work — until then production is an error, not a
    // dormant code path.
    errors.push('engineMode "production" is not implemented yet — keep "test" (see docs/specs/2026-07-18-avatar-shot-plan-design.md)');
  }

  const seen = new Set();
  for (const span of shotsFile.spans ?? []) {
    if (!span.id || seen.has(span.id)) { errors.push(`duplicate or missing span id: "${span.id}"`); continue; }
    seen.add(span.id);
    if (span.flagged) continue; // parked, same semantics as flagged cues
    if (span.kind !== 'avatar-full') { errors.push(`${span.id}: unknown kind "${span.kind}" — only "avatar-full" exists today`); continue; }
    const a = findPhrase(W, span.from_anchor ?? '', cursor);
    if (a.err) { errors.push(`${span.id} from_anchor: ${a.err}`); continue; }
    const b = findPhrase(W, span.to_anchor ?? '', a.idx + a.len);
    if (b.err) { errors.push(`${span.id} to_anchor: ${b.err}`); continue; }
    cursor = b.idx + b.len;
    const start = +a.start.toFixed(2);
    const end = +W[b.idx + b.len - 1].end.toFixed(2);
    out.push({
      id: span.id, kind: span.kind,
      start, end, duration: +(end - start).toFixed(2),
      note: span.note ?? '',
    });
  }
  return { spans: out, errors };
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/resolve-shots.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const shotsFile = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));

  const { spans, errors } = resolveShots(shotsFile, words);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  fs.writeFileSync(
    path.join(workdir, 'shots.resolved.json'),
    JSON.stringify({
      video: shotsFile.video,
      offset: shotsFile.offset ?? 0,
      engineMode: shotsFile.engineMode,
      spans,
    }, null, 2),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

**Verify**: `node -e "import('./lib/resolve-shots.mjs').then(m => console.log(typeof m.resolveShots))"` (from the flow folder) → `function`.

### Step 3: `lib/lint-shots.mjs`

Create with this content:

```js
import fs from 'node:fs';
import path from 'node:path';

// Budget + shape rules for full-screen avatar spans. Seeded from
// tutorial-pipeline-2's 060 rulebook knobs (U-curve, ~5:00 total cap from the
// HeyGen 4 limit); the cap is enforced in BOTH engine modes so a test-mode
// plan is production-shaped by construction. Tune constants here, nowhere else.
const AVATAR_FULL_CAP = 300;        // s — hard total ceiling (HeyGen 4 limit at production)
const AVATAR_FULL_TARGET = 240;     // s — scaled by video length (T/1800); warn under
const SPAN_MIN = 12;                // s — error: a shorter full-screen moment isn't worth a clip
const SPAN_MAX = 150;               // s — warn: a full-screen host stretch this long drags
const FRONT_ZONE = 0.15;            // U-curve: expect a span starting in the first 15% of the VO
const BACK_ZONE = 0.15;             //          and one in the last 15%

export function lintShots({ shotsResolved, resolvedCues, words }) {
  const errors = [];
  const warnings = [];
  if (!words || words.length === 0) return { errors, warnings };
  const T = words[words.length - 1].end;
  const spans = [...(shotsResolved.spans ?? [])].sort((a, b) => a.start - b.start);

  // E1 span-overlap
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start < spans[i - 1].end) {
      errors.push(`E1 span-overlap: ${spans[i].id} starts at ${spans[i].start.toFixed(1)}s before ${spans[i - 1].id} ends (${spans[i - 1].end.toFixed(1)}s)`);
    }
  }

  // E2 fullframe-collision — a fullframe card would fully cover the paid
  // full-screen avatar; overlays are allowed by design (design doc 2026-07-18).
  const fullframes = (resolvedCues ?? []).filter((c) => c.placement === 'fullframe');
  for (const s of spans) {
    for (const c of fullframes) {
      const cEnd = c.start + c.duration;
      if (s.start < cEnd && c.start < s.end) {
        errors.push(`E2 fullframe-collision: ${s.id} (${s.start.toFixed(1)}–${s.end.toFixed(1)}s) overlaps fullframe cue ${c.id} (${c.start.toFixed(1)}–${cEnd.toFixed(1)}s)`);
      }
    }
  }

  // E3 span-min / W1 span-max
  for (const s of spans) {
    if (s.duration < SPAN_MIN) errors.push(`E3 span-min: ${s.id} is ${s.duration.toFixed(1)}s (minimum ${SPAN_MIN}s)`);
    if (s.duration > SPAN_MAX) warnings.push(`W1 span-max: ${s.id} is ${s.duration.toFixed(1)}s (target under ${SPAN_MAX}s)`);
  }

  // E4 budget-cap / W2 budget-target
  const total = spans.reduce((sum, s) => sum + s.duration, 0);
  if (total > AVATAR_FULL_CAP) {
    errors.push(`E4 budget-cap: ${total.toFixed(0)}s total full-screen avatar exceeds cap ${AVATAR_FULL_CAP}s`);
  }
  const target = AVATAR_FULL_TARGET * (T / 1800);
  if (spans.length && total < target * 0.5) {
    warnings.push(`W2 budget-target: ${total.toFixed(0)}s total is under half the scaled target (~${target.toFixed(0)}s for a ${(T / 60).toFixed(1)}min video) — don't be stingy relative to the target`);
  }

  // W3 u-curve — front-load and back-load expectations
  if (spans.length) {
    if (!spans.some((s) => s.start <= T * FRONT_ZONE)) {
      warnings.push(`W3 u-curve: no span starts in the first ${(FRONT_ZONE * 100).toFixed(0)}% of the video — the open should be host-heavy`);
    }
    if (!spans.some((s) => s.end >= T * (1 - BACK_ZONE))) {
      warnings.push(`W3 u-curve: no span reaches the last ${(BACK_ZONE * 100).toFixed(0)}% of the video — land on the host`);
    }
  }

  return { errors, warnings };
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/lint-shots.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const shotsResolved = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.resolved.json'), 'utf8'));
  const resolvedFile = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));

  const { errors, warnings } = lintShots({ shotsResolved, resolvedCues: resolvedFile.resolved, words });
  for (const w of warnings) console.log(w);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

**Verify**: `node -e "import('./lib/lint-shots.mjs').then(m => console.log(typeof m.lintShots))"` → `function`.

### Step 4: Tests

Create `lib/resolve-shots.test.mjs` and `lib/lint-shots.test.mjs` using `node:test` + `node:assert/strict` (imitate the import/describe style of `lib/resolve.test.mjs`). Build fixtures inline — a synthetic word list is enough:

```js
// 1 word per second, "w0 w1 w2 … w119": words[i] = {text:`w${i}`, start:i, end:i+1}
const words = Array.from({ length: 120 }, (_, i) => ({ text: `w${i}`, start: i, end: i + 1 }));
```

`resolve-shots.test.mjs` cases (all against `resolveShots`):
1. happy path: span `{id:'s01', kind:'avatar-full', from_anchor:'w10 w11 w12', to_anchor:'w20 w21 w22'}`, engineMode `test` → one resolved span, `start === 10`, `end === 23`, `duration === 13`, no errors.
2. `to_anchor` before `from_anchor` in the transcript → error mentioning `to_anchor` (forward-cursor discipline).
3. unknown `kind` → error; `flagged: true` span → skipped, no error.
4. `engineMode: 'production'` → error containing `not implemented`; `engineMode: 'nope'` → error containing `invalid`.
5. duplicate span ids → error.
6. anchor with < 3 words → error (via findPhrase).

`lint-shots.test.mjs` cases (all against `lintShots`, words fixture length 1200 — `Array.from({length:1200},…)` so zones are meaningful):
1. two overlapping spans → E1.
2. span overlapping a fullframe cue (`resolvedCues: [{id:'c1', placement:'fullframe', start:100, duration:20}]`, span 90–130) → E2; same span vs an `overlay` cue → no E2.
3. 8s span → E3; 200s span → W1.
4. spans totalling 350s → E4.
5. single mid-video span (start 500, end 560) → W3 twice (no front, no back); spans at 30–90 and 1150–1190 → no W3.
6. empty spans array → no errors, no warnings.

Add both files to the `node --test` line in `scripts/check.sh`.

**Verify**: `bash scripts/check.sh` → exit 0, includes the new tests in the tap output.

### Step 5: Step folder `steps/070-shot-pass-llm/`

Create three files with EXACTLY this content (they are owner-reviewed judgment surfaces — place verbatim, do not paraphrase):

**`README.md`**:

```markdown
# 070 · shot-pass  ·  [LLM] (Sonnet default; same pluggability as 020)

Decide which stretches of the video the **full-screen avatar** speaks — AFTER the
graphics cues are approved, so spans are planned around fullframe cards. Corner
avatar + screen recording is the implicit baseline everywhere else (design doc:
`docs/specs/2026-07-18-avatar-shot-plan-design.md`).

- **In:** `videos/<slug>/transcript.json` + `videos/<slug>/resolved.json` (approved cues) + `RULEBOOK.md`
- **Out:** `videos/<slug>/shots.json` → snapshot the converged LLM output to `shots.llm.json` (committed, immutable) before any owner edit
- **How:** paste `shot-pass-prompt.md` (placeholders filled) into the executor session.
  Fix-loop: `node lib/resolve-shots.mjs <slug> && node lib/lint-shots.mjs <slug>`,
  feed errors back verbatim, ≤3 rounds; errors surviving round 3 escalate to the owner.
- **Pre-flight:** `node lib/feedback-status.mjs` must exit 0 (unfolded feedback = unapplied lessons), and `cues.json` must have `approved: true`.
- **Next:** owner reviews spans on the board (plan 079), then avatar render (plan 080).
```

**`RULEBOOK.md`**:

```markdown
# Shot-pass rulebook (step 070)

Judgment rules for choosing full-screen avatar spans. The quantitative half is
machine-enforced by `lib/lint-shots.mjs` (constants at the top of that file are
the single source for numbers); this file owns the qualitative half. Edit this
file and `shot-pass-prompt.md` together — same convention as 020's pair.

## The model (fixed by design, don't re-litigate)

- A corner avatar over screen recording is the **baseline for the whole video**.
  A human is always on screen. This pass picks ONLY the full-screen host moments.
- Spans are planned AGAINST the approved graphics: never overlap a fullframe
  cue (lint E2). Overlay cards over a full-screen avatar are fine.
- Budget discipline comes from HeyGen 4 being metered at production
  (~$1/min): total full-screen time obeys the cap/target in lint-shots.mjs
  even while `engineMode: "test"` renders everything free on HeyGen 3 —
  a test plan must already be production-shaped.

## Where full-screen avatar goes (priority order — U-curve)

1. **Intro + pre-demo overview** — front-load; first claim on budget.
2. **Conclusion + summary framing** — back-load; land on the host.
3. **Each tool's/section's verdict** — shrinking as the video goes.
4. **Pricing / value wrap-up** — part of the back-load.
5. Still under target? Add back-loaded beats first; mid-demo beats are a last resort.

Lean demo middle: when narration walks the screen ("click", "open", "type",
"select"), the screen recording IS the shot — never claim it for the avatar.

## Anchors

- `from_anchor` = the first words of the span; `to_anchor` = the last words.
  Both verbatim from the transcript, ≥3 words, in transcript order
  (forward-cursor matching, same semantics as cue anchors).
- ASR garbles are quoted verbatim ("Heigen" stays "Heigen") — same rule as 020.
- Prefer span boundaries at sentence starts/ends — a mid-sentence camera cut
  reads as a jump.

## Output contract

- Spans in transcript order, ids `s01, s02, …`, `kind: "avatar-full"` only.
- `note` — one short line saying why this span is host-worthy (the owner reads
  it on the board).
- A span you want but can't place cleanly: `flagged: true` + note, don't force it.
- `engineMode` stays `"test"` until the owner explicitly flips it (owner gate,
  2026-07-18 — production requires heygen-web work that doesn't exist yet).

## Learnings — grows via the 060 feedback fold

| Date | What we learned | Rule / knob change |
|------|-----------------|--------------------|
| 2026-07-18 | (seed — fill from the first owner review) | — |
```

**`shot-pass-prompt.md`**:

```markdown
# Shot-pass prompt

Model-agnostic prompt for the shot pass. Paste this whole file, with the two
placeholders filled, into the executor session — it has no repo access, so the
rules are inlined. Judgment detail lives in `RULEBOOK.md`; this is the
compressed version.

---

You plan the full-screen avatar moments for a voiceover-driven video. A corner
avatar over screen recording runs the whole video by default; you choose ONLY
the stretches where the host takes the full screen. Output ONLY shots.json
content — no other text.

## Schema

```json
{
  "video": "<slug>",
  "approved": false,
  "engineMode": "test",
  "spans": [
    {
      "id": "s01",
      "kind": "avatar-full",
      "from_anchor": "verbatim first words of the span",
      "to_anchor": "verbatim last words of the span",
      "note": "why this is a host moment",
      "flagged": false
    }
  ]
}
```

## Rules

1. Anchors are VERBATIM transcript phrases, ≥3 words, in transcript order.
   Misspellings in the transcript are quoted as-is.
2. U-curve: host-heavy open (intro + overview), lean hands-on middle, host-heavy
   close (verdicts shrinking → pricing wrap → conclusion).
3. Total full-screen time: aim near 4 minutes for a ~30-min video, never above
   5 minutes total. No span under ~15 seconds; prefer spans under ~2 minutes.
4. NEVER place a span over a fullframe graphics cue — the fullframe times are
   listed below; plan around them. Overlay cues are fine to overlap.
5. Span boundaries at sentence starts/ends.
6. When narration describes on-screen actions (click/open/type/select/drag),
   that stretch belongs to the screen recording — not to the avatar.
7. Can't place a span cleanly? Set `"flagged": true` with a note instead of
   forcing bad anchors.
8. `engineMode` is always `"test"` — do not change it.

## Fullframe graphics cues (plan around these — [start, end] seconds)

<FULLFRAME_CUES>

## Transcript (word-timestamped, verbatim)

<TRANSCRIPT_TEXT>
```

**Verify**: `ls steps/070-shot-pass-llm/` → the three files; `node lib/check-rulebook.mjs` still exits 0 (it checks 020's pair — confirm it does not reject the new folder; if it hard-fails on 070's existence, STOP and report, don't patch it).

### Step 6: PIPELINE.md — flow row, layout, schema

1. Flow table: after the `050-render-run` row add:
   `| \`070-shot-pass-llm\` | [LLM] (Sonnet default, pluggable) | approved \`resolved.json\` + \`transcript.json\` → \`shots.json\` (full-screen avatar spans; corner+screen-rec is the implicit baseline) |`
   (Plan 080 adds its own row later; 060's row stays last-listed as the cross-video step.)
2. `videos/<slug>/` layout block: add
   ```
   shots.llm.json   # step 070's final output, pre-owner-edits — committed, immutable
   shots.json       # step 070 output, board edits — committed
   shots.resolved.json  # resolve-shots output (absolute times) — committed
   ```
3. New section `## shots.json schema` directly after the cues.json schema section, stating: this README is the schema's single home (same one-place rule as cues.json); paste the schema JSON from the prompt above plus field semantics: `from_anchor`/`to_anchor` (verbatim, ≥3 words, forward order; span = first word of from_anchor → last word of to_anchor), `kind` (`avatar-full` only today; enum exists for additive future kinds), `engineMode` (`test` = every span renders HeyGen 3 template; `production` = full-screen→HeyGen 4, corner→HeyGen 3 — **a validation error until the owner explicitly enables it**), `flagged` (parked span), `approved` (board gate, same lifecycle as cues.json), top-level `offset` shared meaning with cues.json. Note that the corner track is a standing output of the avatar render step, not a span.

**Verify**: `grep -c "shots.json schema" PIPELINE.md` → 1.

## Test plan

Covered in Step 4 — two new `node:test` files with synthetic word fixtures, wired into `scripts/check.sh`. No live LLM/network calls anywhere in tests.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 with the two new test files in the run.
- [ ] `node --test lib/resolve.test.mjs` passes with zero edits to that test file (Step 1 behavior-preserving).
- [ ] `steps/070-shot-pass-llm/` contains README.md, RULEBOOK.md, shot-pass-prompt.md matching the plan text verbatim.
- [ ] PIPELINE.md has the 070 row, the three new layout lines, and exactly one `shots.json schema` section.
- [ ] `plans/README.md` row for 078 flipped to DONE.

## STOP conditions

- Baseline `scripts/check.sh` red before your first change.
- `lib/check-rulebook.mjs` fails because of the new step folder — report, don't modify that checker.
- Any need to change `resolveCues` behavior beyond the extraction in Step 1.
- Any rule/constant you feel is missing — the rulebook and constants are owner-reviewed content; add nothing not in this plan.

## Maintenance notes

- Numbers live ONLY in `lib/lint-shots.mjs` constants; prose rules ONLY in `RULEBOOK.md` + prompt (edited together). The 060 feedback fold updates all three surfaces.
- `findPhrase` is now shared by two resolvers — a matching-semantics change affects cues AND shots; both test files guard it.
- Plan 079 consumes `shots.json`/`shots.resolved.json` on the board; plan 080 consumes `shots.resolved.json` + `engineMode`. Schema changes go through PIPELINE.md first.
