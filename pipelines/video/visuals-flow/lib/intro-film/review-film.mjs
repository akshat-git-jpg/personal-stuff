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

// Moved to lib/intro-film/npx.mjs so render-film.mjs shares the fix rather than
// carrying the same Windows ENOENT bug independently. Re-exported because tests
// and callers already import these names from here.
import { NPX_NEEDS_SHELL, npxArgs } from './npx.mjs';
export { NPX_NEEDS_SHELL, npxArgs };
import { resolveWorkdir } from './workdir.mjs';
import { linkFilmMedia, STAND_IN_IMAGE } from './film-assets.mjs';
import { checkFilmSync } from './check-film-sync.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';
// The third pass. `check` is mechanical but tests for OVERLAP only; clearance is
// the half of T13/T14 it cannot state. See check-clearance.mjs for why nothing
// existing could be reused.
import { runClearance, MIN_CLEARANCE_PX, severityOf } from './check-clearance.mjs';
import { pathToFileURL } from 'node:url';

const HYPERFRAMES = FILM_RENDERER;

// THREE samples per beat, not one.
//
// A single midpoint frame systematically misses any beat whose content fires
// late. On poc-01 that was three beats out of twelve — the verdict marks
// (56.95s, sampled at 56.73), the scorecard callback (74.1s) and the closing
// roster re-form (85.55s) were all invisible to the review that was supposed to
// catch them, which made the film look cleaner than it was.
//
// Boundaries are still avoided: a beat's transition is resolving at its edges,
// so an edge frame shows a cross-fade rather than a held composition. These sit
// at 25%, 55% and 85% through the beat.
export const BEAT_PHASES = [0.25, 0.55, 0.85];

export function beatSampleTimes(screenplay, { phases = BEAT_PHASES } = {}) {
  const beats = screenplay?.beats ?? [];
  const out = [];
  for (const b of beats) {
    const start = b.t_start ?? 0;
    const span = (b.t_end ?? 0) - start;
    for (const p of phases) {
      out.push({
        t: Number((start + span * p).toFixed(2)),
        phase: p,
        id: b.id,
        intent: b.intent,
        register: b.register,
        face: b.face,
        clause: b.clause,
        stage: b.stage,
      });
    }
  }
  return out;
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

export function renderReport({ slug, samples, findings, screenplay, sheetFiles, clearance = null }) {
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

  // Clearance is reported as its own section, not merged into the list above:
  // these findings are about the GAP between two elements, so they name a pair
  // rather than one offending element, and reading them mixed in loses that.
  if (clearance) {
    lines.push('## Clearance — T13/T14', '');
    lines.push(`Threshold ${clearance.threshold}px at 1080p. `
      + `${clearance.errorCount} error(s), ${clearance.warningCount} warning(s) `
      + `over ${clearance.samples.length} sample(s).`, '');
    if (!clearance.findings.length) lines.push('None.', '');
    for (const f of clearance.findings) {
      const b = f.t == null ? null : beatAt(screenplay, f.t);
      const at = f.t == null ? 'across the whole span' : `@ ${f.t}s`;
      lines.push(`- **${severityOf(f)}** \`${f.code}\` ${f.a} ↔ ${f.b} `
        + `gap=${f.gap}px ${at}${b ? ` (${b.id} ${b.intent})` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Beat frames — does the picture do what the beat says?', '');
  for (const sheet of sheetFiles) lines.push(`Contact sheet: \`${sheet}\``);
  lines.push('');
  // Grouped by beat: the three phase frames of one beat must be read together,
  // against the single stage line all three have to satisfy between them.
  let lastId = null;
  samples.forEach((s, i) => {
    if (s.id !== lastId) {
      lines.push(`### ${s.id} · ${s.intent} · ${s.register} · face:${s.face}`);
      lines.push(`> ${s.clause}`, '');
      lines.push(s.stage, '');
      lastId = s.id;
    }
    lines.push(`- frame ${i + 1} — ${s.t}s (${Math.round(s.phase * 100)}% through the beat)`);
  });
  lines.push('');
  return lines.join('\n');
}

// Async because the clearance pass drives a browser over CDP. The only caller is
// this file's own CLI; the tests exercise the pure helpers above.
export async function runReview(slug, { check = true, snapshot = true, clearance = true } = {}) {
  const workdir = resolveWorkdir(slug);
  const filmDir = path.join(workdir, 'film');
  if (!fs.existsSync(path.join(filmDir, 'index.html'))) {
    throw new Error(`missing ${filmDir}/index.html — run the author step first`);
  }
  const screenplay = JSON.parse(fs.readFileSync(path.join(workdir, 'screenplay.json'), 'utf8'));

  // BEFORE anything is sampled. Every time below is read from the screenplay
  // and applied to the composition, so if the two have drifted the whole pass
  // photographs the wrong moments and reports a working film as broken. Failing
  // here costs a second; failing silently costs a review and the fixes it
  // provokes.
  const sync = checkFilmSync({ screenplay, html: fs.readFileSync(path.join(filmDir, 'index.html'), 'utf8') });
  if (sync.errors.length) {
    const lines = sync.errors.map((e) => `  ${e.code} ${e.message}`).join('\n');
    throw new Error(`screenplay.json and film/index.html disagree — review would sample the wrong times:\n${lines}`);
  }

  // Without this the composition lints with "../" errors and check's layout
  // pass silently samples nothing.
  // The stand-in matters at review time specifically. Without it every
  // face:full and face:panel beat renders with an empty right panel, so the
  // reviewer reads composition against a frame the film will never produce —
  // and the space the presenter occupies looks free for a device to move into.
  // The real avatar.mp4 wins whenever it exists; this only fills the hole.
  const media = linkFilmMedia(slug, { standInImage: STAND_IN_IMAGE });

  const reviewDir = path.join(workdir, 'review');
  fs.rmSync(reviewDir, { recursive: true, force: true });
  fs.mkdirSync(reviewDir, { recursive: true });

  const samples = beatSampleTimes(screenplay);

  let findings = [];
  let report = null;
  if (check) {
    const r = spawnSync('npx', npxArgs(checkArgs(filmDir)), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: NPX_NEEDS_SHELL });
    const raw = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    report = parseCheckJson(raw);
    findings = summariseFindings(report);
  }

  // Clearance runs over the SAME film dir and the SAME sample times `check`
  // covered, so the two passes can never disagree about what was inspected.
  // A clearance error must NOT abort the run: the snapshot pass below is how the
  // owner actually reviews the film, and withholding the frames because a gap is
  // 8px too tight would cost the review to report the defect.
  let clearanceReport = null;
  if (clearance) {
    try {
      clearanceReport = await runClearance(filmDir, { times: samples.map((s) => s.t) });
    } catch (e) {
      // Record the failure instead of throwing: an unmeasurable film is a
      // reportable state, and a silent skip would read as a pass.
      clearanceReport = {
        ok: false, errorCount: 1, warningCount: 0, threshold: MIN_CLEARANCE_PX,
        samples: samples.map((s) => s.t),
        findings: [{ code: 'clearance_unavailable', a: '-', b: '-', gap: 0, t: null, message: e.message }],
      };
    }
  }

  // One check.json carrying both passes. Written after clearance so the file is
  // never half-populated on disk.
  if (report || clearanceReport) {
    fs.writeFileSync(path.join(reviewDir, 'check.json'),
      JSON.stringify({ ...(report ?? {}), clearance: clearanceReport }, null, 2));
  }

  let sheetFiles = [];
  if (snapshot) {
    const r = spawnSync('npx', npxArgs(snapshotArgs(filmDir, samples.map((s) => s.t), reviewDir)), { stdio: 'inherit', shell: NPX_NEEDS_SHELL });
    if (r.status !== 0) throw new Error(`hyperframes snapshot failed (exit ${r.status})`);
    sheetFiles = fs.readdirSync(reviewDir).filter((f) => f.startsWith('contact-sheet')).sort();
  }

  const md = renderReport({ slug, samples, findings, screenplay, sheetFiles, clearance: clearanceReport });
  const reportFile = path.join(reviewDir, 'REVIEW.md');
  fs.writeFileSync(reportFile, md);

  return { reportFile, reviewDir, findings, samples, media, sheetFiles, clearance: clearanceReport };
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-film/review-film.mjs <slug-or-path>');
    process.exit(1);
  }
  try {
    const r = await runReview(slug);
    const errors = r.findings.filter((f) => f.severity === 'error');
    for (const f of r.findings) {
      console.error(`${f.severity.toUpperCase()} ${f.code} ${f.selector ?? ''} ${f.message ?? ''}`.trim());
    }
    const c = r.clearance;
    if (c) {
      for (const f of c.findings) {
        console.error(`${severityOf(f).toUpperCase()} ${f.code} ${f.a} <-> ${f.b} `
          + `gap=${f.gap}px${f.t == null ? '' : ` @ ${f.t}s`}`.trim());
      }
    }
    console.log(`review: ${r.samples.length} frames, ${r.findings.length} findings (${errors.length} errors) -> ${r.reportFile}`);
    if (c) console.log(`clearance: ${c.errorCount} error(s), ${c.warningCount} warning(s) at ${c.threshold}px over ${c.samples.length} sample(s)`);
    // A lint error makes hyperframes skip the layout and contrast passes
    // entirely — they then report ok against ZERO samples. Exiting non-zero is
    // what stops a session reading that vacuous green as a real pass.
    // A clearance error counts the same way: T13 says intro-review surfaces it
    // as a runtime error, and the snapshot pass has already run by this point,
    // so failing here withholds nothing the owner needs.
    process.exit(errors.length || (c && c.errorCount) ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
