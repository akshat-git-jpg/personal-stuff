#!/usr/bin/env node
// flow-queue — a local relay that hands image-generation prompts to the ZAPI
// FLOW browser extension, which runs them on Google Flow.
//
// WHY THIS IS NOT PART OF ANY PIPELINE. Several pipelines have a gate where the
// owner approves a LOOK from generated frames before anything is built:
// visuals-flow does it twice (110 intro ideas, 240 new-card looks), and the
// same shape shows up anywhere a still has to be judged before code or spend.
// Every one of them was the same copy-paste loop — print a prompt into a chat
// window, select it, paste it into Flow, run it, come back for the next.
//
// So the bridge is a tool, not a feature of one pipeline. A producer pushes a
// markdown prompt file; the extension polls /queue and fills its own queue with
// no click. Producers need to know nothing about the browser, and the extension
// needs to know nothing about any pipeline.
//
//   pipeline ──push──▶ ~/.flow-queue/queue.json ──serve :4399──▶ extension ──▶ Google Flow
//
// FLATTENING IS LOAD-BEARING. The extension's queue is ONE PROMPT PER LINE (its
// sidepanel splits on /\r?\n/), while a real look-preview prompt is a multi-
// paragraph block. Handed over raw, one prompt becomes ~15 junk queue entries.
// Newlines mean nothing to an image generator, so collapsing them loses nothing
// — but it has to happen HERE and not in the .md, because the file on disk is
// what a human reads and edits.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PORT = Number(process.env.FLOW_QUEUE_PORT) || 4399;
export const STORE_DIR = process.env.FLOW_QUEUE_HOME || path.join(os.homedir(), '.flow-queue');
const STORE = path.join(STORE_DIR, 'queue.json');

// ── prompt file format ───────────────────────────────────────────────────────
// One markdown file holds one GROUP of prompts — the moments of a single thing
// being previewed. A `---` rule on its own line separates them, and a leading
// `##` heading labels each one for the human reading the file.

const SEPARATOR = /^\s*---\s*$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

export function flattenPrompt(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => !/^\s*```/.test(l)) // markdown fences a copied template brings along
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s) {
  return String(s).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

// The download filename the extension will use, carried BESIDE the prompt and
// never inside it. Look-preview templates allow-list every word permitted to
// appear in frame ("TEXT RULE: the ONLY text anywhere in the image is ..."), so
// a name token in the prompt body is exactly what a generator draws as a
// caption. The extension reads this from the payload instead.
export function nameToken(group, index) {
  return `${slugify(group)}_m${index + 1}`;
}

export function parsePromptFile(text, group) {
  const chunks = [];
  let current = [];
  for (const line of text.split(/\r?\n/)) {
    if (SEPARATOR.test(line)) { chunks.push(current); current = []; continue; }
    current.push(line);
  }
  chunks.push(current);

  const out = [];
  for (const chunk of chunks) {
    let label = null;
    const body = [];
    // Blank lines are not prompt text. A file that opens with an H1 title, a
    // blank line, then the "## m1 — ..." moment heading is the normal shape, and
    // testing body.length alone lets that second heading through into the prompt
    // — where the generator renders it as a caption.
    const hasBody = () => body.some((l) => l.trim());
    for (const line of chunk) {
      const h = line.match(HEADING);
      // A `#` inside the body is a hex colour (#0d0906, #fb923c appear in every
      // template) and must survive. Only a heading before any prompt text is a
      // label; the last such heading wins, so H1-title + H2-moment reports the
      // moment.
      if (h && !hasBody()) { label = h[1].trim(); continue; }
      body.push(line);
    }
    const prompt = flattenPrompt(body.join('\n'));
    if (!prompt) continue;
    out.push({ name: nameToken(group, out.length), label, prompt });
  }
  return out;
}

// ── store ────────────────────────────────────────────────────────────────────

export function readStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    return { groups: Array.isArray(raw.groups) ? raw.groups : [] };
  } catch {
    return { groups: [] };
  }
}

// write-then-rename: the server reads this file on every poll, so a reader must
// never catch it half-written.
export function writeStore(store) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const tmp = `${STORE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2) + '\n');
  fs.renameSync(tmp, STORE);
}

// Re-pushing the same (source, group) REPLACES it rather than appending. A
// producer re-running its step is the common case — an append would queue the
// same frames twice and burn the owner's generations.
export function pushGroup(store, { source, group, label, prompts, origin }) {
  const groups = store.groups.filter((g) => !(g.source === source && g.group === group));
  groups.push({
    source,
    group,
    label: label ?? null,
    origin: origin ?? null,
    added: new Date().toISOString(),
    prompts,
  });
  // Newest first: whatever the session just pushed is what the owner is about
  // to look at.
  groups.sort((a, b) => (a.added < b.added ? 1 : -1));
  return { groups };
}

// What the extension polls. `prompts` and `names` are parallel arrays because
// the queue is a flat list of lines and the panel maps index -> filename.
export function payload(store) {
  const prompts = [];
  const names = [];
  for (const g of store.groups) {
    for (const p of g.prompts) { prompts.push(p.prompt); names.push(p.name); }
  }
  return {
    groups: store.groups.map((g) => ({
      source: g.source, group: g.group, label: g.label, count: g.prompts.length, added: g.added,
    })),
    prompts,
    names,
  };
}

// ── server ───────────────────────────────────────────────────────────────────

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    // The caller is an extension side panel, whose origin is
    // chrome-extension://<id> and therefore not knowable here. Everything is
    // GET, bound to loopback, and holds prompts the owner wrote — a wildcard
    // costs nothing.
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-type', 'application/json; charset=utf-8');

    if (url.pathname === '/health') return res.end(JSON.stringify({ ok: true, port: PORT }));
    if (url.pathname === '/queue') return res.end(JSON.stringify(payload(readStore())));
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found', routes: ['/health', '/queue'] }));
  });
}

async function isUp() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(1200) });
    return r.ok;
  } catch { return false; }
}

// A producer should never have to think about whether the relay is running.
// launchd keeps it up in the steady state (com.kushal.flow-queue.plist); this
// covers a fresh machine, a killed process, and anyone who never installed the
// agent.
async function ensureServing() {
  if (await isUp()) return 'already running';
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, 'serve'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 120));
    if (await isUp()) return 'started';
  }
  return 'failed to start';
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function flag(argv, name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
}

const USAGE = `flow-queue — hand prompts to the ZAPI FLOW extension for Google Flow

  pp-flow-queue push <file.md|-> --source <id> --group <name> [--label <text>]
      Parse a markdown prompt file and queue it. Re-pushing the same
      --source/--group REPLACES it, so a re-run never double-queues.
      Starts the relay if it is not already up.

  pp-flow-queue list                 what is queued right now
  pp-flow-queue clear [--source <id>]  empty the queue, or one source's part
  pp-flow-queue serve [--port N]     run the relay in the foreground
  pp-flow-queue status               is the relay up, and how many prompts

Prompt file format: one file per group. Separate each prompt with a --- rule on
its own line; a leading ## heading labels it for you and is not sent.

The extension polls http://127.0.0.1:${PORT}/queue and fills its queue by
itself — there is nothing to click.`;

async function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help') { console.log(USAGE); return 0; }

  if (cmd === 'serve') {
    createServer().listen(PORT, '127.0.0.1', () => {
      console.log(`flow-queue relay on http://127.0.0.1:${PORT}  (store: ${STORE})`);
    });
    return null; // keep the process alive
  }

  if (cmd === 'status') {
    const up = await isUp();
    const p = payload(readStore());
    console.log(`relay:   ${up ? `up on ${PORT}` : 'not running'}`);
    console.log(`queued:  ${p.prompts.length} prompt(s) in ${p.groups.length} group(s)`);
    for (const g of p.groups) console.log(`  ${g.source}/${g.group}  ${g.count}  ${g.label ?? ''}`);
    return 0;
  }

  if (cmd === 'list') {
    const p = payload(readStore());
    if (!p.prompts.length) { console.log('queue is empty'); return 0; }
    p.prompts.forEach((text, i) => console.log(`${String(i + 1).padStart(2)}. [${p.names[i]}] ${text.slice(0, 90)}…`));
    return 0;
  }

  if (cmd === 'clear') {
    const source = flag(rest, 'source');
    const store = readStore();
    const kept = source ? store.groups.filter((g) => g.source !== source) : [];
    writeStore({ groups: kept });
    console.log(source ? `cleared ${source}` : 'queue cleared');
    return 0;
  }

  if (cmd === 'push') {
    const file = rest[0];
    const source = flag(rest, 'source');
    const group = flag(rest, 'group');
    const label = flag(rest, 'label');
    if (!file || !source || !group) {
      console.error('push needs <file.md|-> --source <id> --group <name>');
      return 2;
    }
    const text = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
    const prompts = parsePromptFile(text, group);
    if (!prompts.length) {
      console.error(`no prompts found in ${file} — is it empty, or all headings?`);
      return 1;
    }
    writeStore(pushGroup(readStore(), {
      source, group, label,
      origin: file === '-' ? null : path.resolve(file),
      prompts,
    }));
    const state = await ensureServing();
    console.log(`queued ${prompts.length} prompt(s) as ${source}/${group}  (relay ${state})`);
    return 0;
  }

  console.error(`unknown command "${cmd}"\n\n${USAGE}`);
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await main(process.argv.slice(2));
  if (code !== null) process.exit(code);
}
