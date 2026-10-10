// 070: map this recipe's artifacts onto the kit's edit plan and let the kit cut the video, once per format.
// Then the cut checks (dead beats, phone sheet) run on the composite and REVIEW.md is rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { workdirOf, mediaDirOf, designSystemDir, readJson, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf, formatsOf } from './run-config.mjs';
import { loadMoments } from './author-moments.mjs';
import { momentClip, OVERLAY_KEY } from './render-moments.mjs';
import { ffmpeg } from './media.mjs';
import { assembleEditPlan, validateEditPlan, registerVersion, detectEncoder } from './kit.mjs';
import { MAIN_FORMAT, FORMATS, formatCanvas, recordingBand } from './formats.mjs';
import { cutFileName } from './review-cut.mjs';

// The bed when there is no screen recording: the design system's background, one flat clip.
export function backgroundColour(designSystem) {
  const tokens = path.join(designSystemDir(designSystem), 'tokens.json');
  const c = fs.existsSync(tokens) ? readJson(tokens).background : null;
  return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000';
}

// Pure: run-config + moments + media paths -> edit plan. Takeovers are base-layer compositions;
// overlays are keyed overlay clips, so the recording keeps playing under them.
export function animateEditPlan({ cfg, moments, media, clipOf, bed, canvas = canvasOf(cfg) }) {
  return {
    total: cfg.total,
    canvas,
    audio: { src: path.join(media, cfg.source.audio) },
    clips: [
      { kind: 'footage', id: 'bed', src: bed },
      ...moments.map((m) => ((m.kind ?? 'takeover') === 'overlay'
        ? { kind: 'card', layer: 'overlay', id: m.id, start: m.start, end: m.end, src: clipOf(m.id), chroma: OVERLAY_KEY }
        : { kind: 'composition', id: m.id, start: m.start, end: m.end, src: clipOf(m.id) })),
    ],
  };
}

// ffmpeg args that put the 16:9 recording in its band of a taller frame, on the design system's background.
export function bandBedArgs(screen, format, colour, out) {
  const c = formatCanvas(format, { fps: 30 });
  const b = recordingBand(format);
  return ['-i', screen, '-an', '-vf', `scale=${b.w}:${b.h},pad=${c.w}:${c.h}:${b.x}:${b.y}:color=${colour.replace('#', '0x')}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', out];
}

function bedFor(slug, cfg, format, canvas) {
  const media = mediaDirOf(slug);
  const colour = backgroundColour(cfg.designSystem);
  const screen = cfg.source.screen ? path.join(media, cfg.source.screen) : null;
  if (screen && format === MAIN_FORMAT) return screen;
  const bed = path.join(media, `bed${FORMATS[format].suffix.replace('--', '-')}.mp4`);
  if (fs.existsSync(bed) && (!screen || fs.statSync(bed).mtimeMs > fs.statSync(screen).mtimeMs)) return bed;
  if (screen) ffmpeg(bandBedArgs(screen, format, colour, bed), `${format} bed`);
  else ffmpeg(['-f', 'lavfi', '-i', `color=c=${colour.replace('#', '0x')}:s=320x${Math.round((320 * canvas.h) / canvas.w / 2) * 2}:r=${canvas.fps}`, '-t', String(Math.ceil(cfg.total) + 2), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', bed], 'background bed');
  return bed;
}

export async function assemble(slug, { final = false, encoder = detectEncoder(), cutChecks = true } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const media = mediaDirOf(slug);
  const moments = loadMoments(slug);
  const formats = formatsOf(cfg);
  const missing = formats.flatMap((f) => moments.filter((m) => !fs.existsSync(momentClip(slug, m.id, f))).map((m) => `${m.id}${FORMATS[f].suffix}`));
  if (missing.length) throw new Error(`moments not rendered yet: ${missing.join(', ')}; run render-moments (060)`);
  let main = null;
  const extra = [];
  for (const format of formats) {
    const canvas = formatCanvas(format, canvasOf(cfg));
    const plan = validateEditPlan(animateEditPlan({ cfg, moments, media, clipOf: (id) => momentClip(slug, id, format), bed: bedFor(slug, cfg, format, canvas), canvas }));
    const suffix = FORMATS[format].suffix.replace('--', '-');
    writeJson(path.join(media, `edit-plan${suffix}.json`), plan);
    const out = path.join(media, cutFileName(format, final));
    // The kit's scratch (assembly-tmp, cache, assembly.md) lands in the media folder, never the repo.
    // No captions or punch-ins, and the tail after the last moment stays on the bed.
    await assembleEditPlan(plan, { workdir: media, video: slug, out, draft: !final, encoder,
      captions: 'off', transitions: 'none', beats: 'off', effects: 'off', effectModules: [], holdTail: false });
    if (format === MAIN_FORMAT) {
      const entry = registerVersion(media, out, { draft: !final });
      main = { out, version: entry.label, file: path.join(media, entry.file) };
    } else extra.push({ format, out });
  }
  if (cutChecks) {
    const { reviewCut } = await import('./review-cut.mjs');
    const { writeReview } = await import('./review-frames.mjs');
    try { reviewCut(slug); writeReview(slug); } catch (e) { console.error(`070 cut checks failed: ${e.message}`); }
  }
  return { ...main, extra };
}
