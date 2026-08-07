// The run ledger: what each step actually did, recorded as it happens.
//
// Before this existed, `run.sh <slug> status` reconstructed progress by probing
// the workdir for files. That can say "resolved.json present"; it can never say
// "040 matched 23 anchors and threw 2 warnings", because nothing wrote that
// down. The terminal scrollback was the only record, which is why following a
// run meant watching a terminal.
//
// Step ids are read from the step registry, never from a list kept in here.
// One source of truth means a session cannot record work under an invented name
// ("body cue pass" one video, "body graphics LLM" the next).

import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { loadSteps, STEPS_DIR } from './steps.mjs';

export const STATUSES = ['todo', 'running', 'done', 'blocked', 'skipped'];

// The registry, not a second directory read. A folder with no step.json is not
// a step, so the ledger and lib/steps.mjs cannot disagree about what exists —
// which is the whole reason the ledger validates ids at all.
export function stepIds(stepsDir = STEPS_DIR) {
  if (!fs.existsSync(stepsDir)) return [];
  return loadSteps({ dir: stepsDir }).map((s) => s.slug);
}

// -run is a script, -llm/-opus is a model session, -human is an owner gate.
// The suffix is the cost signal the step folders already carry.
//
// A step can be both. 038 builds the approved NEW cards with a model AND then
// goes back through the owner: landing a card flips its plan item `new` ->
// `existing`, which changes the plan, which resets `approved` to false
// (lib/card-plan.mjs). So the owner re-approves the built card before 090 will
// render it. Reporting that step as a plain model pass hid a real gate.
export function stepKind(id) {
  const gate = /-human$/.test(id);
  const session = /-(llm|opus)(?:-|$)/.test(id);
  if (gate && session) return 'session+gate';
  if (gate) return 'gate';
  if (session) return 'session';
  if (/-run$/.test(id)) return 'script';
  return 'other';
}

export function stepNumber(id) {
  return id.slice(0, 3);
}

// Accepts a full id or just its number ("030"), so the CLI is usable by hand
// without pasting a 34-character folder name. Anything else is refused: that
// refusal IS the naming fix.
export function resolveStepId(input, ids = stepIds()) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('no step given');
  if (ids.includes(raw)) return raw;
  const byNumber = ids.filter((id) => stepNumber(id) === raw);
  if (byNumber.length === 1) return byNumber[0];
  throw new Error(
    `unknown step "${raw}" — must be one of the steps/ folders, or its number:\n  ${ids.join('\n  ')}`,
  );
}

export function emptyLog(video) {
  return { video, updated: null, steps: {} };
}

export function readRunLog(workdir) {
  const file = path.join(workdir, 'run-log.json');
  if (!fs.existsSync(file)) return emptyLog(path.basename(workdir));
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { video: data.video ?? path.basename(workdir), updated: data.updated ?? null, steps: data.steps ?? {} };
  } catch (e) {
    throw new Error(`run-log.json is not readable JSON: ${e.message}`);
  }
}

export function writeRunLog(workdir, log) {
  fs.writeFileSync(path.join(workdir, 'run-log.json'), JSON.stringify(log, null, 2) + '\n');
}

// A `done` entry with no summary is the failure this whole file exists to
// prevent, so it is rejected rather than written half-empty. `issues` is
// allowed to be absent and becomes an explicit "none found" — a blank field
// must never be readable as "nobody checked".
export function setStep(log, stepId, status, fields = {}, now = new Date()) {
  if (!STATUSES.includes(status)) {
    throw new Error(`unknown status "${status}" — must be one of: ${STATUSES.join(', ')}`);
  }
  // A skipped step did no work by definition — a `did` on it is a
  // contradiction the board then renders as "skipped" over a full work record
  // (038, owner report 2026-07-31). If work happened, the step is done; the
  // reason for skipping belongs in --issues.
  if (status === 'skipped' && typeof fields.did === 'string' && fields.did.trim()) {
    throw new Error(
      `${stepId}: a skipped step cannot carry --did — if work happened, record it as done; put the why-skipped in --issues`,
    );
  }
  const iso = now.toISOString();
  const prev = log.steps[stepId] ?? {};
  const next = { ...prev, status };
  delete next.derived;

  if (status === 'running') {
    next.started = iso;
    delete next.ended;
  }
  if (status === 'done' || status === 'blocked' || status === 'skipped') {
    next.ended = iso;
    if (!next.started) next.started = iso;
  }

  for (const key of ['did', 'issues', 'output']) {
    const v = fields[key];
    if (typeof v === 'string' && v.trim()) next[key] = v.trim();
  }

  if (status === 'done') {
    const missing = ['did', 'output'].filter((k) => !next[k]);
    if (missing.length) {
      throw new Error(
        `${stepId}: a done step needs ${missing.join(' and ')} — pass --${missing.join(' and --')}`,
      );
    }
    if (!next.issues) next.issues = 'none found';
  }

  return { ...log, updated: iso, steps: { ...log.steps, [stepId]: next } };
}

// What proves a step finished, when no ledger entry exists. Used only as a
// fallback so videos that ran before the ledger — and any run in flight right
// now — are not shown as a blank page. Entries produced this way are marked
// `derived` and carry no summary, because none was ever written.
const ARTIFACT_PROOF = {
  '010': (w) => fs.existsSync(path.join(w, 'run-config.json')),
  '020': (w) => fs.existsSync(path.join(w, 'transcript.json')),
  '040': (w) => fs.existsSync(path.join(w, 'segments.json')),
  '050': (w) => fs.existsSync(path.join(w, 'concept.json')),
  '210': (w) => cuesHave(w, (c) => !c.zone),
  '220': (w) => cuesHave(w, (c) => !!c.zone),
  '235': (w) => readJson(path.join(w, 'card-plan.json'))?.approved === true,
  '240': (w) => {
    const plan = readJson(path.join(w, 'card-plan.json'));
    if (!plan?.sections) return false;
    return plan.sections.every((s) => (s.items ?? []).every((i) => i.status !== 'new'));
  },
  '310': (w) => fs.existsSync(path.join(w, 'resolved.json')),
  '320': (w) => fs.existsSync(path.join(w, 'shots.json')),
  '340': (w) =>
    readJson(path.join(w, 'cues.json'))?.approved === true &&
    readJson(path.join(w, 'shots.json'))?.approved === true,
  // Media files, not the directory: an empty renders/ (or one holding only
  // probe leftovers) marked 410 done and painted a green tick for a render
  // that never ran (owner report 2026-07-31).
  '410': (w) => {
    const d = path.join(w, 'renders');
    if (!fs.existsSync(d)) return false;
    try {
      return fs.readdirSync(d).some((f) => /\.(mp4|mov)$/i.test(f));
    } catch {
      return false;
    }
  },
  '430': (w) => fs.existsSync(path.join(w, 'avatar-jobs.json')),
  '510': (w) => fs.existsSync(path.join(w, 'assembly.md')),
  '530': (w) => readJson(path.join(w, 'final-cut.json'))?.approved === true,
};

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function cuesHave(workdir, pred) {
  const data = readJson(path.join(workdir, 'cues.json'));
  const cues = Array.isArray(data) ? data : data?.cues;
  return Array.isArray(cues) && cues.some(pred);
}

// The view the board and `run.sh status` both render, so the page and the
// terminal cannot disagree about where a video is.
export function stepView(workdir, { ids = stepIds(), log = null } = {}) {
  const runLog = log ?? readRunLog(workdir);
  return ids.map((id) => {
    const recorded = runLog.steps[id];
    if (recorded) return { id, number: stepNumber(id), kind: stepKind(id), ...recorded };
    const proof = ARTIFACT_PROOF[stepNumber(id)];
    const done = proof ? safeProof(proof, workdir) : false;
    // Only a step we concluded was DONE is marked derived. A todo step has
    // nothing inferred about it — flagging it too made every unstarted row
    // carry a caveat it did not need.
    return {
      id,
      number: stepNumber(id),
      kind: stepKind(id),
      status: done ? 'done' : 'todo',
      ...(done ? { derived: true } : {}),
    };
  });
}

function safeProof(proof, workdir) {
  try {
    return proof(workdir) === true;
  } catch {
    return false;
  }
}

export function nextStep(view) {
  return view.find((s) => s.status !== 'done' && s.status !== 'skipped') ?? null;
}

export function summarize(view) {
  const count = (s) => view.filter((v) => v.status === s).length;
  return {
    total: view.length,
    done: count('done'),
    running: count('running'),
    blocked: count('blocked'),
    skipped: count('skipped'),
    todo: count('todo'),
    derived: view.filter((v) => v.derived).length,
  };
}

const MARK = { done: '[x]', running: '[~]', blocked: '[!]', skipped: '[-]', todo: '[ ]' };

export function renderTable(view) {
  // Size the column to the longest id rather than a magic number — a renamed
  // step folder must never run into its own status text.
  const w = Math.max(0, ...view.map((s) => s.id.length)) + 2;
  const lines = view.map((s) => {
    const mark = MARK[s.status] ?? '[ ]';
    const note = s.derived ? '  (inferred from artifacts, no summary recorded)' : '';
    const head = `${mark} ${s.id.padEnd(w)}${s.status}${note}`;
    if (s.status !== 'done' || s.derived) return head;
    const body = [
      s.did ? `      did:    ${s.did}` : null,
      s.issues ? `      issues: ${s.issues}` : null,
      s.output ? `      output: ${s.output}` : null,
    ].filter(Boolean);
    return [head, ...body].join('\n');
  });
  const s = summarize(view);
  lines.push('');
  lines.push(`${s.done}/${s.total} done`);
  // An inferred step is a step whose work happened and whose record did not. That
  // used to render as a parenthetical on the row and nothing else, so a whole run
  // could read as clean while the ledger held no account of what was done or found
  // — which is the failure this file exists to prevent. Say it out loud, and name
  // the command that fixes it.
  if (s.derived) {
    const ids = view.filter((v) => v.derived).map((v) => stepNumber(v.id)).join(', ');
    lines.push(
      `WARNING: ${s.derived} step(s) have no recorded summary (${ids}) — status was inferred from ` +
      `artifacts on disk, so nothing records what they did or what they found. Backfill with ` +
      `node lib/run-log.mjs <slug> <step> done --did .. --output ..`,
    );
  }
  return lines.join('\n');
}

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1] ?? '';
      i++;
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [slugArg, stepArg, statusArg, ...rest] = process.argv.slice(2);
  if (!slugArg) {
    console.error(
      'Usage:\n' +
        '  node lib/run-log.mjs <slug>                       print the ledger\n' +
        '  node lib/run-log.mjs <slug> <step> <status> [--did .. --issues .. --output ..]\n' +
        `\nstatuses: ${STATUSES.join(', ')}`,
    );
    process.exit(1);
  }
  const workdir = resolveWorkdir(slugArg);
  if (!fs.existsSync(workdir)) {
    console.error(`no workdir: ${workdir}`);
    process.exit(1);
  }

  if (!stepArg) {
    console.log(renderTable(stepView(workdir)));
    process.exit(0);
  }

  // A ledger belongs to a video workdir. The pipeline root is never one, and
  // scripts/test-run-sh.sh drives verbs with slug "." — which resolveWorkdir maps
  // to the root — so an unguarded write leaves a run-log.json beside run.sh that
  // records nothing and is not gitignored. Reading the root stays allowed, because
  // `run.sh . status` renders this same view.
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  if (path.resolve(workdir) === pipelineRoot) {
    console.error(`refusing to write a ledger into the pipeline root (${pipelineRoot}) — pass a video slug or workdir`);
    process.exit(1);
  }

  try {
    const id = resolveStepId(stepArg);
    const log = setStep(readRunLog(workdir), id, statusArg, parseFlags(rest));
    writeRunLog(workdir, log);
    console.log(`${id}: ${statusArg}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
