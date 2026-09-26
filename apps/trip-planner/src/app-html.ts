/**
 * app-html.ts
 * The whole PWA as one HTML string. No build step, no framework.
 *
 * Boundaries:
 *   - Map rendering: MapLibre GL JS (CDN). Tile provider is defined ONCE in
 *     TILE_SOURCE below — swap it to Google/Mapbox later without touching
 *     anything else.
 *   - Navigation, live traffic, "food near me", Street View, place details:
 *     handed off to the Google Maps app via well-known URL schemes.
 *
 * Data flow (client):
 *   1) GET /api/trips → populate dropdown, pick last-used or ?trip=<slug>.
 *   2) GET /api/trips/:slug → render pins + fit map to their bounds.
 *   3) User taps a pin → info card with Google-Maps handoff buttons.
 *   4) User toggles "Route" → tick multiple pins → opens Google Maps
 *      directions with the selected waypoints in order.
 */

// One source of truth for the map tiles. Swap to Google/Mapbox by changing this.
const TILE_SOURCE = {
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
  maxzoom: 19,
};

export function renderApp(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5" />
<meta name="theme-color" content="#0d0c0b" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Trips" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href='data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0d0c0b"/><text x="16" y="24" font-size="22" text-anchor="middle">🗺️</text></svg>`,
  )}' />
<title>Trips</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.css" />
<style>
  html,body{margin:0;height:100%;font:15px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#0d0c0b}
  #map{position:absolute;inset:0}
  .maplibregl-ctrl-attrib.maplibregl-compact{background:rgba(255,255,255,.7)}
  /* HUD: ONE absolutely-positioned column holding every top control.
     The rows used to be positioned separately, with the chip strip pinned at
     a hard-coded 60px from the top. On a phone the bar wrapped to two or three
     rows and the chips landed on top of it. Stacking them in normal flow means
     the offset can never be wrong, whatever wraps. */
  #hud{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);left:8px;right:8px;z-index:20;display:flex;flex-direction:column;gap:6px;pointer-events:none}
  #hud>*{pointer-events:auto}
  #top{display:flex;gap:6px;align-items:center;flex-wrap:wrap;pointer-events:none}
  #top>*{pointer-events:auto}
  /* border-box everywhere: without it a width:100% input plus its 20px of
     padding is 20px wider than its parent, which made the Places filter poke
     out of its sheet. */
  *,*::before,*::after{box-sizing:border-box}
  select,button,input{font:inherit;color:#111;background:#fff;border:1px solid #d0d0d0;border-radius:10px;padding:8px 10px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
  /* 42vw, not 60vw: at 60 the trip name alone pushed the buttons onto a
     second row on every phone. */
  select{max-width:42vw}
  button{cursor:pointer}
  button.active{background:#0d0c0b;color:#fff;border-color:#0d0c0b}
  /* Filter chips WRAP, they do not scroll.
     A sideways scroller hid Food and Utility off the right edge on every
     phone, with no visual hint that anything was there: the row needed 500px
     and a 390px phone gives it 374px. Wrapping is also the scalable choice --
     a seventh category adds a row instead of silently disappearing. */
  #chips{display:flex;flex-wrap:wrap;gap:5px;padding:2px 0;pointer-events:none}
  #chips>*{pointer-events:auto}
  .chip{flex:0 0 auto;padding:5px 9px;border-radius:999px;background:#fff;border:1px solid #d0d0d0;font-size:12px;line-height:1.25;cursor:pointer;user-select:none;box-shadow:0 2px 6px rgba(0,0,0,.15);white-space:nowrap}
  .chip.off{opacity:.4;background:#f2f2f2}
  /* Tint each chip like its pins, so the emoji is not the only cue. */
  .chip.on-stay{border-color:#e8a0a0}
  .chip.on-transport{border-color:#e8bb80}
  .chip.on-beach{border-color:#ddc040}
  .chip.on-sight{border-color:#84c078}
  .chip.on-food{border-color:#c090e0}
  .chip.on-utility{border-color:#8fa8e8}
  /* pin marker */
  .pin{width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;background:#fff;border:2px solid #333;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer}
  .pin span{transform:rotate(45deg);font-size:16px;line-height:1}
  .pin.sel{background:#ffe08a;border-color:#e08a00}
  .pin.selnum{position:relative}
  .pin.selnum::after{content:attr(data-num);position:absolute;top:-8px;right:-8px;transform:rotate(45deg);background:#e08a00;color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.4)}
  /* category tints on the pin body */
  .pin.stay{background:#ffe1e1}
  .pin.transport{background:#ffe6c8}
  .pin.beach{background:#fff2b3}
  .pin.sight{background:#d6f0d0}
  .pin.food{background:#ecd6ff}
  .pin.utility{background:#dfe7ff}
  /* Bottom sheets live in ONE column too. Route mode plus a tapped pin means
     two sheets are open at once; when each was independently pinned to
     bottom:8px they sat on top of each other. */
  #sheets{position:absolute;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:10;display:flex;flex-direction:column;gap:8px;max-height:70vh;pointer-events:none}
  #sheets>*{pointer-events:auto}
  .sheet{position:relative;flex:0 1 auto;min-height:0;background:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.28);overflow:auto;-webkit-overflow-scrolling:touch}
  .sheet h3{margin:0 0 4px;font-size:16px;padding-right:28px}
  .sheet .cat{font-size:12px;color:#666;text-transform:capitalize;margin-bottom:8px}
  .sheet .note{white-space:pre-wrap;color:#333;margin:8px 0}
  .row{display:flex;flex-wrap:wrap;gap:6px}
  .row a,.row button{padding:8px 10px;border-radius:10px;border:1px solid #d0d0d0;background:#fff;text-decoration:none;color:#111;font-size:13px}
  .row a.primary{background:#1a73e8;color:#fff;border-color:#1a73e8}
  /* sticky so the × stays reachable once a long note scrolls */
  .close{position:sticky;float:right;top:0;border:none;background:transparent;font-size:22px;line-height:1;color:#888;padding:0 4px;margin:-4px -6px 0 0}
  .empty{padding:24px;text-align:center;color:#666;background:#fff;margin:16px;border-radius:12px}
  /* Search gets its own full-width row rather than competing for space in the
     top row, which is what made the bar wrap in the first place. */
  #search-wrap{display:flex;gap:4px;pointer-events:none}
  #search-wrap>*{pointer-events:auto}
  #search{flex:1;min-width:0}
  /* geolocate active */
  .maplibregl-ctrl-geolocate{background-color:#fff !important}

  /* ---------------- Plan view (second view) ----------------
     A full-screen scroller ABOVE the map, not a panel beside it. That keeps it
     out of the HUD's layout entirely: nothing here can push a chip off-screen,
     and the map keeps its own measured layout. Everything inside is normal
     document flow, so it survives any amount of text.
     Class prefix 'p' throughout, so these rules cannot collide with the map's
     bare button / select / .row selectors above. */
  #plan{position:absolute;inset:0;z-index:30;overflow:auto;-webkit-overflow-scrolling:touch;background:#f4f5f4;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 28px)}
  #plan-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;background:#f4f5f4;border-bottom:1px solid #e0e2e0;padding:calc(env(safe-area-inset-top,0px) + 12px) 14px 10px}
  #plan-head .pt{flex:1;min-width:0}
  #plan-title{font-weight:700;font-size:16px;line-height:1.25}
  #plan-sub{font-size:12px;color:#666;margin-top:2px}
  #plan-body{padding:14px 14px 0;display:flex;flex-direction:column;gap:22px}
  .pday-head{display:flex;align-items:baseline;gap:8px;padding-bottom:8px;border-bottom:1px solid #dfe2df}
  .pday-date{font-weight:700;font-size:15px}
  .pday-label{font-size:12px;color:#777;margin-left:auto}
  /* minmax(0,1fr) not 1fr: a long unbroken word in a 1fr track widens the grid
     past the viewport instead of wrapping. */
  .pstop{display:grid;grid-template-columns:46px 14px minmax(0,1fr);column-gap:9px;align-items:start;padding:11px 0;border-bottom:1px solid #e6e8e6}
  .pday .pstop:last-child{border-bottom:none}
  .ptime{font-size:13px;color:#666;padding-top:1px;font-variant-numeric:tabular-nums}
  .prail{position:relative;justify-self:center;align-self:stretch}
  .prail::before{content:"";position:absolute;left:50%;top:13px;bottom:-12px;width:1px;background:#ccd0cd;transform:translateX(-50%)}
  .pday .pstop:last-child .prail::before{display:none}
  .prail i{position:absolute;left:50%;top:4px;transform:translateX(-50%);width:9px;height:9px;border-radius:50%;background:#fff;border:2px solid #ccd0cd}
  .pstop.key .prail i{background:#1a73e8;border-color:#1a73e8}
  .pstop.warn .prail i{background:#c0522a;border-color:#c0522a}
  .pwhat{font-weight:600;line-height:1.3}
  .pwhere{font-size:13px;color:#555;margin-top:2px}
  .ptag{display:inline-block;margin-top:6px;padding:2px 7px;border-radius:5px;background:#e8f0fe;color:#1558b0;font-size:11px;letter-spacing:.03em}
  .pflag{margin-top:7px;padding:7px 9px;border-radius:7px;background:#fbe9e2;color:#8f3a17;font-size:12.5px;line-height:1.4}
  .pjump{margin-top:7px;padding:0;border:none;background:none;box-shadow:none;color:#1a73e8;font-size:13px}
  .psec{font-weight:700;font-size:15px}
  .psub{font-size:12.5px;color:#666;margin:3px 0 12px}
  .pdocs{display:flex;flex-direction:column;gap:10px}
  .pdoc{background:#fff;border:1px solid #e0e2e0;border-radius:12px;padding:12px 13px;display:flex;flex-direction:column;gap:9px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .pdoc.folder{border-color:#1a73e8}
  .pdoc-top{display:flex;gap:10px;align-items:flex-start}
  .pdoc-ico{flex:0 0 32px;height:32px;border-radius:8px;background:#e8f0fe;display:flex;align-items:center;justify-content:center;font-size:16px}
  .pdoc-name{font-weight:700;line-height:1.25}
  .pdoc-kind{font-size:11px;color:#777;margin-top:3px;text-transform:uppercase;letter-spacing:.08em}
  .pdl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;margin:0}
  .pdl dt{font-size:12.5px;color:#777}
  .pdl dd{margin:0;font-size:12.5px;font-weight:600;text-align:right;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
  .pfiles{display:flex;flex-wrap:wrap;gap:6px}
  .pfile{display:inline-block;padding:7px 11px;border:1px solid #d5d8d5;border-radius:999px;background:#fff;color:#111;font-size:12.5px;text-decoration:none}
  .pfile.solid{background:#1a73e8;border-color:#1a73e8;color:#fff}
</style>
</head>
<body>
<div id="map"></div>

<!-- One stacking column for every top control. Rows may wrap freely; nothing
     below them is positioned by a hard-coded offset any more. -->
<div id="hud">
  <div id="top">
    <select id="trip" title="Trip"><option value="">Loading…</option></select>
    <button id="places-btn" title="Jump to a pin">📍 Places</button>
    <button id="route-btn" title="Plan a multi-stop route">Route</button>
    <!-- Hidden until the loaded trip actually has days or bookings, so a
         pins-only trip shows no dead control. -->
    <button id="plan-btn" title="Day plan and booking documents" hidden>🗓️ Plan</button>
  </div>
  <div id="search-wrap">
    <input id="search" placeholder="near me: food, atm, pharmacy…" />
    <button id="search-btn" title="Search near me">→</button>
  </div>
  <!-- Filter chips are ALWAYS visible: no toggle to fail on, and they wrap
       rather than scroll, so none can hide off the right edge. -->
  <div id="chips"></div>
</div>

<!-- One stacking column for the bottom sheets, so two open at once stack
     instead of covering each other. -->
<div id="sheets">
  <div id="places" class="sheet" hidden>
    <button class="close" data-close="places">×</button>
    <h3>Jump to a pin</h3>
    <input id="places-filter" placeholder="type to filter…" style="width:100%;margin:6px 0 8px" />
    <div id="places-list" style="display:flex;flex-direction:column;gap:4px"></div>
  </div>

  <div id="route" class="sheet" hidden>
    <button class="close" data-close="route">×</button>
    <h3>Plan a route</h3>
    <div class="cat">Tap pins on the map in the order you want to visit them.</div>
    <div id="route-list" class="row"></div>
    <div class="row" style="margin-top:10px">
      <button id="route-clear">Clear</button>
      <a id="route-go" class="primary" href="#" target="_blank" rel="noopener">Open in Google Maps</a>
    </div>
    <div class="cat" style="margin-top:8px">Google Maps opens with turn-by-turn, live traffic, and up to ~9 stops.</div>
  </div>

  <!-- Card last so a tapped pin reads closest to the thumb. -->
  <div id="card" class="sheet" hidden></div>
</div>

<!-- The second view. Sits above everything, has its own close button, and is
     rendered from trip.days / trip.bookings by renderPlan(). -->
<div id="plan" hidden>
  <div id="plan-head">
    <div class="pt">
      <div id="plan-title">Plan</div>
      <div id="plan-sub"></div>
    </div>
    <button id="plan-close" title="Back to the map">🗺️ Map</button>
  </div>
  <div id="plan-body"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.js"></script>
<script>
/* ------ Constants (mirrored from the server for now) ------ */
const TILE_SOURCE = ${JSON.stringify(TILE_SOURCE)};
// Labels are kept SHORT so all six chips fit one wrapped row on a 390px
// phone. 'Transport' and 'Utility' were the two that pushed the row to 500px
// and shoved Food off the screen; the emoji carries the meaning either way.
const CATS = [
  ['stay','🏠 Stay'],
  ['transport','🚌 Bus'],
  ['beach','🏖️ Beach'],
  ['sight','🌅 Sight'],
  ['food','☕ Food'],
  ['utility','🏧 ATM'],
];
/* Owner wants a quiet map on open: only the things worth looking at from
   a distance. Everything else is one tap away on its chip. */
const DEFAULT_CATS = ['beach','sight'];

/* ------ Register the no-op service worker (needed for iOS A2HS) ------ */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

/* ------ State ------ */
const state = {
  trips: [],           // index
  trip: null,          // current trip
  markers: [],         // MapLibre marker instances
  activeCats: new Set(DEFAULT_CATS),
  routeMode: false,
  routeOrder: [],      // pin ids in tap order
  userLoc: null,       // {lat,lon} from geolocate
};

/* ------ Map ------ */
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: { osm: { type: 'raster', tileSize: 256, ...TILE_SOURCE } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  },
  center: [77.5946, 12.9716], // Bengaluru default
  zoom: 4,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
const geo = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserHeading: true,
});
map.addControl(geo, 'bottom-right');
geo.on('geolocate', (e) => {
  state.userLoc = { lat: e.coords.latitude, lon: e.coords.longitude };
});

// Auto-request location once the map is ready (user still sees the OS prompt).
map.on('load', () => setTimeout(() => { try { geo.trigger(); } catch {} }, 300));

/* ------ Trip index (dropdown) ------ */
async function loadIndex() {
  const r = await fetch('/api/trips');
  state.trips = await r.json();
  const sel = document.getElementById('trip');
  sel.innerHTML = '';
  if (!state.trips.length) {
    sel.innerHTML = '<option value="">No trips yet</option>';
    document.body.insertAdjacentHTML('beforeend', '<div class="empty">No trips yet. Add pins via the <code>pp-trip</code> CLI.</div>');
    return;
  }
  for (const t of state.trips) {
    const o = document.createElement('option');
    o.value = t.slug;
    o.textContent = t.name + (t.dates ? ' — ' + t.dates : '') + ' (' + t.pinCount + ')';
    sel.appendChild(o);
  }
  // Pick trip: ?trip= wins, then localStorage, then first.
  const url = new URL(location.href);
  const wanted = url.searchParams.get('trip') || localStorage.getItem('trip-planner:last') || state.trips[0].slug;
  const found = state.trips.find(t => t.slug === wanted) ? wanted : state.trips[0].slug;
  sel.value = found;
  await selectTrip(found);
  sel.addEventListener('change', () => selectTrip(sel.value));
}

async function selectTrip(slug) {
  localStorage.setItem('trip-planner:last', slug);
  const url = new URL(location.href);
  url.searchParams.set('trip', slug);
  history.replaceState(null, '', url.toString());
  const r = await fetch('/api/trips/' + encodeURIComponent(slug));
  if (!r.ok) return;
  state.trip = await r.json();
  clearRoute();
  renderPins();
  renderPlan();
  fitToPins();
}

/* ------ Filters ------ */
function renderChips() {
  const el = document.getElementById('chips');
  el.innerHTML = '';
  for (const [key, label] of CATS) {
    const b = document.createElement('button');
    const cls = () => 'chip ' + (state.activeCats.has(key) ? 'on-' + key : 'off');
    b.className = cls();
    b.textContent = label;
    b.setAttribute('aria-pressed', state.activeCats.has(key) ? 'true' : 'false');
    b.title = key;
    b.onclick = () => {
      if (state.activeCats.has(key)) state.activeCats.delete(key);
      else state.activeCats.add(key);
      b.className = cls();
      b.setAttribute('aria-pressed', state.activeCats.has(key) ? 'true' : 'false');
      renderPins();
    };
    el.appendChild(b);
  }
}
renderChips();

/* ------ Places sheet: type-to-filter list of every pin in the trip ------ */
document.getElementById('places-btn').onclick = () => {
  renderPlacesList('');
  document.getElementById('places').hidden = false;
  document.getElementById('card').hidden = true;
  const inp = document.getElementById('places-filter');
  inp.value = '';
  setTimeout(() => inp.focus(), 50);
};
document.getElementById('places-filter').addEventListener('input', (e) => {
  renderPlacesList(e.target.value.trim().toLowerCase());
});
function renderPlacesList(q) {
  const el = document.getElementById('places-list');
  if (!state.trip) { el.innerHTML = '<div class="cat">No trip loaded.</div>'; return; }
  const pins = state.trip.pins.filter(p =>
    !q || (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  );
  if (!pins.length) { el.innerHTML = '<div class="cat">No pins match.</div>'; return; }
  // Sort by category, then name.
  pins.sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));
  el.innerHTML = pins.map(p =>
    '<button style="text-align:left;padding:8px 10px" data-pinid="' + p.id + '">' +
    (p.emoji || '📍') + ' <b>' + escapeHtml(p.name) + '</b>' +
    ' <span class="cat" style="display:inline">· ' + p.category + '</span>' +
    '</button>'
  ).join('');
  el.querySelectorAll('button[data-pinid]').forEach(b => {
    b.onclick = () => {
      const p = state.trip.pins.find(x => x.id === b.dataset.pinid);
      if (!p) return;
      document.getElementById('places').hidden = true;
      map.flyTo({ center: [p.lon, p.lat], zoom: 17, duration: 500 });
      showCard(p);
    };
  });
}

document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => document.getElementById(b.dataset.close).hidden = true);

function toggleSheet(id) {
  const el = document.getElementById(id);
  el.hidden = !el.hidden;
}

/* ------ Pins ------ */
function renderPins() {
  for (const m of state.markers) m.remove();
  state.markers = [];
  if (!state.trip) return;
  for (const p of state.trip.pins) {
    if (!state.activeCats.has(p.category)) continue;
    const el = document.createElement('div');
    el.className = 'pin ' + p.category;
    const routeIdx = state.routeOrder.indexOf(p.id);
    if (routeIdx >= 0) { el.classList.add('sel','selnum'); el.setAttribute('data-num', String(routeIdx + 1)); }
    const s = document.createElement('span');
    s.textContent = p.emoji || '📍';
    el.appendChild(s);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.routeMode) toggleRoutePin(p.id);
      else showCard(p);
    });
    const m = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([p.lon, p.lat])
      .addTo(map);
    state.markers.push(m);
  }
}

function fitToPins() {
  if (!state.trip || !state.trip.pins.length) return;
  const t = state.trip;
  if (t.centerLat != null && t.centerLon != null) {
    map.jumpTo({ center: [t.centerLon, t.centerLat], zoom: t.zoom || 12 });
    return;
  }
  const b = new maplibregl.LngLatBounds();
  for (const p of t.pins) b.extend([p.lon, p.lat]);
  map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 400 });
}

/* ------ Info card ------ */

// Build the Google Maps query for one pin. Prefers the pin's own name
// (so Google searches for the real place) over its lat/lon (which
// reverse-geocodes to whatever road is nearest -- Nanma, Cliff 2nd
// Street, etc). Appends the trip locationHint so ambiguous names
// like Cafe del Mar find the Varkala one, not one in another country.
function gmapsQueryFor(p) {
  if (p.gmapsQuery) return p.gmapsQuery;
  const hint = (state.trip && state.trip.locationHint) ? (', ' + state.trip.locationHint) : '';
  return p.name + hint;
}

// A pin's placeId is Google's own stable id for that place. Passing it as
// query_place_id / destination_place_id removes all guessing: Google opens
// THAT place, not its best match for our text. Google requires the text
// parameter alongside the id, and uses the text only if the id fails to
// resolve, so sending both is strictly better than sending either.
function gmapsIdParam(p, key) {
  return p.placeId ? ('&' + key + '=' + encodeURIComponent(p.placeId)) : '';
}

function showCard(p) {
  const q = encodeURIComponent(gmapsQueryFor(p));
  const searchUrl = 'https://www.google.com/maps/search/?api=1&query=' + q + gmapsIdParam(p, 'query_place_id');
  const navUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + q + gmapsIdParam(p, 'destination_place_id') + '&travelmode=driving';
  const el = document.getElementById('card');
  el.innerHTML = '<button class="close" onclick="document.getElementById(\\'card\\').hidden=true">×</button>' +
    '<h3>' + (p.emoji || '📍') + ' ' + escapeHtml(p.name) + '</h3>' +
    '<div class="cat">' + p.category + (p.source ? ' · ' + p.source : '') + '</div>' +
    (p.note ? '<div class="note">' + escapeHtml(p.note) + '</div>' : '') +
    '<div class="row">' +
      '<a class="primary" href="' + navUrl + '" target="_blank" rel="noopener">Directions</a>' +
      '<a href="' + searchUrl + '" target="_blank" rel="noopener">Open in Maps</a>' +
      (state.routeMode
        ? '<button onclick="window.__toggleRoute(\\'' + p.id + '\\')">' + (state.routeOrder.includes(p.id) ? 'Remove from route' : 'Add to route') + '</button>'
        : '<button onclick="window.__enterRoute(\\'' + p.id + '\\')">Add to route</button>') +
    '</div>';
  el.hidden = false;
}
window.__toggleRoute = (id) => { toggleRoutePin(id); const p = state.trip.pins.find(x=>x.id===id); if (p) showCard(p); };
window.__enterRoute = (id) => { enterRouteMode(); toggleRoutePin(id); const p = state.trip.pins.find(x=>x.id===id); if (p) showCard(p); };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ------ Plan view: the day list plus the booking documents ------

   Rendered from trip.days / trip.bookings, which the owner writes in the trip
   JSON. Every field is optional, so a half-filled day still renders.

   Booking files are LINKS into the trip's Google Drive folder, never uploads:
   this page has no login, so a file served from here would be public, while
   Drive makes the reader sign in. A booking with no file yet falls back to the
   folder link, so the button is never dead. */
const planEl = document.getElementById('plan');
document.getElementById('plan-btn').onclick = () => { planEl.hidden = false; planEl.scrollTop = 0; };
document.getElementById('plan-close').onclick = () => { planEl.hidden = true; };

function renderPlan() {
  const t = state.trip;
  const days = (t && t.days) || [];
  const bookings = (t && t.bookings) || [];
  const folder = (t && t.docsFolderUrl) || '';
  const body = document.getElementById('plan-body');
  const has = !!(days.length || bookings.length || folder);
  document.getElementById('plan-btn').hidden = !has;
  if (!has) { planEl.hidden = true; body.innerHTML = ''; return; }

  document.getElementById('plan-title').textContent = t.name;
  document.getElementById('plan-sub').textContent = t.dates || '';

  const out = [];

  for (const d of days) {
    const rows = (d.items || []).map(it => {
      // A problem outranks a milestone on the rail dot: an orange dot is the
      // one thing the owner must not scroll past.
      const cls = 'pstop' + (it.flag ? ' warn' : (it.key ? ' key' : ''));
      return '<div class="' + cls + '">' +
        '<div class="ptime">' + escapeHtml(it.time || '') + '</div>' +
        '<div class="prail"><i></i></div>' +
        '<div>' +
          '<div class="pwhat">' + escapeHtml(it.what || '') + '</div>' +
          (it.where ? '<div class="pwhere">' + escapeHtml(it.where) + '</div>' : '') +
          (it.tag ? '<span class="ptag">' + escapeHtml(it.tag) + '</span>' : '') +
          (it.flag ? '<div class="pflag">' + escapeHtml(it.flag) + '</div>' : '') +
          (it.pinId ? '<button class="pjump" data-jump="' + escapeHtml(it.pinId) + '">→ Show on map</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    out.push('<section class="pday">' +
      '<div class="pday-head">' +
        '<span class="pday-date">' + escapeHtml(d.date || '') + '</span>' +
        (d.label ? '<span class="pday-label">' + escapeHtml(d.label) + '</span>' : '') +
      '</div>' + rows + '</section>');
  }

  if (bookings.length || folder) {
    const cards = [];
    if (folder) {
      cards.push('<div class="pdoc folder">' +
        '<div class="pdoc-top"><div class="pdoc-ico">📁</div><div>' +
          '<div class="pdoc-name">Trip documents</div>' +
          '<div class="pdoc-kind">Google Drive folder</div>' +
        '</div></div>' +
        '<div class="pfiles"><a class="pfile solid" href="' + escapeHtml(folder) +
          '" target="_blank" rel="noopener">Open folder ↗</a></div>' +
      '</div>');
    }
    for (const b of bookings) {
      const fields = (b.fields || []).map(f =>
        '<dt>' + escapeHtml(f.label) + '</dt><dd>' + escapeHtml(f.value) + '</dd>').join('');
      let files = (b.files || []).map(f =>
        '<a class="pfile" href="' + escapeHtml(f.url) + '" target="_blank" rel="noopener">📄 ' +
        escapeHtml(f.name) + ' ↗</a>').join('');
      if (!files && folder) {
        files = '<a class="pfile" href="' + escapeHtml(folder) +
          '" target="_blank" rel="noopener">📁 Open trip folder ↗</a>';
      }
      cards.push('<div class="pdoc">' +
        '<div class="pdoc-top"><div class="pdoc-ico">' + escapeHtml(b.emoji || '📄') + '</div><div>' +
          '<div class="pdoc-name">' + escapeHtml(b.title || '') + '</div>' +
          (b.kind ? '<div class="pdoc-kind">' + escapeHtml(b.kind) + '</div>' : '') +
        '</div></div>' +
        (fields ? '<dl class="pdl">' + fields + '</dl>' : '') +
        (b.flag ? '<div class="pflag">' + escapeHtml(b.flag) + '</div>' : '') +
        (files ? '<div class="pfiles">' + files + '</div>' : '') +
      '</div>');
    }
    out.push('<section>' +
      '<div class="psec">Bookings &amp; documents</div>' +
      '<div class="psub">The details are here. The files sit in the trip Drive folder.</div>' +
      '<div class="pdocs">' + cards.join('') + '</div>' +
    '</section>');
  }

  body.innerHTML = out.join('');
  body.querySelectorAll('[data-jump]').forEach(b => {
    b.onclick = () => {
      const p = state.trip.pins.find(x => x.id === b.dataset.jump);
      if (!p) return;
      planEl.hidden = true;
      map.flyTo({ center: [p.lon, p.lat], zoom: 17, duration: 500 });
      showCard(p);
    };
  });
}

/* ------ Route mode ------ */
const routeBtn = document.getElementById('route-btn');
routeBtn.onclick = () => state.routeMode ? exitRouteMode() : enterRouteMode();
function enterRouteMode() {
  state.routeMode = true;
  routeBtn.classList.add('active');
  document.getElementById('route').hidden = false;
  document.getElementById('card').hidden = true;
  renderRouteList();
}
function exitRouteMode() {
  state.routeMode = false;
  routeBtn.classList.remove('active');
  document.getElementById('route').hidden = true;
  clearRoute();
}
function clearRoute() {
  state.routeOrder = [];
  renderRouteList();
  renderPins();
}
document.getElementById('route-clear').onclick = clearRoute;

function toggleRoutePin(id) {
  const i = state.routeOrder.indexOf(id);
  if (i >= 0) state.routeOrder.splice(i, 1);
  else state.routeOrder.push(id);
  renderRouteList();
  renderPins();
}

function renderRouteList() {
  const el = document.getElementById('route-list');
  const go = document.getElementById('route-go');
  if (!state.routeOrder.length) {
    el.innerHTML = '<div class="cat">No stops yet.</div>';
    go.href = '#';
    go.style.pointerEvents = 'none';
    go.style.opacity = '0.5';
    return;
  }
  const items = state.routeOrder.map((id, i) => {
    const p = state.trip.pins.find(x => x.id === id);
    return '<button onclick="window.__toggleRoute(\\'' + id + '\\')">' + (i + 1) + '. ' + (p ? escapeHtml(p.name) : '?') + ' ×</button>';
  });
  el.innerHTML = items.join('');
  // Google takes destination + waypoints as names (URL-encoded, pipe-separated)
  // and optionally the matching place ids. Names alone made Google re-guess and
  // sometimes reverse-geocode to the nearest road; the ids remove the guessing.
  const picked = state.routeOrder
    .map(id => state.trip.pins.find(x => x.id === id))
    .filter(Boolean);
  const qs = picked.map(p => encodeURIComponent(gmapsQueryFor(p)));
  let origin = 'My+Location';
  if (state.userLoc) origin = state.userLoc.lat + ',' + state.userLoc.lon;
  const last = picked[picked.length - 1];
  const dest = qs[qs.length - 1];
  const wpPins = picked.slice(0, -1);
  const wps = qs.slice(0, -1).join('|');
  let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + origin +
            '&destination=' + dest + gmapsIdParam(last, 'destination_place_id');
  if (wps) {
    url += '&waypoints=' + wps;
    // waypoint_place_ids must line up 1:1 with waypoints, so send it only when
    // EVERY waypoint has an id. A partial list would misalign the whole route.
    if (wpPins.every(p => p.placeId)) {
      url += '&waypoint_place_ids=' + wpPins.map(p => encodeURIComponent(p.placeId)).join('|');
    }
  }
  go.href = url;
  go.style.pointerEvents = '';
  go.style.opacity = '';
}

/* ------ Search near me (hand off to Google Maps) ------ */
document.getElementById('search-btn').onclick = doSearch;
document.getElementById('search').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
function doSearch() {
  const q = document.getElementById('search').value.trim();
  if (!q) return;
  const c = map.getCenter();
  const near = state.userLoc ? (state.userLoc.lat + ',' + state.userLoc.lon) : (c.lat.toFixed(6) + ',' + c.lng.toFixed(6));
  const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q + ' near ' + near);
  window.open(url, '_blank', 'noopener');
}

/* ------ Go ------ */
loadIndex().catch(err => {
  document.body.insertAdjacentHTML('beforeend', '<div class="empty">Failed to load: ' + escapeHtml(String(err)) + '</div>');
});
</script>
</body>
</html>`;
}
