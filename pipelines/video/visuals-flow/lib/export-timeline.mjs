import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadAssemblyInputs, runAssembly, ASSEMBLE_MEDIA_ROOT, detectEncoder } from './assemble.mjs';
import { planRender } from './render.mjs';
import { planCaptions } from './captions.mjs';

const FPS = 30;
export const frames = (sec) => Math.round(sec * FPS);
export const rt = (fr) => `${fr * 100}/3000s`;

const xmlEsc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function parseArgs(argv) {
  const opts = { workdir: null, baked: false, bundle: false, out: null, jobs: 3, force: false };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--baked') opts.baked = true;
    else if (a === '--bundle') opts.bundle = true;
    else if (a === '--out') opts.out = rest.shift();
    else if (a === '--jobs') opts.jobs = parseInt(rest.shift(), 10);
    else if (a === '--force') opts.force = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/export-timeline.mjs <slug-or-path> [--baked] [--bundle] [--out <dir>] [--jobs N] [--force]');
    process.exit(1);
  }
  const inputs = await loadAssemblyInputs({ workdir: opts.workdir, screen: null, screenOffset: 0, force: opts.force });
  const exportDir = opts.out ?? path.join(ASSEMBLE_MEDIA_ROOT, inputs.video, 'resolve-export');
  const voPath = path.join(inputs.workdir, 'vo.mp3');

  if (opts.baked) {
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

    const srcUrl = (file) => {
      if (opts.bundle) {
        if (path.dirname(file) === segDir) return `./segments/${path.basename(file)}`;
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
  } else {
    fs.rmSync(exportDir, { recursive: true, force: true });
    fs.mkdirSync(exportDir, { recursive: true });

    const srcUrl = (file) => {
      if (opts.bundle) {
        const mediaDir = path.join(exportDir, 'media');
        fs.mkdirSync(mediaDir, { recursive: true });
        const dest = path.join(mediaDir, path.basename(file));
        if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
        return `./media/${path.basename(file)}`;
      }
      return `file://${encodeURI(file)}`;
    };

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
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
