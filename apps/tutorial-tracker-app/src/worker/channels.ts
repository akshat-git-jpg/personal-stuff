/**
 * channels.ts — the tracker's view of config/channels.json.
 *
 * The registry is a repo-root file (plan 261); a Worker bundles it directly. This
 * module is the single resolution point: no other file may read the JSON or hardcode
 * a link domain.
 *
 * WHY THE DOMAIN COMES FROM HERE AND NOT env.LINK_DOMAIN: a short link is minted onto
 * the domain of the channel that will publish the video. One env var can only ever be
 * right for one channel, and minting onto the wrong domain produces a link that
 * resolves (KV is one flat namespace) while attributing the click to nobody.
 */
import registry from "../../../../config/channels.json";

export interface ChannelProfile {
  voice_slug: string;
  avatar_slug: string;
  brand: string;
  taste_file: string;
  style_dna: string | null;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  youtube_channel_id: string;
  owner_account: string;
  link_domain: string;
  zone_name: string;
  archived: boolean;
  profile: ChannelProfile;
}

const ALL = registry.channels as Channel[];

export const DEFAULT_CHANNEL_ID: string = registry.default_channel_id;

/** Non-archived channels, in registry order. What a picker shows. */
export function listChannels(channels: Channel[] = ALL): Channel[] {
  return channels.filter((c) => !c.archived);
}

/**
 * Includes archived channels, so an old card still resolves.
 *
 * The `channels` parameter exists so tests can pass a SYNTHETIC channel list. That is
 * not decoration: with only one channel in the shipped registry, a hardcoded
 * `linkDomainFor` would return the one correct answer and every assertion against the
 * real file would pass. The gate has to resolve a channel that is not in the file.
 */
export function getChannel(id: string, channels: Channel[] = ALL): Channel {
  const found = channels.find((c) => c.id === id);
  if (!found) throw new Error(`CHANNEL_UNKNOWN: ${JSON.stringify(id)} is not in config/channels.json`);
  return found;
}

/** A card's channel id, tolerating rows written before 0007. */
export function channelIdOf(row: { channel_id?: string | null }): string {
  const id = (row.channel_id ?? "").trim();
  return id || DEFAULT_CHANNEL_ID;
}

/**
 * The short-link domain for a channel. The gate in test/channels.test.ts asserts this
 * really reads the registry — a hardcoded return here would let every channel mint on
 * go.agrolloo.com and nothing else would notice.
 */
export function linkDomainFor(id: string, channels: Channel[] = ALL): string {
  return getChannel(id, channels).link_domain;
}
