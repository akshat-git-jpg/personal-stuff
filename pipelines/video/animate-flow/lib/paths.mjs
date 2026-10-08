// Where everything lives. Text artifacts sit in the repo workdir; media and LLM stages sit outside it.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const REPO = path.resolve(ROOT, '..', '..', '..');
export const VIDEO_DIR = path.join(REPO, 'pipelines', 'video');
export const STEPS_DIR = path.join(ROOT, 'steps');
export const TASTE_FILE = path.join(ROOT, 'TASTE-ANIMATE.md');
export const DESIGN_SYSTEMS = path.join(VIDEO_DIR, 'design-systems');
// Brand logos only (registry + files), never the card templates beside them.
export const LOGOS_DIR = path.join(VIDEO_DIR, 'card-library', 'logos');
export const VREG = path.join(REPO, 'pipelines', 'video-registry', 'bin', 'vreg.mjs');
// The two visuals-flow files this recipe names as data (the kit comes in through lib/kit.mjs).
export const TRANSCRIBE_GROQ = path.join(VIDEO_DIR, 'visuals-flow', 'lib', 'transcribe-groq.mjs');
export const ISOLATION_MANIFEST = path.join(VIDEO_DIR, 'visuals-flow', 'recipe-isolation.json');
// The hyperframes skills an author stage gets, from the pipelines skill store.
export const SKILLS_SRC = path.join(REPO, 'pipelines', '.agents', 'skills');
export const AUTHOR_SKILLS = ['hyperframes', 'hyperframes-core', 'hyperframes-animation', 'gsap'];

export const MEDIA_ROOT = process.env.ANIMATE_MEDIA_ROOT ?? path.join(os.homedir(), 'kb-scratch', 'video', 'animate-flow');

export const isSlug = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/.test(s);

export function workdirOf(slug) {
  if (!isSlug(slug)) throw new Error(`not a video key: "${slug}" (lowercase kebab expected)`);
  return path.join(ROOT, 'videos', slug);
}
export const mediaDirOf = (slug) => path.join(MEDIA_ROOT, slug);
export const stageDirOf = (slug, ...parts) => path.join(mediaDirOf(slug), 'stage', ...parts);

export function designSystemDir(name) {
  if (!isSlug(name)) throw new Error(`design system name must be kebab case (got "${name}")`);
  const dir = path.join(DESIGN_SYSTEMS, name);
  if (!fs.existsSync(path.join(dir, 'DESIGN.md'))) throw new Error(`design system "${name}" has no DESIGN.md at ${dir}`);
  return dir;
}

export const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export function writeJson(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
}
