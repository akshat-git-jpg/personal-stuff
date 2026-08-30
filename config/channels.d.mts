export interface Channel {
  id: string;
  name: string;
  handle: string;
  youtube_channel_id: string;
  owner_account: string;
  link_domain: string;
  zone_name: string;
  archived: boolean;
  profile: {
    voice_slug: string;
    avatar_slug: string;
    brand: string;
    taste_file: string;
    style_dna: string | null;
  };
}
export interface Registry { version: number; default_channel_id: string; channels: Channel[] }
export const REGISTRY_PATH: string;
export function loadRegistry(file?: string): Registry;
export function listChannels(reg?: Registry): Channel[];
export function allChannels(reg?: Registry): Channel[];
export function getChannel(id: string, reg?: Registry): Channel;
export function defaultChannel(reg?: Registry): Channel;
export function validate(reg?: Registry): string[];
