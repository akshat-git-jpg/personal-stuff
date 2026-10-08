// 050: mechanical review before anything is encoded. hyperframes check (lint, runtime errors,
// layout overflow and occlusion, contrast) plus three stills per moment for a human to read.
import fs from 'node:fs';
import path from 'node:path';
import { workdirOf, mediaDirOf, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf } from './run-config.mjs';
import { loadMoments, sampleTimes, COMPOSITION_ID } from './author-moments.mjs';
import { checkComposition, snapshotComposition } from './kit.mjs';
import { restoreAssets } from './assets.mjs';

// Contract the renderer and the assembler rely on, read straight from the HTML.
export function contractErrors(html, { duration, canvas }) {
  const errs = [];
  const root = /<[^>]*data-composition-id="([^"]+)"[^>]*>/.exec(html);
  if (!root) return ['no element carries data-composition-id'];
  const tag = root[0];
  const attr = (n) => (new RegExp(`${n}="([^"]*)"`).exec(tag) ?? [])[1];
  if (root[1] !== COMPOSITION_ID) errs.push(`composition id is "${root[1]}", expected "${COMPOSITION_ID}"`);
  if (Number(attr('data-width')) !== canvas.w || Number(attr('data-height')) !== canvas.h) errs.push(`canvas is ${attr('data-width')}x${attr('data-height')}, expected ${canvas.w}x${canvas.h}`);
  const d = Number(attr('data-duration'));
  if (!(Math.abs(d - duration) <= 0.05)) errs.push(`data-duration is ${attr('data-duration')}, the moment is ${duration}s`);
  if (/<(audio|video)\b/i.test(html)) errs.push('a moment must be silent and carry no <audio>/<video>');
  if (/(?:src|href)="(?!https:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)(?:\/|")|assets\/|data:|#)[^"]+"/.test(html)) errs.push('references a file outside assets/ or a host other than the GSAP CDN and Google Fonts');
  return errs;
}

export function reviewFrames(slug, { only = null, snapshots = true } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const canvas = canvasOf(cfg);
  const moments = loadMoments(slug).filter((m) => !only || only.includes(m.id));
  const report = { video: slug, reviewed: new Date().toISOString(), moments: {} };
  const lines = [`# Review: ${slug}`, '', 'Mechanical checks per moment, then three stills each. Frames are for reading against the idea line.', ''];
  for (const m of moments) {
    const dir = path.join(workdir, 'moments', m.id);
    const html = path.join(dir, 'index.html');
    const entry = { idea: m.idea, start: m.start, end: m.end, errors: [], warnings: [], frames: [] };
    report.moments[m.id] = entry;
    lines.push(`## ${m.id} · ${m.start.toFixed(2)}-${m.end.toFixed(2)}s · ${m.duration}s`, '', `> ${m.idea}`, '');
    if (!fs.existsSync(html)) { entry.errors.push('missing index.html: run author-moments (040)'); lines.push('- **error** missing index.html', ''); continue; }
    for (const name of restoreAssets(dir)) entry.errors.push(`assets/${name} is missing and is not a registry logo`);
    entry.errors.push(...contractErrors(fs.readFileSync(html, 'utf8'), { duration: m.duration, canvas }));
    try {
      const { findings } = checkComposition(dir);
      for (const f of findings) (f.severity === 'error' ? entry.errors : entry.warnings).push(`${f.pass}/${f.code ?? '?'}${f.from != null ? ` @${f.from}s` : ''}: ${f.message ?? ''}${f.selector ? ` (${f.selector})` : ''}`);
    } catch (e) {
      entry.errors.push(`hyperframes check did not run: ${e.message}`);
    }
    if (snapshots) {
      const outDir = path.join(mediaDirOf(slug), 'review', m.id);
      fs.rmSync(outDir, { recursive: true, force: true });
      try {
        snapshotComposition(dir, sampleTimes(m.duration), outDir);
        entry.frames = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(outDir, f));
      } catch (e) { entry.errors.push(e.message); }
    }
    for (const e of entry.errors) lines.push(`- **error** ${e}`);
    for (const w of entry.warnings) lines.push(`- warning ${w}`);
    if (!entry.errors.length && !entry.warnings.length) lines.push('- clean');
    if (entry.frames.length) lines.push('', `Frames: \`${path.dirname(entry.frames[0])}\``);
    lines.push('');
  }
  writeJson(path.join(workdir, 'review', 'check.json'), report);
  fs.writeFileSync(path.join(workdir, 'review', 'REVIEW.md'), lines.join('\n'));
  const errors = Object.values(report.moments).reduce((n, e) => n + e.errors.length, 0);
  return { report, errors, file: path.join(workdir, 'review', 'REVIEW.md') };
}
