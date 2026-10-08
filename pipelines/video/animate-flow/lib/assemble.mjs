// 070: map this recipe's artifacts onto the kit's edit plan and let the kit cut the video.
import fs from 'node:fs';
import path from 'node:path';
import { workdirOf, mediaDirOf, designSystemDir, readJson, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf } from './run-config.mjs';
import { loadMoments } from './author-moments.mjs';
import { momentClip } from './render-moments.mjs';
import { ffmpeg } from './media.mjs';
import { assembleEditPlan, validateEditPlan, registerVersion, detectEncoder } from './kit.mjs';

// The bed when there is no screen recording: the design system's background, one flat clip.
export function backgroundColour(designSystem) {
  const tokens = path.join(designSystemDir(designSystem), 'tokens.json');
  const c = fs.existsSync(tokens) ? readJson(tokens).background : null;
  return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000';
}

// Pure: run-config + moments + media paths -> edit plan. Moments are base-layer compositions.
export function animateEditPlan({ cfg, moments, media, clipOf, bed }) {
  return {
    total: cfg.total,
    canvas: canvasOf(cfg),
    audio: { src: path.join(media, cfg.source.audio) },
    clips: [
      { kind: 'footage', id: 'bed', src: bed },
      ...moments.map((m) => ({ kind: 'composition', id: m.id, start: m.start, end: m.end, src: clipOf(m.id) })),
    ],
  };
}

export async function assemble(slug, { final = false, encoder = detectEncoder() } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const media = mediaDirOf(slug);
  const moments = loadMoments(slug);
  const missing = moments.filter((m) => !fs.existsSync(momentClip(slug, m.id))).map((m) => m.id);
  if (missing.length) throw new Error(`moments not rendered yet: ${missing.join(', ')}; run render-moments (060)`);
  let bed = cfg.source.screen ? path.join(media, cfg.source.screen) : null;
  if (!bed) {
    bed = path.join(media, 'bed.mp4');
    const c = backgroundColour(cfg.designSystem).replace('#', '0x');
    ffmpeg(['-f', 'lavfi', '-i', `color=c=${c}:s=320x180:r=${canvasOf(cfg).fps}`, '-t', String(Math.ceil(cfg.total) + 2), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', bed], 'background bed');
  }
  const plan = validateEditPlan(animateEditPlan({ cfg, moments, media, clipOf: (id) => momentClip(slug, id), bed }));
  writeJson(path.join(media, 'edit-plan.json'), plan);
  const out = path.join(media, final ? 'final.mp4' : 'final-draft.mp4');
  // The kit's scratch (assembly-tmp, cache, assembly.md) lands in the media folder, never the repo.
  // No captions, transitions or punch-ins in v1, and the tail after the last moment stays on the bed.
  await assembleEditPlan(plan, { workdir: media, video: slug, out, draft: !final, encoder,
    captions: 'off', transitions: 'none', beats: 'off', effects: 'off', effectModules: [], holdTail: false });
  const entry = registerVersion(media, out, { draft: !final });
  return { out, version: entry.label, file: path.join(media, entry.file) };
}
