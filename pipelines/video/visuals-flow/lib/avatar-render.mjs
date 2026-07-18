import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolveShots } from './resolve-shots.mjs';
import { lintShots } from './lint-shots.mjs';
import { mmss } from './render.mjs';

export const CORNER_CHUNK = 300;
export const PACING = { minGap: 45, maxGap: 150, settleEvery: 5, settleGap: 600 };
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
export const HEYGEN_WEB = process.env.HEYGEN_WEB_BIN
  ?? `node ${path.join(REPO_ROOT, 'tooling', 'cli', 'heygen-web', 'heygen-web.mjs')}`;
export const MEDIA_ROOT = process.env.AVATAR_MEDIA_ROOT ?? path.join(os.homedir(), 'kb-scratch', 'video', 'heygen', 'visuals-flow');

export function planCornerChunks(totalDuration, chunk = CORNER_CHUNK) {
  const out = [];
  for (let i = 0, n = 1; i < totalDuration; i += chunk, n++) {
    out.push({ id: `corner-${String(n).padStart(2, '0')}`, start: +i.toFixed(2), end: +Math.min(i + chunk, totalDuration).toFixed(2) });
  }
  return out;
}

export function planJobs(shotsResolved, totalDuration, { spansOnly = false } = {}) {
  const spanJobs = (shotsResolved.spans || []).map((s) => ({ id: s.id, kind: 'avatar-full', start: s.start, end: s.end }));
  const cornerJobs = spansOnly ? [] : planCornerChunks(totalDuration).map((c) => ({ ...c, kind: 'corner' }));
  return [...spanJobs, ...cornerJobs].map((j) => ({ ...j, duration: +(j.end - j.start).toFixed(2) }));
}

export function avatarManifestMd(video, jobs, offset = 0) {
  const done = jobs.filter((j) => j.file);
  const rows = done.sort((a, b) => a.start - b.start).map((j) =>
    `| ${mmss(j.start + offset)} | ${path.basename(j.file)} | ${j.duration}s | ${j.kind} |`);
  const cornerNote = jobs.some((j) => j.kind === 'corner')
    ? `Corner chunks are contiguous — drop them in sequence from ${mmss(offset)}; the editor cuts the corner during avatar-full spans.`
    : 'Full-screen avatar clips only (corner track not rendered for this video).';
  return [
    `# ${video} — avatar manifest`,
    '',
    cornerNote,
    '',
    '| place at | file | duration | kind |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = { workdir: null, template: null, submit: false, download: false, force: false };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--template') opts.template = rest.shift();
    else if (a === '--submit') opts.submit = true;
    else if (a === '--download') opts.download = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--spans-only') opts.spansOnly = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir || (!opts.submit && !opts.download)) {
    console.error('usage: node lib/avatar-render.mjs <slug-or-path> [--template <slug>] [--submit] [--download] [--force]');
    process.exit(1);
  }

  const workdir = resolveWorkdir(opts.workdir);
  const shotsPath = path.join(workdir, 'shots.json');
  const shotsResolvedPath = path.join(workdir, 'shots.resolved.json');
  const resolvedPath = path.join(workdir, 'resolved.json');
  const transcriptPath = path.join(workdir, 'transcript.json');

  if (opts.submit) {
    const shotsFile = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
    const shotsResolved = JSON.parse(fs.readFileSync(shotsResolvedPath, 'utf8'));
    const resolvedFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

    if (shotsFile.approved !== true && !opts.force) {
      console.error('refusing to render: shots.json approved=false — review on the board or pass --force');
      process.exit(1);
    }

    const recomputed = resolveShots(shotsFile, words);
    if (recomputed.errors.length > 0 || JSON.stringify(recomputed.spans) !== JSON.stringify(shotsResolved.spans)) {
      if (!opts.force) {
        console.error('re-run node lib/resolve-shots.mjs <slug>');
        process.exit(1);
      } else {
        console.warn('warning: proceeding anyway due to --force');
      }
    }

    const lintRes = lintShots({ shotsResolved, resolvedCues: resolvedFile.resolved, words });
    if (lintRes.errors.length > 0) {
      for (const e of lintRes.errors) console.error(e);
      process.exit(1);
    }

    if (shotsFile.engineMode !== 'test') {
      console.error('engineMode "production" is not implemented yet — keep "test" (see docs/specs/2026-07-18-avatar-shot-plan-design.md)');
      process.exit(1);
    }

    if (!opts.template) {
      console.error('missing --template');
      process.exit(1);
    }

    const authRes = spawnSync(HEYGEN_WEB, ['auth-check'], { shell: true, encoding: 'utf8' });
    if (authRes.status !== 0) {
      console.error('auth expired — recapture cURLs (tooling/cli/heygen-web/CLAUDE.md)');
      process.exit(1);
    }

    const slicesDir = path.join(workdir, 'slices-avatar');
    fs.mkdirSync(slicesDir, { recursive: true });

    const totalDuration = words[words.length - 1].end;
    const jobs = planJobs(shotsResolved, totalDuration, { spansOnly: !!opts.spansOnly });

    let jobsState = [];
    const jobsPath = path.join(workdir, 'avatar-jobs.json');
    if (fs.existsSync(jobsPath)) {
      jobsState = JSON.parse(fs.readFileSync(jobsPath, 'utf8')).jobs || [];
    }

    for (const job of jobs) {
      const audioPath = path.join(slicesDir, `${job.id}.mp3`);
      if (!fs.existsSync(audioPath)) {
        const voPath = path.join(workdir, 'vo.mp3');
        spawnSync('ffmpeg', ['-y', '-i', voPath, '-ss', String(job.start), '-to', String(job.end), '-c', 'copy', audioPath]);
      }
    }

    const outJobs = [];
    let submittedAny = false;
    let submitsInRun = 0;
    let exitCode = 0;

    for (const job of jobs) {
      const existing = jobsState.find(j => j.id === job.id);
      if (existing && existing.video_id) {
        outJobs.push(existing);
        continue;
      }

      if (process.env.AVATAR_RENDER_NO_PACING !== '1' && submittedAny) {
        const gap = Math.floor(Math.random() * (PACING.maxGap - PACING.minGap + 1)) + PACING.minGap;
        const sleepSec = (submitsInRun > 0 && submitsInRun % PACING.settleEvery === 0) ? PACING.settleGap : gap;
        spawnSync('sleep', [String(sleepSec)]);
      }

      const title = `${shotsResolved.video}__${job.id}`;
      const audioPath = path.join('slices-avatar', `${job.id}.mp3`);
      const cmd = `${HEYGEN_WEB} generate-from-template --template ${opts.template} --audio ${audioPath} --title ${title}`;
      const res = spawnSync(cmd, { shell: true, encoding: 'utf8', cwd: workdir });
      let video_id = null;
      let status = 'failed';
      try {
        const parsed = JSON.parse(res.stdout);
        if (parsed.video_id) {
          video_id = parsed.video_id;
          status = 'submitted';
        }
      } catch (e) {}

      const newJob = {
        id: job.id, kind: job.kind, start: job.start, end: job.end, duration: job.duration,
        audio: audioPath, video_id, status, submitted_at: new Date().toISOString()
      };
      // Surface the CLI's voice instead of swallowing it (s03 incident 2026-07-18:
      // a failed submit left zero evidence of WHY, and the per-submit meter
      // check — the proof Avatar III stayed free — was invisible too).
      const cliSays = `${res.stderr ?? ''}\n${res.stdout ?? ''}`.trim();
      if (!video_id) {
        newJob.error = cliSays.slice(-400) || `exit ${res.status} with empty output`;
        console.error(`${job.id}: submit FAILED — ${newJob.error}`);
      } else {
        const meter = cliSays.match(/UNLIMITED|NOT-free/)?.[0] ?? 'meter-check not seen';
        console.error(`${job.id}: submitted ${video_id} [${meter}]`);
        if (/NOT-free/.test(cliSays)) console.error(`${job.id}: ⚠️ meter says NOT-free — Avatar III unlimited assumption broken, investigate before submitting more`);
      }
      outJobs.push(newJob);

      fs.writeFileSync(jobsPath, JSON.stringify({
        video: shotsResolved.video,
        template: opts.template,
        engineMode: "test",
        jobs: outJobs
      }, null, 2));

      if (!video_id) exitCode = 1;

      submittedAny = true;
      submitsInRun++;
    }

    // Final flush — the per-submit write above only fires on submits, so a run
    // whose trailing jobs are all skips (e.g. a retry of one failed job) would
    // otherwise leave the file missing every job after the last submit
    // (incident: test-01 s03 retry dropped s04–s09, 2026-07-18).
    fs.writeFileSync(jobsPath, JSON.stringify({
      video: shotsResolved.video,
      template: opts.template,
      engineMode: "test",
      jobs: outJobs
    }, null, 2));
    process.exit(exitCode);
  }

  if (opts.download) {
    const jobsPath = path.join(workdir, 'avatar-jobs.json');
    if (!fs.existsSync(jobsPath)) process.exit(0);
    const jobsData = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
    const jobs = jobsData.jobs || [];
    let exitCode = 0;
    const outDir = path.join(MEDIA_ROOT, jobsData.video);
    fs.mkdirSync(outDir, { recursive: true });

    for (const job of jobs) {
      if (!job.video_id) continue;
      if (job.file) continue;

      const res = spawnSync(`${HEYGEN_WEB} status ${job.video_id}`, { shell: true, encoding: 'utf8', cwd: workdir });
      try {
        const parsed = JSON.parse(res.stdout);
        if (parsed.status === 'completed') {
          const outFile = path.join(outDir, `${job.id}.mp4`);
          const dlRes = spawnSync(`${HEYGEN_WEB} download ${job.video_id} --out ${outFile}`, { shell: true, encoding: 'utf8', cwd: workdir });
          if (dlRes.status !== 0) {
            exitCode = 1;
          } else {
            job.file = outFile;
          }
        } else {
          console.log(`pending: ${job.id}`);
        }
      } catch (e) {
        exitCode = 1;
      }
    }

    fs.writeFileSync(jobsPath, JSON.stringify(jobsData, null, 2));

    const shotsResolved = JSON.parse(fs.readFileSync(shotsResolvedPath, 'utf8'));
    const manifestStr = avatarManifestMd(jobsData.video, jobs, shotsResolved.offset || 0);
    fs.writeFileSync(path.join(workdir, 'avatar-manifest.md'), manifestStr);

    process.exit(exitCode);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
