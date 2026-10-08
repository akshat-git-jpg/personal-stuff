import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveWorkdir } from '../workdir.mjs';
import { planCoupon, markOpenerBreaks } from './plan.mjs';
import { fixBrand, toolFromSlug } from './brand.mjs';
import { stepDir } from '../steps.mjs';

const stepRun = (num) => path.join(stepDir(num), 'run.sh');

// One command, raw recording in, final video out. Coupon videos skip every
// review gate by owner rule (2026-09-30); run-config template=coupon records that.
// Avatar is helen-office by default (--avatar <registry slug> overrides), on Avatar III only,
// as ONE render over the whole voiceover; the full-screen spans are cut from it.

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const REPO = path.resolve(ROOT, '..', '..', '..');
const PP_DRIVE = path.join(REPO, 'tooling', 'cli', 'drive', 'pp-drive');
const AVATAR_POLL_S = 60;
const AVATAR_TIMEOUT_MIN = 60;

function usage() {
  console.error('usage: node lib/coupon/run.mjs <slug> [--src <file|drive-file-id>] [--tool <Name>] [--avatar <slug>] [--drive-account <email>] [--plan-only] [--no-deliver]');
  process.exit(2);
}

function parseArgs(argv) {
  const o = { slug: argv[0], src: null, tool: null, avatar: null, driveAccount: null, planOnly: false, deliver: true };
  if (!o.slug || o.slug.startsWith('--')) usage();
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--src') o.src = argv[++i];
    else if (a === '--tool') o.tool = argv[++i];
    else if (a === '--avatar') o.avatar = argv[++i];
    else if (a === '--drive-account') o.driveAccount = argv[++i];
    else if (a === '--plan-only') o.planOnly = true;
    else if (a === '--no-deliver') o.deliver = false;
    else usage();
  }
  return o;
}

function sh(cmd, args, { cwd = ROOT, allowFail = false } = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  // Public npm for the card renderer's npx: a work-account registry token 401s here.
  const env = { ...process.env, npm_config_registry: 'https://registry.npmjs.org/' };
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env });
  if (r.status !== 0 && !allowFail) throw new Error(`${cmd} ${args[0] ?? ''} exited ${r.status}`);
  return r.status;
}

function log(slug, num, status, extra = {}) {
  const args = ['lib/run-log.mjs', slug, num, status];
  for (const [k, v] of Object.entries(extra)) args.push(`--${k}`, v);
  spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'ignore' });
}

const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

function setTemplate(workdir) {
  const p = path.join(workdir, 'run-config.json');
  const cfg = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  if (cfg.template !== 'coupon') writeJson(p, { ...cfg, template: 'coupon', decided_at: new Date().toISOString() });
}

function ingest(workdir, src, driveAccount) {
  const srcDir = path.join(workdir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  let raw = fs.readdirSync(srcDir).find((f) => /^raw\./.test(f));
  if (src) {
    if (fs.existsSync(src)) {
      raw = `raw${path.extname(src).toLowerCase() || '.mp4'}`;
      fs.copyFileSync(src, path.join(srcDir, raw));
    } else {
      if (!driveAccount) throw new Error('--src is not a local file, so it is read as a Drive file id: pass --drive-account <email>');
      raw = 'raw.mov';
      sh(PP_DRIVE, ['download', src, '--out', path.join(srcDir, raw), '--account', driveAccount]);
    }
    for (const f of ['screen.mp4', 'vo.mp3', 'transcript.json']) fs.rmSync(path.join(workdir, f), { force: true });
  }
  if (!raw) throw new Error(`no source: put the recording at ${srcDir}/raw.<ext> or pass --src`);
  const rawPath = path.join(srcDir, raw);
  if (!fs.existsSync(path.join(workdir, 'screen.mp4'))) {
    sh('ffmpeg', ['-v', 'error', '-y', '-i', rawPath, '-an', '-c:v', 'copy', '-movflags', '+faststart', path.join(workdir, 'screen.mp4')]);
  }
  if (!fs.existsSync(path.join(workdir, 'vo.mp3'))) {
    sh('ffmpeg', ['-v', 'error', '-y', '-i', rawPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', path.join(workdir, 'vo.mp3')]);
  }
}

function transcribe(slug, workdir, tool) {
  const tp = path.join(workdir, 'transcript.json');
  if (!fs.existsSync(tp)) {
    log(slug, '020', 'running');
    sh('bash', [stepRun('020'), slug]);
  }
  const branded = fixBrand(JSON.parse(fs.readFileSync(tp, 'utf8')), tool);
  const { words, marks } = markOpenerBreaks(branded.words);
  writeJson(tp, words);
  log(slug, '020', 'done', { did: `Transcribed the voiceover, fixed the tool name to "${tool}" in ${branded.fixes} place(s) and closed ${marks} run-on sentence(s) before the intro/outro openers, by rule. No LLM clean-up: coupon template.`, output: 'transcript.json' });
  return words;
}

function plan(slug, workdir, words, avatar) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(workdir, 'vo.mp3')], { encoding: 'utf8' });
  const r = planCoupon(words, { video: slug, total: parseFloat(probe.stdout) || null, ...(avatar ? { avatar } : {}) });
  if (r.errors.length) {
    for (const e of r.errors) console.error(`COUPON-PLAN: ${e}`);
    throw new Error('this recording does not follow the coupon script shape, so the template cannot place the edit');
  }
  writeJson(path.join(workdir, 'cues.json'), r.cues);
  writeJson(path.join(workdir, 'shots.json'), r.shots);
  writeJson(path.join(workdir, 'avatar-plan.json'), r.avatarPlan);
  const t = r.timeline;
  console.log(`\ncoupon plan: code ${r.code}; avatar full ${t.s01.start.toFixed(1)}-${t.s01.end.toFixed(1)}s and ${t.s02.start.toFixed(1)}-${t.total.toFixed(1)}s; ${r.cues.cues.length} cards`);
  for (const c of r.cues.cues) console.log(`  ${c.id} ${c.card}  "${c.anchor}"  lead ${c.lead}`);
  for (const n of r.notes) console.log(`  note: ${n}`);
  log(slug, '210', 'done', { did: `Placed ${r.cues.cues.length} cards and 2 full-screen avatar spans from the coupon rule table (lib/coupon/plan.mjs), no LLM.`, output: 'cues.json + shots.json + avatar-plan.json', ...(r.notes.length ? { issues: r.notes.join(' | ') } : {}) });
  return r;
}

function avatars(slug, workdir) {
  log(slug, '430', 'running');
  sh(process.execPath, ['lib/avatar-render.mjs', slug, '--submit']);
  const deadline = Date.now() + AVATAR_TIMEOUT_MIN * 60 * 1000;
  for (;;) {
    const code = sh(process.execPath, ['lib/avatar-render.mjs', slug, '--download'], { allowFail: true });
    if (code === 2) throw new Error('HEYGEN-CREDITS-SPENT: the credit check failed, stopping before anything else');
    const jobs = JSON.parse(fs.readFileSync(path.join(workdir, 'avatar-jobs.json'), 'utf8')).jobs;
    const pending = jobs.filter((j) => (j.video_id || j.from) && !j.file);
    const failed = jobs.filter((j) => !j.video_id && !j.from);
    if (failed.length) throw new Error(`avatar submit failed for ${failed.map((j) => j.id).join(', ')}`);
    const meter = JSON.parse(fs.readFileSync(path.join(workdir, 'heygen-meter.json'), 'utf8'));
    if (pending.length === 0 && meter.status === 'verified-free') break;
    if (pending.length === 0 && code !== 0) throw new Error('avatar clips are in but the credit check did not finish; re-run to retry it');
    if (Date.now() > deadline) throw new Error(`avatar clips still rendering after ${AVATAR_TIMEOUT_MIN} min: re-run this command to pick up where it left off`);
    console.log(`waiting on HeyGen: ${pending.length} clip(s) pending, next check in ${AVATAR_POLL_S}s`);
    spawnSync('sleep', [String(AVATAR_POLL_S)]);
  }
  const who = JSON.parse(fs.readFileSync(path.join(workdir, 'avatar-jobs.json'), 'utf8')).template;
  log(slug, '430', 'done', { did: `Rendered ${who} on Avatar III once over the whole voiceover, cut the full-screen spans from it, then re-read the HeyGen meters: no credits used.`, output: 'avatar-jobs.json + heygen-meter.json (verified-free)' });
}

function deliver(slug, workdir, driveAccount) {
  const final = path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow', slug, 'final.mp4');
  const copy = path.join(os.homedir(), 'Downloads', `${slug}-final.mp4`);
  fs.copyFileSync(final, copy);
  console.log(`\nfinal: ${copy}`);
  const cfgPath = path.join(workdir, 'run-config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (driveAccount && !cfg.drive_account) writeJson(cfgPath, { ...cfg, drive_account: driveAccount });
  if (cfg.drive_folder && (cfg.drive_account || driveAccount)) {
    log(slug, '620', 'running');
    sh('bash', [stepRun('620'), slug]);
    log(slug, '620', 'done', { did: 'Uploaded the coupon final to the Drive Output folder.', output: `Output/${slug}-final.mp4` });
  } else {
    console.log('no drive_folder in run-config.json, so nothing was uploaded to Drive');
  }
  return copy;
}

export async function main(argv) {
  const o = parseArgs(argv);
  // The card renderer (HyperFrames) refuses older Node; fail here, not 10 minutes in.
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error(`Node ${process.versions.node} is too old: the card renderer needs Node 22+ (macOS: export PATH=/opt/homebrew/opt/node@22/bin:$PATH)`);
  }
  const workdir = resolveWorkdir(o.slug);
  fs.mkdirSync(workdir, { recursive: true });
  const slug = path.basename(workdir);
  const tool = o.tool ?? toolFromSlug(slug);

  setTemplate(workdir);
  ingest(workdir, o.src, o.driveAccount);
  const words = transcribe(slug, workdir, tool);
  plan(slug, workdir, words, o.avatar);
  if (o.planOnly) return;

  log(slug, '310', 'running');
  sh(process.execPath, ['lib/resolve.mjs', slug]);
  sh(process.execPath, ['lib/resolve-shots.mjs', slug]);
  log(slug, '310', 'done', { did: 'Resolved the coupon cards and avatar spans to times.', output: 'resolved.json + shots.resolved.json' });

  avatars(slug, workdir);

  log(slug, '410', 'running');
  sh('bash', [stepRun('410'), slug]);
  log(slug, '410', 'done', { did: 'Rendered the coupon cards.', output: 'renders/' });
  sh(process.execPath, ['lib/effects-plan.mjs', slug]);
  sh(process.execPath, ['lib/sound/sfx-plan.mjs', slug]);
  sh(process.execPath, ['lib/sound/build-mix.mjs', slug]);
  log(slug, '460', 'done', { did: 'Planned sound effects and mixed the master.', output: 'master.wav' });

  log(slug, '510', 'running');
  sh(process.execPath, ['lib/assemble.mjs', slug]);
  log(slug, '510', 'done', { did: 'Assembled the coupon final: screen, full-screen avatar intro and outro with light-leak cuts, bubble, cards, captions everywhere.', output: 'final.mp4' });

  if (o.deliver) deliver(slug, workdir, o.driveAccount);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => { console.error(`\ncoupon run stopped: ${e.message}`); process.exit(1); });
}
