import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadAssemblyInputs, runAssembly, ASSEMBLE_MEDIA_ROOT, detectEncoder, planPanelGeometry, planSideGeometry, planSegments, absorbSlivers, probeSrcAspect } from './assemble.mjs';
import { planRender } from './render.mjs';
import { planCaptions, formatAssText } from './captions.mjs';
import * as captionsMod from './effects/captions.mjs';
import { SHOT_CONSTANTS } from './shot-constants.mjs';
import { readFinalCut } from './final-cut.mjs';
import { VO_CHAIN, sfxInstanceChain } from './sound/build-mix.mjs';
import { loadBrand } from './brand-inline.mjs';

const FPS = 30;
export const frames = (sec) => Math.round(sec * FPS);
export const rt = (fr) => `${fr * 100}/3000s`;

const xmlEsc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Builds the `src` value written into every <asset>. FCPXML's src is a URL,
// NOT a filesystem path — and DaVinci Resolve will not resolve a relative one.
// `--bundle` used to emit "./media/clip.mp4", which looks right, imports
// without an error, and leaves every single clip offline: the import reports
// "97 of 97 clips were not yet found" (measured on best-ai-video-generator,
// 2026-08-02 — the first bundled export ever run). The non-bundled branch was
// always correct, which is why nothing caught it.
//
// Bundling and absolute URLs are not in tension. Copy the media in so the
// folder is self-contained, AND point each asset at the absolute file:// URL
// of its copy inside that folder. Move the folder later and Resolve's relink
// still works by basename — a broken URL and a moved folder are not the same
// failure, and only one of them is ours to prevent.
//
export function makeSrcUrl({ exportDir, bundle }) {
  if (!bundle) return (file) => pathToFileURL(file).href;
  const root = path.resolve(exportDir);
  const mediaDir = path.join(root, 'media');
  const takenBy = new Map();
  // Anything the exporter itself wrote inside the export folder — baked
  // segments, baked SFX, the processed VO — is already self-contained where it
  // lies. Copying it into media/ would only duplicate it, and vo-processed.wav
  // alone is ~370 MB on a 32-minute video.
  const isInside = (f) => !path.relative(root, path.resolve(f)).startsWith('..');
  return (file) => {
    if (isInside(file)) return pathToFileURL(file).href;
    const base = path.basename(file);
    const prior = takenBy.get(base);
    // Flattening many source dirs into one media/ can collide. The old code
    // skipped the copy when the name existed and handed BOTH assets the first
    // file's bytes — a silently wrong timeline. Refuse instead.
    if (prior !== undefined && prior !== file) {
      throw new Error(`bundle name collision: "${base}" is both ${prior} and ${file} — two different sources cannot share one bundled name`);
    }
    takenBy.set(base, file);
    fs.mkdirSync(mediaDir, { recursive: true });
    const dest = path.join(mediaDir, base);
    if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
    return pathToFileURL(dest).href;
  };
}

export function ffprobeDuration(file) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat((p.stdout || '').trim());
  if (!Number.isFinite(d)) throw new Error(`cannot read duration of ${file}: ${p.stderr || 'no output'}`);
  return +d.toFixed(3);
}

// One file per DISTINCT (sample, semi, gain, loop-length). 108 instances on
// best-ai-video-generator collapse to 17 files.
export function sfxBakeName(inst) {
  const len = inst.loop && inst.end ? `-l${(inst.end - inst.at).toFixed(3)}` : '';
  return `sfx-${inst.sample}-s${inst.semi}-g${inst.gainDb}${len}.wav`.replace(/[^A-Za-z0-9_.-]/g, '_');
}

// Bakes each SFX instance through the SAME chain build-mix uses, so the Resolve
// project carries the mix rather than 108 raw samples at unity gain.
//
// Three things were being dropped, and they compound:
//   gainDb  — every instance played 14-30 dB hot
//   semi    — 26 of 108 instances are pitch-shifted
//   loop    — drone_low.wav is 8s of media behind an 86.7s clip; the mix fills
//             that with `-stream_loop -1`, and a raw reference simply cannot.
// Duration comes from the baked file, not a guess: the old code hardcoded 2.0s
// for every non-loop clip against samples that run 0.05s to 0.886s.
export function bakeSfxClips({ instances, outDir, sfxAssetDir, run = spawnSync, probe = ffprobeDuration }) {
  if (!instances.length) return [];
  fs.mkdirSync(outDir, { recursive: true });
  const built = new Map();
  return instances.map((inst) => {
    const name = sfxBakeName(inst);
    if (!built.has(name)) {
      const dest = path.join(outDir, name);
      if (!fs.existsSync(dest)) {
        const args = ['-y', '-hide_banner', '-loglevel', 'error'];
        if (inst.loop) args.push('-stream_loop', '-1');
        args.push('-i', path.join(sfxAssetDir, `${inst.sample}.wav`),
          '-af', sfxInstanceChain(inst, { delay: false }).join(','),
          '-ar', '48000', '-ac', '2', dest);
        const r = run('ffmpeg', args, { encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`sfx bake failed for ${name}: ${r.stderr || ''}`);
      }
      built.set(name, { file: dest, dur: probe(dest) });
    }
    const b = built.get(name);
    return { id: inst.sample, offsetSec: inst.at, durationSec: b.dur, file: b.file };
  });
}

// The voiceover lane shipped as a raw vo.mp3 — no highpass, no compressor, no
// limiter — so it sat noticeably below the level it has in final.mp4.
export function bakeVo({ voPath, outDir, run = spawnSync }) {
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, 'vo-processed.wav');
  if (!fs.existsSync(dest)) {
    const r = run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', voPath,
      '-af', VO_CHAIN, '-ar', '48000', '-ac', '2', dest], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`vo bake failed: ${r.stderr || ''}`);
  }
  return dest;
}

export function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(mm, 3)}`;
}

// A subtitle clip in Resolve is anchored to its FIRST cue and lands wherever
// you drop it — the leading gap is discarded, not preserved. So an SRT whose
// first cue is at 25.61s, dropped at 00:00:00, plays every caption 25.61s
// early. The old unfiltered SRT had the same bug and hid it: its first cue was
// at 0.4s, so the whole track was silently 0.4s out. Suppressing the intro
// captions turned that into a visible 25s slip (owner, 2026-08-02).
//
// A zero-duration-looking anchor at 00:00:00 makes the clip start at zero, so
// every real cue lands on its true timecode no matter where it is dropped.
// U+200B renders as nothing; a plain space risks being trimmed to an empty cue.
const SRT_ANCHOR_TEXT = '​';
export function srtFromCaptions(chunks) {
  const all = chunks.length > 0 && chunks[0].start > 0
    ? [{ start: 0, end: Math.min(1 / 30, chunks[0].start), text: SRT_ANCHOR_TEXT }, ...chunks]
    : chunks;
  return all.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n') + '\n';
}

// Captions are burned ONLY over the screen recording — assemble.mjs skips any
// segment whose kind is not 'screen', so a fullframe card or a full-screen
// avatar covers the frame caption-free and the card's own typography carries
// the moment.
//
// The sidecar SRT ignored that and shipped every chunk, so in Resolve captions
// appeared on top of the intro motion graphics where the shipped video has
// none (owner, 2026-08-02). Same shape as the SFX bug: a rule enforced on one
// surface and silently not on the next. Segments come from the same planner
// assemble uses rather than being re-derived here.
// A chunk that straddles a boundary is CLIPPED, not dropped and not passed
// through whole: assemble renders each screen segment separately and lets the
// segment's own end cut the caption off, so a chunk spanning card->screen only
// ever shows for its screen half. An SRT has one time range per entry, so the
// clip has to be done here or that chunk reappears over the card.
const CAP_MIN_SEC = 1 / 30;
export function assTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// SRT carries words and timecodes and NOTHING else — no font, no size, no
// position, and no per-word colour. So an imported SRT lands in Resolve's own
// default style: oversized, all white, no orange keywords (owner, 2026-08-02:
// "no keywords highlighted coloured, all white and text size big").
//
// This writes the same ASS the burn uses, as one whole-timeline file: identical
// style line, and formatAssText's per-word {\1c} keyword colour. If the editor
// can read it, the captions match the video exactly instead of approximately.
// Style values are mirrored from assemble.mjs's caption block; the numbers are
// derived here the same way rather than restated as literals.
export function assFromCaptions({ chunks, w = 1920, h = 1080, fontPx = captionsMod.CONSTANTS.CAP_FONT_PX, yFrac = captionsMod.CONSTANTS.CAP_Y_FRAC, keywordColor = '#fb923c' } = {}) {
  const capFontPx = Math.round(fontPx * h / 1080);
  const outline = Math.max(2, Math.floor(capFontPx / 16));
  const marginV = h - Math.round(h * yFrac);
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Helvetica,${capFontPx},&H00FFFFFF,&H00000000,&H00000000,1,${outline},0,2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const body = chunks.map((c) =>
    `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Cap,,0,0,0,,${formatAssText(c.words, keywordColor)}`).join('\n');
  return head + body + '\n';
}

export function screenCaptionChunks({ words, resolved, avatarJobs, total }) {
  const screen = absorbSlivers(planSegments({ resolved, avatarJobs, total })).filter((s) => s.kind === 'screen');
  const out = [];
  for (const c of planCaptions(words)) {
    for (const s of screen) {
      const start = Math.max(c.start, s.start);
      const end = Math.min(c.end, s.end);
      // sub-frame slivers are a flash in an NLE, not a caption
      if (end - start >= CAP_MIN_SEC) out.push({ ...c, start: +start.toFixed(3), end: +end.toFixed(3) });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// Native layered project: ONE continuous screen clip on the spine; everything
// else is a connected clip on its own lane; markers record dropped effects.
// avatarClips/fullframes/overlayClips/fxClips/sfxClips: [{ id, offsetSec, durationSec, file }]
export function buildNativeFcpxml({ video, screenPath, voPath, musicPath, total, w, h, avatarClips, fullframes, overlayClips, fxClips, sfxClips, markers, srcUrl, filmSpan, workdir }) {
  const totalF = frames(total);
  const assets = [];
  let nextId = 2;
  const assetIdByFile = new Map();
  const assetFor = (file, { audio = false, durF }) => {
    if (assetIdByFile.has(file)) return assetIdByFile.get(file);
    const id = `r${nextId++}`;
    assets.push(`    <asset id="${id}" name="${xmlEsc(path.basename(file))}" start="0s" duration="${rt(durF)}" hasVideo="${audio ? '0' : '1'}" hasAudio="${audio ? '1' : '0'}" src="${xmlEsc(srcUrl(file))}"/>`);
    assetIdByFile.set(file, id);
    return id;
  };

  const screenRef = assetFor(screenPath, { durF: totalF });
  const voRef = assetFor(voPath, { audio: true, durF: totalF });
  
  let musicRef;
  if (musicPath) {
    musicRef = assetFor(musicPath, { audio: true, durF: totalF });
  }

  const lane = (items, laneNo, isAudio) => items.map((c) => {
    const durF = Math.max(1, frames(c.offsetSec + c.durationSec) - frames(c.offsetSec));
    const ref = assetFor(c.file, { audio: isAudio, durF });
    if (c.isPanel) {
      const g = planPanelGeometry({ canvas: { w, h }, constants: SHOT_CONSTANTS, srcAspect: probeSrcAspect(c.file) });
      const px = g.x + g.w / 2 - w / 2;
      const py = h / 2 - (g.y + g.h / 2);
      const s = g.w / w;
      return `        <asset-clip lane="${laneNo}" ref="${ref}" offset="${rt(frames(c.offsetSec))}" duration="${rt(durF)}" start="0s" name="${xmlEsc(c.id)}">
          <adjust-transform position="${px} ${py}" scale="${s} ${s}"/>
        </asset-clip>`;
    }
    if (c.isSide) {
      const g = planSideGeometry({ canvas: { w, h }, constants: SHOT_CONSTANTS, srcAspect: probeSrcAspect(c.file) });
      const px = g.x + g.cropW / 2 - w / 2;
      const py = h / 2 - (g.y + g.cropH / 2);
      const s = g.scaleW / w;
      const srcCropL = g.cropX / s;
      const srcCropR = (g.scaleW - g.cropW - g.cropX) / s;
      const srcCropT = g.cropY / s;
      const srcCropB = (g.scaleH - g.cropH - g.cropY) / s;
      return `        <video lane="${laneNo}" ref="${ref}" offset="${rt(frames(c.offsetSec))}" duration="${rt(durF)}" start="0s" name="${xmlEsc(c.id)}">
          <adjust-crop mode="trim" left="${srcCropL}" right="${srcCropR}" top="${srcCropT}" bottom="${srcCropB}"/>
          <adjust-transform position="${px} ${py}" scale="${s} ${s}"/>
        </video>`;
    }
    return `        <asset-clip lane="${laneNo}" ref="${ref}" offset="${rt(frames(c.offsetSec))}" duration="${rt(durF)}" start="0s" name="${xmlEsc(c.id)}"/>`;
  });

  const children = [
    `        <asset-clip lane="-1" ref="${voRef}" offset="${rt(0)}" duration="${rt(totalF)}" start="0s" name="vo"/>`,
    ...(musicPath ? [`        <asset-clip lane="-2" ref="${musicRef}" offset="${rt(0)}" duration="${rt(totalF)}" start="0s" name="music"/>`] : []),
    ...lane(sfxClips || [], -3, true),
    ...lane(avatarClips, 1, false),
    ...lane(fullframes, 2, false),
    ...lane(overlayClips, 3, false),
    ...lane(fxClips, 4, false),
    ...markers.filter((m) => typeof m.at === 'number').map((m) =>
      `        <marker start="${rt(frames(m.at))}" duration="100/3000s" value="${xmlEsc(m.note)}"/>`),
  ].join('\n');

  let spineXml = '';
  if (filmSpan) {
    const introDurF = frames(filmSpan.end);
    const screenDurF = totalF - introDurF;
    const introPath = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
    const introRef = assetFor(introPath, { durF: introDurF });
    spineXml = `            <asset-clip ref="${introRef}" offset="${rt(0)}" duration="${rt(introDurF)}" start="0s" name="intro">
${children}
            </asset-clip>
            <asset-clip ref="${screenRef}" offset="${rt(introDurF)}" duration="${rt(screenDurF)}" start="${rt(introDurF)}" name="screen"/>`;
  } else {
    spineXml = `            <asset-clip ref="${screenRef}" offset="${rt(0)}" duration="${rt(totalF)}" start="0s" name="screen">
${children}
            </asset-clip>`;
  }

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
- Effect looks (flash, captions, punch-ins) are baked upstream. To
  change one, edit effects.json in the repo and re-export — don't rebuild here.
- The voiceover on A1 is the master clock: edits that change total duration
  desync everything after the edit point.
`;

export const NATIVE_README = (video) => `# ${video} — native editor project (layered)

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

Audio: every clip arrives PRE-MIXED, so the balance already matches
final.mp4 and you should not need to touch a fader to get there. The
voiceover on lane -1 is vo-processed.wav (highpass + compressor + limiter,
the same chain the master uses), and each SFX on lane -3 is baked at its
planned gain and pitch. Leave the clip gains alone unless you want a
different balance; they are not at unity by accident.

The one thing NOT baked is the master loudness pass (loudnorm I=-14 LUFS),
because it applies to the sum and not to any one clip. Everything is
correct relative to everything else; the whole timeline just sits lower
than final.mp4 in absolute terms (measured on best-ai-video-generator:
the sum lands near -23 LUFS against the shipped -13.5).

Do NOT close that gap with a fader. The voiceover already peaks at
-1.4 dBFS, which is exactly where the shipped master peaks — loudnorm
bought ~10 dB of average level dynamically while holding the same peak, so
a flat +10 dB would clip by about 8 dB. Put a loudness normalize (or a
compressor into a limiter) on the master bus targeting -14 LUFS instead.

Captions: captions.srt holds ONLY the stretches that are captioned in
final.mp4 — a fullframe card or a full-screen avatar plays caption-free,
and the card's own typography carries the moment. It also opens with a
33ms zero-width anchor cue at 00:00:00, because Resolve anchors a subtitle
clip to its FIRST cue and drops it wherever you release it; without the
anchor the whole track slides ~25s early.

SRT carries words and timecodes and nothing else, so Resolve styles it
with its own oversized white default. To match the burn, set the subtitle
track style (Inspector -> Track Style) to Helvetica Bold, size 44, white
with a 2px black border, no shadow, bottom-centre, bottom margin 140px
(these are CAP_FONT_PX and CAP_Y_FRAC from lib/effects/captions.mjs at
1080p — recompute if the canvas changes).

The one thing a track style cannot do is the per-word orange keyword
colour, since Resolve styles a track uniformly. captions.ass carries it
(same style, same {\\1c} runs as the burn) but Resolve's subtitle importer
REFUSES .ass — verified 2026-08-02, the file greys out in the dialog. Keep
it for ffmpeg burn-in or a player that reads it; for Resolve the choice is
white captions you can edit, or a pre-rendered caption overlay you cannot.

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
  
  if (!opts.force) {
    const fc = readFinalCut(inputs.workdir);
    if (!fc.approved) {
      console.error('refusing to build the full-resolution final: final-cut.json approved=false — review the Final Cut tab (node lib/board.mjs <slug>) or pass --force. Use --draft for a review copy.');
      process.exit(1);
    }
  }

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

    const srcUrl = makeSrcUrl({ exportDir, bundle: opts.bundle });

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

    const srcUrl = makeSrcUrl({ exportDir, bundle: opts.bundle });

    const rfx = spawnSync(process.execPath, [path.join(import.meta.dirname, 'render-fx.mjs'), opts.workdir], { encoding: 'utf8', stdio: 'inherit' });
    if (rfx.status !== 0) process.exit(1);
    const fxManifest = JSON.parse(fs.readFileSync(path.join(inputs.workdir, 'renders-fx', 'manifest.json'), 'utf8'));
    const renderDir = path.join(inputs.workdir, 'renders');
    const cueClip = (c) => ({ id: c.id, offsetSec: c.start, durationSec: c.duration, file: path.join(renderDir, planRender(c).outFile) });
    const fullframes = inputs.resolved.filter((c) => c.placement === 'fullframe').map(cueClip);
    const overlayClips = inputs.resolved.filter((c) => c.placement === 'overlay').map(cueClip);
    const avatarClips = [
      ...inputs.avatarJobs.map((j) => ({ id: j.id, offsetSec: j.start, durationSec: +(j.end - j.start).toFixed(3), file: j.file })),
      ...inputs.panelJobs.map((j) => ({ id: `panel:${j.id}`, isPanel: true, offsetSec: j.start, durationSec: +(j.end - j.start).toFixed(3), file: j.file })),
      ...(inputs.sideJobs || []).map((j) => (
        { id: `side:${j.id}`, isSide: true, offsetSec: j.start, durationSec: +(j.end - j.start).toFixed(3), file: j.file }
      ))
    ];
    const fxClips = fxManifest.rendered.map((r) => ({ id: r.id, offsetSec: r.timelineStart, durationSec: r.duration, file: r.file }));
    const markers = fxManifest.dropped.map((d) => ({ at: d.at, note: `${d.type}: ${d.reason}` }));
    
    let musicPath = null;
    const duckedPath = path.join(inputs.workdir, 'music-ducked.wav');
    if (fs.existsSync(duckedPath)) {
      musicPath = duckedPath;
    }
    
    const audioDir = path.join(exportDir, 'audio');
    let sfxClips = [];
    const soundPath = path.join(inputs.workdir, 'sound.json');
    if (fs.existsSync(soundPath)) {
      const soundData = JSON.parse(fs.readFileSync(soundPath, 'utf8'));
      if (soundData.approved && soundData.instances) {
        sfxClips = bakeSfxClips({
          instances: soundData.instances.filter((i) => i.enabled !== false),
          outDir: audioDir,
          sfxAssetDir: path.resolve(import.meta.dirname, '../assets/sfx'),
        });
      }
    }
    // The lane must carry the same processing the master does, or the levels in
    // Resolve are not the levels the owner approved.
    const voMixed = bakeVo({ voPath, outDir: audioDir });

    const xml = buildNativeFcpxml({ video: inputs.video, screenPath: inputs.screen, voPath: voMixed, musicPath, total: inputs.total, w: 1920, h: 1080, avatarClips, fullframes, overlayClips, fxClips, sfxClips, markers, srcUrl, filmSpan: inputs.filmSpan, workdir: inputs.workdir });
    fs.writeFileSync(path.join(exportDir, 'timeline.fcpxml'), xml);
    const capChunks = screenCaptionChunks({
      words: inputs.words, resolved: inputs.resolved, avatarJobs: inputs.avatarJobs, total: inputs.total,
    });
    fs.writeFileSync(path.join(exportDir, 'captions.srt'), srtFromCaptions(capChunks));
    // Styled twin of the SRT: same words, plus the font/size/position and the
    // per-word keyword colour that SRT cannot express.
    const brandObj = loadBrand(path.resolve(import.meta.dirname, '..'), { brand: inputs.brand || 'default' });
    fs.writeFileSync(path.join(exportDir, 'captions.ass'), assFromCaptions({
      chunks: capChunks, w: 1920, h: 1080, keywordColor: brandObj?.caption?.keywordColor,
    }));
    fs.writeFileSync(path.join(exportDir, 'README.md'), NATIVE_README(inputs.video));
    console.log(`exported (native): ${exportDir}`);
    console.log(`avatar: ${avatarClips.length}, graphics: ${fullframes.length}, overlays: ${overlayClips.length}, fx: ${fxClips.length}, sfx: ${sfxClips.length}, markers: ${markers.length}, captions: sidecar SRT`);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
