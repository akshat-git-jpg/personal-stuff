// 040: one fresh model run per moment, each in its own sealed stage, writes one hyperframes composition per format.
// Only moments whose storyboard panel (035) the owner approved are authored.
import fs from 'node:fs';
import path from 'node:path';
import { STEPS_DIR, TASTE_FILE, LOGOS_DIR, SKILLS_SRC, AUTHOR_SKILLS, workdirOf, stageDirOf, designSystemDir, readJson, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf, modelsOf, formatsOf } from './run-config.mjs';
import { freshStage, fillStage, sealStage, fillTemplate } from './stage.mjs';
import { momentWords } from './moments.mjs';
import { runClaude, pool } from './claude.mjs';
import { HYPERFRAMES } from './kit.mjs';
import { MAIN_FORMAT, formatCanvas, formatDirName, stageCompositionName, recordingBand } from './formats.mjs';
import { readBoard, boardGate, stillDir, panelPath } from './storyboard.mjs';
import { recordingFrame, busyRegion, describeBusy } from './recording.mjs';

const STEP = '040-author-moments-llm';
export const COMPOSITION_ID = 'moment';

// Review frames at a quarter, a half and most of the way through: late reveals stay visible.
export const sampleTimes = (duration) => [0.25, 0.55, 0.85].map((p) => +(duration * p).toFixed(2));

export function loadMoments(slug) {
  const p = path.join(workdirOf(slug), 'moments.json');
  if (!fs.existsSync(p)) throw new Error('no moments.json: run plan-moments (030) first');
  return readJson(p).moments;
}

// The prompt's per-format lines: where each composition goes and what frame it lays out in.
export function formatLines(formats, main, kind) {
  return formats.map((f) => {
    const c = formatCanvas(f, main);
    const head = `- \`${stageCompositionName(f)}/index.html\`: ${f}, ${c.w}x${c.h}px`;
    if (f === MAIN_FORMAT) return `${head} (the main cut).`;
    const b = recordingBand(f);
    return kind === 'overlay'
      ? `${head}. The recording sits in a band at y ${b.y}-${b.y + b.h}px; lay the graphic out in the frame around and on that band, re-composed for this shape, never a crop of the main one.`
      : `${head}. Re-compose the same idea for this shape (stack what sat side by side); never a crop of the main one.`;
  }).join('\n');
}

export function buildAuthorStage(slug, m, { cfg = readRunConfig(workdirOf(slug)), words = readJson(path.join(workdirOf(slug), 'transcript.json')), board = readBoard(slug) } = {}) {
  const canvas = canvasOf(cfg);
  const formats = formatsOf(cfg);
  const dir = freshStage(stageDirOf(slug, STEP, m.id));
  const kind = m.kind ?? 'takeover';
  const panel = board.moments?.[m.id];
  const prompt = fillTemplate(fs.readFileSync(path.join(STEPS_DIR, STEP, 'prompt.md'), 'utf8'), {
    ID: m.id, DURATION: m.duration.toFixed(2), W: canvas.w, H: canvas.h, FPS: canvas.fps,
    COMPOSITION_ID, HYPERFRAMES, SAMPLES: sampleTimes(m.duration).join(','), KIND: kind,
    KIND_RULES: kind === 'overlay'
      ? 'This moment is an OVERLAY: the screen recording keeps playing underneath. The root and the page stay transparent (no full-bleed background); paint only the graphic, and keep it off the region of the recording the voice is talking about (see `busy` in `moment.json`).'
      : 'This moment is a TAKEOVER: the graphic owns the whole frame, over a full-bleed background child, and hands back to the recording when it ends.',
    FORMATS: formatLines(formats, canvas, kind),
    STORYBOARD: panel?.status === 'approved'
      ? `\`storyboard/\` holds the owner-approved key still (\`still.html\`, and \`panel.png\` drawn over the recording). At ${panel.at}s your composition arrives at that frame. Animate toward it; do not redesign it.${panel.note ? ` Owner note on it: "${panel.note}".` : ''}`
      : 'There is no approved storyboard still for this moment (the owner skipped the gate). Design the key frame yourself against the frame checklist.',
  });
  const skills = Object.fromEntries(AUTHOR_SKILLS.map((s) => [path.join('.claude', 'skills', s), path.join(SKILLS_SRC, s)]));
  const sb = panel?.status === 'approved' && fs.existsSync(path.join(stillDir(slug, m.id), 'index.html'))
    ? { 'storyboard/still.html': path.join(stillDir(slug, m.id), 'index.html'), ...(fs.existsSync(panelPath(slug, m.id)) ? { 'storyboard/panel.png': panelPath(slug, m.id) } : {}) }
    : {};
  fillStage(dir, {
    'PROMPT.md': { text: prompt },
    'moment.json': { text: JSON.stringify({ id: m.id, kind, duration: m.duration, idea: m.idea, why: m.why, busy: describeBusy(busyRegion(slug, cfg, m)), words: momentWords(words, m) }, null, 2) + '\n' },
    'design-system': designSystemDir(cfg.designSystem),
    'TASTE-ANIMATE.md': TASTE_FILE,
    logos: LOGOS_DIR,
    ...sb,
    ...skills,
  });
  recordingFrame(slug, cfg, m.start + (panel?.at ?? m.duration / 2), path.join(dir, 'recording.jpg'), { w: 960, h: Math.round((960 * canvas.h) / canvas.w / 2) * 2 });
  for (const f of formats) fs.mkdirSync(path.join(dir, stageCompositionName(f)), { recursive: true });
  sealStage(dir);
  return dir;
}

// The authored compositions move into the workdir; snapshots and logs stay in the stage.
export function collectComposition(slug, id, stage, formats = [MAIN_FORMAT]) {
  const out = [];
  for (const f of formats) {
    const src = path.join(stage, stageCompositionName(f));
    if (!fs.existsSync(path.join(src, 'index.html'))) throw new Error(`moment ${id}: the run wrote no ${stageCompositionName(f)}/index.html (stage ${stage})`);
    const dest = path.join(workdirOf(slug), 'moments', formatDirName(id, f));
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
    out.push(dest);
  }
  return out[0];
}

export async function authorMoments(slug, { only = null, jobs = 3, stageOnly = false, skipStoryboard = false } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const words = readJson(path.join(workdir, 'transcript.json'));
  const moments = loadMoments(slug).filter((m) => !only || only.includes(m.id));
  if (!moments.length) throw new Error(`no moments match ${only}`);
  const board = readBoard(slug);
  const blocked = boardGate(board, moments);
  if (blocked.length && !skipStoryboard) {
    throw new Error(`storyboard gate: these moments are not approved, so 040 will not author them:\n  ${blocked.map((b) => `${b.id}: ${b.why}`).join('\n  ')}\n`
      + `approve them (node lib/run.mjs ${slug} storyboard-review), or pass --skip-storyboard to override`);
  }
  if (blocked.length) console.warn(`040: storyboard gate overridden for ${blocked.map((b) => b.id).join(', ')}`);
  const stages = moments.map((m) => buildAuthorStage(slug, m, { cfg, words, board }));
  if (stageOnly) return { stages };
  const model = modelsOf(cfg).author;
  const formats = formatsOf(cfg);
  const results = await pool(moments, jobs, async (m, i) => {
    console.log(`040 ${m.id}: authoring (${m.duration}s) in ${stages[i]}`);
    const run = await runClaude({ cwd: stages[i], prompt: 'Read PROMPT.md in this folder and do exactly what it says.', model, maxTurns: 80 + 30 * (formats.length - 1), label: 'author' });
    let dest = null, error = null;
    try { dest = collectComposition(slug, m.id, stages[i], formats); } catch (e) { error = e.message; }
    console.log(`040 ${m.id}: ${error ? `FAILED ${error}` : 'done'} (${run.seconds}s, $${run.cost.toFixed(2)})`);
    return { id: m.id, ok: !error && run.ok, error: error ?? (run.ok ? null : `claude exited ${run.code}`), seconds: run.seconds, cost: run.cost,
      summary: String(run.envelope?.result ?? '').slice(0, 1200), ...(blocked.some((b) => b.id === m.id) ? { storyboardSkipped: true } : {}) };
  });
  const logPath = path.join(workdir, 'author-log.json');
  const prior = fs.existsSync(logPath) ? readJson(logPath) : { runs: {} };
  for (const r of results) prior.runs[r.id] = { ...r, at: new Date().toISOString(), model };
  writeJson(logPath, prior);
  return { results, stages, dest: results.map((r) => r.id) };
}
