// 040: one fresh model run per moment, each in its own sealed stage, writes one hyperframes composition.
import fs from 'node:fs';
import path from 'node:path';
import { STEPS_DIR, TASTE_FILE, LOGOS_DIR, SKILLS_SRC, AUTHOR_SKILLS, workdirOf, stageDirOf, designSystemDir, readJson, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf, modelsOf } from './run-config.mjs';
import { freshStage, fillStage, sealStage, fillTemplate } from './stage.mjs';
import { momentWords } from './moments.mjs';
import { runClaude, pool } from './claude.mjs';
import { HYPERFRAMES } from './kit.mjs';

const STEP = '040-author-moments-llm';
export const COMPOSITION_ID = 'moment';

// Review frames at a quarter, a half and most of the way through: late reveals stay visible.
export const sampleTimes = (duration) => [0.25, 0.55, 0.85].map((p) => +(duration * p).toFixed(2));

export function loadMoments(slug) {
  const p = path.join(workdirOf(slug), 'moments.json');
  if (!fs.existsSync(p)) throw new Error('no moments.json: run plan-moments (030) first');
  return readJson(p).moments;
}

export function buildAuthorStage(slug, m, { cfg = readRunConfig(workdirOf(slug)), words = readJson(path.join(workdirOf(slug), 'transcript.json')) } = {}) {
  const canvas = canvasOf(cfg);
  const dir = freshStage(stageDirOf(slug, STEP, m.id));
  const prompt = fillTemplate(fs.readFileSync(path.join(STEPS_DIR, STEP, 'prompt.md'), 'utf8'), {
    ID: m.id, DURATION: m.duration.toFixed(2), W: canvas.w, H: canvas.h, FPS: canvas.fps,
    COMPOSITION_ID, HYPERFRAMES, SAMPLES: sampleTimes(m.duration).join(','),
  });
  const skills = Object.fromEntries(AUTHOR_SKILLS.map((s) => [path.join('.claude', 'skills', s), path.join(SKILLS_SRC, s)]));
  fillStage(dir, {
    'PROMPT.md': { text: prompt },
    'moment.json': { text: JSON.stringify({ id: m.id, duration: m.duration, idea: m.idea, why: m.why, words: momentWords(words, m) }, null, 2) + '\n' },
    'design-system': designSystemDir(cfg.designSystem),
    'TASTE-ANIMATE.md': TASTE_FILE,
    logos: LOGOS_DIR,
    ...skills,
  });
  fs.mkdirSync(path.join(dir, 'composition'), { recursive: true });
  sealStage(dir);
  return dir;
}

// The authored composition moves into the workdir; snapshots and logs stay in the stage.
export function collectComposition(slug, id, stage) {
  const src = path.join(stage, 'composition');
  if (!fs.existsSync(path.join(src, 'index.html'))) throw new Error(`moment ${id}: the run wrote no composition/index.html (stage ${stage})`);
  const dest = path.join(workdirOf(slug), 'moments', id);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  return dest;
}

export async function authorMoments(slug, { only = null, jobs = 3, stageOnly = false } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const words = readJson(path.join(workdir, 'transcript.json'));
  const moments = loadMoments(slug).filter((m) => !only || only.includes(m.id));
  if (!moments.length) throw new Error(`no moments match ${only}`);
  const stages = moments.map((m) => buildAuthorStage(slug, m, { cfg, words }));
  if (stageOnly) return { stages };
  const model = modelsOf(cfg).author;
  const results = await pool(moments, jobs, async (m, i) => {
    console.log(`040 ${m.id}: authoring (${m.duration}s) in ${stages[i]}`);
    const run = await runClaude({ cwd: stages[i], prompt: 'Read PROMPT.md in this folder and do exactly what it says.', model, maxTurns: 80, label: 'author' });
    let dest = null, error = null;
    try { dest = collectComposition(slug, m.id, stages[i]); } catch (e) { error = e.message; }
    console.log(`040 ${m.id}: ${error ? `FAILED ${error}` : 'done'} (${run.seconds}s, $${run.cost.toFixed(2)})`);
    return { id: m.id, ok: !error && run.ok, error: error ?? (run.ok ? null : `claude exited ${run.code}`), seconds: run.seconds, cost: run.cost,
      summary: String(run.envelope?.result ?? '').slice(0, 1200) };
  });
  const logPath = path.join(workdir, 'author-log.json');
  const prior = fs.existsSync(logPath) ? readJson(logPath) : { runs: {} };
  for (const r of results) prior.runs[r.id] = { ...r, at: new Date().toISOString(), model };
  writeJson(logPath, prior);
  return { results, stages };
}
