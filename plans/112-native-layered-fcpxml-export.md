---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: false
deploy:
needs: ["land 111 before dispatch — consumes renders-fx/manifest.json and shares check.sh"]
---

# Plan 112: Native layered FCPXML export — the editor-native default mode

## Summary

- **Problem statement**: The current export bakes effects into segment encodes — nothing on the Resolve timeline is a native object. Owner decision 2026-07-21 (spec `docs/specs/2026-07-21-native-editor-export-design.md`): the default editing export becomes a layered native project — continuous screen on the spine, avatar/graphics/overlays/FX each on their own lane, captions as SRT, markers for dropped effects.
- **Goals**:
  - `lib/export-timeline.mjs <slug>` default mode = **native** (no segment encoding, near-instant): spine `screen.mp4`, lane -1 `vo.mp3`, lane 1 avatar spans, lane 2 fullframe graphics, lane 3 overlay graphics, lane 4 FX clips (plan 111), timeline markers for each dropped effect, sidecar `captions.srt`.
  - `--baked` preserves the plan-109 behavior (WYSIWYG ship-check).
  - Auto-runs `render-fx` so one command produces the whole editor package.
- **Executor proposed**: `agy` (fully-inlined, default routing per `tooling/boss/data/rules.md`)
- **Done criteria** (terse): check.sh green incl. new native-generator + SRT tests; existing baked-mode tests untouched and passing; docs/skill verb updated (grep checks).
- **Stop conditions** (terse): baseline red; any change needed in `lib/assemble.mjs`; scope breach.
- **Test / verification for success**: unit tests over the native FCPXML generator (structure/lane/marker counts, offsets) + SRT emitter; owner acceptance = import into Resolve (post-merge, media present).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 090dcb8..HEAD -- pipelines/video/visuals-flow/lib/export-timeline.mjs pipelines/video/visuals-flow/lib/export-timeline.test.mjs pipelines/video/visuals-flow/scripts/check.sh pipelines/.claude/skills/visuals-flow/SKILL.md pipelines/video/visuals-flow/HANDOFF.md pipelines/video/visuals-flow/PIPELINE.md pipelines/video/visuals-flow/steps/095-resolve-export-run`
> Plan 111's check.sh line and a `lib/render-fx.mjs` addition WILL show — expected. If `export-timeline.mjs` changed beyond commit `090dcb8`'s shape (buildFcpxml/srcUrl/parseArgs/main as quoted below), re-read it and adapt; if `buildFcpxml` was removed → STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (reworks the exporter CLI; baked path must stay regression-green)
- **Depends on**: 111 (manifest contract; merge order)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `090dcb8`, 2026-07-21

## Why this matters

First hands-on Resolve session (2026-07-21): the owner wants the timeline to look like an editor built it — every avatar span, graphic, overlay, and effect its own copyable/movable/deletable object, the screen recording continuous underneath. This mode delivers that with FCPXML mechanics that are all already proven on this exact Resolve install (absolute-path media linking, lane/connected clips, markers). It also skips ALL segment encoding — export goes from minutes to instant. Phase 2 (native .drp authoring, GFX-19) later swaps the container; the data layer built here carries over.

## Current state

All paths relative to `pipelines/video/visuals-flow/` unless noted. `lib/export-timeline.mjs` at `090dcb8` (read it first — plan 111 does not touch it):

- Exports `frames(sec)`, `rt(fr)`, module-level `xmlEsc`, `buildFcpxml({video, clips, overlays, voPath, total, w, h, srcUrl})` (the baked generator — keep verbatim), `README_TEXT`, `parseArgs` (flags: `--bundle`, `--out`, `--jobs`, `--force`), and `main()` which calls `loadAssemblyInputs` (gates + inputs: `{workdir, video, resolved, avatarJobs, cornerJobs, words, total, screen}`) then `runAssembly(... overlayComposite:false, segmentsOutDir ...)`.
- `loadAssemblyInputs` (in `lib/assemble.mjs`) enforces all approval gates incl. effects.json; honors `force`.
- Media facts: `resolved` cues carry `placement` (`fullframe`|`overlay`), `start`, `duration`; render file = `planRender(cue).outFile` under `videos/<slug>/renders/` (import `planRender`, `mmss` from `./render.mjs`). `avatarJobs` entries: `{id, start, end, file}` — files are span-length (start at source 0). `words` = transcript array for `planCaptions` (`./captions.mjs`, returns `[{i, text, words, start, end}]`).
- Plan 111 provides `videos/<slug>/renders-fx/manifest.json`: `{video, rendered:[{id, type, at, timelineStart, duration, file}], dropped:[{id, type, at, reason}]}` and `lib/render-fx.mjs <slug>` CLI (regenerates the whole dir).
- FCPXML mechanics proven this week on the owner's Resolve 21.0.2-free: absolute `file://` src URLs auto-link; connected clips (`lane` attr) import to their own tracks; ProRes 4444 alpha overlays composite correctly.
- `scripts/check.sh` — explicit test list. Docs surfaces: SKILL verb (`pipelines/.claude/skills/visuals-flow/SKILL.md`, edit the pipelines source only), `HANDOFF.md` quick-reference block, `PIPELINE.md` 095 row, `steps/095-resolve-export-run/README.md`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline + merge gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0 |
| Run exporter tests | `cd pipelines/video/visuals-flow && node --test lib/export-timeline.test.mjs` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/export-timeline.mjs`
- `pipelines/video/visuals-flow/lib/export-timeline.test.mjs`
- `pipelines/video/visuals-flow/steps/095-resolve-export-run/README.md`
- `pipelines/.claude/skills/visuals-flow/SKILL.md` (export verb section)
- `pipelines/video/visuals-flow/HANDOFF.md` (quick-ref line), `PIPELINE.md` (095 row)
- `plans/README.md` (status row at the end)

**Out of scope**:
- `lib/assemble.mjs`, `lib/render-fx.mjs`, all effect modules — consumed read-only.
- FCPXML keyframed transforms / Ken Burns in-editor (spec: dropped, markers instead).
- FCPXML `<caption>` embedding (SRT sidecar is the contract; embedding may be explored later).
- Reverse timeline-diff (still deferred).

## Git workflow

- Branch: `advisor/112-native-layered-fcpxml-export`
- Commit per step, single-line conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: Baseline

`bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0, else STOP.

### Step 2: Native generator + SRT emitter in `lib/export-timeline.mjs`

Add (exported, next to `buildFcpxml` — which stays untouched):

```js
export function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(mm, 3)}`;
}

export function srtFromCaptions(chunks) {
  return chunks.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n') + '\n';
}

// Native layered project: ONE continuous screen clip on the spine; everything
// else is a connected clip on its own lane; markers record dropped effects.
// avatarClips/fullframes/overlayClips/fxClips: [{ id, offsetSec, durationSec, file }]
export function buildNativeFcpxml({ video, screenPath, voPath, total, w, h, avatarClips, fullframes, overlayClips, fxClips, markers, srcUrl }) {
  const totalF = frames(total);
  const assets = [];
  let nextId = 2;
  const assetFor = (file, { audio = false, durF }) => {
    const id = `r${nextId++}`;
    assets.push(`    <asset id="${id}" name="${xmlEsc(path.basename(file))}" start="0s" duration="${rt(durF)}" hasVideo="${audio ? '0' : '1'}" hasAudio="${audio ? '1' : '0'}" src="${xmlEsc(srcUrl(file))}"/>`);
    return id;
  };

  const screenRef = assetFor(screenPath, { durF: totalF });
  const voRef = assetFor(voPath, { audio: true, durF: totalF });

  const lane = (items, laneNo) => items.map((c) => {
    const durF = Math.max(1, frames(c.offsetSec + c.durationSec) - frames(c.offsetSec));
    const ref = assetFor(c.file, { durF });
    return `        <asset-clip lane="${laneNo}" ref="${ref}" offset="${rt(frames(c.offsetSec))}" duration="${rt(durF)}" start="0s" name="${xmlEsc(c.id)}"/>`;
  });

  const children = [
    `        <asset-clip lane="-1" ref="${voRef}" offset="${rt(0)}" duration="${rt(totalF)}" start="0s" name="vo"/>`,
    ...lane(avatarClips, 1),
    ...lane(fullframes, 2),
    ...lane(overlayClips, 3),
    ...lane(fxClips, 4),
    ...markers.filter((m) => typeof m.at === 'number').map((m) =>
      `        <marker start="${rt(frames(m.at))}" duration="100/3000s" value="${xmlEsc(m.note)}"/>`),
  ].join('\n');

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
            <asset-clip ref="${screenRef}" offset="${rt(0)}" duration="${rt(totalF)}" start="0s" name="screen">
${children}
            </asset-clip>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/export-timeline.mjs').then(m => console.log(m.srtTime(62.5), m.srtFromCaptions([{start:0,end:1.2,text:'hi'}]).includes('00:00:01,200')))"` → `00:01:02,500 true`

### Step 3: CLI rework in `main()`

1. `parseArgs`: add `--baked` (boolean, default false). Usage line becomes `... <slug-or-path> [--baked] [--bundle] [--out <dir>] [--jobs N] [--force]`.
2. `main()` keeps the shared prologue (`loadAssemblyInputs`, exportDir/segDir setup only for baked). Then:
   - **baked branch** (`opts.baked`): EXACTLY today's behavior (runAssembly export mode → `buildFcpxml` → same outputs). Do not change its output filenames.
   - **native branch** (default):
     ```js
     const rfx = spawnSync(process.execPath, [path.join(import.meta.dirname, 'render-fx.mjs'), opts.workdir], { encoding: 'utf8', stdio: 'inherit' });
     if (rfx.status !== 0) process.exit(1);
     const fxManifest = JSON.parse(fs.readFileSync(path.join(inputs.workdir, 'renders-fx', 'manifest.json'), 'utf8'));
     const renderDir = path.join(inputs.workdir, 'renders');
     const cueClip = (c) => ({ id: c.id, offsetSec: c.start, durationSec: c.duration, file: path.join(renderDir, planRender(c).outFile) });
     const fullframes = inputs.resolved.filter((c) => c.placement === 'fullframe').map(cueClip);
     const overlayClips = inputs.resolved.filter((c) => c.placement === 'overlay').map(cueClip);
     const avatarClips = inputs.avatarJobs.map((j) => ({ id: j.id, offsetSec: j.start, durationSec: +(j.end - j.start).toFixed(3), file: j.file }));
     const fxClips = fxManifest.rendered.map((r) => ({ id: r.id, offsetSec: r.timelineStart, durationSec: r.duration, file: r.file }));
     const markers = fxManifest.dropped.map((d) => ({ at: d.at, note: `${d.type}: ${d.reason}` }));
     const xml = buildNativeFcpxml({ video: inputs.video, screenPath: inputs.screen, voPath, total: inputs.total, w: 1920, h: 1080, avatarClips, fullframes, overlayClips, fxClips, markers, srcUrl });
     fs.writeFileSync(path.join(exportDir, 'timeline.fcpxml'), xml);
     fs.writeFileSync(path.join(exportDir, 'captions.srt'), srtFromCaptions(planCaptions(inputs.words)));
     fs.writeFileSync(path.join(exportDir, 'README.md'), NATIVE_README(inputs.video));
     console.log(`exported (native): ${exportDir}`);
     console.log(`avatar: ${avatarClips.length}, graphics: ${fullframes.length}, overlays: ${overlayClips.length}, fx: ${fxClips.length}, markers: ${markers.length}, captions: sidecar SRT`);
     ```
     Imports to add: `planRender` from `./render.mjs`, `planCaptions` from `./captions.mjs`. `srcUrl` = the existing one (absolute `file://` default; `--bundle` copies any referenced file into `exportDir/media/` and returns `./media/<basename>` — in native mode there is no `segments/` special-case, so simplify the bundle branch to the copy-all path).
3. `NATIVE_README(video)` — add verbatim:
   ```js
   const NATIVE_README = (video) => `# ${video} — native editor project (layered)

   Import: DaVinci Resolve -> File -> Import -> Timeline -> timeline.fcpxml.
   Then captions: File -> Import -> Subtitle -> captions.srt (drops onto a
   subtitle track; style it once in Inspector -> Track).

   Layout: spine = the screen recording, continuous. Lane -1 = voiceover.
   Lane 1 = avatar spans. Lane 2 = fullframe graphics. Lane 3 = overlay
   graphics. Lane 4 = FX clips (flash-wipes, beat flashes) — every one is a
   normal clip: copy it to another cut, slide it, delete it.

   Markers on the screen clip = effects the pipeline dropped from the editor
   version (punch-ins, Ken Burns, blur-whips) with a note saying what to use
   natively (Dynamic Zoom / a stock transition) if you want them.

   Tips:
   - FX clips composite in Normal mode; for an exact match to the shipped
     look, set Composite Mode -> Screen on them (Inspector -> Settings).
   - The voiceover is the master clock — duration-changing edits desync
     everything after the edit point.
   - Re-exporting overwrites this folder; do editor work on a duplicated
     Resolve project if you need to keep it.
   `;
   ```

**Verify**: `bash pipelines/video/visuals-flow/steps/095-resolve-export-run/run.sh 2>&1 | head -1` → usage line mentioning `[--baked]`.

### Step 4: Tests

Extend `lib/export-timeline.test.mjs` (existing baked tests stay untouched):

1. `srtTime(0) === '00:00:00,000'`, `srtTime(3661.042) === '01:01:01,042'`; `srtFromCaptions` renders index/arrow/blank-line framing for 2 chunks.
2. `buildNativeFcpxml` with a synthetic fixture (2 avatar, 2 fullframes, 1 overlay, 2 fx, 2 markers, one marker with `at: null` which must be EXCLUDED):
   - exactly 1 spine clip (regex `<asset-clip ref=` occurrences with no `lane=`) and it spans `frames(total)*100`;
   - lane counts: 2 clips `lane="1"`, 2 `lane="2"`, 1 `lane="3"`, 2 `lane="4"`, 1 `lane="-1"`;
   - `<marker` count === 1 valid marker? No — 2 markers minus the null-at one → exactly 1; its `start` equals `frames(at)*100`;
   - `<asset ` count = 1 screen + 1 vo + 7 clips = 9;
   - every `offset` of a lane clip equals `frames(offsetSec)*100`.
3. XML escaping: an fx id containing `&` survives (no raw `&`).

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 (baked tests + new native tests).

### Step 5: Docs + skill verb

1. `pipelines/.claude/skills/visuals-flow/SKILL.md` — REPLACE the body of the `## Verb: "export the timeline" / "open it in resolve"` section with:
   ```markdown
   1. Same gates as assembly (exporter enforces them; `--force` bypasses —
      owner-said-so only, same rule as the render verb).
   2. `bash steps/095-resolve-export-run/run.sh <slug> [--baked] [--bundle] [--force]`
      — DEFAULT is the NATIVE layered project (near-instant, no encoding):
      continuous screen on the spine, avatar/graphics/overlays/FX clips each on
      their own lane (every effect a copyable clip), markers for dropped
      transform-effects, sidecar captions.srt. `--baked` = the WYSIWYG
      pre-encoded variant (plays exactly like final.mp4; for ship checks).
      Output: `~/kb-scratch/video/visuals-flow/<slug>/resolve-export/`.
   3. Tell the owner: Resolve → File → Import → Timeline → timeline.fcpxml,
      then File → Import → Subtitle → captions.srt. Effect LOOK tweaks stay
      effects.json + re-export; structural edits are native drags now.
   ```
2. `HANDOFF.md` quick-ref: update the 095 line to `bash steps/095-resolve-export-run/run.sh <slug> [--baked] [--bundle]   # -> native layered editor project (default) or baked WYSIWYG (--baked)`.
3. `PIPELINE.md` 095 row: append `; default = native layered project (spec docs/specs/2026-07-21-native-editor-export-design.md), --baked = pre-encoded WYSIWYG` to the row text.
4. `steps/095-resolve-export-run/README.md`: rewrite to describe both modes (mirror the SKILL verb content; keep the command block).

**Verify**: `rtk proxy grep -c "baked" pipelines/.claude/skills/visuals-flow/SKILL.md pipelines/video/visuals-flow/HANDOFF.md pipelines/video/visuals-flow/PIPELINE.md pipelines/video/visuals-flow/steps/095-resolve-export-run/README.md` → each ≥ 1.

## Test plan

Step 4. No repo media touched; all generator-level. Owner acceptance (post-merge, main checkout): `bash steps/095-resolve-export-run/run.sh test-01 --force` → import timeline.fcpxml + captions.srt into Resolve → native lanes visible, FX clips at cuts, markers present.

## Done criteria

- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0 (existing baked tests + new native tests).
- [ ] Usage line shows `--baked`; native is default (code inspection: `opts.baked` guards the runAssembly path).
- [ ] Doc greps above ≥ 1 each.
- [ ] `git diff --stat` touches only in-scope files.
- [ ] `plans/README.md` row 112 flipped to DONE.

## STOP conditions

- Baseline red before changes.
- Anything requires editing `lib/assemble.mjs` or `lib/render-fx.mjs`.
- `buildFcpxml`/baked outputs would need behavior changes (they must stay byte-compatible for the baked mode).
- Do NOT run the exporter against real media in the worktree (absent); generator tests are the proof.

## Maintenance notes

- Phase 2 (GFX-19, deferred): swaps this FCPXML container for native .drp authoring (vendored drp-format lib) once its two blob problems are solved — `avatarClips/fullframes/overlayClips/fxClips/markers` computed here are exactly the data Phase 2 consumes; keep that assembly-side of `main()` container-agnostic.
- If Resolve import of connected-clip-heavy FCPXML shows lane-order quirks on a real video, lane numbers are the only knob — they live in one place (`buildNativeFcpxml`).
- Captions: per-word orange highlight intentionally absent in the editor route (SRT limitation); the ship path keeps it. If the owner wants styled editor captions, that's the Phase 2 Text+ upgrade.
