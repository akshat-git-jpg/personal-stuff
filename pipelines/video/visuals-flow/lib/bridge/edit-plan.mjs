// The kb-editor bridge's input: a workdir's approved plan as the kit edit plan, with no render needed.
// Cards keep their cue in `data` so the editor places a live Motif instead of the rendered `src`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { templateEditPlan } from '../assemble.mjs';
import { jobPurpose } from '../shot-constants.mjs';
import { introSpan } from '../intro-modes.mjs';
import { isCouponTemplate, loadRunConfig } from '../run-config.mjs';
import { resolveWorkdir } from '../workdir.mjs';
import { resolveCanvas, validateEditPlan } from '../kit/edit-plan.mjs';

const AVATAR_MODES = { 'avatar-full': 'full', 'avatar-panel': 'panel', 'avatar-side': 'side', corner: 'bubble' };

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  if (!Number.isFinite(d)) throw new Error(`ffprobe could not read ${file}`);
  return d;
}

// A job written on another machine (e.g. the Windows PC) is looked up in this machine's heygen folder.
export function localAvatarFile(job, video, home = os.homedir()) {
  if (job.file && fs.existsSync(job.file)) return job.file;
  if (!job.file) return null;
  const local = path.join(home, 'kb-scratch', 'video', 'heygen', 'visuals-flow', video, job.file.split(/[\\/]/).pop());
  return fs.existsSync(local) ? local : null;
}

export function bridgeEditPlan(slugOrPath, { probe = probeDuration, home = os.homedir(), force = false } = {}) {
  const workdir = resolveWorkdir(slugOrPath);
  const warnings = [];
  const vo = path.join(workdir, 'vo.mp3');
  if (!fs.existsSync(vo)) throw new Error(`missing ${vo}`);
  const { video, resolved } = readJson(path.join(workdir, 'resolved.json'));

  const shotsPath = path.join(workdir, 'shots.json');
  if (fs.existsSync(shotsPath) && readJson(shotsPath).approved !== true && !force) {
    throw new Error('the storyboard is not approved (shots.json approved=false): approve it on the board first');
  }

  const jobs = { full: [], panel: [], side: [], bubble: [] };
  const jobsPath = path.join(workdir, 'avatar-jobs.json');
  for (const j of fs.existsSync(jobsPath) ? readJson(jobsPath).jobs : []) {
    const mode = AVATAR_MODES[jobPurpose(j)];
    if (!mode) continue;
    const file = localAvatarFile(j, video, home);
    if (!file) { warnings.push(`avatar ${j.id}: clip not on this machine (${j.file ?? 'never downloaded'}), skipped`); continue; }
    jobs[mode].push({ ...j, file });
  }

  const film = isCouponTemplate(workdir) ? null : introSpan(workdir);
  const filmFile = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
  if (film && !fs.existsSync(filmFile)) warnings.push(`intro film not rendered (${filmFile}), skipped`);

  const plan = templateEditPlan({
    workdir, resolved,
    avatarJobs: jobs.full, panelJobs: jobs.panel, sideJobs: jobs.side, cornerJobs: jobs.bubble,
    total: probe(vo), screen: path.join(workdir, 'screen.mp4'),
    filmSpan: film && fs.existsSync(filmFile) ? film : null,
    canvas: resolveCanvas(loadRunConfig(workdir).canvas),
  });
  plan.audio = { src: vo };
  return { plan: validateEditPlan(plan), warnings, video, workdir };
}

// CLI for the editor plugin: run in its own node so no yt-edit module loads inside the editor.
// usage: node lib/bridge/edit-plan.mjs <slug-or-workdir> [--force]   → JSON on stdout
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    process.stdout.write(JSON.stringify(bridgeEditPlan(args.find((a) => !a.startsWith('--')), { force: args.includes('--force') })));
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
