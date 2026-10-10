// 050: mechanical review before anything is encoded. Per moment and format: the contract, the hyperframes check
// (lint, runtime, layout, contrast), then measured checks on the composition's boxes over time (crowding,
// finished first and last frames, empty bands on takeovers, overlays sitting on the recording's busy region),
// and three stills at settled instants. When a cut exists, its dead beats and phone sheet join the report.
import fs from 'node:fs';
import path from 'node:path';
import { workdirOf, mediaDirOf, readJson, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf, formatsOf } from './run-config.mjs';
import { loadMoments, sampleTimes, COMPOSITION_ID } from './author-moments.mjs';
import { checkComposition, snapshotComposition, probeComposition } from './kit.mjs';
import { restoreAssets } from './assets.mjs';
import { MAIN_FORMAT, formatCanvas, formatDirName } from './formats.mjs';
import { textCutOff, crowding, finishedFrames, emptyBand, coversBusy, settledTimes, weakestMoment } from './frame-checks.mjs';
import { busyRegion } from './recording.mjs';
import { reviewCut, readCutReport } from './review-cut.mjs';

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

// Probe instants: every quarter second, plus the exact first and last frame.
export function probeTimes(duration, fps) {
  const last = +(duration - 1 / fps).toFixed(3);
  const ts = [];
  for (let t = 0; t < last; t += 0.25) ts.push(+t.toFixed(3));
  ts.push(last);
  return ts;
}

const fmtFinding = (f) => `${f.pass}/${f.code ?? '?'}${f.from != null ? ` @${f.from}s` : ''}: ${f.message ?? ''}${f.selector ? ` (${f.selector})` : ''}`;
const say = (f) => `${f.check}: ${f.message}`;

// One composition (one moment in one format): every check that reads it.
function reviewComposition(slug, cfg, m, format, { snapshots, probe }) {
  const canvas = formatCanvas(format, canvasOf(cfg));
  const dir = path.join(workdirOf(slug), 'moments', formatDirName(m.id, format));
  const html = path.join(dir, 'index.html');
  const r = { errors: [], warnings: [], frames: [], measures: {} };
  if (!fs.existsSync(html)) { r.errors.push(`missing ${path.basename(dir)}/index.html: run author-moments (040)`); return r; }
  for (const name of restoreAssets(dir)) r.errors.push(`assets/${name} is missing and is not a registry logo`);
  r.errors.push(...contractErrors(fs.readFileSync(html, 'utf8'), { duration: m.duration, canvas }));
  try {
    const { report, findings } = checkComposition(dir);
    for (const f of findings) (f.severity === 'error' ? r.errors : r.warnings).push(fmtFinding(f));
    for (const f of textCutOff(report)) r.errors.push(say(f));
  } catch (e) {
    r.errors.push(`hyperframes check did not run: ${e.message}`);
  }
  let samples = null;
  if (probe) {
    try {
      samples = probeComposition(dir, probeTimes(m.duration, canvas.fps)).samples;
      const measured = [
        ...crowding(samples, canvas),
        ...finishedFrames(samples[0], samples.at(-1), { kind: m.kind, canvas }),
      ];
      if ((m.kind ?? 'takeover') === 'takeover') {
        const eb = emptyBand(samples, canvas, { duration: m.duration });
        measured.push(...eb.findings);
        r.measures.coverage = eb.coverage;
        r.measures.band = eb.band;
      } else if (format === MAIN_FORMAT) {
        const busy = busyRegion(slug, cfg, m);
        const cb = coversBusy(samples, canvas, busy);
        measured.push(...cb.findings);
        r.measures.busy = busy?.box ?? null;
        r.measures.busyCovered = cb.covered;
      }
      for (const f of measured) (f.severity === 'error' ? r.errors : r.warnings).push(say(f));
    } catch (e) {
      r.warnings.push(`measured checks did not run: ${e.message}`);
    }
  }
  if (snapshots && format === MAIN_FORMAT) {
    const outDir = path.join(mediaDirOf(slug), 'review', m.id);
    fs.rmSync(outDir, { recursive: true, force: true });
    const wanted = sampleTimes(m.duration);
    const picks = samples ? settledTimes(samples, wanted) : wanted.map((t) => ({ t, settled: true }));
    for (const p of picks) if (!p.settled) r.warnings.push(`finished-frame: no instant near ${p.t}s is free of half-revealed text, the still shows it mid-reveal`);
    const moved = picks.filter((p) => p.settled && p.wanted !== undefined && Math.abs(p.wanted - p.t) > 0.01);
    if (moved.length) r.measures.stillsMoved = moved.map((p) => `${p.wanted}s->${p.t}s`);
    try {
      snapshotComposition(dir, [...new Set(picks.map((p) => p.t))], outDir);
      r.frames = fs.readdirSync(outDir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(outDir, f));
    } catch (e) { r.errors.push(e.message); }
  }
  return r;
}

export function reviewFrames(slug, { only = null, snapshots = true, probe = true, cut = true } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const moments = loadMoments(slug).filter((m) => !only || only.includes(m.id));
  const prior = only && fs.existsSync(path.join(workdir, 'review', 'check.json')) ? readJson(path.join(workdir, 'review', 'check.json')).moments : {};
  const report = { video: slug, reviewed: new Date().toISOString(), formats: formatsOf(cfg), moments: { ...prior } };
  for (const m of moments) {
    const entry = { idea: m.idea, kind: m.kind ?? 'takeover', start: m.start, end: m.end, duration: m.duration, errors: [], warnings: [], frames: [], measures: {} };
    for (const format of formatsOf(cfg)) {
      const r = reviewComposition(slug, cfg, m, format, { snapshots, probe });
      const tag = format === MAIN_FORMAT ? '' : `[${format}] `;
      entry.errors.push(...r.errors.map((e) => tag + e));
      entry.warnings.push(...r.warnings.map((w) => tag + w));
      if (format === MAIN_FORMAT) { entry.frames = r.frames; entry.measures = r.measures; }
    }
    report.moments[m.id] = entry;
  }
  writeJson(path.join(workdir, 'review', 'check.json'), report);
  if (cut) {
    try { reviewCut(slug); } catch (e) { console.error(`050 cut checks skipped: ${e.message}`); }
  }
  const file = writeReview(slug);
  const errors = Object.values(report.moments).reduce((n, e) => n + e.errors.length, 0);
  return { report, errors, file };
}

// REVIEW.md from check.json and, when a cut exists, cut.json. Always ends with the weakest-moment line.
export function writeReview(slug) {
  const workdir = workdirOf(slug);
  const p = path.join(workdir, 'review', 'check.json');
  const report = fs.existsSync(p) ? readJson(p) : { moments: {} };
  const cutReport = readCutReport(slug);
  const lines = [`# Review: ${slug}`, '', 'Mechanical and measured checks per moment, then three stills each. Frames are for reading against the idea line.', ''];
  const ids = Object.keys(report.moments).sort();
  const withDead = {};
  for (const id of ids) {
    const e = report.moments[id];
    const dead = cutReport?.dead?.byMoment?.[id] ?? 0;
    withDead[id] = { ...e, deadSeconds: dead };
    lines.push(`## ${id} · ${e.kind ?? 'takeover'} · ${e.start.toFixed(2)}-${e.end.toFixed(2)}s · ${e.duration ?? +(e.end - e.start).toFixed(2)}s`, '', `> ${e.idea}`, '');
    for (const x of e.errors) lines.push(`- **error** ${x}`);
    for (const x of e.warnings) lines.push(`- warning ${x}`);
    if (dead) lines.push(`- warning dead-beat: ${dead}s of the cut inside this moment show nothing new`);
    if (!e.errors.length && !e.warnings.length && !dead) lines.push('- clean');
    if (e.measures?.coverage !== undefined) lines.push(`- measured: content spans ${Math.round(e.measures.coverage * 100)}% of the frame height`);
    if (e.measures?.stillsMoved) lines.push(`- measured: stills moved off half-revealed text (${e.measures.stillsMoved.join(', ')})`);
    if (e.frames?.length) lines.push('', `Frames: \`${path.dirname(e.frames[0])}\``);
    lines.push('');
  }
  if (cutReport) {
    lines.push(`## The cut · ${path.basename(cutReport.cut)}`, '');
    lines.push(`- dead beats (nothing new for ${cutReport.dead.maxStill}s or more, recording motion counts as change): ${cutReport.dead.runs.length ? '' : 'none'}`);
    for (const r of cutReport.dead.runs) lines.push(`  - ${r.from.toFixed(2)}-${r.to.toFixed(2)}s (${r.seconds}s) in ${r.where.join(', ')}`);
    lines.push(`- phone sheet (1 frame a second at 360px wide, read every word at this size): \`${cutReport.phone}\``);
    for (const x of cutReport.extra ?? []) lines.push(`- ${x.format}: phone sheet \`${x.phone}\`, ${x.dead.runs.length} dead beat(s)`);
    lines.push('');
  } else lines.push('## The cut', '', '- no cut yet: dead beats and the phone sheet run after assemble (070)', '');
  const weak = weakestMoment(withDead);
  lines.push(weak ? `**Weakest moment:** ${weak.id}: ${weak.reason}` : '**Weakest moment:** none flagged by the measured checks; judge it on the storyboard sheet and the stills.');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const file = path.join(workdir, 'review', 'REVIEW.md');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}
