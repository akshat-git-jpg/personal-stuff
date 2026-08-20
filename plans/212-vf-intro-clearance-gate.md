---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && node --test lib/intro-film/check-clearance.test.mjs lib/intro-film/review-film.test.mjs
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/visuals-flow/lib/intro-film/check-clearance.mjs, pipelines/video/visuals-flow/lib/intro-film/check-clearance.test.mjs, pipelines/video/visuals-flow/lib/intro-film/cdp.mjs, pipelines/video/visuals-flow/lib/intro-film/cdp.test.mjs, pipelines/video/visuals-flow/lib/intro-film/review-film.mjs, pipelines/video/visuals-flow/lib/intro-film/fixtures/clearance-clean/index.html, pipelines/video/visuals-flow/TASTE-INTRO.md]

mutation_apply: |
  node -e "const f='pipelines/video/visuals-flow/lib/intro-film/fixtures/clearance-clean/index.html';const fs=require('fs');let s=fs.readFileSync(f,'utf8');s=s.replace('top: 600px; /* CLEARANCE-ANCHOR */','top: 388px; /* CLEARANCE-ANCHOR */');fs.writeFileSync(f,s)"
mutation_command: cd pipelines/video/visuals-flow && node lib/intro-film/check-clearance.mjs --fixture lib/intro-film/fixtures/clearance-clean
mutation_expect: low_clearance
mutation_timeout: 900
---

# Plan 201: Intro film clearance gate (TASTE-INTRO T13/T14 enforcement)

## Summary

- **Problem statement**: Every layout check in visuals-flow tests for *overlap* — a strictly positive box intersection. The owner rejects on *clearance*: two things that don't touch but sit close enough to read as one broken object. On 2026-08-15 hyperframes `check` sampled the `best-no-code-automation-tool` intro film 464 times, including all six defect timestamps the owner reported, and returned **zero** layout findings.
- **Goals**:
  - Add `lib/intro-film/check-clearance.mjs` — measures every visible element box across sampled times and reports `low_clearance`, `text_intersect`, and `corridor_conflict`.
  - Wire it into `review-film.mjs` so `bash run.sh <slug> intro-review` reports clearance findings alongside `check` / `check-film-style`.
  - Flip TASTE-INTRO **T13** and **T14** from "author judgement" to machine-enforced.
- **Executor proposed**: `claude-p` / `sonnet` — see Difficulty note below. This is the rules.md "can't be fully inlined" row: a raw CDP client against a specific Chrome build needs live protocol/timing debugging that cannot be fully predetermined here.
- **Done criteria** (terse — full list below): new checker passes on a clean fixture, FAILS on a defect fixture printing `low_clearance`, is invoked by `intro-review`, and `test_cmd` exits 0.
- **Stop conditions** (terse — full list below): don't weaken an assertion to go green; don't touch the body/brand rule surfaces; don't add an npm dependency.
- **Test / verification for success**: unit tests on the pure geometry (no browser) + one integration test that drives the real Chrome over a committed fixture + boss's mutation gate.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 3fbf346f..HEAD -- pipelines/video/visuals-flow/lib/intro-film/ pipelines/video/visuals-flow/TASTE-INTRO.md`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Difficulty**: tricky — graded up from `standard` deliberately. Every snippet below is inlined, but the deliverable **is a gate**, and LESSONS records three separate occasions (2026-08-02 ×2, 2026-07-24) where a crew shipped a gate that could not fire and still passed `test_cmd`. A gate that never fires is worse than none: it reads as coverage. Routed to `claude-p`/`sonnet` rather than the `agy` default for that reason.
- **Planned-at SHA**: `3fbf346f`

## Why this matters

The owner has now said "take care of this in future too" three times in one round of feedback, about three different instances of the same defect. TASTE-INTRO T13 and T14 were written on 2026-08-15 to capture it, but both say **Enforced by: author judgement** — which is the same protection that already failed. T3 ("Text never crosses a graphic") has claimed machine enforcement since 2026-08-02 and did not catch any of the six defects, because hyperframes' `text_occluded` only looks for text covered **by** something. When the b11 measuring rule was drawn *under* the subtitle and struck it through, the checker saw text on top of a graphic — which is not its defect shape — and passed.

The intent is narrow and worth stating so the executor can make correct judgment calls: **this checker exists to catch what a human eye catches and a box-intersection test does not.** Two elements 8px apart are a defect. Two elements 400px apart are not. Two elements that partially cross each other are a defect even when the text is the thing on top.

## Current state

### Files

| File | Role |
|---|---|
| `pipelines/video/visuals-flow/lib/intro-film/review-film.mjs` | The 140 `intro-review` pass. Computes samples, spawns hyperframes `check` and `snapshot`, writes `review/check.json` + `review/REVIEW.md`. This is where the new checker is wired in. |
| `pipelines/video/visuals-flow/lib/intro-film/npx.mjs` | **Use this for every `npx` spawn.** Exports `NPX_NEEDS_SHELL`, `npxArgs(args)`, `npxSpawnOpts(extra)`. |
| `pipelines/video/visuals-flow/lib/renderer-constants.mjs` | Exports `FILM_RENDERER = 'hyperframes@0.7.88'`. Never hardcode a version. |
| `pipelines/video/visuals-flow/lib/intro-film/fixtures/film-fixture/index.html` | Existing 45-line CSS-driven fixture film. Copy its shape for the new fixtures. |
| `pipelines/video/visuals-flow/TASTE-INTRO.md` | T13 and T14 live here; their **Enforced by:** lines get updated in the last step. |

### The sampling shape already exists

`review-film.mjs` exports `beatSamples(...)` producing three samples per beat (25%, 55%, 85% through it). Read it and **reuse it** — do not invent a second sampling scheme, or the checker and the frame review will disagree about what "sampled" means.

### There is no package.json and no browser driver

`pipelines/video/visuals-flow/` has **no `package.json`** and no `playwright`/`puppeteer` installed. Everything runs as plain `node` plus `npx <pinned-package>`. **Do not add a dependency or a package.json.** Two facts, both verified on 2026-08-15 on this machine, make a zero-dependency CDP client the right shape:

```
$ npx -y hyperframes@0.7.88 browser path
C:\Users\kushi\.cache\hyperframes\chrome\chrome-headless-shell\win64-152.0.7928.2\chrome-headless-shell-win64\chrome-headless-shell.exe

$ node -e "console.log(typeof WebSocket, process.version)"
function v24.15.0
```

Node 24 has a **global `WebSocket`**, so raw Chrome DevTools Protocol needs no package at all.

### Why not reuse an existing hyperframes command

Verified on 2026-08-15: `hyperframes inspect` reports *issues* (overflow/overlap) and `check` reports *findings* with a `bbox` per finding. Neither emits the box of every element, which is what a clearance test needs. `--tolerance` on `inspect` is an allowed-overflow knob, not a clearance knob. There is no existing command to reuse.

## Commands you will need

```bash
cd pipelines/video/visuals-flow

# the merge gate (this is test_cmd)
node --test lib/intro-film/check-clearance.test.mjs lib/intro-film/review-film.test.mjs
# expect: "pass N", "fail 0"

# the checker standalone against a fixture
node lib/intro-film/check-clearance.mjs --fixture lib/intro-film/fixtures/clearance-clean
# expect on clean: "clearance ok — 0 findings", exit 0

# resolve the pinned Chrome once (slow first time: it may download)
npx -y hyperframes@0.7.88 browser path

# the full review pass, after wiring
bash run.sh consistent-ai-influencer intro-review
```

**Do NOT use `bash scripts/check.sh` as your signal.** On Windows it currently has
**7 pre-existing failures** in `film-assets.test.mjs` / `workdir.test.mjs` /
`render-fx.test.mjs`, caused by an unrelated absolute-path-join bug in
`resolveWorkdir` under temp dirs. Confirmed pre-existing at `3fbf346f` on
2026-08-15. Do not try to fix them; do not let them mask your own result.

## Scope

**In scope (the only files to touch):**
- `pipelines/video/visuals-flow/lib/intro-film/cdp.mjs` (new)
- `pipelines/video/visuals-flow/lib/intro-film/cdp.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/intro-film/check-clearance.mjs` (new)
- `pipelines/video/visuals-flow/lib/intro-film/check-clearance.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/intro-film/fixtures/clearance-clean/index.html` (new)
- `pipelines/video/visuals-flow/lib/intro-film/review-film.mjs` (wire-in only)
- `pipelines/video/visuals-flow/TASTE-INTRO.md` (two **Enforced by:** lines only)

**Out of scope — looks related, do not touch:**
- `lib/cue-rules.mjs`, `lib/zone-rules.mjs`, `lib/zone-constants.mjs`, `../card-library/DESIGN.md` — these govern the **body track and the shared brand**. An intro lesson landing there changes what every non-intro video renders. `no-template-contamination.test.mjs` defends this wall from the other side.
- `lib/render.mjs` — carries the same Windows `npx` ENOENT bug as render-film did. Recorded debt, not this plan's job.
- The 7 pre-existing Windows test failures above.
- `videos/**` — never commit a video workdir edit from this plan.

## Steps

### Step 1 — Zero-dependency CDP client

Create `lib/intro-film/cdp.mjs`. It launches the pinned Chrome, connects over the DevTools Protocol, and evaluates JS in the page. Inlined because getting the launch/readiness handshake right is the fiddly part:

```js
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { npxArgs, npxSpawnOpts } from './npx.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';

// The renderer already manages a Chrome download; reuse THAT binary so the
// checker and the render never disagree about the engine.
export function chromePath() {
  const r = spawnSync('npx', npxArgs(['-y', FILM_RENDERER, 'browser', 'path']),
    npxSpawnOpts({ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  if (r.status !== 0) throw new Error(`hyperframes browser path failed (exit ${r.status})`);
  const line = String(r.stdout).trim().split(/\r?\n/).filter(Boolean).pop();
  if (!line) throw new Error('hyperframes browser path printed nothing');
  return line;
}

// port 0 => the OS picks a free one. A fixed port collides when two runs overlap.
export async function launch() {
  const exe = chromePath();
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', '--no-first-run',
    '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('chrome did not report a DevTools endpoint in 30s')), 30000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
    proc.on('exit', (c) => { clearTimeout(t); reject(new Error(`chrome exited early (${c})`)); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket failed')); });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  // One tab, driven through a flat session.
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  return {
    async goto(file) {
      await send('Page.enable', {}, sessionId);
      await send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
      // poll for the composition runtime rather than racing a load event
      for (let i = 0; i < 200; i++) {
        const r = await this.eval('!!(window.__timelines && Object.keys(window.__timelines).length)');
        if (r === true) return;
        await new Promise((s) => setTimeout(s, 100));
      }
      throw new Error('window.__timelines never appeared — is this a composition?');
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
      return r.result.value;
    },
    async close() { try { ws.close(); } catch {} proc.kill(); },
  };
}
```

**Verify:**
```bash
cd pipelines/video/visuals-flow && node -e "
import('./lib/intro-film/cdp.mjs').then(async (m) => {
  const b = await m.launch();
  await b.goto('lib/intro-film/fixtures/film-fixture/index.html');
  console.log('eval:', await b.eval('1+1'));
  await b.close();
})"
```
Expect `eval: 2` and the process to exit. If it hangs, the readiness poll is wrong — fix it, do not add a blanket sleep.

### Step 2 — Seek + measure

Add to `check-clearance.mjs` the two page-side snippets. Seeking must drive **both** adapters, because films in this repo use GSAP *or* pure CSS:

```js
export const SEEK_JS = (t) => `(() => {
  const tls = window.__timelines || {};
  for (const k of Object.keys(tls)) {
    const tl = tls[k];
    try { tl.pause(); tl.seek ? tl.seek(${t}) : tl.totalTime(${t}); } catch (e) {}
  }
  // CSS-adapter films: drive animation-delay negatively so a seek is deterministic
  for (const el of document.querySelectorAll('*')) {
    for (const a of (el.getAnimations ? el.getAnimations() : [])) {
      try { a.pause(); a.currentTime = ${t} * 1000; } catch (e) {}
    }
  }
  return true;
})()`;

export const MEASURE_JS = `(() => {
  const sel = (el) => {
    if (el.id) return '#' + el.id;
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
    const p = el.parentElement;
    const idx = p ? Array.prototype.indexOf.call(p.children, el) : 0;
    return el.tagName.toLowerCase() + cls + '[' + idx + ']';
  };
  const ownText = (el) => Array.from(el.childNodes)
    .some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  const out = [];
  const walk = (el, depth) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (parseFloat(cs.opacity) === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0.5 && r.height > 0.5) {
      out.push({ sel: sel(el), depth,
        x: r.x, y: r.y, w: r.width, h: r.height, text: ownText(el) });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(document.getElementById('root') || document.body, 0);
  return out;
})()`;
```

**Verify:**
```bash
cd pipelines/video/visuals-flow && node lib/intro-film/check-clearance.mjs --fixture lib/intro-film/fixtures/film-fixture --dump 1.5
```
Expect a JSON array containing `#bg` and `#bar` with plausible boxes, and `#bar`'s `x` near `860` at t=1.5 (it travels 0→1720 over 3s).

### Step 3 — The geometry (pure, unit-testable, no browser)

This is the core. Export it as a pure function so it tests without Chrome:

```js
// TASTE-INTRO T13: 40px at 1080p. Below this, adjacent bands read as touching.
export const MIN_CLEARANCE_PX = 40;

const contains = (a, b) =>
  a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;

// Axis separation. 0 on an axis means the boxes share a band on that axis.
export function separation(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  return { dx, dy };
}

export function pairFinding(a, b) {
  // An ancestor's box always encloses its child's; a full-bleed background always
  // encloses the text on it. Containment is normal composition, never a defect.
  if (contains(a, b) || contains(b, a)) return null;

  const { dx, dy } = separation(a, b);

  // PARTIAL intersection with text involved. This is the shape hyperframes'
  // text_occluded misses when the GRAPHIC is the thing underneath — exactly how
  // the b11 measuring rule struck through the subtitle and passed.
  if (dx === 0 && dy === 0) {
    if (!a.text && !b.text) return null;
    return { code: 'text_intersect', a: a.sel, b: b.sel, gap: 0 };
  }

  // Diagonal neighbours never read as touching — only flag when the boxes are
  // aligned on one axis and merely close on the other.
  if (dx > 0 && dy > 0) return null;

  const gap = dx === 0 ? dy : dx;
  if (gap >= MIN_CLEARANCE_PX) return null;
  if (!a.text && !b.text) return null;   // T13 is about TEXT clearance
  return { code: 'low_clearance', a: a.sel, b: b.sel, gap: Math.round(gap) };
}
```

**Verify:** unit tests in Step 5 cover this; no command yet.

### Step 4 — Sweep detection (T14)

```js
// A device parked in a traveller's corridor gets crossed. Union each element's
// boxes across samples; an element whose union is much larger than its own box
// is a TRAVELLER, and a static box inside that union is a corridor conflict.
export function sweepFindings(perSample) {
  const unions = new Map(), last = new Map(), areaOf = (r) => r.w * r.h;
  for (const boxes of perSample) {
    for (const b of boxes) {
      last.set(b.sel, b);
      const u = unions.get(b.sel);
      if (!u) { unions.set(b.sel, { ...b }); continue; }
      const x2 = Math.max(u.x + u.w, b.x + b.w), y2 = Math.max(u.y + u.h, b.y + b.h);
      u.x = Math.min(u.x, b.x); u.y = Math.min(u.y, b.y);
      u.w = x2 - u.x; u.h = y2 - u.y;
    }
  }
  const travellers = [], statics = [];
  for (const [sel, u] of unions) {
    const own = last.get(sel);
    (areaOf(u) > areaOf(own) * 1.5 ? travellers : statics).push({ sel, u, own });
  }
  const out = [];
  for (const t of travellers) {
    for (const s of statics) {
      if (s.sel === t.sel || s.sel.startsWith(t.sel)) continue;
      if (contains(t.u, s.own) || contains(s.own, t.u)) continue;
      const { dx, dy } = separation(t.u, s.own);
      if (dx === 0 && dy === 0) {
        out.push({ code: 'corridor_conflict', a: t.sel, b: s.sel, gap: 0 });
      }
    }
  }
  return out;
}
```

`corridor_conflict` is reported at **warning** severity (it is advisory: a traveller may legitimately pass behind scenery). `low_clearance` and `text_intersect` are **errors**.

### Step 5 — Tests

Create `lib/intro-film/check-clearance.test.mjs` using `node:test` + `node:assert/strict`, matching the style of `lib/intro-film/check-taste-intro.test.mjs`. Cover at minimum:

1. `separation` returns `{dx:0, dy:8}` for two boxes stacked 8px apart in the same column.
2. `pairFinding` returns `low_clearance` with `gap: 8` for that pair when one has text.
3. `pairFinding` returns `null` at exactly `MIN_CLEARANCE_PX` (boundary is inclusive-pass).
4. `pairFinding` returns `null` for containment (background enclosing text).
5. `pairFinding` returns `null` for diagonal neighbours (`dx>0 && dy>0`).
6. `pairFinding` returns `text_intersect` for partial intersection where the **graphic is listed second** and the **text first** — and again with the order swapped, asserting the result is symmetric. This is the b11 regression.
7. `sweepFindings` flags a static box sitting inside a travelling box's union.
8. **Integration** (real Chrome, over the committed clean fixture): `runClearance()` returns zero errors. Guard it with `test.after` that force-closes the browser — LESSONS 2026-07-31: a node:test file that opens a process and asserts before teardown hangs the runner **forever with no output**.

**Verify:**
```bash
cd pipelines/video/visuals-flow && node --test lib/intro-film/check-clearance.test.mjs
# expect: "fail 0"
```

### Step 6 — The clean fixture (this is what the mutation gate mutates)

Create `lib/intro-film/fixtures/clearance-clean/index.html`, modelled on `fixtures/film-fixture/index.html`. It must be **clean** (zero findings) and contain the exact anchor comment the mutation recipe rewrites:

- `#root` 1920x1080 with `data-composition-id="clearance-clean"`, `data-duration="3"`, `data-fps="30"`, `data-width="1920"`, `data-height="1080"`.
- A registered no-op `window.__timelines['clearance-clean']` stub (copy the shape from `film-fixture`).
- A `.sub` text div at `top: 300px; left: 120px;` with real text content.
- A `#device` block with **exactly** this declaration, anchor comment included verbatim:
  ```css
  #device { position: absolute; left: 120px; width: 600px; height: 200px;
            top: 600px; /* CLEARANCE-ANCHOR */ background: #444; }
  ```
  At `top: 600px` the gap to `.sub` is far above `MIN_CLEARANCE_PX` → clean. The mutation rewrites it to `388px`, putting the device ~8px under the sub's text band → `low_clearance`.

**Verify:**
```bash
cd pipelines/video/visuals-flow
node lib/intro-film/check-clearance.mjs --fixture lib/intro-film/fixtures/clearance-clean
# expect: "clearance ok — 0 findings", exit 0

# now prove the gate can FAIL (this is the mutation, run by hand once):
node -e "const f='lib/intro-film/fixtures/clearance-clean/index.html';const fs=require('fs');let s=fs.readFileSync(f,'utf8');s=s.replace('top: 600px; /* CLEARANCE-ANCHOR */','top: 388px; /* CLEARANCE-ANCHOR */');fs.writeFileSync(f,s)"
node lib/intro-film/check-clearance.mjs --fixture lib/intro-film/fixtures/clearance-clean
# expect: NON-ZERO exit, output contains "low_clearance"
git checkout -- lib/intro-film/fixtures/clearance-clean/index.html
```

**If the mutated run does not fail, the gate is not real. STOP and report.** Do not proceed to Step 7.

### Step 7 — Wire into `review-film.mjs`

In `runReview(slug, ...)`, after the existing `check` spawn and before the snapshot pass, call the clearance checker over the same film dir and the same `samples` array `beatSamples` already produced. Merge its findings into the object written to `review/check.json` under a new top-level `clearance` key with the same shape the other sections use:

```js
clearance: { ok, errorCount, warningCount, findings, samples, threshold: MIN_CLEARANCE_PX }
```

Print a one-line summary next to the existing ones, and include a **Clearance** section in `review/REVIEW.md` listing each finding as `<code> <a> ↔ <b> gap=<n>px @ <t>s`.

Keep the existing behaviour intact: a clearance error must not suppress the snapshot pass, because the frames are how the owner reviews.

**Verify:**
```bash
cd pipelines/video/visuals-flow
bash run.sh consistent-ai-influencer intro-review
node -e "const c=require('./videos/consistent-ai-influencer/intro-film/review/check.json');
console.log('clearance present:', !!c.clearance, '| errors:', c.clearance && c.clearance.errorCount);"
# expect: "clearance present: true"
node --test lib/intro-film/review-film.test.mjs   # expect "fail 0"
```

### Step 8 — Flip the TASTE-INTRO enforcement lines

In `pipelines/video/visuals-flow/TASTE-INTRO.md`, replace the **Enforced by:** paragraph of **T13** and of **T14** so each names the real check. Keep the `## T<N> — …` headings, the `**From:**` lines, and the rule bodies **exactly as they are** — `check-taste-intro.mjs` parses this file for provenance and ordering, and the fold that wrote these rules is the record of what the owner said.

T13's new line must state: enforced by `lib/intro-film/check-clearance.mjs` via `run.sh <slug> intro-review`, reporting `low_clearance` (gap below `MIN_CLEARANCE_PX`) and `text_intersect` (partial intersection involving text, in either z-order). T14's must state: enforced as `corridor_conflict` at warning severity, with the residual judgement call named — the checker flags the conflict, the author still decides whether to move the device or cap the traveller.

**Verify:**
```bash
cd pipelines/video/visuals-flow && node lib/intro-film/check-taste-intro.mjs
# expect: "intro taste ok — 15 rules", exit 0
```

## Test plan

| Test | File | Follows |
|---|---|---|
| Pure geometry: separation, thresholds, containment, diagonal, symmetry | `lib/intro-film/check-clearance.test.mjs` | `lib/intro-film/check-taste-intro.test.mjs` |
| Sweep/corridor union math | same | same |
| Integration over the clean fixture, with `test.after` teardown | same | `lib/intro-film/review-film.test.mjs` |
| CDP smoke (launch → goto → eval → close) | `lib/intro-film/cdp.test.mjs` | same |

## Done criteria

1. `cd pipelines/video/visuals-flow && node --test lib/intro-film/check-clearance.test.mjs lib/intro-film/review-film.test.mjs` → `fail 0`.
2. `node lib/intro-film/check-clearance.mjs --fixture lib/intro-film/fixtures/clearance-clean` → exit 0, `0 findings`.
3. With the Step 6 mutation applied, the same command exits non-zero and prints `low_clearance`; after `git checkout --` it exits 0 again.
4. `bash run.sh consistent-ai-influencer intro-review` writes a `clearance` key into `review/check.json`.
5. `node lib/intro-film/check-taste-intro.mjs` → exit 0.
6. `git diff --stat 3fbf346f..HEAD --name-only` lists **only** files from the in-scope list.
7. No `package.json` and no `node_modules` added anywhere under `pipelines/video/visuals-flow/`.

## STOP conditions

- **Gate integrity**: if an assertion fails, fix the code or the fixture. Weakening, swapping, deleting, or `skip`-ing an assertion to reach green is a STOP. (LESSONS 2026-07-31, 2026-07-24.)
- **The mutation does not fail the gate** (Step 6) — STOP. That is the entire point of the plan; a gate that cannot fire is worse than none.
- Chrome cannot be launched or the CDP handshake will not complete on this machine after a genuine attempt — STOP and report; do not fall back to a regex/static analysis of the CSS. A static approximation would pass the mutation test while measuring nothing real.
- The clearance check fires on a film the owner has already approved (`consistent-ai-influencer`) with more than ~5 errors — STOP and report the findings rather than tuning `MIN_CLEARANCE_PX` until it goes quiet. The threshold is the owner's rule; a noisy result is data about the films, and silently raising it to 12px would delete the gate's value.
- You find yourself editing `lib/cue-rules.mjs`, `lib/zone-rules.mjs`, `lib/zone-constants.mjs`, or `card-library/DESIGN.md` — STOP. Those are the body/brand surfaces.

## Maintenance notes

- **`MIN_CLEARANCE_PX = 40` is the owner's rule, not a tuning knob.** It came from three complaints on 2026-08-15 where the real gaps were 8px and 16px. Anyone lowering it should be able to point at owner feedback saying so.
- The threshold is resolution-bound (40px at 1080p). If a film is ever authored at another canvas size, this must scale with it — currently it does not, and that is a known limit rather than an oversight.
- A reviewer should scrutinise two things: that `contains()` really suppresses the background-behind-text case (or the checker will drown every film in noise), and that `pairFinding` is **symmetric** — the b11 defect was a graphic *under* text, and an asymmetric implementation would miss exactly the case that motivated the plan.
- `corridor_conflict` is deliberately advisory. If it proves reliable across a few videos, promoting it to an error is a one-line change plus a TASTE-INTRO T14 update.
