// 035: one cheap key still per moment, drawn by one sealed model run, composited over the real recording frame,
// then a contact sheet and per-panel approval. 040 refuses a moment whose panel is not approved.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { STEPS_DIR, TASTE_FILE, LOGOS_DIR, workdirOf, mediaDirOf, stageDirOf, designSystemDir, readJson, writeJson } from './paths.mjs';
import { readRunConfig, canvasOf, modelsOf } from './run-config.mjs';
import { freshStage, fillStage, sealStage, fillTemplate } from './stage.mjs';
import { momentWords } from './moments.mjs';
import { runClaude } from './claude.mjs';
import { ffmpeg } from './media.mjs';
import { screenshotPage, drawtextFont } from './kit.mjs';
import { loadMoments } from './author-moments.mjs';
import { recordingFrame, busyRegion, describeBusy } from './recording.mjs';
import { backgroundColour } from './assemble.mjs';
import { restoreAssets } from './assets.mjs';

const STEP = '035-storyboard-moments-llm';
export const STATUSES = ['pending', 'approved', 'rejected'];

// What a panel was drawn for: a re-planned moment (new span, kind or idea) makes its approval stale.
export const momentSig = (m) => createHash('sha1').update(JSON.stringify([m.id, m.kind ?? 'takeover', m.start, m.end, m.idea])).digest('hex').slice(0, 12);

const boardPath = (slug) => path.join(workdirOf(slug), 'storyboard.json');
export const panelPath = (slug, id) => path.join(mediaDirOf(slug), 'storyboard', `${id}.png`);
export const sheetPath = (slug) => path.join(mediaDirOf(slug), 'storyboard', 'storyboard.png');
export const stillDir = (slug, id) => path.join(workdirOf(slug), 'storyboard', id);

export function readBoard(slug) {
  return fs.existsSync(boardPath(slug)) ? readJson(boardPath(slug)) : { video: slug, moments: {} };
}

// Per moment: approved, or why not.
export function boardGate(board, moments) {
  const blocked = [];
  for (const m of moments) {
    const p = board.moments?.[m.id];
    if (!p) blocked.push({ id: m.id, why: 'no storyboard panel yet (run storyboard, 035)' });
    else if (p.sig !== momentSig(m)) blocked.push({ id: m.id, why: 'the moment changed since its panel was drawn (re-run storyboard --only)' });
    else if (p.status !== 'approved') blocked.push({ id: m.id, why: `panel is ${p.status}${p.note ? `: "${p.note}"` : ''}` });
  }
  return blocked;
}

// Owner decision on one or more panels. Rejecting keeps the note, which the next storyboard run reads.
export function decide(slug, ids, status, note) {
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);
  const board = readBoard(slug);
  for (const id of ids) {
    if (!board.moments[id]) throw new Error(`no storyboard panel for ${id}`);
    board.moments[id] = { ...board.moments[id], status, decided: new Date().toISOString(), ...(note !== undefined ? { note } : {}) };
  }
  writeJson(boardPath(slug), board);
  return board;
}

// Validates the run's board.json against the moments it was asked to draw.
export function boardErrors(doc, moments, dir) {
  const errs = [];
  if (!doc || typeof doc !== 'object') return ['board.json must be an object keyed by moment id'];
  for (const m of moments) {
    const e = doc[m.id];
    if (!e) { errs.push(`board.json has no entry for ${m.id}`); continue; }
    if (!(Number.isFinite(e.at) && e.at >= 0 && e.at <= m.duration)) errs.push(`${m.id}: at must be seconds within 0-${m.duration}`);
    if (typeof e.caption !== 'string' || !e.caption.trim()) errs.push(`${m.id}: caption is required (one line)`);
    if (dir && !fs.existsSync(path.join(dir, 'stills', `${m.id}.html`))) errs.push(`stills/${m.id}.html was not written`);
  }
  return errs;
}

export function buildBoardStage(slug, moments, { cfg = readRunConfig(workdirOf(slug)) } = {}) {
  const workdir = workdirOf(slug);
  const words = readJson(path.join(workdir, 'transcript.json'));
  const canvas = canvasOf(cfg);
  const prior = readBoard(slug);
  const dir = freshStage(stageDirOf(slug, STEP));
  const prompt = fillTemplate(fs.readFileSync(path.join(STEPS_DIR, STEP, 'prompt.md'), 'utf8'), {
    W: canvas.w, H: canvas.h, COUNT: moments.length, IDS: moments.map((m) => m.id).join(', '),
    BED: cfg.source.screen ? 'a screen recording' : 'a plain background (there is no screen recording)',
  });
  const brief = moments.map((m) => ({
    id: m.id, kind: m.kind ?? 'takeover', duration: m.duration, idea: m.idea, why: m.why,
    recording: `recording/${m.id}.jpg`, busy: describeBusy(busyRegion(slug, cfg, m)),
    ...(prior.moments?.[m.id]?.status === 'rejected' && prior.moments[m.id].note ? { ownerNote: prior.moments[m.id].note } : {}),
    words: momentWords(words, m),
  }));
  for (const m of moments) {
    const f = path.join(dir, 'recording', `${m.id}.jpg`);
    recordingFrame(slug, cfg, m.start + m.duration / 2, f, { w: 960, h: Math.round((960 * canvas.h) / canvas.w / 2) * 2, colour: backgroundColour(cfg.designSystem) });
  }
  fillStage(dir, {
    'PROMPT.md': { text: prompt },
    'moments.json': { text: JSON.stringify({ moments: brief }, null, 2) + '\n' },
    'design-system': designSystemDir(cfg.designSystem),
    'TASTE-ANIMATE.md': TASTE_FILE,
    logos: LOGOS_DIR,
  });
  fs.mkdirSync(path.join(dir, 'stills'), { recursive: true });
  sealStage(dir);
  return dir;
}

// A drawn still over the recording frame at its key time, labelled for the sheet.
function composePanel(slug, cfg, m, stillHtml, at, canvas) {
  const media = path.join(mediaDirOf(slug), 'storyboard');
  const still = screenshotPage(stillHtml, path.join(media, `${m.id}-still.png`), { w: canvas.w, h: canvas.h });
  const rec = recordingFrame(slug, cfg, m.start + at, path.join(media, `${m.id}-rec.png`), { w: canvas.w, h: canvas.h, colour: backgroundColour(cfg.designSystem) });
  const out = panelPath(slug, m.id);
  ffmpeg(['-i', rec, '-i', still, '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto', '-frames:v', '1', out], `panel ${m.id}`);
  return out;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '\\%');

// One image, three panels across, each labelled with its number, id, kind, time and caption.
export function renderSheet(slug, moments, board) {
  const dir = path.join(mediaDirOf(slug), 'storyboard', 'thumbs');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const font = drawtextFont();
  moments.forEach((m, i) => {
    const p = board.moments[m.id];
    const label = `${i + 1}  ${m.id}  ${m.kind ?? 'takeover'}  ${(m.start + p.at).toFixed(1)}s  [${p.status}]`;
    ffmpeg(['-i', panelPath(slug, m.id), '-vf', `scale=640:360,pad=640:420:0:0:color=0x111111,drawtext=${font}:text='${esc(label)}':x=10:y=366:fontsize=18:fontcolor=white,drawtext=${font}:text='${esc(p.caption.slice(0, 64))}':x=10:y=392:fontsize=16:fontcolor=0xbbbbbb`,
      '-frames:v', '1', path.join(dir, `${String(i + 1).padStart(3, '0')}.png`)], `thumb ${m.id}`);
  });
  const cols = Math.min(3, moments.length), rows = Math.ceil(moments.length / cols);
  ffmpeg(['-framerate', '1', '-i', path.join(dir, '%03d.png'), '-vf', `tile=${cols}x${rows}:padding=8:color=0x000000`, '-frames:v', '1', sheetPath(slug)], 'storyboard sheet');
  return sheetPath(slug);
}

export async function storyboard(slug, { only = null, stageOnly = false } = {}) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const canvas = canvasOf(cfg);
  const all = loadMoments(slug);
  const moments = all.filter((m) => !only || only.includes(m.id));
  if (!moments.length) throw new Error(`no moments match ${only}`);
  const dir = buildBoardStage(slug, moments, { cfg });
  if (stageOnly) return { stage: dir };
  const model = modelsOf(cfg).storyboard;
  let run = await runClaude({ cwd: dir, prompt: 'Read PROMPT.md in this folder and do exactly what it says.', model, maxTurns: 40, label: 'storyboard' });
  let cost = run.cost;
  const check = () => {
    const f = path.join(dir, 'board.json');
    if (!fs.existsSync(f)) return ['board.json was not written'];
    try { return boardErrors(readJson(f), moments, dir); } catch (e) { return [`board.json is not valid JSON: ${e.message}`]; }
  };
  let errs = check();
  if (errs.length && run.sessionId) {
    run = await runClaude({ cwd: dir, model, maxTurns: 15, resume: run.sessionId, label: 'storyboard-fix',
      prompt: `The storyboard is incomplete. Fix it:\n${errs.map((e) => `- ${e}`).join('\n')}` });
    cost += run.cost;
    errs = check();
  }
  if (errs.length) throw new Error(`storyboard still incomplete after one correction round (stage ${dir}):\n  ${errs.join('\n  ')}`);
  const doc = readJson(path.join(dir, 'board.json'));
  const board = readBoard(slug);
  board.made = new Date().toISOString();
  for (const m of moments) {
    const dest = stillDir(slug, m.id);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(path.join(dir, 'stills', `${m.id}.html`), path.join(dest, 'index.html'));
    const unknown = restoreAssets(dest);
    if (unknown.length) throw new Error(`${m.id}: the still names assets that are not registry logos: ${unknown.join(', ')}`);
    composePanel(slug, cfg, m, path.join(dest, 'index.html'), doc[m.id].at, canvas);
    board.moments[m.id] = { at: +Number(doc[m.id].at).toFixed(2), caption: doc[m.id].caption.trim(), sig: momentSig(m), status: 'pending', model, drawn: board.made };
  }
  writeJson(boardPath(slug), board);
  const sheet = renderSheet(slug, all.filter((m) => board.moments[m.id] && fs.existsSync(panelPath(slug, m.id))), board);
  return { stage: dir, sheet, cost, board };
}
