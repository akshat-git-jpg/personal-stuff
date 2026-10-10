// Staging: every LLM pass runs in a fresh folder OUTSIDE the repo holding only its allowed inputs,
// so no repo CLAUDE.md, skill or other recipe's file is reachable by default.
import fs from 'node:fs';
import path from 'node:path';
import { REPO, ISOLATION_MANIFEST, readJson } from './paths.mjs';

// The names this recipe must never see, from the same manifest the isolation test enforces.
export function bannedNames(manifest = readJson(ISOLATION_MANIFEST)) {
  const scope = manifest.scopes.find((s) => s.id === 'animate');
  if (!scope) throw new Error('recipe-isolation.json has no animate scope');
  return scope.banned;
}

// Fresh, empty stage. Refuses a path inside the repo: that would put repo context back in reach.
export function freshStage(dir) {
  const abs = path.resolve(dir);
  const rel = path.relative(REPO, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) throw new Error(`stage ${abs} is inside the repo; stages must live outside it`);
  fs.rmSync(abs, { recursive: true, force: true });
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

// entries: { 'name/in/stage': '/abs/source/file-or-dir' | { text: '...' } }
export function fillStage(dir, entries) {
  for (const [rel, src] of Object.entries(entries)) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (src && typeof src === 'object' && 'text' in src) fs.writeFileSync(dest, src.text);
    else fs.cpSync(src, dest, { recursive: true, dereference: true });
  }
}

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, base) : [path.relative(base, p)];
  });
}

// Skills are third-party docs; transcripts and moment briefs carry the speaker's words: all are checked by name only.
const TEXT_SKIP = /^(\.claude|logos)[\\/]|^transcript\.|^moments?\.json$/;

// Every file in the stage, checked: no banned name in any path, and none in the text we wrote.
export function auditStage(dir, { banned = bannedNames(), textSkip = (rel) => TEXT_SKIP.test(rel) } = {}) {
  const files = walk(dir);
  const problems = [];
  for (const rel of files) {
    for (const b of banned) if (rel.includes(b)) problems.push(`${rel}: path names banned ${b}`);
    if (textSkip(rel) || !/\.(md|json|tsv|txt|html|mjs)$/.test(rel)) continue;
    const text = fs.readFileSync(path.join(dir, rel), 'utf8');
    for (const b of banned) if (text.includes(b)) problems.push(`${rel}: text names banned ${b}`);
  }
  return { files, problems };
}

// Audit, then record what the model could see. Throws before the model runs if anything leaked in.
export function sealStage(dir, opts) {
  const { files, problems } = auditStage(dir, opts);
  if (problems.length) throw new Error(`stage ${dir} holds out-of-scope material:\n  ${problems.join('\n  ')}`);
  fs.writeFileSync(path.join(dir, 'stage-manifest.json'), JSON.stringify({ sealed: new Date().toISOString(), files }, null, 2) + '\n');
  return files;
}

// {{KEY}} placeholders in a prompt template; an unknown key is an error, not a silent blank.
export function fillTemplate(text, vars) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error(`prompt placeholder ${m} has no value`);
    return String(vars[k]);
  });
}
