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
