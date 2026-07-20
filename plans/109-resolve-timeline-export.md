---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: false
deploy:
needs: []
---

# Plan 109: Resolve timeline export — assembly → FCPXML for human touch-up

## Summary

- **Problem statement**: The assembled `final.mp4` is a flat baked file — the owner's/editor's fast micro-fixes (move a graphic, trim a cut, delete a card) require chat round-trips with Claude instead of ten-second drags in an NLE.
- **Goals**:
  - `lib/export-timeline.mjs <slug>` exports the exact assembly as a DaVinci-Resolve-importable `timeline.fcpxml` + per-segment media clips.
  - V1 = base cut (screen/avatar/graphic segments, effects + captions baked in, overlay-free), lane 1 = overlay graphics as separate movable clips, lane -1 = voiceover.
  - `--bundle` copies vo + overlay movs in for a portable editor handoff.
  - Reuses the existing gates, segment planner, effect pipeline, and `assembly-cache/`.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High — fully-inlined plan, default routing per `tooling/boss/data/rules.md`)
- **Done criteria** (terse): `bash pipelines/video/visuals-flow/scripts/check.sh` green including new `export-timeline.test.mjs`; docs/skill/quick-ref lines present (grep checks below).
- **Stop conditions** (terse): baseline check.sh already red; any existing assemble.test.mjs test breaks and can't be fixed within the 5-attempt cap; scope breach outside in-scope list.
- **Test / verification for success**: unit tests on the FCPXML generator (gapless-spine property, structure counts, escaping) + one lavfi integration test of export mode, all wired into check.sh.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e885de7..HEAD -- pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/assemble.test.mjs pipelines/video/visuals-flow/scripts/check.sh pipelines/.claude/skills/visuals-flow/SKILL.md pipelines/video/visuals-flow/HANDOFF.md pipelines/video/visuals-flow/PIPELINE.md`
> If any of these files changed since `e885de7`, re-read the changed file before editing it and adapt line references (they are anchors, not gospel); if `runAssembly`'s signature or job loop changed structurally, STOP and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches `runAssembly`, guarded by the existing integration tests in `assemble.test.mjs`)
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `e885de7`, 2026-07-20

## Why this matters

The visuals-flow POC is complete end to end and the owner's verdict is "keep improving". The single biggest workflow gap now (owner-stated 2026-07-20): after Claude assembles the video, the remaining fixes are small human judgment calls — a graphic runs long, a cut lands a beat late, a card should go — and each currently costs a chat round-trip plus re-assembly. Exporting the assembly as a real NLE timeline makes those fixes ten-second drags in DaVinci Resolve (or Premiere — same format), while the pipeline stays the source of truth. Design decision (owner-confirmed 2026-07-20): deterministic FCPXML file generation, NOT MCP-driven Resolve editing — headless, unit-testable, reproducible.

## Current state

All paths below are relative to `pipelines/video/visuals-flow/` unless noted.

- `lib/assemble.mjs` — step 090's engine. Facts the exporter builds on (verified at `e885de7`):
  - `runAssembly({...})` (line ~324) plans segments (`planSegments` + `absorbSlivers` + per-effect-module `transformSegments`), then builds one ffmpeg job per segment into `tmpDir` as MPEG-TS, cached content-keyed in `videos/<slug>/assembly-cache/<sha1>.ts` (`jobKey` hashes the ffmpeg args + input file size/mtime, line ~25). Whip transitions insert extra micro-segments (`whipMod.boundarySegments`, line ~597) and shave `TRANSITION_DUR / 2` off each adjacent segment. Finally: concat + `vo.mp3` mux + duration/resolution/audio probes + `assembly.md` write. **It currently returns nothing** (bare `return;`, line ~711).
  - Overlays are composited INSIDE the intersecting segment encodes (line ~401 `const segOverlays = planSegmentOverlays(segments, overlays);` feeding the `needsComplex` branch at line ~540). This is why the exporter must pass an empty overlay list into the segment encodes and place overlays on their own timeline lane instead.
  - Per-segment concat filename: `` `seg-${String(segIndex).padStart(3, '0')}-${seg.id}.ts` `` (line ~467); transition micro-segments use `ex.fileTag`. Sub-split avatar ids render as `s02.1` via `seg.sub` (see `getSegId` inside `assemblyMd`, line ~211).
  - `main()` (line ~714) holds ALL the gates inline: cues `approved`, `resolved.json` freshness re-check, shots approved + avatar files present, `effects.json` approved, vo/screen/renders existence, vo/screen ffprobe, short-screen warning (lines ~729–816). The exporter must enforce identical gates — extract, don't duplicate.
  - `CANVAS = { w: 1920, h: 1080, fps: 30 }` (line ~38); `ASSEMBLE_MEDIA_ROOT` = `~/kb-scratch/video/visuals-flow` (line ~39).
- `lib/assemble.test.mjs` — the exemplar to imitate. Pure-unit tests on exported planners at the top; **`test('Integration: ffmpeg runAssembly', ...)` at line ~377** synthesizes screen/avatar/vo/graphics/overlay media with `lavfi` (`testsrc`, `color=c=red`, `anullsrc`, qtrle alpha overlay) into `lib/.test-tmp/assemble-it/`, calls `runAssembly` directly (bypassing `main()`'s gates), and verifies with ffprobe/signalstats. Follow this exact pattern for the new integration test.
- `lib/render.mjs` — `planRender(cue)` (line ~44) gives each render's `outFile`; overlays are ProRes 4444 `.mov` with alpha (`yuva444p12le`, ffprobe-verified on `videos/test-01/renders/0239-c04-stat-hit.mov`) — DaVinci Resolve imports ProRes 4444 alpha natively, no transcode needed.
- `scripts/check.sh` — the flow gate; an explicit list of `node --test` files + `node lib/check-rulebook.mjs`. New test files MUST be appended to the list (LESSONS 2026-07-09: never use `node --test <dir>` — it fails on node 22).
- `steps/090-assemble-run/run.sh` — the 4-line wrapper pattern to copy for step 095:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  cd "$(dirname "$0")/../.."
  exec node lib/assemble.mjs "$@"
  ```
- `pipelines/.claude/skills/visuals-flow/SKILL.md` — the verb router (repo-root `.claude/skills/visuals-flow` is a symlink to it; **edit only the `pipelines/` source**). Verbs are `## Verb: "..."` sections; the new verb goes right after `## Verb: "assemble the video" / "build the final video"`.
- `HANDOFF.md` — has a `## How to run (quick reference)` fenced block listing one command per step.
- `PIPELINE.md` — `## The flow (run top to bottom)` table, one row per step.
- Convention: plain `.mjs`, no package.json, no external deps, `node:` imports only, 2-space indent, `node --test` + `assert/strict`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline + merge gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Run one test file | `cd pipelines/video/visuals-flow && node --test lib/export-timeline.test.mjs` | exit 0 |
| ffmpeg present | `ffmpeg -version` | exit 0 |

## Scope

**In scope** (the only files to touch):
- `pipelines/video/visuals-flow/lib/assemble.mjs` (small additive changes, spec below)
- `pipelines/video/visuals-flow/lib/export-timeline.mjs` (new)
- `pipelines/video/visuals-flow/lib/export-timeline.test.mjs` (new)
- `pipelines/video/visuals-flow/steps/095-resolve-export-run/run.sh` + `README.md` (new)
- `pipelines/video/visuals-flow/scripts/check.sh` (append one test file)
- `pipelines/.claude/skills/visuals-flow/SKILL.md` (add one verb section)
- `pipelines/video/visuals-flow/HANDOFF.md` (quick-reference: add one command line)
- `pipelines/video/visuals-flow/PIPELINE.md` (flow table: add one row)
- `plans/README.md` (status row flip at the end)

**Out of scope** (looks related — don't touch):
- `lib/effects/*.mjs`, `lib/render.mjs`, `lib/board.mjs` — the exporter consumes them read-only.
- Any reverse timeline-diff / re-import work — deliberately deferred (owner decision 2026-07-20).
- The `davinci-resolve` MCP servers under `tooling/mcp/` — unrelated to this deterministic exporter.
- `videos/test-01/**` — do not regenerate or commit anything there.

## Git workflow

- Branch: `advisor/109-resolve-timeline-export`
- Commit per step, conventional single-line messages (e.g. `feat(visuals-flow): fcpxml timeline exporter`) — no AI footers. Do NOT push.

## Steps

### Step 1: Baseline

Run `bash pipelines/video/visuals-flow/scripts/check.sh`.

**Verify**: exit 0, last line `visuals-flow check OK`. If red → STOP (condition 1).

### Step 2: Extract `loadAssemblyInputs` from `main()` in `lib/assemble.mjs`

Move the gate-and-load block of `main()` — everything from `const workdir = resolveWorkdir(opts.workdir);` (line ~729) through the short-screen warning `if (lastScreen && ...) { console.warn(...) }` (line ~816), INCLUSIVE — into a new exported function, verbatim (no logic edits):

```js
export async function loadAssemblyInputs(opts) {
  // <the moved block, unchanged>
  return { workdir, video, resolved, avatarJobs, cornerJobs, words, total, screen };
}
```

`main()` then becomes: parse args → libass pre-check (keep it in `main()`, it is captions-specific) → `const inputs = await loadAssemblyInputs(opts);` → compute `out` as today (using `inputs.video`) → call `runAssembly({ ...inputs, ... })` with the same option passthrough as today. Note the moved block references `opts.force`, `opts.screen`, `opts.screenOffset` — it receives the same `opts` object, so behavior is identical.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 (pure refactor; the integration tests call `runAssembly` directly and must be unaffected).

### Step 3: Add export mode to `runAssembly`

All changes additive:

1. Signature: add `overlayComposite = true, segmentsOutDir = null` to the destructured options.
2. Line ~401: `const segOverlays = planSegmentOverlays(segments, overlayComposite ? overlays : []);`
3. Next to `const concatLines = [];` add `const timelineClips = [];`
4. In the job loop, immediately after `jobs.push({ outFile: segFile, ... })` (line ~595):
   ```js
   timelineClips.push({
     file: segFileStr,
     kind: seg.kind,
     id: seg.sub !== undefined ? `${seg.id}.${seg.sub + 1}` : seg.id,
     dur,
   });
   ```
   and in the transition-extras loop, after its `jobs.push(...)` (line ~613):
   ```js
   timelineClips.push({ file: transStr, kind: 'transition', id: ex.fileTag, dur: ex.dur });
   ```
5. Immediately after `await runPool(jobs, jobsN);` + its console.log (line ~661), insert the export branch:
   ```js
   if (segmentsOutDir) {
     fs.mkdirSync(segmentsOutDir, { recursive: true });
     for (const c of timelineClips) {
       const mp4 = path.join(segmentsOutDir, c.file.replace(/\.ts$/, '.mp4'));
       const r = spawnSync('ffmpeg', ['-y', '-i', path.join(tmpDir, c.file), '-c', 'copy', mp4], { encoding: 'utf8' });
       if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
       c.file = mp4;
     }
     if (!keepTemp) fs.rmSync(tmpDir, { recursive: true, force: true });
     console.log(`exported ${timelineClips.length} segment clips to ${segmentsOutDir}`);
     return { clips: timelineClips, overlays, total, w, h };
   }
   ```
   (Export mode deliberately skips the concat, mux, probes, and — critically — the `assembly.md` write: an overlay-free variant must never clobber the real EDL.)
6. Change the final bare `return;` (line ~711) to `return { clips: timelineClips, overlays, total, w, h };` (additive — the existing caller ignores the return value).

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 (all existing integration tests still pass: `overlayComposite` defaults to `true`, `segmentsOutDir` to `null`).

### Step 4: Create `lib/export-timeline.mjs`

Full file — place verbatim (only adjust if Step 2/3 names differ):

```js
import fs from 'node:fs';
import path from 'node:path';
import { loadAssemblyInputs, runAssembly, ASSEMBLE_MEDIA_ROOT, detectEncoder } from './assemble.mjs';

const FPS = 30;
export const frames = (sec) => Math.round(sec * FPS);
export const rt = (fr) => `${fr * 100}/3000s`;

const xmlEsc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// clips: ordered, gapless [{ file, id, kind, dur }] (dur in seconds).
// overlays: [{ id, start, end, file }] in absolute timeline seconds.
// srcUrl(file) -> the URL string written into <asset src>.
// Spine durations are re-derived from cumulative frame-rounded boundaries so
// the primary storyline is gapless by construction (per-clip rounding drifts).
export function buildFcpxml({ video, clips, overlays, voPath, total, w, h, srcUrl }) {
  const assets = [];
  let nextId = 2;
  const assetFor = (file, { audio = false, durF }) => {
    const id = `r${nextId++}`;
    assets.push(`    <asset id="${id}" name="${xmlEsc(path.basename(file))}" start="0s" duration="${rt(durF)}" hasVideo="${audio ? '0' : '1'}" hasAudio="${audio ? '1' : '0'}" src="${xmlEsc(srcUrl(file))}"/>`);
    return id;
  };

  let cum = 0;
  const spine = clips.map((c) => {
    const f0 = frames(cum);
    cum += c.dur;
    const f1 = frames(cum);
    const durF = Math.max(1, f1 - f0);
    return { ...c, offsetF: f0, durF, ref: assetFor(c.file, { durF }) };
  });
  const totalF = frames(total);
  const voRef = assetFor(voPath, { audio: true, durF: totalF });
  const ovs = overlays.map((o) => {
    const durF = Math.max(1, frames(o.end) - frames(o.start));
    return { ...o, offsetF: frames(o.start), durF, ref: assetFor(o.file, { durF }) };
  });

  const connected = [
    `        <asset-clip lane="-1" ref="${voRef}" offset="${rt(0)}" duration="${rt(totalF)}" start="0s" name="vo"/>`,
    ...ovs.map((o) =>
      `        <asset-clip lane="1" ref="${o.ref}" offset="${rt(o.offsetF)}" duration="${rt(o.durF)}" start="0s" name="${xmlEsc(o.id)}"/>`),
  ].join('\n');

  const spineXml = spine.map((c, i) => {
    const open = `      <asset-clip ref="${c.ref}" offset="${rt(c.offsetF)}" duration="${rt(c.durF)}" start="0s" name="${xmlEsc(c.id)}"`;
    return i === 0 ? `${open}>\n${connected}\n      </asset-clip>` : `${open}/>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="100/3000s" width="${w}" height="${h}"/>
${assets.join('\n')}
  </resources>
  <library>
    <event name="visuals-flow">
      <project name="${xmlEsc(video)}">
        <sequence format="r1" duration="${rt(totalF)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spineXml}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

const README_TEXT = (video) => `# ${video} — Resolve/Premiere timeline export

Import: DaVinci Resolve -> File -> Import -> Timeline -> timeline.fcpxml
(Premiere: File -> Import). If media shows offline, right-click the clips ->
Relink Media and point at this folder.

Tracks: V1 = base cut (screen / avatar / graphics segments — effects and
captions are baked into these clips), V2 = overlay graphics (movable /
deletable), A1 = voiceover.

Rules of thumb:
- Move / trim / delete freely — every clip is plain media, nothing generated.
- You can NOT extend a clip past its rendered length; ask for a re-render
  of that piece instead.
- Effect looks (flash, drift, captions, punch-ins) are baked upstream. To
  change one, edit effects.json in the repo and re-export — don't rebuild here.
- The voiceover on A1 is the master clock: edits that change total duration
  desync everything after the edit point.
`;

function parseArgs(argv) {
  const opts = { workdir: null, bundle: false, out: null, jobs: 3 };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--bundle') opts.bundle = true;
    else if (a === '--out') opts.out = rest.shift();
    else if (a === '--jobs') opts.jobs = parseInt(rest.shift(), 10);
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/export-timeline.mjs <slug-or-path> [--bundle] [--out <dir>] [--jobs N]');
    process.exit(1);
  }
  const inputs = await loadAssemblyInputs({ workdir: opts.workdir, screen: null, screenOffset: 0, force: false });
  const exportDir = opts.out ?? path.join(ASSEMBLE_MEDIA_ROOT, inputs.video, 'resolve-export');
  const segDir = path.join(exportDir, 'segments');
  fs.rmSync(exportDir, { recursive: true, force: true });
  fs.mkdirSync(segDir, { recursive: true });

  const plan = await runAssembly({
    ...inputs,
    out: path.join(exportDir, 'unused.mp4'),
    draft: false,
    encoder: detectEncoder(),
    overlayComposite: false,
    segmentsOutDir: segDir,
    jobsN: opts.jobs,
  });

  const voPath = path.join(inputs.workdir, 'vo.mp3');
  const srcUrl = (file) => {
    if (path.dirname(file) === segDir) return `./segments/${path.basename(file)}`;
    if (opts.bundle) {
      const mediaDir = path.join(exportDir, 'media');
      fs.mkdirSync(mediaDir, { recursive: true });
      const dest = path.join(mediaDir, path.basename(file));
      if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
      return `./media/${path.basename(file)}`;
    }
    return `file://${encodeURI(file)}`;
  };

  const xml = buildFcpxml({
    video: inputs.video, clips: plan.clips, overlays: plan.overlays,
    voPath, total: plan.total, w: plan.w, h: plan.h, srcUrl,
  });
  fs.writeFileSync(path.join(exportDir, 'timeline.fcpxml'), xml);
  fs.writeFileSync(path.join(exportDir, 'README.md'), README_TEXT(inputs.video));
  console.log(`exported: ${exportDir}`);
  console.log(`clips: ${plan.clips.length}, overlays: ${plan.overlays.length}, duration: ${plan.total.toFixed(1)}s`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/export-timeline.mjs').then(m => console.log(typeof m.buildFcpxml, m.frames(57.5), m.rt(10)))"` → `function 1725 1000/3000s`

### Step 5: `lib/export-timeline.test.mjs`

New file with these tests (follow assemble.test.mjs's import/style conventions):

1. `frames/rt basics` — `frames(57.5) === 1725`, `frames(0) === 0`, `rt(30) === '3000/3000s'`.
2. `buildFcpxml: gapless spine under rounding drift` — clips with rounding-hostile durations:
   ```js
   const clips = Array.from({ length: 30 }, (_, i) => ({ file: `c${i}.mp4`, id: `s${i}`, kind: 'screen', dur: 1.0333 }));
   const xml = buildFcpxml({ video: 't', clips, overlays: [], voPath: 'vo.mp3', total: 30.999, w: 1920, h: 1080, srcUrl: (f) => f });
   ```
   Extract every spine clip (regex `/<asset-clip ref="r\d+" offset="(\d+)\/3000s" duration="(\d+)\/3000s"/g` — spine clips start with `ref=`, connected ones with `lane=`), assert for consecutive clips `offset[i] + duration[i] === offset[i+1]` and the last `offset+duration === frames(30.999) * 100` (spine covers total exactly, no gaps).
3. `buildFcpxml: structure counts` — 2 clips + 3 overlays: total `<asset-clip` occurrences = 2 + 3 + 1 (vo); exactly 3 with `lane="1"`, exactly 1 with `lane="-1"`; `<asset ` count = 2 + 3 + 1; overlay offsets equal `frames(o.start) * 100`.
4. `buildFcpxml: XML escaping` — a clip file/id containing `&` and `"` produces no raw `&` (assert `!/&(?!amp;|lt;|gt;|quot;)/.test(xml)`).
5. `Integration: export mode` (skip when ffmpeg missing, same skip guard as line ~377) — copy the media-fixture setup from `test('Integration: ffmpeg runAssembly', ...)` verbatim (same lavfi screen/avatar/vo/graphics/overlay recipe, `.test-tmp/export-it/`), then call `runAssembly` with the same args PLUS `overlayComposite: false, segmentsOutDir: path.join(testTmp, 'segments')`, and assert:
   - returned `plan.clips.length >= 3`, every `plan.clips[i].file` exists and ends `.mp4`;
   - `plan.overlays.length` equals the fixture's overlay count;
   - no `final` output nor `assembly.md` was written by this call (export mode skips both — compare `assembly.md` mtime/absence in the export fixture dir);
   - `buildFcpxml` over the returned plan yields a spine whose summed duration = `frames(total) * 100` (reuse the regex from test 2);
   - one exported segment ffprobes to `h264` video (`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 <file>` → `h264`).

Append `lib/export-timeline.test.mjs` to the `node --test` list in `scripts/check.sh` (single line, keep the existing one-line format).

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 including the new file.

### Step 6: Step wrapper + step README

`steps/095-resolve-export-run/run.sh` (chmod +x):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
exec node lib/export-timeline.mjs "$@"
```

`steps/095-resolve-export-run/README.md`:

```markdown
# 095 — Resolve timeline export

Turns an assembled video into a DaVinci-Resolve/Premiere-importable timeline
for human touch-up: `timeline.fcpxml` + full-res segment clips (overlay-free
V1 base cut; overlays ride lane 1 as separate movable clips; vo on lane -1).
Enforces the same gates as step 090 (approvals, downloads, media present) and
shares `assembly-cache/`.

    bash steps/095-resolve-export-run/run.sh <slug> [--bundle] [--jobs N]

Out: `~/kb-scratch/video/visuals-flow/<slug>/resolve-export/`
(`timeline.fcpxml`, `segments/`, `README.md`; `--bundle` adds `media/` with
vo.mp3 + overlay movs copied in for a portable handoff).
```

**Verify**: `bash pipelines/video/visuals-flow/steps/095-resolve-export-run/run.sh 2>&1 | head -1` → the usage line (exit 1 is expected with no args).

### Step 7: Docs + skill verb

1. `PIPELINE.md` — in `## The flow (run top to bottom)`, add after the `090-assemble-run` row:
   ```
   | `095-resolve-export-run` | [RUN] | same inputs as 090 → `resolve-export/` in kb-scratch (`timeline.fcpxml` + segment clips) for human touch-up in DaVinci Resolve / Premiere |
   ```
2. `HANDOFF.md` — in the `## How to run (quick reference)` fenced block, add after the 090 line:
   ```
   bash steps/095-resolve-export-run/run.sh <slug> [--bundle]   # -> kb-scratch resolve-export/ (timeline.fcpxml for DaVinci/Premiere touch-up)
   ```
3. `pipelines/.claude/skills/visuals-flow/SKILL.md` — add this section verbatim, right after the `## Verb: "assemble the video" / "build the final video"` section:
   ```markdown
   ## Verb: "export the timeline" / "open it in resolve"

   1. Same gates as assembly (the exporter enforces them itself: cues approved +
      rendered, shots approved with clips downloaded, screen.mp4 present).
   2. `bash steps/095-resolve-export-run/run.sh <slug> [--bundle]` — full-res
      segment encodes (shares assembly-cache/ with the ship render, so a prior
      ship render makes this mostly cache hits), overlay-free base clips, writes
      `~/kb-scratch/video/visuals-flow/<slug>/resolve-export/` (timeline.fcpxml
      + segments/ + README.md; `--bundle` adds media/ with vo + overlay movs for
      a portable editor handoff).
   3. Tell the owner: DaVinci Resolve → File → Import → Timeline →
      timeline.fcpxml (Premiere: File → Import). V1 = base cut, lane 1 = overlay
      graphics (each movable/deletable), lane -1 = VO. Effects (flash / drift /
      captions / punch-ins) are baked INTO the clips — effect tweaks stay
      `effects.json` + re-assemble, never Resolve.
   ```

**Verify**: `rtk proxy grep -c "095-resolve-export-run" pipelines/video/visuals-flow/PIPELINE.md pipelines/video/visuals-flow/HANDOFF.md pipelines/.claude/skills/visuals-flow/SKILL.md` → each file ≥ 1.

## Test plan

Covered in Steps 5 (unit + lavfi integration, wired into check.sh). No tests against `videos/test-01/` real media — its renders/screen/vo are gitignored and absent from executor worktrees.

## Done criteria

- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0, including `export-timeline.test.mjs` (visible in the tap output).
- [ ] `git diff --stat` touches only in-scope files.
- [ ] `grep -c "export-timeline.test.mjs" pipelines/video/visuals-flow/scripts/check.sh` → 1.
- [ ] `grep -c "095-resolve-export-run" pipelines/video/visuals-flow/PIPELINE.md` → ≥1; same for `HANDOFF.md` and `pipelines/.claude/skills/visuals-flow/SKILL.md`.
- [ ] `test -x pipelines/video/visuals-flow/steps/095-resolve-export-run/run.sh` → exit 0.
- [ ] `plans/README.md` row 109 flipped to DONE.

## STOP conditions

- Baseline `check.sh` is red BEFORE any change (no pre-existing failure is expected at `e885de7`).
- Any existing `assemble.test.mjs` test fails after Step 2 or 3 and survives 2 fix attempts — the refactor/extension must be behavior-preserving; report instead of reworking test expectations.
- The drift check shows structural changes to `runAssembly`'s job loop or `main()`'s gate block.
- Anything requires touching an out-of-scope file.
- Do NOT run the exporter against `videos/test-01` (media absent in worktrees); the lavfi integration test is the proof.

## Maintenance notes

- **Owner's first-use verify (post-merge, not the executor's job)**: run `bash steps/095-resolve-export-run/run.sh test-01` on the main checkout (media present), import `timeline.fcpxml` into DaVinci Resolve, confirm: plays identical to final.mp4, overlays sit on their own lane, VO aligned. Any importer quirk (e.g. Resolve rejecting `duration` on `<asset>`) is a one-line generator fix — file it as board/chat feedback.
- The exporter's segment encodes use different ffmpeg args than the ship render for overlay-intersecting segments only (empty overlay list) — those get separate `assembly-cache/` entries; all other segments share cache with the ship render.
- Future reverse timeline-diff (deferred): Resolve exports the edited timeline back to FCPXML/EDL; diff against `plan.clips` to produce fold items. Design anchor: this plan's `buildFcpxml` clip ids are the join key.
- If `absorbSlivers`/effect `transformSegments` semantics change, `timelineClips` inherits it automatically (collected inside the job loop) — no exporter change needed.
