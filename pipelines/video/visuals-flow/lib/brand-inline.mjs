import fs from 'node:fs';
import path from 'node:path';
import { getChannel, defaultChannel } from '../../../../config/channels.mjs';
import { channelOf, load as loadVideoRegistry } from '../../../video-registry/lib/registry.mjs';

/**
 * Brand resolution order (plan 264):
 *
 *   1. `videoManifest.brand`, when it names something other than the literal
 *      string "default" — an explicit per-video override always wins.
 *      (`loadVideoManifest` merges in `brand: "default"` for every video that
 *      never set one, so a literal "default" reads as "not set", not an
 *      override — there is nothing else to compare it against.)
 *   2. Otherwise, the channel's `profile.brand`. The channel is
 *      `videoManifest.channel` if set, else the channel the video is
 *      registered under in `video-registry` (via `videoManifest.key`), else
 *      the channel registry's default.
 *   3. Otherwise `"default"` — if no channel resolves, or the resolved
 *      channel has no usable profile.
 */
export function loadBrand(root, videoManifest = {}) {
  const brandName = resolveBrandName(videoManifest);
  const brandPath = brandPathFor(brandName, root);

  if (!fs.existsSync(brandPath)) {
    throw new Error(`brand not found: ${brandName}`);
  }

  return JSON.parse(fs.readFileSync(brandPath, 'utf8'));
}

function brandPathFor(brandName, root) {
  return brandName === 'default'
    ? path.join(root, 'brand.json')
    : path.join(root, 'brands', `${brandName}.json`);
}

function resolveBrandName(videoManifest) {
  if (videoManifest.brand && videoManifest.brand !== 'default') return videoManifest.brand;

  const channelId = resolveChannelId(videoManifest);
  try {
    return getChannel(channelId).profile?.brand || 'default';
  } catch {
    // Unknown channel id, or a channel with no profile block. Never throw here —
    // brand resolution degrades to the literal default rather than blocking a run.
    return 'default';
  }
}

function resolveChannelId(videoManifest) {
  if (videoManifest.channel) return videoManifest.channel;
  if (videoManifest.key) {
    try {
      return channelOf(videoManifest.key, loadVideoRegistry());
    } catch {
      // fall through to the registry default
    }
  }
  try {
    return defaultChannel().id;
  } catch {
    return null;
  }
}

export function injectBrand(html, brand) {
  if (!brand || !brand.tokens) return html;

  const rules = Object.entries(brand.tokens)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  const styleTag = `<style id="brand-tokens">:root{${rules}}</style>`;

  return html.replace('</head>', `${styleTag}</head>`);
}
