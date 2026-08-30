/**
 * channels.ts — the dashboard's view of config/channels.json.
 *
 * The registry is a repo-root file (plan 261); a Worker bundles it directly. This is
 * the single resolution point: no other file may read the JSON or hardcode a channel
 * id, a playlist id or a link domain.
 */
import registry from "../../../../config/channels.json";

export interface Channel {
  id: string;
  name: string;
  handle: string;
  youtube_channel_id: string;
  owner_account: string;
  link_domain: string;
  zone_name: string;
  archived: boolean;
}

const ALL = registry.channels as Channel[];

export const DEFAULT_CHANNEL_ID: string = registry.default_channel_id;

export function listChannels(channels: Channel[] = ALL): Channel[] {
  return channels.filter((c) => !c.archived);
}

/**
 * The `channels` parameter exists so tests can pass a SYNTHETIC channel list. That is
 * not decoration: with one channel in the shipped registry, a hardcoded playlist id is
 * the one right answer, so a gate that only checks the real file passes vacuously.
 */
export function getChannel(id: string, channels: Channel[] = ALL): Channel {
  const found = channels.find((c) => c.id === id);
  if (!found) throw new Error(`CHANNEL_UNKNOWN: ${JSON.stringify(id)} is not in config/channels.json`);
  return found;
}

/**
 * The uploads playlist for a channel: the channel id with "UC" swapped for "UU".
 * The gate in test/channels.test.ts asserts this really reads the registry — a
 * hardcoded playlist would show one channel's uploads under every channel's name.
 */
export function uploadsPlaylistFor(id: string, channels: Channel[] = ALL): string {
  return "UU" + getChannel(id, channels).youtube_channel_id.slice(2);
}

export function linkDomainFor(id: string, channels: Channel[] = ALL): string {
  return getChannel(id, channels).link_domain;
}
