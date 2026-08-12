// The avatar spend gate (step 102). Avatar IV (heygen4) is METERED against
// the monthly second-pool; before this, the engine was chosen at kickoff
// (run-config.json's `engine`, step 005) — twenty steps before shots.json
// exists, so the authorisation was against an unknown number of clips and
// seconds. This moves the decision here, against the real numbers, and turns
// it into a hard gate: nothing reaches HeyGen until it is approved.
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { pathToFileURL } from 'node:url';

export const MODELS = ['heygen3', 'heygen4'];

const REGISTRY_PATH = path.resolve(import.meta.dirname, '..', '..', 'heygen', 'registry.json');

export function loadRegistry(registryPath = REGISTRY_PATH) {
  return fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, 'utf8')) : {};
}

export function avatarPlanPath(workdir) {
  return path.join(workdir, 'avatar-plan.json');
}

// clips/seconds come from shots.resolved.json's spans — the REAL numbers, not
// an estimate. That is the entire reason this decision moved here from
// kickoff (a reviewer should scrutinise that this stays true across changes).
export function buildAvatarPlan({ workdir, shotsResolved, registry }) {
  const spans = shotsResolved?.spans ?? [];
  const clips = spans.length;
  const seconds = +spans.reduce((sum, s) => sum + (s.duration ?? 0), 0).toFixed(2);
  const candidates = Object.entries(registry ?? {}).map(([id, def]) => ({
    id,
    description: def?.description ?? '',
    hasTemplate: !!def?.template_id,
    hasImage: !!def?.image,
  }));
  return {
    video: shotsResolved?.video ?? path.basename(workdir),
    character: null,
    model: null,
    clips,
    seconds,
    candidates,
    models: [...MODELS],
    approved: false,
  };
}

// A re-run (after re-authoring shots) must reflect the current shot count
// without silently discarding an approval already on disk — but it must
// never invent character/model that the owner never picked.
export function mergeAvatarPlan(existing, fresh) {
  if (!existing) return fresh;
  return {
    ...fresh,
    character: existing.character ?? null,
    model: existing.model ?? null,
    approved: existing.approved === true,
  };
}

// The gate itself. Throws rather than returning a boolean so a caller that
// forgets to check cannot accidentally submit anyway. Every message carries
// UNAPPROVED-AVATAR-SPEND — the one string a mutation, or any future
// regression, can grep for to prove this actually refused.
export function requireAvatarPlanApproved(workdir) {
  const p = avatarPlanPath(workdir);
  if (!fs.existsSync(p)) {
    throw new Error(
      `UNAPPROVED-AVATAR-SPEND: missing ${p} — run "run.sh <slug> avatar-plan", then pick a ` +
      'character and model on the board\'s Avatar tab before submitting anything to HeyGen',
    );
  }
  const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
  const missing = [];
  if (!plan.character) missing.push('character');
  if (!plan.model) missing.push('model');
  if (plan.approved !== true) missing.push('approved');
  if (missing.length) {
    throw new Error(
      `UNAPPROVED-AVATAR-SPEND: avatar-plan.json is missing ${missing.join(', ')} — approve a ` +
      'character and model on the board\'s Avatar tab (step 102) before submitting anything to HeyGen',
    );
  }
  return plan;
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/avatar-plan.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(slug);
  const shotsResolvedPath = path.join(workdir, 'shots.resolved.json');
  if (!fs.existsSync(shotsResolvedPath)) {
    console.error(`missing ${shotsResolvedPath} — run "run.sh <slug> storyboard-check" first`);
    process.exit(1);
  }
  const shotsResolved = JSON.parse(fs.readFileSync(shotsResolvedPath, 'utf8'));
  const registry = loadRegistry();
  const fresh = buildAvatarPlan({ workdir, shotsResolved, registry });

  const p = avatarPlanPath(workdir);
  const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  const merged = mergeAvatarPlan(existing, fresh);
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + '\n');

  console.log(merged.approved
    ? `avatar-plan: ${merged.clips} clips, ${merged.seconds}s — approved (${merged.character}/${merged.model})`
    : `avatar-plan: ${merged.clips} clips, ${merged.seconds}s — awaiting owner approval on the board's Avatar tab`);
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
