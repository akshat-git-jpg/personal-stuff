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
  select,button,input{font:inherit;color:#111;background:#fff;border:1px solid #d0d0d0;border-radius:10px;padding:8px 10px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
  /* 42vw, not 60vw: at 60 the trip name alone pushed the buttons onto a
     second row on every phone. */
  select{max-width:42vw}
  button{cursor:pointer}
  button.active{background:#0d0c0b;color:#fff;border-color:#0d0c0b}
  /* Always-visible filter strip (own row, own scroller). min-width:0 keeps a
     scrolling flex child from forcing the whole column wider than the screen. */
  #chips{display:flex;gap:6px;min-width:0;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:2px 0;scrollbar-width:none;pointer-events:none}
  #chips::-webkit-scrollbar{display:none}
  #chips>*{pointer-events:auto}
  .chip{flex:0 0 auto;padding:6px 10px;border-radius:999px;background:#fff;border:1px solid #d0d0d0;font-size:13px;cursor:pointer;user-select:none;box-shadow:0 2px 6px rgba(0,0,0,.15);white-space:nowrap}
  .chip.off{opacity:.35;background:#f2f2f2}
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
  </div>
  <div id="search-wrap">
    <input id="search" placeholder="near me: food, atm, pharmacy…" />
    <button id="search-btn" title="Search near me">→</button>
  </div>
  <!-- Filter chips are ALWAYS visible: no toggle to fail on. Scrolls sideways if they don't fit. -->
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

<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.js"></script>
<script>
/* ------ Constants (mirrored from the server for now) ------ */
const TILE_SOURCE = ${JSON.stringify(TILE_SOURCE)};
const CATS = [
  ['stay','🏠 Stay'],
  ['transport','🚌 Transport'],
  ['beach','🏖️ Beach'],
  ['sight','🌅 Sight'],
  ['food','☕ Food'],
  ['utility','🏧 Utility'],
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
  fitToPins();
}

/* ------ Filters ------ */
function renderChips() {
  const el = document.getElementById('chips');
  el.innerHTML = '';
  for (const [key, label] of CATS) {
    const b = document.createElement('button');
    b.className = 'chip' + (state.activeCats.has(key) ? '' : ' off');
    b.textContent = label;
    b.onclick = () => {
      if (state.activeCats.has(key)) state.activeCats.delete(key);
      else state.activeCats.add(key);
      b.className = 'chip' + (state.activeCats.has(key) ? '' : ' off');
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
