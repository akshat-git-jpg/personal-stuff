/**
 * profiles.mjs — the creative half of a channel: voice, avatar, brand, taste.
 *
 * A profile is a set of POINTERS at assets that live in the pipelines. This module is
 * what makes a dangling pointer a build failure instead of a video that quietly comes
 * out in the wrong voice.
 *
 * Error strings are prefixed with a stable CODE. Gates assert on the code, so
 * renaming one silently disarms a gate. Do not reword them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { allChannels, getChannel, loadRegistry } from './channels.mjs';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..');

const VOICE_CATALOG = path.join(REPO_ROOT, 'pipelines', 'video', 'tts', 'REFERENCES.md');
const AVATAR_REGISTRY = path.join(REPO_ROOT, 'pipelines', 'video', 'heygen', 'registry.json');
const VISUALS_ROOT = path.join(REPO_ROOT, 'pipelines', 'video', 'visuals-flow');

/** Slugs from the Markdown table in tts/REFERENCES.md — the backticked first cell. */
export function knownVoiceSlugs(file = VOICE_CATALOG) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\|\s*`([a-z0-9][a-z0-9-]*)`\s*\|/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Top-level keys of heygen/registry.json. */
export function knownAvatarSlugs(file = AVATAR_REGISTRY) {
  if (!fs.existsSync(file)) return [];
  return Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Where a brand name resolves to on disk. Mirrors visuals-flow/lib/brand-inline.mjs. */
export function brandPathFor(brandName, root = VISUALS_ROOT) {
  return brandName === 'default'
    ? path.join(root, 'brand.json')
    : path.join(root, 'brands', `${brandName}.json`);
}

export function profileFor(channelId, reg = loadRegistry()) {
  const p = getChannel(channelId, reg).profile;
  if (!p) throw new Error(`PROFILE_MISSING: channel ${JSON.stringify(channelId)} has no profile block`);
  return p;
}

/** Returns [] when every profile points at something real; else one string per problem. */
export function validateProfiles(reg = loadRegistry(), opts = {}) {
  const voices = new Set(opts.voices ?? knownVoiceSlugs());
  const avatars = new Set(opts.avatars ?? knownAvatarSlugs());
  const root = opts.repoRoot ?? REPO_ROOT;
  const visuals = opts.visualsRoot ?? VISUALS_ROOT;
  const errors = [];

  for (const c of allChannels(reg)) {
    const at = JSON.stringify(c.id);
    const p = c.profile;
    if (!p) { errors.push(`PROFILE_MISSING: ${at} has no profile block`); continue; }

    if (!p.voice_slug) errors.push(`PROFILE_VOICE_MISSING: ${at} has no voice_slug`);
    else if (!voices.has(p.voice_slug)) {
      errors.push(`PROFILE_VOICE_UNKNOWN: ${at} names voice ${p.voice_slug}, not in tts/REFERENCES.md`);
    }

    if (!p.avatar_slug) errors.push(`PROFILE_AVATAR_MISSING: ${at} has no avatar_slug`);
    else if (!avatars.has(p.avatar_slug)) {
      errors.push(`PROFILE_AVATAR_UNKNOWN: ${at} names avatar ${p.avatar_slug}, not in heygen/registry.json`);
    }

    if (!p.brand) errors.push(`PROFILE_BRAND_MISSING: ${at} has no brand`);
    else if (!fs.existsSync(brandPathFor(p.brand, visuals))) {
      errors.push(`PROFILE_BRAND_UNRESOLVED: ${at} names brand ${p.brand}, no file at ${brandPathFor(p.brand, visuals)}`);
    }

    if (!p.taste_file) errors.push(`PROFILE_TASTE_MISSING: ${at} has no taste_file`);
    else if (!fs.existsSync(path.join(root, p.taste_file))) {
      errors.push(`PROFILE_TASTE_FILE_MISSING: ${at} names taste_file ${p.taste_file}, which does not exist`);
    }

    if (p.style_dna != null && !fs.existsSync(path.join(root, p.style_dna))) {
      errors.push(`PROFILE_STYLE_DNA_MISSING: ${at} names style_dna ${p.style_dna}, which does not exist`);
    }
  }

  return errors;
}
