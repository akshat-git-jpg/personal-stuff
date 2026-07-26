---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: false
deploy:
needs: []
---

# Plan 154: vf2 — key the chroma plate on the FCPXML export path

## Summary

- **Problem statement**: `lib/assemble.mjs` keys the green chroma plate out of
  `link-in-description` when it builds the mp4, but `lib/export-timeline.mjs`
  has zero chroma handling. Export a timeline to DaVinci Resolve and that card
  lands as a **solid green rectangle** over the footage, in both the native and
  the `--baked` export modes.
- **Goals**:
  - Bake the key into a real alpha channel (ProRes 4444) for every overlay cue
    that carries `chroma`, and point the FCPXML at that file instead of the raw
    green `.mov`.
  - Make assemble and export share ONE key recipe so the exported timeline can
    never drift from the shipped mp4.
  - Cover the `colorkey` branch in `assemble.mjs` with a test — it has none
    today, which is why this gap survived the original fix.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — `standard`, fully inlined.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0
  with two new test files running; a keyed export contains no green pixel where
  the plate was; assemble and export use one shared key constant.
- **Stop conditions** (terse — full list below): the keyed `.mov` has no alpha
  channel; ffmpeg lacks `prores_ks`; you are tempted to express the keyer as an
  FCPXML `<filter-video>` effect.
- **Test / verification for success**: unit tests plus a pixel assertion —
  `ffprobe` confirms an alpha channel and `ffmpeg` sampling confirms the keyed
  region is transparent, not green.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ad9db43..HEAD -- pipelines/video/visuals-flow-2/lib pipelines/video/visuals-flow-2/scripts pipelines/video/card-library/catalog.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `ad9db43`, 2026-07-27

## Why this matters

This is the **same bug, one surface later**. `lib/resolve.mjs:344-349` carries a
comment recording the first occurrence:

```js
// A card that paints a chroma-key plate instead of real transparency must
// be keyed out at composite or it ships as a coloured rectangle over the
// footage — owner v2:5 2026-07-24, "Why green screen? Is the template
// wrong?". The template was fine; assemble never keyed it. Carrying the
// key colour here is what lets assemble do it.
if (cat.chroma) entry.chroma = cat.chroma;
```

That fix taught `assemble.mjs`. Nobody taught `export-timeline.mjs`. The owner
would hit the identical symptom — a green rectangle, and the identical wrong
conclusion that the template is broken — the first time they export to Resolve.

This is the recurring failure class in this pipeline, named in
`.claude/skills/visuals-flow-feedback/SKILL.md`: *"Computed on one surface,
never consumed on the next. If a field exists, grep for its consumer."*
`chroma` has exactly one consumer today. This plan gives it the second one, and
adds the test that would have caught its absence.

**Why pre-key instead of an FCPXML effect.** FCPXML expresses an effect as a
`<filter-video>` referencing an `<effect>` resource identified by an Apple
Motion / FxPlug UID. Resolve's FCPXML importer silently drops effect UIDs it
does not recognise, so a keyer written that way would produce a file that looks
correct and imports as a green rectangle anyway — a worse failure than today's,
because it would look fixed. Baking the alpha needs **zero** effect support from
the NLE, and ProRes 4444 with an alpha channel is natively supported by both
Resolve and Premiere. This repo already proves the path: `lib/render-fx.mjs`
renders alpha-bearing ProRes 4444 `.mov` files for the FX lane today.

## Current state

### The gap, exactly

`lib/assemble.mjs:646-651` — the ONLY place `chroma` is consumed:

```js
          } else {
            // Chroma cards carry no alpha of their own — key the plate out first,
            // otherwise the overlay lands as a solid colour block (owner v2:5).
            const keyFilter = o.chroma ? `,colorkey=${o.chroma}:0.30:0.10` : '';
            chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${w}:${h}${keyFilter}[${oj}];`;
            chain += `[${lastV}][${oj}]overlay=eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
          }
```

`chroma` reaches that point via two hops, both of which already work:

```js
// lib/assemble.mjs:382-384 — overlay list construction
  const overlays = resolved.filter(c => c.placement === 'overlay').map(c => {
    return { id: c.id, start: c.start, end: c.start + c.duration, file: path.join(renderDir, planRender(c).outFile), ...(c.chroma ? { chroma: c.chroma } : {}) };
  });
```

```js
// lib/assemble.mjs:158-166 — per-segment overlay slice
    for (const o of overlays) {
      ...
          ...(o.chroma ? { chroma: o.chroma } : {}),
```

**`lib/export-timeline.mjs` contains the string `chroma` zero times.** Both of
its modes are affected, for different reasons:

1. **Native mode** (default). `cueClip` never carries `chroma` off the resolved
   cue in the first place — `lib/export-timeline.mjs:306-308`:

   ```js
       const cueClip = (c) => ({ id: c.id, offsetSec: c.start, durationSec: c.duration, file: path.join(renderDir, planRender(c).outFile) });
       const fullframes = inputs.resolved.filter((c) => c.placement === 'fullframe').map(cueClip);
       const overlayClips = inputs.resolved.filter((c) => c.placement === 'overlay').map(cueClip);
   ```

2. **`--baked` mode.** Here `plan.overlays` DOES carry `chroma` (it comes
   straight from `assemble.mjs:383` above), but `buildFcpxml` ignores it and
   emits a plain `asset-clip` — `lib/export-timeline.mjs:151-152`:

   ```js
       ...ovs.map((o) =>
         `        <asset-clip lane="1" ref="${o.ref}" offset="${rt(o.offsetF)}" duration="${rt(o.durF)}" start="0s" name="${xmlEsc(o.id)}"/>`),
   ```

### The exemplar to copy

`lib/render-fx.mjs` is the pattern for this whole plan: a standalone module that
renders alpha-bearing ProRes 4444 `.mov` files into a sibling directory plus a
`manifest.json`, invoked by `export-timeline.mjs` via `spawnSync` before the XML
is built. Its render recipe (`lib/render-fx.mjs:47-52`):

```js
  return [
    '-y', '-f', 'lavfi', '-i', grad,
    '-vf', vf, '-r', String(FPS), '-frames:v', String(envelope.length),
    '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
    outFile,
  ];
```

And its invocation (`lib/export-timeline.mjs:302-304`):

```js
    const rfx = spawnSync(process.execPath, [path.join(import.meta.dirname, 'render-fx.mjs'), opts.workdir], { encoding: 'utf8', stdio: 'inherit' });
    if (rfx.status !== 0) process.exit(1);
    const fxManifest = JSON.parse(fs.readFileSync(path.join(inputs.workdir, 'renders-fx', 'manifest.json'), 'utf8'));
```

Match this structure exactly. Do not invent a different one.

### Which cards are affected

Exactly one today:

```
link-in-description/link-in-description   chroma: 0x00b140
```

Overlay cues render as `.mov` (`lib/render.mjs:66`: `const format = cue.placement === 'overlay' ? 'mov' : 'mp4';`) — but this card paints an **opaque** green plate rather than using real transparency, which is why a `.mov` extension does not mean the alpha problem is already solved. The card documents this itself, in `pipelines/video/card-library/link-in-description/link-in-description/index.html:7-9`:

```
  THIS IS AN OVERLAY — it has no real background of its own. Drop it onto your
  footage by keying out the GREEN CHROMA-KEY background. To change the key color,
  edit --bg in :root (e.g. a different key color, or "transparent" + render mov).
```

### The test gate

`pipelines/video/visuals-flow-2/scripts/check.sh` **enumerates every test file
explicitly** on one `node --test` line. A new `*.test.mjs` that is not added to
that list never runs and the gate stays green while covering nothing. Adding the
file to the list is a required step of this plan, not a nicety.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run the gate (this is `test_cmd`) | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0, last line `visuals-flow check OK` |
| Run only the new tests | `cd pipelines/video/visuals-flow-2 && node --test lib/render-keyed.test.mjs lib/chroma.test.mjs` | exit 0 |
| Confirm ffmpeg has the ProRes encoder | `ffmpeg -hide_banner -encoders 2>/dev/null \| grep prores_ks` | one line containing `prores_ks` |
| Confirm a file has an alpha channel | `ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 <file>` | a `yuva…` pix_fmt (see note below) |
| Prove `chroma` has a second consumer | `cd pipelines/video/visuals-flow-2 && grep -rl 'chroma' lib/*.mjs \| sort` | includes `lib/export-timeline.mjs` |

## Scope

**In scope** (the only files to touch):
- `pipelines/video/visuals-flow-2/lib/chroma.mjs` — NEW
- `pipelines/video/visuals-flow-2/lib/chroma.test.mjs` — NEW
- `pipelines/video/visuals-flow-2/lib/render-keyed.mjs` — NEW
- `pipelines/video/visuals-flow-2/lib/render-keyed.test.mjs` — NEW
- `pipelines/video/visuals-flow-2/lib/assemble.mjs` — use the shared filter helper
- `pipelines/video/visuals-flow-2/lib/assemble.test.mjs` — add the chroma-branch test
- `pipelines/video/visuals-flow-2/lib/export-timeline.mjs` — invoke + substitute
- `pipelines/video/visuals-flow-2/scripts/check.sh` — register the two new test files
- `plans/README.md` — status row only, at the very end

**Out of scope** — looks related, do NOT touch:
- `pipelines/video/card-library/link-in-description/**` — the card is correct.
  It is *supposed* to paint a green plate. Do not add real transparency to it,
  do not change `--bg`, do not change its catalog `chroma` value.
- `lib/resolve.mjs` — already carries `chroma` correctly.
- `lib/render.mjs` — the raw `.mov` render must stay green; the keyed file is a
  derived artifact, not a replacement.
- Any other card, `catalog.json` beyond reading it, and every FCPXML concern
  that is not chroma (lanes, geometry, markers, captions, sfx).
- `lib/render-fx.mjs` — read it as the exemplar, do not modify it.

## Git workflow

- Branch: `advisor/154-vf2-chroma-keyed-export`
- Commit: `vf2: key the chroma plate on the FCPXML export path` — no AI footers.
  Do NOT push.

## Steps

### Step 1: Create `lib/chroma.mjs` — one key recipe, two consumers

This is the whole point of the plan: assemble and export must not be able to
drift. Create `pipelines/video/visuals-flow-2/lib/chroma.mjs` with exactly this
content:

```js
// Single source of truth for the chroma key.
//
// Two renditions consume it and they MUST agree:
//   - lib/assemble.mjs keys inline inside its ffmpeg filter chain (the mp4).
//   - lib/render-keyed.mjs bakes the same key into a ProRes 4444 file with a
//     real alpha channel (the FCPXML export, which cannot carry an effect).
//
// If these two ever disagree, the timeline the owner opens in Resolve stops
// matching the mp4 that shipped — which is a subtler version of the exact bug
// this module exists to fix. Never inline the numbers at a call site.
export const CHROMA_KEY = { similarity: 0.3, blend: 0.1 };

export const chromaKeyFilter = (chroma) =>
  `colorkey=${chroma}:${CHROMA_KEY.similarity}:${CHROMA_KEY.blend}`;
```

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && node -e "import('./lib/chroma.mjs').then(m => console.log(m.chromaKeyFilter('0x00b140')))"
```
→ exactly `colorkey=0x00b140:0.3:0.1`

### Step 2: Point `assemble.mjs` at the shared helper

In `lib/assemble.mjs`, add to the existing import block at the top of the file:

```js
import { chromaKeyFilter } from './chroma.mjs';
```

Then replace the inline recipe at line ~649. Change:

```js
            const keyFilter = o.chroma ? `,colorkey=${o.chroma}:0.30:0.10` : '';
```

to:

```js
            const keyFilter = o.chroma ? `,${chromaKeyFilter(o.chroma)}` : '';
```

Leave the surrounding comment and both `chain +=` lines untouched.

Note the emitted string changes from `0.30:0.10` to `0.3:0.1`. These are
numerically identical ffmpeg arguments; do not "fix" this by padding the
constants back to two decimals.

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && grep -c 'colorkey=' lib/assemble.mjs
```
→ `0` (the literal is gone; only the helper builds it now)

### Step 3: Create `lib/render-keyed.mjs`

Create `pipelines/video/visuals-flow-2/lib/render-keyed.mjs` with exactly this
content. It mirrors `render-fx.mjs`: pure planning functions that are unit
testable, plus a `main()` that only runs when invoked directly.

```js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';
import { planRender } from './render.mjs';
import { chromaKeyFilter } from './chroma.mjs';

// The FCPXML export cannot carry a keyer: Resolve silently drops effect UIDs it
// does not recognise, so a <filter-video> keyer would import as a green
// rectangle that LOOKS fixed. Instead we bake the key into a real alpha channel
// — ProRes 4444, natively supported by Resolve and Premiere — and point the XML
// at that file. Same approach and same codec as lib/render-fx.mjs.

// Which overlay cues need a keyed rendition. A fullframe cue is never keyed:
// it covers the frame, so its background is the picture, not a plate.
export function planKeyed(resolved) {
  return (resolved || [])
    .filter((c) => c.placement === 'overlay' && c.chroma)
    .map((c) => ({
      id: c.id,
      chroma: c.chroma,
      srcFile: planRender(c).outFile,
      outFile: `${c.id}.mov`,
    }));
}

export function keyedRenderArgs({ srcPath, chroma, outPath }) {
  return [
    '-y', '-i', srcPath,
    '-vf', `${chromaKeyFilter(chroma)},format=yuva444p10le`,
    '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
    '-an',
    outPath,
  ];
}

// Swap the raw green plate for its keyed .mov in a list of timeline clips.
// Matched by cue id, because that is the one field both clip shapes share:
// the native path builds {id, offsetSec, durationSec, file} and the --baked
// path builds {id, start, end, file, chroma}. Clips with no keyed rendition
// pass through untouched.
export function withKeyedFiles(clips, manifest) {
  const byId = new Map((manifest?.keyed ?? []).map((k) => [k.id, k.file]));
  return (clips ?? []).map((c) => (byId.has(c.id) ? { ...c, file: byId.get(c.id) } : c));
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/render-keyed.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(slug);
  const resolvedPath = path.join(workdir, 'resolved.json');
  if (!fs.existsSync(resolvedPath)) {
    console.error(`missing ${resolvedPath} — run the resolve step first`);
    process.exit(1);
  }
  const resolved = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')).resolved ?? [];
  const jobs = planKeyed(resolved);

  const outDir = path.join(workdir, 'renders-keyed');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const renderDir = path.join(workdir, 'renders');
  const keyed = [];
  for (const j of jobs) {
    const srcPath = path.join(renderDir, j.srcFile);
    if (!fs.existsSync(srcPath)) {
      console.error(`missing render for ${j.id}: ${srcPath} — render the cues first`);
      process.exit(1);
    }
    const outPath = path.join(outDir, j.outFile);
    const res = spawnSync('ffmpeg', keyedRenderArgs({ srcPath, chroma: j.chroma, outPath }), { encoding: 'utf8' });
    if (res.status !== 0) {
      console.error(`ffmpeg failed keying ${j.id}\n${(res.stderr || '').slice(-2000)}`);
      process.exit(1);
    }
    keyed.push({ id: j.id, chroma: j.chroma, file: outPath });
  }

  const manifest = { video: path.basename(workdir), keyed };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`keyed overlays: ${keyed.length} -> ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && node -e "
import('./lib/render-keyed.mjs').then(m => {
  const jobs = m.planKeyed([
    { id: 'o1', placement: 'overlay', start: 5, duration: 1, card: 'link-in-description/link-in-description', chroma: '0x00b140' },
    { id: 'o2', placement: 'overlay', start: 9, duration: 1, card: 'overlay/lower-third' },
    { id: 'c1', placement: 'fullframe', start: 1, duration: 2, card: 'title/x', chroma: '0x00b140' },
  ]);
  console.log(JSON.stringify(jobs));
})"
```
→ exactly one job, for `o1` only:
`[{"id":"o1","chroma":"0x00b140","srcFile":"0005-o1-link-in-description.mov","outFile":"o1.mov"}]`

### Step 4: Wire it into BOTH export modes

Edit `lib/export-timeline.mjs`.

**4a.** Add to the imports at the top:

```js
import { withKeyedFiles } from './render-keyed.mjs';
```

**4b — native mode.** Immediately after the existing `render-fx.mjs` spawn block
(`lib/export-timeline.mjs:302-304`), add the sibling spawn for `render-keyed.mjs`:

```js
    const rkey = spawnSync(process.execPath, [path.join(import.meta.dirname, 'render-keyed.mjs'), opts.workdir], { encoding: 'utf8', stdio: 'inherit' });
    if (rkey.status !== 0) process.exit(1);
    const keyedManifest = JSON.parse(fs.readFileSync(path.join(inputs.workdir, 'renders-keyed', 'manifest.json'), 'utf8'));
```

Then change the `overlayClips` line (currently `lib/export-timeline.mjs:308`)
from:

```js
    const overlayClips = inputs.resolved.filter((c) => c.placement === 'overlay').map(cueClip);
```

to:

```js
    // Chroma cards ship a green plate, not alpha. The mp4 path keys it in the
    // ffmpeg chain; FCPXML has no keyer we can trust Resolve to honour, so we
    // point the XML at the pre-keyed ProRes 4444 rendition instead.
    const overlayClips = withKeyedFiles(
      inputs.resolved.filter((c) => c.placement === 'overlay').map(cueClip),
      keyedManifest,
    );
```

**4c — `--baked` mode.** In the `if (opts.baked)` branch, `plan.overlays`
already carries `chroma` but `buildFcpxml` ignores it. Add the same spawn +
substitution. After the `runAssembly({...})` call completes and before
`const srcUrl = ...`, insert:

```js
    const rkey = spawnSync(process.execPath, [path.join(import.meta.dirname, 'render-keyed.mjs'), opts.workdir], { encoding: 'utf8', stdio: 'inherit' });
    if (rkey.status !== 0) process.exit(1);
    const keyedManifest = JSON.parse(fs.readFileSync(path.join(inputs.workdir, 'renders-keyed', 'manifest.json'), 'utf8'));
    plan.overlays = withKeyedFiles(plan.overlays, keyedManifest);
```

Note both branches declare a local `const rkey` / `const keyedManifest`; they
are in separate block scopes (`if` / `else`), so this is valid — do not hoist
them to a shared outer scope, because the baked branch must run its spawn AFTER
`runAssembly`.

Leave `buildFcpxml` and `buildNativeFcpxml` themselves **unchanged** — the
substitution happens on the clip lists before the XML is built, so neither
builder needs to learn about chroma at all.

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && node --check lib/export-timeline.mjs && grep -c 'withKeyedFiles' lib/export-timeline.mjs
```
→ `node --check` exits 0 silently, then `3` (one import, one per mode)

### Step 5: Register both new test files in the gate

Edit `pipelines/video/visuals-flow-2/scripts/check.sh` and add
`lib/chroma.test.mjs lib/render-keyed.test.mjs` to the enumerated `node --test`
list (append them immediately after `lib/render-fx.test.mjs`, keeping the single
line).

Do **not** replace the enumeration with `node --test lib/` — the explicit list is
deliberate.

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && grep -o 'lib/chroma.test.mjs\|lib/render-keyed.test.mjs' scripts/check.sh | sort
```
→ two lines, `lib/chroma.test.mjs` and `lib/render-keyed.test.mjs`

### Step 6: Write `lib/chroma.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHROMA_KEY, chromaKeyFilter } from './chroma.mjs';

test('chromaKeyFilter builds the ffmpeg colorkey filter', () => {
  assert.equal(chromaKeyFilter('0x00b140'), 'colorkey=0x00b140:0.3:0.1');
});

test('the key constants are shared, not re-declared per call site', async () => {
  // If someone re-inlines the numbers in assemble.mjs, the exported timeline
  // silently stops matching the shipped mp4. Assert the literal is gone.
  const fs = await import('node:fs');
  const assembleSrc = fs.readFileSync(new URL('./assemble.mjs', import.meta.url), 'utf8');
  assert.ok(
    !/colorkey=/.test(assembleSrc),
    'assemble.mjs must build its colorkey via chromaKeyFilter, not a literal',
  );
  assert.equal(CHROMA_KEY.similarity, 0.3);
  assert.equal(CHROMA_KEY.blend, 0.1);
});
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/chroma.test.mjs` → exit 0, 2 pass

### Step 7: Write `lib/render-keyed.test.mjs`

This is the test that proves data reaches pixels, not just that a field exists.
Follow the fixture style of `lib/export-timeline.test.mjs:160-176` (build source
media with `ffmpeg -f lavfi`).

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planKeyed, keyedRenderArgs, withKeyedFiles } from './render-keyed.mjs';

test('planKeyed selects only overlay cues that carry a chroma plate', () => {
  const jobs = planKeyed([
    { id: 'o1', placement: 'overlay', start: 5, duration: 1, card: 'link-in-description/link-in-description', chroma: '0x00b140' },
    { id: 'o2', placement: 'overlay', start: 9, duration: 1, card: 'overlay/lower-third' },
    { id: 'c1', placement: 'fullframe', start: 1, duration: 2, card: 'title/x', chroma: '0x00b140' },
  ]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'o1');
  assert.equal(jobs[0].outFile, 'o1.mov');
  assert.equal(jobs[0].srcFile, '0005-o1-link-in-description.mov');
});

test('planKeyed tolerates an empty or missing cue list', () => {
  assert.deepEqual(planKeyed([]), []);
  assert.deepEqual(planKeyed(undefined), []);
});

test('withKeyedFiles swaps only the clips that have a keyed rendition', () => {
  const clips = [
    { id: 'o1', offsetSec: 5, durationSec: 1, file: '/renders/0005-o1-link.mov' },
    { id: 'o2', offsetSec: 9, durationSec: 1, file: '/renders/0009-o2-lower.mov' },
  ];
  const out = withKeyedFiles(clips, { keyed: [{ id: 'o1', chroma: '0x00b140', file: '/renders-keyed/o1.mov' }] });
  assert.equal(out[0].file, '/renders-keyed/o1.mov');
  assert.equal(out[1].file, '/renders/0009-o2-lower.mov', 'untouched clip keeps its file');
  assert.equal(out[0].offsetSec, 5, 'other fields survive the swap');
  assert.equal(clips[0].file, '/renders/0005-o1-link.mov', 'input is not mutated');
});

test('withKeyedFiles is a no-op on an empty manifest', () => {
  const clips = [{ id: 'o1', file: '/a.mov' }];
  assert.deepEqual(withKeyedFiles(clips, { keyed: [] }), clips);
  assert.deepEqual(withKeyedFiles(clips, {}), clips);
});

const W = 320, H = 180;

// Composite `clipPath` over a solid RED frame and return the rgb triple at
// (x, y). No crop filter: this ffmpeg build rejects `crop` after `overlay`
// with "non positive size for width '0'", so read the whole frame and index
// it here instead.
function pixelOverRed(tmp, clipPath, x, y, tag) {
  const flat = path.join(tmp, `over-red-${tag}.png`);
  const comp = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', `color=c=red:s=${W}x${H}:r=30`,
    '-i', clipPath,
    '-filter_complex', '[0:v][1:v]overlay=0:0',
    '-frames:v', '1', flat,
  ], { encoding: 'utf8' });
  assert.equal(comp.status, 0, `composite failed: ${(comp.stderr || '').slice(-500)}`);

  const raw = spawnSync('ffmpeg', [
    '-v', 'error', '-i', flat, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-',
  ], { maxBuffer: 1 << 26 });
  assert.equal(raw.status, 0, 'raw frame is readable');
  const off = (y * W + x) * 3;
  return [raw.stdout[off], raw.stdout[off + 1], raw.stdout[off + 2]];
}

test('the keyed render produces real alpha where the plate was green', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vf2-keyed-'));
  try {
    // A green plate with an opaque white bar across the middle — exactly the
    // shape of a chroma card: keyable background, real content on top.
    const src = path.join(tmp, 'plate.mov');
    const mk = spawnSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', `color=c=0x00b140:s=${W}x${H}:r=30`,
      '-vf', 'drawbox=x=0:y=80:w=320:h=20:color=white:t=fill',
      '-t', '1', '-c:v', 'qtrle', src,
    ], { encoding: 'utf8' });
    assert.equal(mk.status, 0, `fixture render failed: ${(mk.stderr || '').slice(-500)}`);

    const out = path.join(tmp, 'keyed.mov');
    const res = spawnSync('ffmpeg', keyedRenderArgs({ srcPath: src, chroma: '0x00b140', outPath: out }), { encoding: 'utf8' });
    assert.equal(res.status, 0, `keyed render failed: ${(res.stderr || '').slice(-500)}`);
    assert.ok(fs.existsSync(out));

    // 1. The file carries an alpha channel. Assert the FAMILY, not the exact
    //    pix_fmt: we ask ffmpeg for yuva444p10le but prores_ks promotes 4444
    //    to yuva444p12le, so an equality check here fails on a correct file.
    const probe = spawnSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=pix_fmt', '-of', 'csv=p=0', out,
    ], { encoding: 'utf8' });
    assert.match(probe.stdout.trim(), /^yuva/, 'keyed file must carry an alpha channel');

    // 2. data -> pixels. Composited over red, the keyed region must read RED
    //    (the plate is gone). A green reading means the key silently did
    //    nothing — which is exactly today's bug. Measured on the prototype:
    //    keyed -> rgb(254,0,0); unkeyed -> rgb(0,176,64).
    const [r, g, b] = pixelOverRed(tmp, out, 10, 10, 'keyed');
    assert.ok(r > 150 && g < 100, `keyed region should read as the red backdrop, got rgb(${r},${g},${b}) — the green plate survived the key`);

    // 3. The key must not eat the CONTENT. The white bar is opaque and must
    //    survive; an over-aggressive similarity would erase it, and test 2
    //    alone would still pass.
    const [br, bg, bb] = pixelOverRed(tmp, out, 10, 90, 'bar');
    assert.ok(br > 200 && bg > 200 && bb > 200, `the white bar must survive the key, got rgb(${br},${bg},${bb})`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/render-keyed.test.mjs` → exit 0, 5 pass

### Step 8: Cover the `assemble.mjs` colorkey branch

The branch has no test today — that absence is why this gap survived the
original fix. Add ONE test to the end of `lib/assemble.test.mjs`, matching the
import and fixture style already used in that file:

```js
test('the overlay branch keys chroma via the shared helper', () => {
  // Guards the mp4 half of the pair. lib/render-keyed.test.mjs guards the
  // export half; lib/chroma.test.mjs guards that both use one recipe.
  // Kept to plain substring checks — a regex mirroring the exact template
  // literal would break on any harmless reformatting of that line.
  const src = fs.readFileSync(new URL('./assemble.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes("from './chroma.mjs'"), 'assemble.mjs imports the shared chroma module');
  assert.ok(src.includes('chromaKeyFilter(o.chroma)'), 'the overlay branch calls chromaKeyFilter');
  assert.ok(!src.includes('colorkey='), 'no literal colorkey recipe remains in assemble.mjs');
});
```

If `lib/assemble.test.mjs` does not already import `fs`, add
`import fs from 'node:fs';` to its imports.

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/assemble.test.mjs` → exit 0

### Step 9: Full gate

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
```
→ exit 0, last line `visuals-flow check OK`

### Step 10: Prove the field now has two consumers

The whole failure class is "a field with one consumer". Confirm it is closed.

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && grep -rl 'chroma' lib/*.mjs | sort
```
→ the list MUST include all of: `lib/assemble.mjs`, `lib/chroma.mjs`,
`lib/export-timeline.mjs`, `lib/render-keyed.mjs`, `lib/resolve.mjs`

### Step 11: Update the registry row

Set plan 154's row in `plans/README.md` to `DONE`. Change nothing else in that
file.

## Test plan

Four layers, each guarding a different failure:

1. **`lib/chroma.test.mjs`** — the recipe is shared. Asserts the literal
   `colorkey=` no longer appears in `assemble.mjs`, so the two renditions cannot
   drift apart.
2. **`lib/render-keyed.test.mjs`** — selection logic (`planKeyed`), substitution
   logic (`withKeyedFiles`, including non-mutation), and **a data→pixels
   assertion**: composite the keyed output over red and read the pixel back. A
   green result means the key silently did nothing.
3. **`lib/assemble.test.mjs`** — the previously untested mp4-side branch.
4. **`bash scripts/check.sh`** — the merge gate, with both new files registered.

Layer 2's pixel check is the one that matters. `plans/runs/LESSONS.md`
(2026-07-24): *"lint validated the field while the renderer never received it.
Test the full path data→pixels, not per-surface."* A green filter graph is not
evidence that green left the frame.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` exits 0.
- [ ] `grep -c 'colorkey=' lib/assemble.mjs` → `0`.
- [ ] `grep -o 'lib/chroma.test.mjs\|lib/render-keyed.test.mjs' scripts/check.sh | sort` → both files listed.
- [ ] `grep -rl 'chroma' lib/*.mjs | sort` includes `lib/export-timeline.mjs` and `lib/render-keyed.mjs`.
- [ ] `node --test lib/render-keyed.test.mjs` → 5 tests pass, including the
      over-red pixel assertion.
- [ ] `git diff --name-only ad9db43..HEAD` lists ONLY the files named in "In
      scope". In particular it must NOT list anything under
      `pipelines/video/card-library/`.

## STOP conditions

- **`ffmpeg -encoders | grep prores_ks` returns nothing.** The whole approach
  depends on ProRes 4444 with alpha. Stop and report; do not substitute another
  codec (`qtrle` is lossless but Resolve handles ProRes 4444 far better, and
  `webm`/VP9 alpha is not a Resolve-friendly path).
- **You are tempted to express the keyer as an FCPXML `<filter-video>` /
  `<effect>` element.** Do not. Resolve drops effect UIDs it does not recognise,
  so this produces a file that looks fixed and imports as a green rectangle —
  strictly worse than the current bug. Stop and report if pre-keying seems
  impossible.
- **You are tempted to edit the `link-in-description` card** to use real
  transparency instead of a green plate. Out of scope and not the fix — the card
  is deliberately a chroma card and is documented as one. Stop and report.
- **The over-red pixel assertion in Step 7 reads green.** That means the key ran
  but did not take. Do not loosen the assertion or widen `CHROMA_KEY.similarity`
  to make it pass — report the measured rgb triple instead.
- **`bash scripts/check.sh` fails in a test you did not touch.** Do not fix
  unrelated tests inside this plan; stop and report which test and its output.

## Maintenance notes

- **The pair is the invariant.** `assemble.mjs` (mp4) and `render-keyed.mjs`
  (FCPXML) are two renditions of one key. `lib/chroma.mjs` exists solely to stop
  them drifting; a reviewer should scrutinise any change that reintroduces a
  literal `colorkey=` at a call site.
- **A new chroma card needs no code.** Add `chroma` to its `catalog.json` entry
  and both paths pick it up. Only `link-in-description/link-in-description`
  carries one today.
- **The `renders-keyed/` directory is derived output**, rebuilt from scratch on
  every export (`fs.rmSync` then `mkdirSync`, same as `renders-fx/`). It must
  never be committed — confirm it is covered by the workdir gitignore rules that
  already exclude `renders/` and `renders-fx/`.
- **This is the third instance of the same failure class** in this pipeline
  ("computed on one surface, never consumed on the next" — see the
  `visuals-flow-feedback` skill). The generalisable lesson: when a field is
  added to carry data across a boundary, grep for its *consumers*, plural, and
  ask which rendition paths exist. Here there were two from the start; only one
  ever learned about it.
