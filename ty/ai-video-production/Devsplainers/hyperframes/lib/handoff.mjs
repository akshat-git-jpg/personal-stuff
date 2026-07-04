#!/usr/bin/env node
// handoff.mjs — hand an [ANTIGRAVITY] step's prompt to the Antigravity desktop app.
// Reads steps/<NNN-*>/rulebook.md (the paste-ready prompt), fills in the slug and
// repo paths, copies it to the macOS clipboard, and focuses Antigravity IDE.
// No API, no screenshots, no permissions — the only manual act is you pressing Cmd+V + Enter.
//
// Usage:  node lib/handoff.mjs <step> --video <slug> [--print]
//   <step>   step number or name prefix, e.g. 020 or 120 or build-static
//   --video  the video slug (required unless the prompt has no <slug> token)
//   --print  also echo the filled prompt to stdout (don't only copy)
//
// Token substitutions applied to the rulebook text:
//   <slug>        -> the --video value
//   <HF>          -> absolute path to the hyperframes/ root
//   <VIDEO_DIR>   -> absolute path to videos/<slug>

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HF = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const step = args.find((a) => !a.startsWith('--'));
const slug = valOf('--video');
const doPrint = args.includes('--print');

function valOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
function die(msg) { console.error(`handoff: ${msg}`); process.exit(1); }

if (!step) die('missing <step> (e.g. 020 or build-static)');

// resolve the step folder by prefix / substring match
const stepsDir = join(HF, 'steps');
const match = readdirSync(stepsDir).filter(
  (d) => d.startsWith(step) || d.includes(step)
);
if (match.length === 0) die(`no step folder matches "${step}"`);
if (match.length > 1) die(`ambiguous "${step}": ${match.join(', ')}`);
const stepDir = join(stepsDir, match[0]);

if (!match[0].endsWith('-antigravity')) {
  console.error(`handoff: warning — ${match[0]} is not an [ANTIGRAVITY] step; handing off anyway.`);
}

let prompt;
try {
  prompt = readFileSync(join(stepDir, 'rulebook.md'), 'utf8');
} catch {
  die(`${match[0]}/rulebook.md not found (that file is the paste-ready Antigravity prompt)`);
}

if (prompt.includes('<slug>') && !slug) die('this prompt needs --video <slug>');
const videoDir = slug ? join(HF, 'videos', slug) : '';
prompt = prompt
  .replaceAll('<slug>', slug ?? '<slug>')
  .replaceAll('<HF>', HF)
  .replaceAll('<VIDEO_DIR>', videoDir);

// copy to clipboard
const pb = spawnSync('pbcopy', { input: prompt });
if (pb.status !== 0) die('pbcopy failed (not on macOS?)');

// focus Antigravity (best-effort; both known app names)
for (const app of ['Antigravity IDE', 'Antigravity']) {
  const r = spawnSync('osascript', ['-e', `tell application "${app}" to activate`]);
  if (r.status === 0) break;
}

console.log(`✔ ${match[0]} prompt copied to clipboard${slug ? ` (video: ${slug})` : ''}.`);
console.log('  → Antigravity is focused. Click its agent chat, press ⌘V then Enter.');
console.log(`  (${prompt.split('\n').length} lines, ${prompt.length} chars)`);
if (doPrint) console.log('\n----- prompt -----\n' + prompt);
