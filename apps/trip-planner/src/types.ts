/**
 * types.ts
 * Shape of a trip in KV. One trip = one KV entry, keyed by slug.
 */

export type PinCategory =
  | "stay"       // 🏠 hotel / homestay
  | "transport"  // 🚌 bus / train / airport
  | "beach"      // 🏖️
  | "sight"      // 🌅 tourist spot / temple / fort
  | "food"       // ☕ cafe / restaurant
  | "utility";   // 🏧 atm / pharmacy / hospital / shop

export interface Pin {
  id: string;              // stable id within the trip
  name: string;            // display name
  emoji: string;           // one emoji for the pin
  category: PinCategory;   // filter grouping
  lat: number;
  lon: number;
  note?: string;           // any free text (address, phone, opening hours)
  gmapsQuery?: string;     // fallback query for "open in google maps" — defaults to `name`
}

export interface Trip {
  slug: string;            // url-safe id, must match the KV key
  name: string;            // "Varkala Trip (11-13 Sep 2026)"
  dates?: string;          // human-friendly, e.g. "11-13 Sep 2026"
  centerLat?: number;      // initial map center (defaults to avg of pins)
  centerLon?: number;
  zoom?: number;           // initial zoom (defaults to 12)
  // Bbox for Nominatim `bounded=1` searches by `pp-trip add`. Format
  // "W,N,E,S" as lon/lat pairs. Prevents "Kappil Beach" from resolving to
  // a beach 500 km away. Read by the CLI, ignored by the Worker.
  viewbox?: string;
  // Appended to every pin's Google-Maps handoff query so Google searches
  // for the RIGHT "Cafe X" (there are many). e.g. "Varkala Kerala".
  // Without this, Google reverse-geocodes lat/lon to the nearest random
  // road name and shows that instead of the pin's real name.
  locationHint?: string;
  pins: Pin[];
  updatedAt: string;       // ISO
}

export interface TripIndexEntry {
  slug: string;
  name: string;
  dates?: string;
  pinCount: number;
  updatedAt: string;
}

export const INDEX_KEY = "__index";

export interface Env {
  TRIPS_KV: KVNamespace;
  ADMIN_TOKEN: string;
}
