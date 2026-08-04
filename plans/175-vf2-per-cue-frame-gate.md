<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh && node --test lib/frame-gate.test.mjs
ui: false
deploy:
needs: ["shares lib/lint-cues.mjs with plans 177 and 179 — expect append-region conflicts, boss resolves the concat. Plan 179 claims E-codes E14 and E15; this plan claims E12. Plan 178 covers the card-library side (card-qa variant coverage) and is complementary, not overlapping."]
---

# Plan 175: visuals-flow per-cue frame gate — overflow + accent-visibility, wired into 040/090

## Summary

- **Problem statement**: The overflow probe (plan 168) measures cards at *declared* capacity with *synthetic* content and is invoked by nothing in the pipeline — real cue content ships unchecked. Three render-only defects shipped on opusclip-vs-submagic alone: a clipped pipeline-flow title (2026-07-30 RCA "overflow-not-gated"), a truncated bad-clip-montage caption (z01), and kinetic-sentence accent words rendering WHITE in every `--variables` render while the browser/board showed them orange (2026-07-31).
- **Goals**:
  - A per-cue frame gate that probes every resolved cue's card with its REAL variables at its real beat times, headlessly, and FAILS `run.sh <slug> resolve` (step 040) on overflow/truncation (new lint code E12).
  - A rendered-frame accent-visibility check at step 090: after each cue renders, if the cue's variables carry a non-empty `accent` string, sample the actual output frame and fail the render when no accent-colored pixels exist.
  - Prove-it-can-fail tests for both, teardown-safe (no hanging `node --test`).
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — fully inlined below.
- **Done criteria** (terse): `bash scripts/check.sh` green including new tests; E12 fires on a knowingly-overflowing fixture; accent check fails on a frame with no accent pixels; both pass on the real opusclip-vs-submagic workdir.
- **Stop conditions** (terse): never weaken/skip an assertion to pass; STOP if hyperframes renders in tests exceed 90s each or Chrome cannot launch; STOP if E12 flags >5 cues on opusclip-vs-submagic (that means the probe policy is wrong, not the cards).
- **Test / verification for success**: `node --test lib/frame-gate.test.mjs` (new) + `bash scripts/check.sh` + one real-workdir run of `bash run.sh opusclip-vs-submagic resolve`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 802e7078..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/run.sh pipelines/video/visuals-flow/scripts pipelines/video/card-library/scripts/overflow-probe.mjs`
> If `lib/resolve.mjs`, `lib/render.mjs`, `run.sh`, or `overflow-probe.mjs` changed since 802e7078 in ways that contradict the excerpts below, STOP and report.

## Status

- **Priority**: P1 (third render-only defect in one video; owner asked for the systemic fix twice)
- **Effort**: M
- **Risk**: medium (headless browser + ffmpeg in a gate path; flaky-teardown hazard is known and mitigated below)
- **Depends on**: none (plan 168 already landed)
- **Category**: pipeline gate
- **Planned-at SHA**: 802e7078

## Why this matters

The pipeline's checks are content-blind at exactly the layer the owner reviews: lint validates JSON, card-qa renders synthetic capacity content, the board paints an overflow badge nobody consumes, and the browser can LIE about the render (the 2026-07-31 accent bug rendered correctly in the board and white in every real render). The only trustworthy surface is a frame produced by the real machinery with the real content — this plan makes that a gate instead of a habit.

### Update 2026-08-02 — a fourth defect, and two corrections

A fourth instance of exactly this class reached the owner on `best-ai-video-generator`,
which is the strongest evidence yet for the 040 half of this plan.

`enacted/pipeline-flow` hardcoded `body.variant-b .chain { height: 760px }` regardless of
step count. At 3 steps the flex connectors absorbed 472px of slack and drew two ~236px
bare lines, and 150px title + 64px margin + 760px chain overflowed the 840px padding box
by 134px, disabling the frame's centering. Owner, c27: "no padding in top/bottom, last box
is too bottom, heading text is too top."

It is worth being precise about why nothing caught it, because it sharpens this plan's
scope. Three separate blind spots had to line up:

- the probe fills variables to declared CAPACITY with filler words, not the cue's real copy;
- it has no beat times, so it cannot seek to the moment a reveal is on screen;
- both `overflow-probe.mjs` and `card-qa.mjs` shoot `variants[0]`, and `resolve.mjs` had
  rotated c27 onto variant B.

All three are only knowable from `resolved.json`. The measurement was never wrong; it was
fed synthetic data. That is precisely what this plan fixes, and it means the per-cue gate
must pass the cue's `variables` through UNCHANGED, including the resolved `variant`.

**Two corrections to this plan since it was raised on 2026-07-31:**

1. **The lint code is now E12, not E13.** `E13 open-cover` was added to `lib/lint-cues.mjs`
   after this plan was written. E12 and E6 are the free codes; plan 179 has claimed E14 and
   E15. Every mention below has been updated.
2. **The drift-check base moved from `8ad09a76` to `802e7078`.** Re-run the drift check
   before starting: `lib/lint-cues.mjs` has changed materially (E13 `open-cover` added, and
   E5 `demo-coverage` gained a `section-opener` role carve-out on 2026-08-02), and
   `enacted/pipeline-flow` has been fixed by hand, so the Step 4 fixture must RECONSTRUCT
   the 760px overflow rather than expecting to find it.

## Current state (facts, verified 2026-07-31 at 802e7078)

All paths relative to `pipelines/video/` unless noted.

- `visuals-flow/lib/overflow-measure.mjs` — the single-source DOM overflow measurement. Exports `CANVAS = { W: 1920, H: 1080, TOL: 2 }` and `MEASURE_OVERFLOW_SRC` (stringified ES5 function `__measureOverflow()` returning `{ broken, offenders }`).
- `card-library/scripts/overflow-probe.mjs` — plan 168's machinery. Relevant exports:
  - `probeCardVariant(cardSlug, variant, variables, times)` — copies the card dir to a temp dir, rewrites `data-composition-variables`, injects `window.__hyperframes.getVariables`, loads in cached puppeteer-core Chrome (via `resolveChrome()` → `npx hyperframes@latest browser path`), seeks `window.__timelines[0]` to each `t`, runs `__measureOverflow()`. Returns `{ broken, t?, offenders }`. `cardSlug` goes through `path.resolve(cardSlug)` — **absolute paths work**; that is how the new gate must call it (its cwd is visuals-flow, not card-library).
  - `closeBrowser()` — idempotent; the module caches the browser and anything importing it MUST call this when done or `node --test` hangs forever after printing all oks (bitten 2026-07-30; comment in the file).
  - `probeTimes(card, vars)` — beat `at`s + midpoint + duration−1.
- `visuals-flow/lib/resolve.mjs` — 040. `validateCues(cues, catalog, cardLibraryRoot, workdir)` collects `errors` (E-codes fail the step). Beats are resolved to absolute times and merged into card variables at ~line 372: `let vars = { ...cue.variables, ...(beats.length ? { beats } : {}) };` where each beat is `{ ...reveal, at }` with `at` **card-local seconds**.
- `visuals-flow/lib/render.mjs` — 090. Per-cue `renderOne(cue)` stages the card into a temp dir, rewrites duration, `injectBrand()`, writes `vars.json`, spawns `npx hyperframes@0.7.62 render … -o outPath`, then caches via `hashRenderInputs`. Errors are pushed to an `errors` array that fails the run.
- `visuals-flow/run.sh` — `resolve)` case at ~line 246 runs the resolve/lint; `render)` at ~line 288.
- The **resolved artifact** is `videos/<slug>/resolved.json`: `{ resolved: [ { id, card, start, duration, variables, placement?, sideMode?, … } ] }`. `variables.beats[].at` are card-local. `variables.accent` is a plain string on kinetic-sentence-family cues.
- Renders land in `videos/<slug>/renders/<mmss>-<id>-<cardbase>.<mp4|mov>` (gitignored).
- **Why the accent check must read RENDERED frames, not puppeteer DOM** (verified experimentally 2026-07-31): the c20 accent bug does NOT reproduce in a browser page — puppeteer shows orange; only `hyperframes render --variables` output is white. A DOM probe would green-light exactly the bug class it exists to catch. The check therefore runs at 090 on the actual output file via ffmpeg.
- `ffmpeg`/`ffprobe` are on PATH (used throughout this repo). `puppeteer-core` is a dependency of `card-library` (plan 168); visuals-flow does NOT depend on it directly — the gate imports card-library's probe module by relative path, same pattern (reversed) as overflow-probe.mjs importing overflow-measure.mjs.
- Exemplar test file for teardown-safe suites: `card-library/scripts/overflow-probe.test.mjs` (uses `after(closeBrowser)`).

## Commands you will need

Run from `pipelines/video/visuals-flow/` unless noted:

- `bash scripts/check.sh` — the v2 gate. Expected now: green (456 node-test passes + rulebook/run.sh/board checks).
- `node --test lib/frame-gate.test.mjs` — the new suite (created by this plan). Must exit; a hang is a failure.
- `bash run.sh opusclip-vs-submagic resolve` — 040 on the real workdir. Expected after this plan: exits 0, warnings only, E12 absent.
- `node lib/render.mjs opusclip-vs-submagic --only c20 --force` — 090 single-cue render (gate refuses without `--force` pre-approval; `--force` is correct for verification).
- `ffmpeg -v error -ss 3 -i <mp4> -frames:v 1 out.png -y` — frame extraction.

## Scope

**In scope (the only files to touch):**
- `pipelines/video/visuals-flow/lib/frame-gate.mjs` (new)
- `pipelines/video/visuals-flow/lib/frame-gate.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/resolve.mjs` (wire E12)
- `pipelines/video/visuals-flow/lib/render.mjs` (wire accent check)
- `pipelines/video/visuals-flow/run.sh` (pass-through only if needed; prefer zero changes)
- `pipelines/video/visuals-flow/scripts/check.sh` (add the new test file to the existing `node --test` list — one line)
- `pipelines/video/visuals-flow/tests/TESTS.md` (one dated line)

**Out of scope (do NOT touch):**
- `card-library/scripts/overflow-probe.mjs` — consumed as-is; if its API seems wrong, STOP.
- `card-library/catalog.json`, any card `index.html` — this plan gates, it does not fix cards.
- `lib/board.mjs` — the board badge stays as-is.
- `videos/*/cues.json` and other per-video artifacts.

## Steps

### Step 1 — `lib/frame-gate.mjs`: per-cue overflow probe over resolved.json

Create `pipelines/video/visuals-flow/lib/frame-gate.mjs` with exactly this content (adjust only if an import path fails at verify):

```js
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Per-cue frame gate (plan 175). Probes every resolved cue's card with its
// REAL variables at its real beat times in a headless page, using plan 168's
// probe machinery from card-library. DOM overflow only — the accent check
// lives in render.mjs because the browser cannot reproduce render-only bugs.
async function loadProbe(cardLibraryRoot) {
  const mod = path.join(cardLibraryRoot, 'scripts', 'overflow-probe.mjs');
  return import(pathToFileURL(mod).href);
}

export function probeTimesForCue(cue) {
  const beats = Array.isArray(cue.variables?.beats) ? cue.variables.beats : [];
  const times = beats.map((b) => b.at).filter((t) => typeof t === 'number');
  const dur = typeof cue.duration === 'number' ? cue.duration : 6;
  times.push(Math.max(0.5, dur / 2), Math.max(0.5, dur - 1));
  return [...new Set(times.map((t) => +t.toFixed(2)))].sort((a, b) => a - b);
}

// Returns array of error strings (E12 …), empty when clean.
export async function frameGate(resolved, cardLibraryRoot, { only } = {}) {
  const probe = await loadProbe(cardLibraryRoot);
  const errors = [];
  try {
    for (const cue of resolved) {
      if (only && !only.includes(cue.id)) continue;
      const cardDir = path.join(cardLibraryRoot, cue.card);
      const vars = cue.variables ?? {};
      const times = probeTimesForCue(cue);
      const res = await probe.probeCardVariant(cardDir, vars.variant ?? 'a', vars, times);
      if (res.broken) {
        errors.push(
          `E12 frame-gate: ${cue.id} (${cue.card}) overflows the canvas at t=${res.t}s ` +
          `with its real content — offenders: ${res.offenders.join(', ') || '(document scroll)'}`,
        );
      }
    }
  } finally {
    await probe.closeBrowser();
  }
  return errors;
}
```

**Verify:** `node -e "import('./lib/frame-gate.mjs').then(m=>console.log(typeof m.frameGate,'/',typeof m.probeTimesForCue))"` prints `function / function`.

### Step 2 — wire E12 into 040

In `lib/resolve.mjs`, find where the resolve entry point has both the final `resolved` array and `cardLibraryRoot` (the same scope that writes `resolved.json`), and AFTER existing validation passes (do not run the browser when cheap lints already failed), add:

```js
import { frameGate } from './frame-gate.mjs';
// …
const frameErrors = await frameGate(resolved, cardLibraryRoot);
errors.push(...frameErrors);
```

If the enclosing function is not async, make the minimal call-chain async — `run.sh resolve` invokes node once, so an async main is safe. E12 strings join the same error channel that makes `run.sh <slug> resolve` exit non-zero.

**Verify (must FAIL first — prove the gate can bite):** in a scratch copy of the workdir cues, set `videos/opusclip-vs-submagic/cues.json` c04's `variables.title` to a 14-word string, run `bash run.sh opusclip-vs-submagic resolve`; expect exit non-zero with an `E12 frame-gate: c04 …` line. Restore the file (`git checkout -- videos/opusclip-vs-submagic/cues.json`) — a leftover mutation is a STOP.

**Verify (real content passes):** `bash run.sh opusclip-vs-submagic resolve` exits 0 (warnings allowed, no `E12` lines).

### Step 3 — accent-visibility check in `lib/render.mjs` (090)

Add to `lib/frame-gate.mjs`:

```js
import { execSync } from 'node:child_process';

// Parse '#rrggbb' → [r,g,b]
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// True when the frame contains at least `minPixels` pixels within ±tol per
// channel of accentHex. Reads the frame via ffmpeg rawvideo at 480x270 —
// dependency-free, ~50ms.
export function frameHasColor(framePath, accentHex, { tol = 36, minPixels = 25 } = {}) {
  const [ar, ag, ab] = hexRgb(accentHex);
  const buf = execSync(
    `ffmpeg -v error -i "${framePath}" -vf scale=480:270 -f rawvideo -pix_fmt rgb24 -`,
    { maxBuffer: 8 * 1024 * 1024 },
  );
  let hits = 0;
  for (let i = 0; i + 2 < buf.length; i += 3) {
    if (Math.abs(buf[i] - ar) <= tol && Math.abs(buf[i + 1] - ag) <= tol && Math.abs(buf[i + 2] - ab) <= tol) {
      if (++hits >= minPixels) return true;
    }
  }
  return false;
}

// Policy: a cue whose variables carry a non-empty string `accent` must show
// accent-colored pixels in the rendered output at its last beat (or midpoint
// when beatless). Returns null when clean, an error string otherwise.
export function checkAccentVisible(cue, outPath, accentHex) {
  const beats = Array.isArray(cue.variables?.beats) ? cue.variables.beats : [];
  const lastAt = beats.length ? Math.max(...beats.map((b) => b.at ?? 0)) : (cue.duration ?? 6) / 2;
  const t = Math.min(lastAt + 0.5, Math.max(0.2, (cue.duration ?? 6) - 0.3));
  const tmp = `${outPath}.accent-probe.png`;
  execSync(`ffmpeg -v error -y -ss ${t.toFixed(2)} -i "${outPath}" -frames:v 1 "${tmp}"`);
  try {
    if (!frameHasColor(tmp, accentHex)) {
      return `accent-gate: ${cue.id} (${cue.card}) declares accent "${cue.variables.accent}" but the rendered frame at t=${t.toFixed(2)}s contains no accent-colored pixels — render-only color loss (see TESTS.md 2026-07-31)`;
    }
    return null;
  } finally {
    execSync(`rm -f "${tmp}"`);
  }
}
```

In `lib/render.mjs` `renderOne(cue)`, after a successful render AND after the cache-store step (both fresh renders and cache hits must be checked — a stale cached artifact can carry the bug), add:

```js
import { checkAccentVisible } from './frame-gate.mjs';
// …
if (typeof cue.variables?.accent === 'string' && cue.variables.accent.trim()) {
  const msg = checkAccentVisible(cue, outPath, (brand?.tokens?.['--accent'] ?? '#fb923c'));
  if (msg) errors.push(`${cue.id}: ${msg}`);
}
```

`brand` is already in scope in render.mjs (it is what `injectBrand` uses); if its accessor differs from `brand?.tokens?.['--accent']`, read the actual shape from the `injectBrand` implementation and use that — the fallback literal stays `#fb923c`.

**Verify (can-fail):** craft `/tmp/white.png` via `ffmpeg -v error -f lavfi -i color=white:s=1920x1080 -frames:v 1 /tmp/white.png -y`, then `node -e "import('./lib/frame-gate.mjs').then(m=>console.log(m.frameHasColor('/tmp/white.png','#fb923c')))"` prints `false`.
**Verify (passes on real):** `node lib/render.mjs opusclip-vs-submagic --only c20 --force` exits 0 (c20 declares accent and its render now carries orange pixels — the 2026-07-31 card fix).

### Step 4 — tests: `lib/frame-gate.test.mjs`

Create a `node --test` suite. Structure it exactly like this (fill in the obvious plumbing):

- `test('probeTimesForCue: beats + midpoint + tail, deduped sorted', …)` — pure unit, no browser.
- `test('frameHasColor: false on all-white, true on accent swatch', …)` — generate both fixtures with ffmpeg `lavfi color=` (accent swatch: `color=0xfb923c`).
- `test('frameGate flags an overflowing cue and passes a clean one', …)` — build two fake resolved cues against real card-library cards: clean = `slate/kinetic-sentence` with a 5-word text and its word beats; overflowing = `pros-cons/pros-cons` with `variables.title` of 16 words and beats `[ { kind:'pro', text:'x', at:1 } ]`. Assert exactly one E12 mentioning the overflowing id.
- **Teardown**: the suite must `import { closeBrowser } from '<card-library>/scripts/overflow-probe.mjs'` and register `after(() => closeBrowser())` — this is the known hang (LESSONS 2026-07-31 item 2); without it `node --test` never exits.

Add the file to the `node --test` invocation in `scripts/check.sh` next to the existing lib tests (one line; keep the existing list intact — check.sh is a known rebase-collision hotspot, touch only your line).

**Verify:** `node --test lib/frame-gate.test.mjs` → all pass AND the process exits (wrap in `timeout 300` to prove it: `timeout 300 node --test lib/frame-gate.test.mjs; echo exit=$?` → `exit=0`).

### Step 5 — record + fresh-checkout gate

- Append one dated line to `tests/TESTS.md` under **Folded lessons**: `- 2026-07-31 — plan 175: the overflow probe became a per-cue GATE (E12 at 040, real variables at real beat times) and 090 gained the accent-visibility frame check (render-only color loss class). Badge → gate, per owner RCA 2026-07-30.`
- **Fresh-checkout run** (this is the batch's last plan): from a clean worktree of the repo (`git worktree add /tmp/wt-175 HEAD` or equivalent), run `cd pipelines/video/visuals-flow && bash scripts/check.sh` and confirm green with zero manually-built artifacts. Remove the worktree after.

**Verify:** both commands above; check.sh green on the fresh tree.

## Test plan

Covered in Step 4 (three tests + teardown). The can-fail verifies in Steps 2–3 are part of Done criteria, not optional.

## Done criteria (machine-checkable)

1. `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, output includes the frame-gate test file's passes.
2. `timeout 300 node --test lib/frame-gate.test.mjs; echo exit=$?` → `exit=0` (proves no hang).
3. Step 2's can-fail experiment produced an `E12 frame-gate: c04` error before the file was restored (paste the line into the run log), and `git status --porcelain videos/` is empty afterward.
4. `bash run.sh opusclip-vs-submagic resolve` → exit 0, no E12 lines.
5. `node lib/render.mjs opusclip-vs-submagic --only c20 --force` → exit 0.
6. Fresh-checkout check.sh green (Step 5).

## STOP conditions

- **Gate integrity**: if any assertion in this plan's tests or verifies fails, fix the code or the fixture — weakening, swapping, or deleting the assertion is a STOP.
- `probeCardVariant`'s API doesn't match the excerpt (signature/паths) → STOP, report the actual signature.
- E12 flags more than 5 cues on the untouched opusclip-vs-submagic workdir → the policy (times/tolerance) is mis-tuned; STOP rather than loosening TOL.
- Chrome cannot launch headless (`resolveChrome()` throws) or any single test render exceeds 90s → STOP, report environment.
- Any needed change outside the in-scope list → STOP.

## Maintenance notes

- The gate's runtime cost at 040 is ~1–2s per fullframe cue (shared browser); a 40-cue video adds ~1 minute. If that becomes painful the knob is parallel pages, not skipping cues.
- The accent policy is deliberately narrow (only cues declaring `variables.accent`). Widening it to "every card must show its one accented element" needs catalog metadata (which element carries accent) — a future plan, not a tweak.
- render.mjs cache: the accent check runs on cache hits too (specified in Step 3) so a poisoned cache entry can't dodge the gate; reviewer should confirm that placement.
- The browser-vs-render split is load-bearing: DOM probes at 040 (fast, pre-render), pixel probes at 090 (the only layer that catches render-only bugs). Do not "simplify" by moving both to one layer.
