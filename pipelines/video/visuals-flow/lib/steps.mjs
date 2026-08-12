// THE step registry. One step.json per steps/<slug>/ folder is the single
// declaration of the pipeline's shape. run.sh's usage list, verb dispatch and
// status next-hint, PIPELINE.md's table, and (plan 193) the board's tabs all
// DERIVE from this. Before it, the list was hand-encoded in six places and two
// lib modules resolved step FOLDER NAMES at runtime, so renumbering a step
// broke running code with nothing to catch it (PIPELINE.md records a rename
// sweep that already destroyed a mapping table).
//
// decisions.md 2026-08-06: "A NEW STEP ADDS NO CODE HERE."

import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { pathToFileURL } from 'node:url';

export const STEPS_DIR = path.resolve(import.meta.dirname, '..', 'steps');

const ACTORS = ['run', 'llm', 'human', 'opus', 'owner-live'];
const VERB_KINDS = ['meta', 'helper', 'stage', 'composite'];

// The two parallel tracks (plan 199). "intro" is 110-160 — the bespoke intro
// film shares no artifact with the card plan (130's authoring contract
// forbids reading catalog.json/cues.json/card-plan.json, and no 2xx step reads
// the screenplay), so a gate on one must not park the status next-hint on the
// other. They rejoin at 440-rerender-intro-film-run, which consumes both the
// film and the avatar clips, so 440 and everything after it is "main". Order
// here is print order in nextHintLine(): intro first, then main.
const TRACKS = ['intro', 'main'];

// Optional, human-facing, all strings:
//   summary     the PIPELINE.md "In → Out" cell, verbatim
//   actorLabel  the PIPELINE.md "Actor" cell
//   nextHint    the `run.sh <slug> status` next-line, "<slug>" substituted
//   usageArgs   the flags run.sh's usage list prints after the verb
const OPTIONAL_STRINGS = ['summary', 'actorLabel', 'nextHint', 'usageArgs'];

// Every field is REQUIRED unless listed above, so a half-declared step fails
// loudly at load instead of behaving oddly at dispatch.
//
//   number    "030"                     — ordering key, unique, matches the folder prefix
//   slug      "030-pick-or-propose-…"   — the folder name; run-log.json keys on this
//   title     "pick or propose graphics" — for the generated PIPELINE.md table
//   actor     one of ACTORS             — who performs it
//   verbs     ["cue-pass"]              — run.sh verbs that execute it (may be [])
//   consumes  ["transcript.json"]       — artifacts read, relative to videos/<slug>/
//   produces  ["cues.json"]             — artifacts written, same base
//   gate      null | {file, field, label} — a human approval gate
//   tab       null | "storyboard"       — the board tab that reviews it (plan 193)
//   external  bool                      — the real output lands OUTSIDE videos/<slug>/
//                                         (card-library, a rulebook, Drive, kb-scratch),
//                                         so `produces` is empty by design rather than
//                                         by omission
//   optional  bool                      — the video can finish without it, so the
//                                         status next-hint never parks on it
//   track     one of TRACKS              — "intro" or "main" (plan 199); the
//                                         status next-hint reports one step per
//                                         track instead of a single serial walk
export function loadSteps({ dir = STEPS_DIR } = {}) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name, 'step.json');
    if (!fs.existsSync(p)) continue;
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      throw new Error(`E-REG ${name}/step.json is not valid JSON: ${e.message}`);
    }
    out.push(validateStep(raw, name));
  }
  if (!out.length) throw new Error(`E-REG no step.json found under ${dir}`);
  return out;
}

export function validateStep(s, folderName) {
  const die = (msg) => {
    throw new Error(`E-REG ${folderName}: ${msg}`);
  };
  if (!s || typeof s !== 'object') die('step.json must hold an object');
  if (s.slug !== folderName) die(`slug "${s.slug}" must equal its folder name`);
  if (!/^\d{3}$/.test(String(s.number ?? ''))) die('number must be a 3-digit string');
  if (!folderName.startsWith(`${s.number}-`)) die(`folder must start with "${s.number}-"`);
  if (typeof s.title !== 'string' || !s.title.trim()) die('title is required');
  if (!ACTORS.includes(s.actor)) die(`actor must be one of ${ACTORS.join('|')}`);
  for (const k of ['verbs', 'consumes', 'produces']) {
    if (!Array.isArray(s[k])) die(`${k} must be an array (use [] for none)`);
    if (s[k].some((v) => typeof v !== 'string' || !v)) die(`${k} must hold non-empty strings`);
  }
  for (const k of ['consumes', 'produces']) {
    for (const f of s[k]) {
      if (f.startsWith('/') || f.split('/').includes('..')) {
        die(`${k} entry "${f}" must be relative to videos/<slug>/ — no leading "/" and no ".."`);
      }
    }
  }
  if (s.gate !== null) {
    if (typeof s.gate !== 'object' || Array.isArray(s.gate)) die('gate must be null or an object');
    for (const k of ['file', 'field', 'label']) {
      if (typeof s.gate[k] !== 'string' || !s.gate[k]) die(`gate.${k} is required`);
    }
    if (s.gate.file.startsWith('/') || s.gate.file.split('/').includes('..')) {
      die(`gate.file "${s.gate.file}" must be relative to videos/<slug>/`);
    }
  }
  if (s.tab !== null && (typeof s.tab !== 'string' || !s.tab)) die('tab must be null or a string');
  for (const k of ['external', 'optional']) {
    if (typeof s[k] !== 'boolean') die(`${k} must be a boolean`);
  }
  if (!TRACKS.includes(s.track)) die(`track must be one of ${TRACKS.join('|')}`);
  for (const k of OPTIONAL_STRINGS) {
    if (k in s && (typeof s[k] !== 'string' || !s[k].trim())) {
      die(`${k} is optional, but when present it must be a non-empty string`);
    }
  }
  // A gate with no tab cannot be approved anywhere.
  // It is a declaration bug, not a runtime condition.
  if (s.gate !== null && s.tab === null) die('a gate needs a board tab to be approved on');
  // A step must declare an EFFECT. A step that writes no artifact, holds no
  // gate, and is not marked external does nothing the rest of the pipeline can
  // see — and every consumer here (the next-hint walk, the generated table, the
  // artifact flow check) then reads it as a no-op. Blanking `produces` is the
  // easiest way to break that silently, so it is refused at load.
  if (!s.produces.length && s.gate === null && s.external !== true) {
    die(
      'declares no effect — a step must write at least one artifact into produces, ' +
        'hold a gate, or set "external": true when its real output lands outside videos/<slug>/',
    );
  }
  return s;
}

// The non-step commands run.sh accepts: meta (status), helpers (validate,
// stillness, outline, audit-gate, shots, qc), stages (sound, mix) and the one
// composite (cut). They live here rather than in invented step folders on
// purpose — lib/run-log.mjs would then accept them as ledger keys, which is
// exactly the ambiguity the folder validation prevents.
export function loadVerbs({ dir = STEPS_DIR } = {}) {
  const p = path.join(dir, '_verbs.json');
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`E-REG _verbs.json is not readable: ${e.message}`);
  }
  for (const [verb, def] of Object.entries(raw)) {
    if (!def || typeof def !== 'object') {
      throw new Error(`E-REG _verbs.json ${verb}: must hold an object`);
    }
    if (!VERB_KINDS.includes(def.kind)) {
      throw new Error(`E-REG _verbs.json ${verb}: kind must be one of ${VERB_KINDS.join('|')}`);
    }
  }
  return raw;
}

// Resolve a step by number, slug or verb. This is what replaces every
// hardcoded path.resolve(..., 'steps', '<literal folder name>') — those made a
// renumber a code-breaking change.
export function findStep(ref, { dir = STEPS_DIR, steps = null } = {}) {
  const all = steps ?? loadSteps({ dir });
  const hit = all.find((s) => s.number === ref || s.slug === ref || s.verbs.includes(ref));
  if (!hit) throw new Error(`E-REG no step matches "${ref}"`);
  return hit;
}

// The folder NAME, e.g. "030-pick-or-propose-graphics-llm". run.sh wants this
// rather than an absolute path so the command it dispatches still reads
// `bash steps/<slug>/run.sh <slug>` exactly as it always has.
export function stepSlug(ref, opts = {}) {
  return findStep(ref, opts).slug;
}

export function stepDir(ref, { dir = STEPS_DIR, steps = null } = {}) {
  return path.join(dir, stepSlug(ref, { dir, steps }));
}

// Every verb the driver accepts, steps and non-steps together, for usage
// output. Order follows the steps' own order, with each non-step verb slotted
// where _verbs.json puts it (`after`), so the usage list still reads like the
// flow instead of like a directory listing.
export function allVerbs({ dir = STEPS_DIR } = {}) {
  return usageEntries({ dir }).map((e) => e.verb);
}

export function usageEntries({ dir = STEPS_DIR } = {}) {
  const steps = loadSteps({ dir });
  const verbs = loadVerbs({ dir });
  const out = [];
  const seen = new Set();
  const push = (verb, entry) => {
    if (seen.has(verb)) return;
    seen.add(verb);
    out.push({ verb, ...entry });
    // A loose verb can itself be the anchor for another (mix follows sound),
    // so slotting recurses rather than running one level deep.
    slotAfter(verb);
  };
  const slotAfter = (anchor) => {
    for (const [verb, def] of Object.entries(verbs)) {
      if ((def.after ?? null) === anchor) push(verb, { kind: def.kind, summary: def.summary });
    }
  };
  slotAfter(null);
  for (const s of steps) {
    for (const v of s.verbs) push(v, { kind: 'step', step: s, usageArgs: s.usageArgs });
    slotAfter(s.number);
  }
  // Anything _verbs.json slotted after a verb that no longer exists still has
  // to appear — a mis-slotted helper must not vanish from the usage list.
  for (const [verb, def] of Object.entries(verbs)) push(verb, { kind: def.kind, summary: def.summary });
  return out;
}

// Near-matches for a verb run.sh did not recognise. Cheap and deliberately
// dumb: shared prefix, containment, or one edit away. The point is to name the
// verb the typist meant, not to be clever about it.
export function suggestVerbs(input, { dir = STEPS_DIR, verbs = null } = {}) {
  const all = verbs ?? allVerbs({ dir });
  const q = String(input ?? '').toLowerCase();
  if (!q) return [];
  return all.filter((v) => {
    const w = v.toLowerCase();
    if (w.includes(q) || q.includes(w)) return true;
    const shared = [...w].findIndex((c, i) => c !== q[i]);
    return (shared === -1 ? Math.min(w.length, q.length) : shared) >= 3;
  });
}

// The next step to run PER TRACK, derived from the registry rather than a
// fixed if/elif chain (plan 199). Before the tracks existed, this returned a
// single first-unsatisfied step across the whole registry, so an owner gate
// on the intro film stopped the walk before it ever reached the card track —
// waiting on the intro idea blocked the body cue pass, even though the two
// share no artifact.
//
// A step is SATISFIED when every artifact it produces exists AND, if it has a
// gate, that gate's field is true. `optional` and `external` steps never park
// the hint: nothing under videos/<slug>/ proves them either way.
//
// Returns { intro: stepOrNull, main: stepOrNull } — one entry per TRACKS.
export function nextStep({ steps = null, exists, readFlag } = {}) {
  const all = steps ?? loadSteps();
  const out = {};
  for (const track of TRACKS) {
    out[track] = firstUnsatisfied(all.filter((s) => s.track === track), exists, readFlag);
  }
  return out;
}

function firstUnsatisfied(steps, exists, readFlag) {
  for (const s of steps) {
    if (s.optional) continue;
    if (!s.external && s.produces.length && !s.produces.every((f) => exists(f))) return s;
    if (s.gate && !readFlag(s.gate.file, s.gate.field)) return s;
  }
  return null;
}

// The `next:` line(s) `run.sh <slug> status` prints — one per track that
// still has work, in TRACKS order (intro, then main), or a single "nothing"
// line once both are satisfied. A step carries its own hint text when the
// bare verb is not enough guidance (the gates, mostly); every other step
// falls back to naming its verb.
export function nextHintLine(slug, next) {
  const lines = TRACKS.map((t) => next[t]).filter(Boolean).map((step) => hintLineForStep(slug, step));
  if (!lines.length) return 'next: nothing — every step for this video is satisfied';
  return lines.join('\n');
}

function hintLineForStep(slug, step) {
  if (step.nextHint) return `next: ${step.nextHint.replaceAll('<slug>', slug)}`;
  const verb = step.verbs[0];
  if (!verb) return `next: ${step.number} ${step.title}  (no verb — see steps/${step.slug}/README.md)`;
  return `next: run.sh ${slug} ${verb}  (${step.number} ${step.title})`;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// The fs-backed probes nextStep() takes by injection, bound to a real workdir.
export function workdirProbes(workdir) {
  return {
    exists: (f) => fs.existsSync(path.join(workdir, f)),
    readFlag: (f, field) => readJson(path.join(workdir, f))?.[field] === true,
  };
}

// run.sh talks to the registry through this CLI rather than through a second
// hand-maintained copy of the list in bash.
// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'verbs') {
      for (const v of allVerbs()) console.log(v);
    } else if (cmd === 'usage') {
      for (const e of usageEntries()) console.log(`  ${e.verb}${e.usageArgs ? ` ${e.usageArgs}` : ''}`);
    } else if (cmd === 'suggest') {
      const near = suggestVerbs(rest[0]);
      if (near.length) console.log(`did you mean: ${near.join(', ')}`);
    } else if (cmd === 'slug') {
      console.log(stepSlug(rest[0]));
    } else if (cmd === 'next') {
      const [slugArg] = rest;
      const workdir = resolveWorkdir(slugArg);
      console.log(
        nextHintLine(
          slugArg,
          nextStep({ ...workdirProbes(workdir) }),
        ),
      );
    } else {
      console.error(
        'Usage:\n' +
          '  node lib/steps.mjs verbs                         every verb run.sh accepts\n' +
          '  node lib/steps.mjs usage                         the same list, formatted for run.sh usage()\n' +
          '  node lib/steps.mjs slug <number|verb|slug>       the step folder name\n' +
          '  node lib/steps.mjs next <slug> [intro] [review]  the status next-hint line',
      );
      process.exit(1);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
