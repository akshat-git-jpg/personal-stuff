// Mechanical hyperframes calls any recipe can share: lint/check/snapshot/render one composition
// directory, parse the check report, and a black-frame probe. No design judgment lives here.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { FILM_RENDERER } from '../renderer-constants.mjs';
import { DEFAULT_CANVAS } from './edit-plan.mjs';

// One pin for review and render, so a green review never ships on another renderer.
export const HYPERFRAMES = FILM_RENDERER;

// On Windows npx is npx.cmd and needs a shell; a shell joins argv, so quote anything with spaces.
export const NPX_NEEDS_SHELL = process.platform === 'win32';
export const npxArgs = (args, needsShell = NPX_NEEDS_SHELL) =>
  (needsShell ? args.map((a) => (/\s/.test(String(a)) ? `"${a}"` : a)) : args);
// npm_config_userconfig: an expired token in ~/.npmrc 401s public packages.
export const npxSpawnOpts = (extra = {}) => ({
  shell: NPX_NEEDS_SHELL, ...extra, env: { ...process.env, ...(extra.env || {}), npm_config_userconfig: os.devNull },
});

export const lintArgs = (dir) => ['-y', HYPERFRAMES, 'lint', dir];
export const checkArgs = (dir) => ['-y', HYPERFRAMES, 'check', dir, '--at-transitions', '--json'];
export const snapshotArgs = (dir, times, outDir) => ['-y', HYPERFRAMES, 'snapshot', dir, '--at', times.join(','), '--no-end', '--describe', 'false', '-o', outDir];
// -o must be a file name with an extension, or the mux step cannot pick a format.
export const renderArgs = (dir, outFile, fps = DEFAULT_CANVAS.fps) => ['-y', HYPERFRAMES, 'render', dir, '--fps', String(fps), '--format', 'mp4', '--quality', 'high', '-o', outFile];

// The CLI prints progress around its JSON body, so scan braces to the matching close, skipping strings.
export function extractJsonObject(raw) {
  const start = raw.indexOf('{');
  if (start === -1) throw new Error('no JSON object in check output');
  let depth = 0, inStr = false, escaped = false;
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

// Every non-info finding across the passes, errors first, one entry per persisting defect.
export function summariseFindings(report) {
  const rank = { error: 0, warning: 1 };
  const out = [];
  for (const pass of ['lint', 'runtime', 'layout', 'motion', 'contrast']) {
    for (const f of report?.[pass]?.findings ?? []) {
      if (f.severity === 'info') continue;
      out.push({ pass, severity: f.severity, code: f.code, from: f.firstSeen ?? f.time, to: f.lastSeen ?? f.time,
        selector: f.selector, covering: f.containerSelector, text: f.text, message: f.message });
    }
  }
  return out.sort((a, b) => ((rank[a.severity] ?? 2) - (rank[b.severity] ?? 2)) || ((a.from ?? 0) - (b.from ?? 0)));
}

const npx = (args, extra) => spawnSync('npx', npxArgs(args), npxSpawnOpts({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...extra }));

// lint + runtime + layout + contrast in one call. A lint error makes the later passes sample nothing,
// so callers must treat any error as a failure rather than reading the empty passes as green.
export function checkComposition(dir) {
  const r = npx(checkArgs(dir));
  const report = JSON.parse(extractJsonObject(`${r.stdout ?? ''}${r.stderr ?? ''}`));
  return { report, findings: summariseFindings(report) };
}

export function snapshotComposition(dir, times, outDir) {
  const r = npx(snapshotArgs(dir, times, outDir), { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`hyperframes snapshot failed for ${dir} (exit ${r.status})`);
}

export function renderComposition(dir, outFile, { fps = DEFAULT_CANVAS.fps } = {}) {
  const r = npx(renderArgs(dir, outFile, fps), { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`hyperframes render failed for ${dir} (exit ${r.status})`);
}

// A path inside a lavfi graph: ':' separates options and '\' escapes, so a Windows drive needs both handled.
export function lavfiPath(p) {
  return String(p).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\\\:');
}

// Average luma per frame; a render that came out black reads ~0 everywhere.
export function frameLuma(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', `movie=${lavfiPath(video)},signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`signalstats failed: ${r.stderr}`);
  return String(r.stdout).trim().split('\n').map(Number).filter(Number.isFinite);
}
