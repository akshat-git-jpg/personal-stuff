#!/usr/bin/env node
// Golden no-regression harness for lib/assemble.mjs.
//
//   node scripts/golden.mjs stage  [slug...]   copy media from the live workdirs (one-off)
//   node scripts/golden.mjs record [slug...]   write plan.json + frames.json, save reference frames
//   node scripts/golden.mjs check  [--plan-only] [slug...]
//
// The assembler runs as a black box (its CLI) with an `ffmpeg` shim on PATH that logs every
// argument list, so the plan survives any internal refactor. --plan-only stubs the encodes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..');                      // visuals-flow in THIS checkout
const REPO = path.resolve(ROOT, '..', '..', '..');
const SELF = path.join(HERE, 'golden.mjs');
const MEDIA = process.env.GOLDEN_MEDIA_ROOT ?? path.join(os.homedir(), 'kb-scratch', 'video', 'golden');
const SNAP = path.join(ROOT, 'tests', 'golden');
const N_FRAMES = 20;
const ASSEMBLE_ARGS = ['--draft', '--encoder', 'x264', '--no-cache'];

const MAIN = path.join(os.homedir(), 'codebase', 'personal-stuff', 'pipelines', 'video', 'visuals-flow', 'videos');
const GOLDENS = {
  'consistent-character-ai-animation-howto': {
    src: path.join(MAIN, 'consistent-character-ai-animation-howto'),
    // The live intro is unapproved; the staged copy approves it so the cut can be assembled.
    patch: { 'intro-simple/cutlist.json': { approved: true } },
    ssimMin: 0.9999,   // unchanged runs: every frame 1.000000
  },
  'everbee-promo-code': {
    src: path.join(os.homedir(), 'kb-scratch', 'workspaces', 'personal-stuff-0fbb2c25', 'coupon-edit-flow',
      'personal-stuff', 'pipelines', 'video', 'visuals-flow', 'videos', 'everbee-promo-code'),
    patch: {},
    // Unchanged runs drift to 0.99891 inside the bubble span (ring gleam framesync), so lower.
    ssimMin: 0.998,
  },
};

const die = (msg) => { console.error(msg); process.exit(1); };
const sha = (buf) => createHash('sha1').update(buf).digest('hex');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); };
const realFfmpeg = () => {
  const r = spawnSync('/bin/sh', ['-c', 'command -v ffmpeg'], { encoding: 'utf8' });
  return r.stdout.trim() || die('ffmpeg not on PATH');
};
function ff(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', ...args], { encoding: 'utf8' });
  if (r.status !== 0) die(`ffmpeg ${args.join(' ')}\n${r.stderr}`);
  return r;
}

// ---------------------------------------------------------------- ffmpeg shim
function shim(args) {
  const rec = { args, files: {} };
  for (const a of args) {
    for (const m of a.matchAll(/subtitles=filename='((?:[^'\\]|\\.)+)'/g)) {
      const p = m[1].replace(/\\:/g, ':');
      rec.files[p] = fs.existsSync(p) ? sha(fs.readFileSync(p)) : 'missing';
    }
  }
  const isMux = args.includes('concat');
  if (isMux) rec.concat = fs.readFileSync(path.join(process.cwd(), 'concat.txt'), 'utf8');
  const probe = args.includes('-encoders') || args.includes('-filters');
  if (!probe) fs.appendFileSync(process.env.GOLDEN_SHIM_LOG, JSON.stringify(rec) + '\n');
  const real = process.env.GOLDEN_REAL_FFMPEG;
  const out = args[args.length - 1];
  if (process.env.GOLDEN_SHIM_MODE === 'plan' && !probe) {
    if (out.endsWith('.ts')) { fs.writeFileSync(out, 'stub'); process.exit(0); }
    if (isMux) {
      // Cheap stand-in that passes assemble's duration, A/V and resolution gates.
      const total = Number(args[args.indexOf('-t') + 1]);
      const n = Math.ceil(total);
      const rate = `${n * 1e6}/${Math.round(total * 1e6)}`;
      const r = spawnSync(real, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${process.env.GOLDEN_WH}:r=${rate}`,
        '-f', 'lavfi', '-i', 'anullsrc=r=8000:cl=mono', '-t', String(total), '-c:v', 'libx264', '-preset', 'ultrafast',
        '-c:a', 'aac', out], { stdio: 'inherit' });
      process.exit(r.status ?? 1);
    }
  }
  const r = spawnSync(real, args, { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

// ---------------------------------------------------------------- stage
function stage(slug) {
  const { src, patch } = GOLDENS[slug];
  const dst = path.join(MEDIA, slug);
  if (!fs.existsSync(src)) die(`${slug}: source workdir missing: ${src}`);
  if (fs.existsSync(path.join(dst, 'golden-stage.json'))) die(`${slug}: already staged at ${dst} (delete it to re-stage)`);
  fs.mkdirSync(dst, { recursive: true });
  const copy = (rel, to = rel) => {
    const s = path.join(src, rel);
    if (!fs.existsSync(s)) return false;
    fs.mkdirSync(path.dirname(path.join(dst, to)), { recursive: true });
    fs.copyFileSync(s, path.join(dst, to));
    return true;
  };
  // Small top-level text files (the edit plan) plus the three media inputs.
  for (const f of fs.readdirSync(src)) {
    const st = fs.statSync(path.join(src, f));
    if (st.isFile() && (st.size < 2e6 && !/\.(mp4|mov|wav|mp3)$/.test(f))) copy(f);
  }
  for (const f of ['vo.mp3', 'master.wav', 'screen.mp4', 'intro-film/out/intro.mp4',
    'intro-film/screenplay.json', 'intro-simple/cutlist.json']) copy(f);
  const { resolved } = readJson(path.join(src, 'resolved.json'));
  return import(path.join(ROOT, 'lib', 'render.mjs')).then(({ planRender }) => {
    for (const c of resolved) {
      const f = planRender(c).outFile;
      if (!copy(path.join('renders', f))) die(`${slug}: missing render ${f}`);
    }
    const ajPath = path.join(dst, 'avatar-jobs.json');
    if (fs.existsSync(ajPath)) {
      const aj = readJson(ajPath);
      for (const j of aj.jobs) {
        if (!j.file || !fs.existsSync(j.file)) continue;
        const to = path.join(dst, 'avatars', `${j.id}${path.extname(j.file)}`);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(j.file, to);
        j.file = to;
      }
      writeJson(ajPath, aj);
    }
    for (const [rel, fields] of Object.entries(patch)) {
      const p = path.join(dst, rel);
      writeJson(p, { ...readJson(p), ...fields });
    }
    writeJson(path.join(dst, 'golden-stage.json'), { src, staged: new Date().toISOString(), patch });
    const du = spawnSync('du', ['-sh', dst], { encoding: 'utf8' }).stdout.trim();
    console.log(`staged ${slug}: ${du}`);
  });
}

// ---------------------------------------------------------------- assemble once
function assemble(slug, mode) {
  const golden = path.join(MEDIA, slug);
  if (!fs.existsSync(path.join(golden, 'golden-stage.json'))) die(`${slug}: not staged — run: node scripts/golden.mjs stage ${slug}`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `golden-${slug}-`));
  const wd = path.join(tmp, 'wd');
  fs.mkdirSync(wd);
  // Symlinks into the immutable staged copy; assemble's own writes land in the temp dir.
  for (const f of fs.readdirSync(golden)) {
    if (['frames', 'check-frames', 'golden-stage.json', 'assembly.md', 'assembly-cache', 'assembly-tmp'].includes(f)) continue;
    fs.symlinkSync(path.join(golden, f), path.join(wd, f));
  }
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'ffmpeg'), `#!/bin/sh\nexec "${process.execPath}" "${SELF}" __shim "$@"\n`, { mode: 0o755 });
  const log = path.join(tmp, 'ffmpeg.log');
  const out = path.join(tmp, 'out.mp4');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GOLDEN_SHIM_LOG: log, GOLDEN_SHIM_MODE: mode,
    GOLDEN_REAL_FFMPEG: realFfmpeg(), GOLDEN_WH: '1280x720', ASSEMBLE_MEDIA_ROOT: path.join(tmp, 'media') };
  const jobs = String(Math.max(2, Math.floor(os.cpus().length / 2)));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'lib', 'assemble.mjs'), wd, ...ASSEMBLE_ARGS, '--out', out, '--jobs', jobs],
    { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) die(`${slug}: assemble failed (${mode})\n${(r.stdout + r.stderr).slice(-3000)}`);
  const norm = (s) => [[fs.realpathSync(wd), '<WD>'], [wd, '<WD>'], [fs.realpathSync(tmp), '<TMP>'], [tmp, '<TMP>'],
    [golden, '<GOLDEN>'], [REPO, '<REPO>']].reduce((acc, [a, b]) => acc.split(a).join(b), s);
  const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(norm(l)))
    .sort((a, b) => (a.args.at(-1) < b.args.at(-1) ? -1 : a.args.at(-1) > b.args.at(-1) ? 1 : 0));
  const plan = { assemblyMd: norm(fs.readFileSync(path.join(wd, 'assembly.md'), 'utf8')).split('\n'), ffmpeg: calls };
  return { plan, out, tmp };
}

const cleanup = (tmp) => fs.rmSync(tmp, { recursive: true, force: true });

// ---------------------------------------------------------------- plan diff
function diffPlan(want, got) {
  const lines = [];
  const md = Math.max(want.assemblyMd.length, got.assemblyMd.length);
  for (let i = 0; i < md; i++) {
    if (want.assemblyMd[i] !== got.assemblyMd[i]) lines.push(`assembly.md:${i + 1}\n  - ${want.assemblyMd[i] ?? '(none)'}\n  + ${got.assemblyMd[i] ?? '(none)'}`);
  }
  const key = (c) => c.args.at(-1);
  const w = new Map(want.ffmpeg.map((c) => [key(c), c]));
  const g = new Map(got.ffmpeg.map((c) => [key(c), c]));
  for (const k of w.keys()) if (!g.has(k)) lines.push(`ffmpeg job removed: ${k}`);
  for (const k of g.keys()) if (!w.has(k)) lines.push(`ffmpeg job added: ${k}`);
  for (const [k, a] of w) {
    const b = g.get(k);
    if (!b) continue;
    const n = Math.max(a.args.length, b.args.length);
    for (let i = 0; i < n; i++) {
      if (a.args[i] !== b.args[i]) { lines.push(`ffmpeg ${k} arg[${i}]\n  - ${a.args[i] ?? '(none)'}\n  + ${b.args[i] ?? '(none)'}`); break; }
    }
    if (JSON.stringify(a.files) !== JSON.stringify(b.files)) lines.push(`ffmpeg ${k}: caption file content changed`);
    if (a.concat !== b.concat) lines.push(`ffmpeg ${k}: concat list changed`);
  }
  return lines;
}

// ---------------------------------------------------------------- frames
function pickTimestamps(plan) {
  // Piece boundaries from the concat order and each piece's -frames:v count.
  const mux = plan.ffmpeg.find((c) => c.concat);
  const byName = new Map(plan.ffmpeg.map((c) => [path.basename(c.args.at(-1)), c]));
  const pieces = mux.concat.trim().split('\n').map((l) => /'(.+)'/.exec(l)[1]);
  const total = Number(mux.args[mux.args.indexOf('-t') + 1]);
  const cuts = [];
  const bounds = [];
  let f = 0;
  for (const p of pieces) {
    const c = byName.get(p);
    const n = Number(c.args[c.args.indexOf('-frames:v') + 1]);
    bounds.push(f / 30);
    if (n >= 15 && f > 0) cuts.push((f + 6) / 30);   // just past a cut
    f += n;
  }
  // Half the frames just past cuts, the rest evenly through the timeline (nudged off any cut).
  const nCuts = Math.min(cuts.length, N_FRAMES / 2);
  const picked = Array.from({ length: nCuts }, (_, i) => cuts[Math.round((i * (cuts.length - 1)) / Math.max(1, nCuts - 1))]);
  const nEven = N_FRAMES - picked.length;
  for (let i = 0; i < nEven; i++) {
    let t = (total * (i + 0.5)) / nEven;
    if (bounds.some((b) => Math.abs(t - b) < 0.2)) t += 0.4;
    picked.push(t);
  }
  return [...new Set(picked.map((t) => +t.toFixed(3)))].sort((a, b) => a - b);
}

function extractFrames(video, timestamps, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return timestamps.map((t, i) => {
    const p = path.join(dir, `${String(i).padStart(2, '0')}-${t.toFixed(3)}.png`);
    ff(['-y', '-ss', String(t), '-i', video, '-frames:v', '1', p]);
    return p;
  });
}

function ssim(a, b) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'ssim', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /All:([\d.]+)/.exec(r.stderr);
  return m ? Number(m[1]) : 0;
}

// ---------------------------------------------------------------- verbs
function record(slug) {
  const t0 = Date.now();
  const { plan, out, tmp } = assemble(slug, 'real');
  const stub = assemble(slug, 'plan');
  const selfDiff = diffPlan(plan, stub.plan);
  cleanup(stub.tmp);
  if (selfDiff.length) die(`${slug}: plan-only and full runs disagree — harness bug\n${selfDiff.join('\n')}`);
  const timestamps = pickTimestamps(plan);
  extractFrames(out, timestamps, path.join(MEDIA, slug, 'frames'));
  writeJson(path.join(SNAP, slug, 'plan.json'), plan);
  writeJson(path.join(SNAP, slug, 'frames.json'), { timestamps });
  cleanup(tmp);
  console.log(`recorded ${slug}: ${plan.ffmpeg.length} ffmpeg jobs, ${timestamps.length} frames (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

function check(slug, planOnly) {
  const t0 = Date.now();
  const planPath = path.join(SNAP, slug, 'plan.json');
  if (!fs.existsSync(planPath)) die(`${slug}: no recorded plan — run: node scripts/golden.mjs record ${slug}`);
  const { plan, out, tmp } = assemble(slug, planOnly ? 'plan' : 'real');
  let fail = false;
  const d = diffPlan(readJson(planPath), plan);
  if (d.length) {
    fail = true;
    console.error(`FAIL ${slug}: edit plan differs (${d.length} change${d.length > 1 ? 's' : ''})`);
    for (const l of d.slice(0, 40)) console.error('  ' + l.replace(/\n/g, '\n  '));
    if (d.length > 40) console.error(`  ... ${d.length - 40} more`);
  } else console.log(`ok   ${slug}: plan identical (${plan.ffmpeg.length} ffmpeg jobs)`);
  if (!planOnly) {
    const { timestamps } = readJson(path.join(SNAP, slug, 'frames.json'));
    const refDir = path.join(MEDIA, slug, 'frames');
    const candDir = path.join(MEDIA, slug, 'check-frames');
    const cand = extractFrames(out, timestamps, candDir);
    const scores = cand.map((p) => ({ t: timestamps[cand.indexOf(p)], s: ssim(path.join(refDir, path.basename(p)), p) }));
    const min = Math.min(...scores.map((x) => x.s));
    const SSIM_MIN = GOLDENS[slug].ssimMin;
    const bad = scores.filter((x) => x.s < SSIM_MIN);
    if (bad.length) {
      fail = true;
      console.error(`FAIL ${slug}: ${bad.length}/${scores.length} frames below SSIM ${SSIM_MIN}: `
        + bad.map((x) => `t=${x.t}s ssim=${x.s.toFixed(6)}`).join(', ') + `\n  compare ${refDir} vs ${candDir}`);
    } else console.log(`ok   ${slug}: ${scores.length} frames, min SSIM ${min.toFixed(6)} (threshold ${SSIM_MIN})`);
  }
  cleanup(tmp);
  console.log(`     ${slug}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return !fail;
}

const [verb, ...rest] = process.argv.slice(2);
if (verb === '__shim') shim(rest);
else {
  const planOnly = rest.includes('--plan-only');
  const slugs = rest.filter((a) => !a.startsWith('--'));
  for (const s of slugs) if (!GOLDENS[s]) die(`unknown golden: ${s} (have: ${Object.keys(GOLDENS).join(', ')})`);
  const targets = slugs.length ? slugs : Object.keys(GOLDENS);
  if (verb === 'stage') for (const s of targets) await stage(s);
  else if (verb === 'record') for (const s of targets) record(s);
  else if (verb === 'check') {
    const results = targets.map((s) => check(s, planOnly));
    if (results.some((x) => !x)) die('golden check FAILED');
    console.log(`golden check OK${planOnly ? ' (plan only)' : ''}`);
  } else die('usage: node scripts/golden.mjs stage|record|check [--plan-only] [slug...]');
}
