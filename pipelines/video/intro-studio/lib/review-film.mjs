// The PRE-RENDER review pass.
//
// Rendering the film to inspect it costs minutes and is the wrong artifact to
// review: every visual defect found so far (a rail label on a card, the crown
// landing on the presenter, an agenda line under a logo tile) was visible in a
// still. hyperframes can seek and screenshot without encoding, so the whole
// design review happens before a single frame is encoded.
//
// Two passes, deliberately separate:
//
//   check    — mechanical. Occlusion, overflow, contrast, runtime errors,
//              sampled densely including transition seams. Catches the bugs a
//              machine can state. Requires lint to pass first: see film-assets.
//   snapshot — editorial. One frame at the MIDPOINT of every beat, paired with
//              that beat's `stage` line, so the film can be read against the
//              screenplay it was written from. Catches intent failures, which
//              no pixel check ever will.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';
import { linkFilmMedia } from './film-assets.mjs';

const HYPERFRAMES = 'hyperframes@0.7.88';

// Midpoint, not the boundary: a beat's transition_out is still resolving at its
// edges, so a boundary frame shows a cross-fade rather than the beat's held
// composition. The midpoint is what a viewer actually reads.
export function beatSampleTimes(screenplay) {
  const beats = screenplay?.beats ?? [];
  return beats.map((b) => ({
    t: Number((((b.t_start ?? 0) + (b.t_end ?? 0)) / 2).toFixed(2)),
    id: b.id,
    intent: b.intent,
    register: b.register,
    face: b.face,
    clause: b.clause,
    stage: b.stage,
  }));
}

export function snapshotArgs(filmDir, times, outDir) {
  return [
    '-y', HYPERFRAMES, 'snapshot', filmDir,
    '--at', times.join(','),
    '--no-end',
    '--describe', 'false',   // the Gemini pass needs a key and costs money; the frames are for reading
    '-o', outDir,
  ];
}

export function checkArgs(filmDir) {
  return ['-y', HYPERFRAMES, 'check', filmDir, '--at-transitions', '--json'];
}

// The CLI writes progress on both sides of the JSON body, so neither
// JSON.parse(raw) nor a slice from the first brace works — the tail of the
// stream is more spinner output. Scan braces to the matching close, skipping
// anything inside a string literal so a `{` in a message cannot end the scan.
export function extractJsonObject(raw) {
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('no JSON object in check output');
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return raw.slice(start, i + 1);
  }
  throw new Error('unterminated JSON object in check output');
}

export function parseCheckJson(raw) {
  return JSON.parse(extractJsonObject(raw));
}

// Flatten every pass into one severity-ordered list. A finding that persists
// across samples is reported ONCE with its span, so 26 samples of the same
// occluded line read as one defect instead of burying the other five.
export function summariseFindings(report) {
  const rank = { error: 0, warning: 1, info: 2 };
  const out = [];
  for (const pass of ['lint', 'runtime', 'layout', 'motion', 'contrast']) {
    for (const f of report?.[pass]?.findings ?? []) {
      if (f.severity === 'info') continue;
      out.push({
        pass,
        severity: f.severity,
        code: f.code,
        from: f.firstSeen ?? f.time,
        to: f.lastSeen ?? f.time,
        selector: f.selector,
        covering: f.containerSelector,
        text: f.text,
        message: f.message,
      });
    }
  }
  return out.sort((a, b) => (rank[a.severity] - rank[b.severity]) || ((a.from ?? 0) - (b.from ?? 0)));
}

// Which beat owns a given timestamp — so a mechanical finding lands on the beat
// whose staging caused it, not on a bare number.
export function beatAt(screenplay, t) {
  const beats = screenplay?.beats ?? [];
  return beats.find((b) => t >= b.t_start && t < b.t_end) ?? beats[beats.length - 1] ?? null;
}

export function renderReport({ slug, samples, findings, screenplay, sheetFiles }) {
  const lines = [];
  lines.push(`# Review — ${slug}`, '');
  lines.push(`${findings.length} mechanical finding(s), ${samples.length} beat frame(s).`, '');

  lines.push('## Mechanical findings', '');
  if (!findings.length) lines.push('None.', '');
  for (const f of findings) {
    const b = beatAt(screenplay, f.from ?? 0);
    const span = f.to != null && f.to !== f.from ? `${f.from}s–${f.to}s` : `${f.from}s`;
    lines.push(`- **${f.severity}** \`${f.code ?? f.pass}\` at ${span}${b ? ` (${b.id} ${b.intent})` : ''}`);
    if (f.text) lines.push(`  - text: "${f.text}"`);
    if (f.selector) lines.push(`  - element: \`${f.selector}\`${f.covering ? ` covered by \`${f.covering}\`` : ''}`);
    lines.push(`  - ${f.message}`);
  }
  lines.push('');

  lines.push('## Beat frames — does the picture do what the beat says?', '');
  for (const sheet of sheetFiles) lines.push(`Contact sheet: \`${sheet}\``);
  lines.push('');
  samples.forEach((s, i) => {
    lines.push(`### ${i + 1}. ${s.id} · ${s.intent} · ${s.register} · face:${s.face} · ${s.t}s`);
    lines.push(`> ${s.clause}`, '');
    lines.push(s.stage, '');
  });
  return lines.join('\n');
}

export function runReview(slug, { check = true, snapshot = true } = {}) {
  const workdir = resolveWorkdir(slug);
  const filmDir = path.join(workdir, 'film');
  if (!fs.existsSync(path.join(filmDir, 'index.html'))) {
    throw new Error(`missing ${filmDir}/index.html — run the author step first`);
  }
  const screenplay = JSON.parse(fs.readFileSync(path.join(workdir, 'screenplay.json'), 'utf8'));

  // Without this the composition lints with "../" errors and check's layout
  // pass silently samples nothing.
  const media = linkFilmMedia(slug);

  const reviewDir = path.join(workdir, 'review');
  fs.rmSync(reviewDir, { recursive: true, force: true });
  fs.mkdirSync(reviewDir, { recursive: true });

  const samples = beatSampleTimes(screenplay);

  let findings = [];
  if (check) {
    const r = spawnSync('npx', checkArgs(filmDir), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const raw = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const report = parseCheckJson(raw);
    fs.writeFileSync(path.join(reviewDir, 'check.json'), JSON.stringify(report, null, 2));
    findings = summariseFindings(report);
  }

  let sheetFiles = [];
  if (snapshot) {
    const r = spawnSync('npx', snapshotArgs(filmDir, samples.map((s) => s.t), reviewDir), { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`hyperframes snapshot failed (exit ${r.status})`);
    sheetFiles = fs.readdirSync(reviewDir).filter((f) => f.startsWith('contact-sheet')).sort();
  }

  const md = renderReport({ slug, samples, findings, screenplay, sheetFiles });
  const reportFile = path.join(reviewDir, 'REVIEW.md');
  fs.writeFileSync(reportFile, md);

  return { reportFile, reviewDir, findings, samples, media, sheetFiles };
}
