// The simple flow's inputs, resolved once so both the authoring rulebook
// (SIMPLE-PASS.md) and the pacing lint / renderer agree on where they live.
import fs from 'node:fs';
import path from 'node:path';
import { introSpan } from '../intro-modes.mjs';

// pipelines/video/intro-kit/ — plan 219's locked 7-card kit. Three levels up
// from lib/intro-kit/ (lib -> visuals-flow -> video), then into intro-kit/,
// exactly the sibling-folder pattern lib/intro-film/film-assets.mjs already
// uses to reach video/heygen/.
export const INTRO_KIT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', 'intro-kit');

export function loadKit({ root = INTRO_KIT_ROOT } = {}) {
  return JSON.parse(fs.readFileSync(path.join(root, 'kit.json'), 'utf8'));
}

// transcript.json is a flat ARRAY of {text,start,end} words, not an object.
// This is the entry point SIMPLE-PASS.md tells the authoring model to use for
// every on-screen word — never type a word from memory, S7 exists to catch
// exactly that (the standalone intro POC put 4 of 5 product names wrong).
export function introWords(workdir) {
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  if (!Array.isArray(words)) throw new Error('transcript.json must be an array of words');
  const span = introSpan(workdir);
  if (!span) throw new Error('introSpan(workdir) returned null — run `run.sh <slug> segments` first');
  return words.filter((w) => w.start >= span.start && w.end <= span.end);
}

export function loadCutlist(workdir) {
  const p = path.join(workdir, 'intro-simple', 'cutlist.json');
  if (!fs.existsSync(p)) throw new Error(`missing ${p} — author the simple intro first`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
