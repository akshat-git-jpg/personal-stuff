// The kb-editor bridge's input: a workdir's plan as the kit edit plan, with no render needed.
// Cards keep their cue in `data` so the editor places a live Motif instead of the rendered `src`.
// An avatar span with no rendered clip yet comes back in `drafts`, for a grey box in the editor.
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
// 1 s of slack: a last span snapped to the VO end after its render still uses that clip, as the old assembly does.
const near = (a, b) => Math.abs(a - b) <= 1;

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

function spokenText(words, start, end) {
  const text = words.filter((w) => w.start >= start - 0.05 && w.end <= end + 0.05).map((w) => w.text).join(' ');
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

export function bridgeEditPlan(slugOrPath, { probe = probeDuration, home = os.homedir(), force = false, draft = false } = {}) {
  const workdir = resolveWorkdir(slugOrPath);
  const warnings = [];
  const vo = path.join(workdir, 'vo.mp3');
  if (!fs.existsSync(vo)) throw new Error(`missing ${vo}`);
  const { video, resolved } = readJson(path.join(workdir, 'resolved.json'));

  const shotsPath = path.join(workdir, 'shots.json');
  const approved = !fs.existsSync(shotsPath) || readJson(shotsPath).approved === true;
  if (!approved && !force && !draft) {
    throw new Error('the storyboard is not approved (shots.json approved=false): push it as a draft, then approve it');
  }

  // The storyboard's spans decide where full/panel/side avatars go; a render for other times is stale.
  const spansPath = path.join(workdir, 'shots.resolved.json');
  const spans = fs.existsSync(spansPath) ? readJson(spansPath).spans ?? [] : null;
  const spanById = new Map((spans ?? []).map((s) => [s.id, s]));

  const jobs = { full: [], panel: [], side: [], bubble: [] };
  const jobsPath = path.join(workdir, 'avatar-jobs.json');
  for (const j of fs.existsSync(jobsPath) ? readJson(jobsPath).jobs : []) {
    const mode = AVATAR_MODES[jobPurpose(j)];
    if (!mode) continue;
    if (spans && mode !== 'bubble') {
      const s = spanById.get(j.id);
      if (!s || !near(s.start, j.start) || !near(s.end, j.end)) {
        if (s) warnings.push(`avatar ${j.id}: rendered for an older storyboard, re-render it`);
        continue;
      }
    }
    const file = localAvatarFile(j, video, home);
    if (!file) { if (!spans || mode === 'bubble') warnings.push(`avatar ${j.id}: clip not on this machine (${j.file ?? 'never downloaded'}), skipped`); continue; }
    jobs[mode].push({ ...j, file });
  }

  const placed = new Set([...jobs.full, ...jobs.panel, ...jobs.side].map((j) => j.id));
  const transcriptPath = path.join(workdir, 'transcript.json');
  const words = fs.existsSync(transcriptPath) ? readJson(transcriptPath) : [];
  const drafts = (spans ?? []).filter((s) => !placed.has(s.id)).map((s) => ({
    id: s.id, mode: s.mode ?? 'full', start: s.start, end: s.end, text: spokenText(Array.isArray(words) ? words : [], s.start, s.end),
  }));
  for (const d of drafts) warnings.push(`avatar ${d.id}: not rendered yet, a grey box stands in`);

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
  return { plan: validateEditPlan(plan), drafts, approved, warnings, video, workdir };
}

// CLI for the editor plugin: run in its own node so no yt-edit module loads inside the editor.
// usage: node lib/bridge/edit-plan.mjs <slug-or-workdir> [--draft]   → JSON on stdout
//        node lib/bridge/edit-plan.mjs <slug-or-workdir> --approve   → approves the storyboard (step 340)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const target = args.find((a) => !a.startsWith('--'));
    if (args.includes('--approve')) {
      const { approveStoryboard } = await import('../board.mjs');
      const workdir = resolveWorkdir(target);
      approveStoryboard(workdir);
      process.stdout.write(JSON.stringify({ approved: true, workdir }));
    } else {
      const draft = args.includes('--draft') || args.includes('--force');
      process.stdout.write(JSON.stringify(bridgeEditPlan(target, { draft })));
    }
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
