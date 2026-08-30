/**
 * channels.mjs — the single source of truth for "what channels exist".
 *
 * Read by: the redirector route gate, the tracker Worker, the analytics Worker and
 * (via channels.py) the Python pipelines. A D1 table was rejected because the
 * pipelines cannot read D1 at all — see plans/261.
 *
 * Error strings are prefixed with a stable CODE. Gates assert on the code, so
 * renaming one silently disarms a gate. Do not reword them.
 */
import fs from 'node:fs';
import path from 'node:path';

export const REGISTRY_PATH = path.resolve(import.meta.dirname, 'channels.json');

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YT_CHANNEL_RE = /^UC[A-Za-z0-9_-]{22}$/;
const DOMAIN_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/;

export function loadRegistry(file = REGISTRY_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Every non-archived channel, in file order. */
export function listChannels(reg = loadRegistry()) {
  return reg.channels.filter((c) => !c.archived);
}

/** Every channel including archived ones. */
export function allChannels(reg = loadRegistry()) {
  return reg.channels.slice();
}

export function getChannel(id, reg = loadRegistry()) {
  const found = reg.channels.find((c) => c.id === id);
  if (!found) throw new Error(`CHANNEL_UNKNOWN: no channel with id ${JSON.stringify(id)}`);
  return found;
}

export function defaultChannel(reg = loadRegistry()) {
  return getChannel(reg.default_channel_id, reg);
}

/** Returns [] when the registry is well-formed; else one string per problem. */
export function validate(reg = loadRegistry()) {
  const errors = [];
  if (reg.version !== 1) errors.push(`CHANNEL_VERSION_UNSUPPORTED: version ${reg.version}`);
  if (!Array.isArray(reg.channels) || reg.channels.length === 0) {
    errors.push('CHANNEL_LIST_EMPTY: channels must be a non-empty array');
    return errors;
  }

  const seenIds = new Set();
  const seenDomains = new Set();
  const seenYt = new Set();

  for (const c of reg.channels) {
    const at = JSON.stringify(c.id ?? '(missing id)');
    if (!c.id || !ID_RE.test(c.id)) errors.push(`CHANNEL_ID_INVALID: ${at} must be kebab-case`);
    else if (seenIds.has(c.id)) errors.push(`CHANNEL_ID_DUPLICATE: ${at}`);
    else seenIds.add(c.id);

    if (!c.name || !String(c.name).trim()) errors.push(`CHANNEL_NAME_MISSING: ${at}`);

    if (!YT_CHANNEL_RE.test(c.youtube_channel_id || '')) {
      errors.push(`CHANNEL_YT_ID_INVALID: ${at} youtube_channel_id must match UC + 22 chars`);
    } else if (seenYt.has(c.youtube_channel_id)) {
      errors.push(`CHANNEL_YT_ID_DUPLICATE: ${at}`);
    } else seenYt.add(c.youtube_channel_id);

    if (!c.owner_account || !String(c.owner_account).includes('@')) {
      errors.push(`CHANNEL_OWNER_INVALID: ${at} owner_account must be the Google account that OWNS the channel`);
    }

    if (!DOMAIN_RE.test(c.link_domain || '')) {
      errors.push(`CHANNEL_DOMAIN_INVALID: ${at} link_domain must be a bare hostname`);
    } else if (seenDomains.has(c.link_domain)) {
      errors.push(`CHANNEL_DOMAIN_DUPLICATE: ${at} shares link_domain ${c.link_domain}`);
    } else seenDomains.add(c.link_domain);

    if (!c.zone_name || !DOMAIN_RE.test(c.zone_name)) {
      errors.push(`CHANNEL_ZONE_INVALID: ${at} zone_name must be the Cloudflare zone`);
    } else if (c.link_domain && !c.link_domain.endsWith(c.zone_name)) {
      errors.push(`CHANNEL_ZONE_MISMATCH: ${at} link_domain ${c.link_domain} is not inside zone ${c.zone_name}`);
    }
  }

  if (!seenIds.has(reg.default_channel_id)) {
    errors.push(`CHANNEL_DEFAULT_UNKNOWN: default_channel_id ${JSON.stringify(reg.default_channel_id)} is not a channel`);
  }

  return errors;
}
