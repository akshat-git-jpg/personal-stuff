import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { parseArgs } from "node:util";
import { loadEnv } from "./env.mjs";
import { GLOBAL_RESPELL_PATH, wordCheckDir, localApprovedPath } from "./respell.mjs";
import { synthOne } from "./vo-synth.mjs";

// The owner approves a pronunciation once; it is never asked again.
// A word approved "as written" is stored as itself ("Notion": "Notion").
// The app writes approved.json (outside git); `promote` folds it into the shared map for a commit.

export { wordCheckDir };

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export function loadQueue(dir = wordCheckDir()) {
  return readJson(path.join(dir, "queue.json"), { jobs: {} });
}

export function saveQueue(queue, dir = wordCheckDir()) {
  writeJson(path.join(dir, "queue.json"), queue);
}

// Every approved word: the shared map plus approvals not yet promoted.
export function loadApproved({ dir = wordCheckDir(), respellPath = GLOBAL_RESPELL_PATH } = {}) {
  return { ...readJson(respellPath, {}), ...readJson(localApprovedPath(dir), {}) };
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
}

// Relative audio path for one spoken option, shared across jobs.
export function audioRel(word, spelling) {
  return path.posix.join("audio", slugify(word), `${slugify(spelling)}.wav`);
}

// Adds a job's risky words. Already-approved words are dropped; "as written" is always option 1.
export function addWords(queue, job, words, approved) {
  const existing = queue.jobs[job]?.words ?? [];
  const byWord = new Map(existing.map((w) => [w.word, w]));
  for (const { word, options = [] } of words) {
    if (Object.hasOwn(approved, word)) continue;
    const entry = byWord.get(word) ?? { word, options: [], approved: null };
    for (const spelling of [word, ...options]) {
      if (!entry.options.some((o) => o.spelling === spelling)) {
        entry.options.push({ spelling, audio: audioRel(word, spelling) });
      }
    }
    byWord.set(word, entry);
  }
  return { ...queue, jobs: { ...queue.jobs, [job]: { words: [...byWord.values()] } } };
}

// Words in a job still waiting for the owner. A word approved elsewhere since counts as done,
// unless it was reopened because it sounded wrong.
export function pendingWords(queue, job, approved) {
  const words = queue.jobs[job]?.words ?? [];
  return words.filter((w) => !w.approved && (w.reopened || !Object.hasOwn(approved, w.word)));
}

// Puts an approved word back in front of the owner with new options.
export function reopenWord(queue, job, word, options, dir = wordCheckDir()) {
  const file = localApprovedPath(dir);
  const local = readJson(file, {});
  if (Object.hasOwn(local, word)) {
    delete local[word];
    writeJson(file, local);
  }
  const next = addWords(queue, job, [{ word, options }], {});
  for (const w of next.jobs[job].words) {
    if (w.word === word) Object.assign(w, { approved: null, reopened: true });
  }
  return next;
}

// The gate vo-prep and vo-synth share. ok only when the job exists and nothing is pending.
export function wordGate(job, { dir = wordCheckDir(), respellPath = GLOBAL_RESPELL_PATH } = {}) {
  const queue = loadQueue(dir);
  if (!queue.jobs[job]) return { ok: false, reason: `no word check yet for "${job}" — run the word check first`, pending: [] };
  const pending = pendingWords(queue, job, loadApproved({ dir, respellPath })).map((w) => w.word);
  if (pending.length) return { ok: false, reason: `waiting for your OK on: ${pending.join(", ")}`, pending };
  return { ok: true, reason: "every risky word is approved", pending: [] };
}

// Records the owner's pick in approved.json and in every job that has the word.
export function approveWord(word, spelling, { dir = wordCheckDir() } = {}) {
  const file = localApprovedPath(dir);
  const map = readJson(file, {});
  map[word] = spelling;
  writeJson(file, map);
  const queue = loadQueue(dir);
  for (const j of Object.values(queue.jobs)) {
    for (const w of j.words) if (w.word === word) Object.assign(w, { approved: spelling, reopened: false });
  }
  saveQueue(queue, dir);
  return map;
}

// Copies approvals into a shared respell.json (in a workspace, then commit). Returns words added or changed.
export function promote(respellPath, { dir = wordCheckDir() } = {}) {
  const shared = readJson(respellPath, {});
  const local = readJson(localApprovedPath(dir), {});
  const changed = Object.keys(local).filter((k) => shared[k] !== local[k]);
  if (changed.length) writeJson(respellPath, { ...shared, ...local });
  return changed;
}

// Synthesizes every option that has no audio yet. Returns the paths written.
export async function synthMissing(queue, job, opts, fetchImpl = fetch, dir = wordCheckDir()) {
  const written = [];
  for (const w of queue.jobs[job]?.words ?? []) {
    for (const o of w.options) {
      const file = path.join(dir, o.audio);
      if (fs.existsSync(file)) continue;
      const bytes = await synthOne({ id: "s01" }, `${o.spelling}.`, opts, fetchImpl);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
      written.push(o.audio);
      opts.onWrite?.(w.word, o.spelling);
    }
  }
  return written;
}

const isMain =
  typeof process !== "undefined" &&
  import.meta.url.startsWith("file:") &&
  url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const [verb, job, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    options: { words: { type: "string" }, word: { type: "string" }, options: { type: "string" } },
    allowPositionals: true,
  });
  const usage = `Usage:
  node lib/word-check.mjs add <job> --words words.json      # [{ "word": "Descript", "options": ["dee-script", "deh-script"] }]
  node lib/word-check.mjs more <job> --word Descript --options "duh-script,dess-cript"
  node lib/word-check.mjs status <job>
  node lib/word-check.mjs promote <path/to/respell.json>    # run in a workspace, then commit`;
  if (verb === "promote") {
    // job is the target respell.json path here
    const changed = promote(job || GLOBAL_RESPELL_PATH);
    console.log(changed.length ? `promoted: ${changed.join(", ")}` : "nothing new to promote");
    process.exit(0);
  }
  if (!verb || !job) {
    console.error(usage);
    process.exit(1);
  }

  const here = path.dirname(url.fileURLToPath(import.meta.url));
  loadEnv(path.join(here, ".."));
  const opts = {
    url: process.env.MODAL_TTS_URL,
    token: process.env.MODAL_TTS_TOKEN,
    onWrite: (w, s) => console.log(`  audio: ${w} -> ${s}`),
  };

  if (verb === "add" || verb === "more") {
    const queue =
      verb === "add"
        ? addWords(loadQueue(), job, JSON.parse(fs.readFileSync(values.words, "utf8")), loadApproved())
        : reopenWord(loadQueue(), job, values.word, (values.options || "").split(",").map((s) => s.trim()).filter(Boolean));
    saveQueue(queue);
    try {
      await synthMissing(queue, job, opts);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  } else if (verb !== "status") {
    console.error(usage);
    process.exit(1);
  }

  const gate = wordGate(job);
  console.log(`${job}: ${gate.reason}`);
  if (!gate.ok && gate.pending.length) console.log("Open the word pronunciation check app (local apps, :4371) and approve one option per word.");
  process.exit(gate.ok ? 0 : 1);
}
