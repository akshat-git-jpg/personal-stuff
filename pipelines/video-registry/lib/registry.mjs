import fs from 'node:fs';
import path from 'node:path';

export const REGISTRY_PATH = path.resolve(import.meta.dirname, '..', 'videos.json');
export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Where each pipeline keeps its per-video workdirs, relative to the repo root. */
export const PIPELINE_VIDEO_ROOTS = {
  script: path.join('pipelines', 'youtube', 'yt-script', 'videos'),
  visuals: path.join('pipelines', 'video', 'visuals-flow', 'videos'),
};

export function isValidKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length <= 60 && SLUG_RE.test(key);
}

export function load(file = REGISTRY_PATH) {
  if (!fs.existsSync(file)) return { version: 1, videos: {} };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || typeof raw.videos !== 'object' || raw.videos === null) {
    throw new Error(`E-REGISTRY: ${file} has no "videos" object`);
  }
  return raw;
}

export function save(reg, file = REGISTRY_PATH) {
  const ordered = { version: reg.version ?? 1, videos: {} };
  for (const k of Object.keys(reg.videos).sort()) ordered.videos[k] = reg.videos[k];
  fs.writeFileSync(file, JSON.stringify(ordered, null, 2) + '\n');
}

/**
 * Canonical key for any name the owner might type.
 * Exact key wins; then aliases. Returns null when nothing matches — callers
 * treat null as "not registered", NEVER as an error. Nothing in a consuming
 * pipeline may hard-fail on a missing entry.
 */
export function resolveKey(name, reg = load()) {
  if (!name) return null;
  if (Object.prototype.hasOwnProperty.call(reg.videos, name)) return name;
  for (const [key, v] of Object.entries(reg.videos)) {
    for (const a of (v.aliases || [])) {
      if (a === name) return key;
    }
  }
  return null;
}

/** Every name that maps to this video: the key plus its aliases. */
export function namesFor(key, reg = load()) {
  const v = reg.videos[key];
  if (!v) return [];
  return [key, ...(v.aliases || [])];
}

export function list(reg = load()) {
  return Object.entries(reg.videos).map(([key, v]) => ({ key, ...v }));
}

export function mint(key, { title = '', minted, aliases = [], card_id } = {}, reg = load()) {
  if (!isValidKey(key)) {
    throw new Error(`E-REGISTRY: "${key}" is not a valid key (lowercase kebab-case, <=60 chars)`);
  }
  const clash = resolveKey(key, reg);
  if (clash) throw new Error(`E-REGISTRY: "${key}" already resolves to "${clash}"`);
  for (const a of aliases) {
    const c = resolveKey(a, reg);
    if (c) throw new Error(`E-REGISTRY: alias "${a}" already resolves to "${c}"`);
  }
  const entry = { title, minted: minted ?? new Date().toISOString().slice(0, 10), aliases };
  if (card_id) entry.card_id = card_id;
  reg.videos[key] = entry;
  return reg;
}

/**
 * The symmetric entry point BOTH pipelines call. Idempotent by design:
 *   - name already resolves (as a key OR an alias) -> return that canonical key,
 *     touch nothing
 *   - name is new -> mint it and return it
 * Whichever pipeline reaches a video first mints; the other finds it and reuses.
 * Returns { key, minted, reg } so a caller can tell "I created this" from
 * "it already existed".
 */
export function ensure(name, { title = '' } = {}, reg = load()) {
  const existing = resolveKey(name, reg);
  if (existing) return { key: existing, minted: false, reg };
  return { key: name, minted: true, reg: mint(name, { title }, reg) };
}

/**
 * Where each pipeline's workdir for this video is, and whether it exists.
 *
 * A folder may sit under the canonical key OR under any registered alias —
 * aliasing exists precisely so those folders never had to be renamed, so
 * checking only the canonical name reports "missing" for a folder that is
 * right there. Each slot reports the `name` the folder is actually on disk
 * under, which is the canonical key for anything minted after this existed.
 */
export function whereIs(key, repoRoot = REPO_ROOT, reg = load()) {
  const names = namesFor(key, reg);
  const candidates = names.length ? names : [key];
  return Object.fromEntries(
    Object.entries(PIPELINE_VIDEO_ROOTS).map(([pipeline, rel]) => {
      for (const name of candidates) {
        const p = path.join(repoRoot, rel, name);
        if (fs.existsSync(p)) return [pipeline, { path: p, exists: true, name }];
      }
      return [pipeline, { path: path.join(repoRoot, rel, key), exists: false, name: key }];
    }),
  );
}

/** Every videos/ directory on disk that no registry entry claims. */
export function unregisteredDirs(reg = load(), repoRoot = REPO_ROOT) {
  const out = [];
  for (const rel of Object.values(PIPELINE_VIDEO_ROOTS)) {
    const root = path.join(repoRoot, rel);
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith('.')) continue;
      if (!resolveKey(d.name, reg)) out.push(path.join(root, d.name));
    }
  }
  return out;
}

export function addAlias(key, alias, reg = load()) {
  if (!reg.videos[key]) throw new Error(`E-REGISTRY: no video "${key}"`);
  const clash = resolveKey(alias, reg);
  if (clash === key) return reg;
  if (clash) throw new Error(`E-REGISTRY: alias "${alias}" already resolves to "${clash}"`);
  reg.videos[key].aliases = [...(reg.videos[key].aliases || []), alias].sort();
  return reg;
}
