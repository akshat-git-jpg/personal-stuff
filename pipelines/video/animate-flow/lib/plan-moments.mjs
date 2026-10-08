// 030: a fresh model run, staged outside the repo, picks the moments that deserve a graphic.
import fs from 'node:fs';
import path from 'node:path';
import { STEPS_DIR, TASTE_FILE, workdirOf, stageDirOf, designSystemDir, readJson, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf, modelsOf } from './run-config.mjs';
import { freshStage, fillStage, sealStage, fillTemplate } from './stage.mjs';
import { wordTable, resolveMoments } from './moments.mjs';
import { runClaude } from './claude.mjs';

const STEP = '030-plan-moments-llm';

// About one graphic per 15s of narration, at least two.
export const targetCount = (total) => Math.max(2, Math.round(total / 15));

export function buildPlanStage(slug) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const tPath = path.join(workdir, 'transcript.json');
  if (!fs.existsSync(tPath)) throw new Error('no transcript.json: run transcribe (020) first');
  const words = readJson(tPath);
  const canvas = canvasOf(cfg);
  const dir = freshStage(stageDirOf(slug, STEP));
  const prompt = fillTemplate(fs.readFileSync(path.join(STEPS_DIR, STEP, 'prompt.md'), 'utf8'), {
    TOTAL: cfg.total.toFixed(1),
    TARGET: cfg.moments?.target ?? targetCount(cfg.total),
    BED: cfg.source.screen ? 'a screen recording' : 'a plain background (there is no screen recording)',
    CANVAS: `${canvas.w}x${canvas.h}`,
  });
  fillStage(dir, {
    'PROMPT.md': { text: prompt },
    'transcript.tsv': { text: wordTable(words) },
    'transcript.json': tPath,
    'DESIGN.md': path.join(designSystemDir(cfg.designSystem), 'DESIGN.md'),
    'TASTE-ANIMATE.md': TASTE_FILE,
    'moments.mjs': path.join(import.meta.dirname, 'moments.mjs'),
  });
  sealStage(dir);
  return { dir, cfg, words };
}

export async function planMoments(slug, { stageOnly = false } = {}) {
  const { dir, cfg, words } = buildPlanStage(slug);
  if (stageOnly) return { stage: dir };
  const model = modelsOf(cfg).plan;
  let run = await runClaude({ cwd: dir, prompt: 'Read PROMPT.md in this folder and do exactly what it says.', model, maxTurns: 40, label: 'plan' });
  let cost = run.cost;
  const check = () => {
    const f = path.join(dir, 'moments.json');
    if (!fs.existsSync(f)) return { errors: ['moments.json was not written'], moments: [] };
    try { return resolveMoments(readJson(f), words, { total: cfg.total }); } catch (e) { return { errors: [`moments.json is not valid JSON: ${e.message}`], moments: [] }; }
  };
  let res = check();
  // One correction round in the same session, with the validator's own words.
  if (res.errors.length && run.sessionId) {
    run = await runClaude({ cwd: dir, model, maxTurns: 20, resume: run.sessionId, label: 'plan-fix',
      prompt: `moments.json fails validation. Fix it and run the check again:\n${res.errors.map((e) => `- ${e}`).join('\n')}` });
    cost += run.cost;
    res = check();
  }
  if (res.errors.length) throw new Error(`moments.json still invalid after one correction round (stage ${dir}):\n  ${res.errors.join('\n  ')}`);
  const doc = readJson(path.join(dir, 'moments.json'));
  const out = { video: cfg.video, designSystem: cfg.designSystem, total: cfg.total, planned: new Date().toISOString(), moments: res.moments };
  if (doc.note) out.note = doc.note;
  writeJson(path.join(workdirOf(slug), 'moments.json'), out);
  return { stage: dir, moments: res.moments, cost };
}
