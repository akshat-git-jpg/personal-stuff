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

// Where a pin's lat/lon came from. Shown in the UI so the owner can tell a
// surveyed coordinate from a weaker one without having to ask.
//   owner  - the owner long-pressed the spot in Google Maps. Most trusted.
//   google - Google Places API. Authoritative for small businesses in India.
//   osm    - Nominatim / OpenStreetMap. Good for beaches, temples, roads.
export type PinSource = "owner" | "google" | "osm" | "unknown";

export interface Pin {
  id: string;              // stable id within the trip
  name: string;            // display name
  emoji: string;           // one emoji for the pin
  category: PinCategory;   // filter grouping
  lat: number;
  lon: number;
  note?: string;           // any free text (address, phone, opening hours)
  gmapsQuery?: string;     // fallback query for "open in google maps" — defaults to `name`
  // Google's stable id for this place. When present the map hands it to the
  // Google Maps app as query_place_id / destination_place_id, which resolves to
  // the EXACT place instead of Google re-guessing from a name or, worse,
  // reverse-geocoding lat/lon to the nearest road (the "Nanma" bug).
  placeId?: string;
  source?: PinSource;
}

/* ------------------------- the Plan view ------------------------- */

// One line on a day's timeline. Everything except `what` is optional, so a
// half-known day still renders: a stop with no time sorts where it is written.
export interface DayItem {
  time?: string;   // "07:45" — free text, printed as-is, never parsed
  what: string;    // "Bus drops you at Varkala"
  where?: string;  // one line of detail: address, distance, why
  pinId?: string;  // when set, the row gets a "Show on map" jump to this pin
  tag?: string;    // short badge, e.g. "KBS LUXURY" or a ticket ref
  flag?: string;   // a problem worth an orange box (clash, missing seat)
  key?: boolean;   // a fixed, unmissable moment — filled dot on the rail
}

export interface Day {
  date: string;    // "Fri 11 Sep" — display only
  label?: string;  // "Arrive", "Full day" — a word for the day's shape
  items: DayItem[];
}

// A booking's files are LINKS, not uploads. The trip gets one Google Drive
// folder (`Trip.docsFolderUrl`) and each file points inside it. Drive asks for
// a Google login, so the files stay private even though this page does not.
export interface BookingFile {
  name: string;    // "sekar-ticket.pdf" — what the chip says
  url: string;     // Drive file link
}

export interface Booking {
  id: string;
  emoji: string;
  title: string;                                 // "Varkala → Bengaluru"
  kind?: string;                                 // "Bus ticket · outbound"
  fields?: { label: string; value: string }[];   // the detail rows
  flag?: string;                                 // orange box under the rows
  files?: BookingFile[];
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
  // The Plan view. All three are optional: a trip with only pins still works,
  // and the Plan button hides itself when there is nothing to show.
  days?: Day[];
  bookings?: Booking[];
  docsFolderUrl?: string;  // the trip's Google Drive folder
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
