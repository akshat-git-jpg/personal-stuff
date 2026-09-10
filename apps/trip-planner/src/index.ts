/**
 * index.ts
 * Hono entry-point for the trip-planner Worker.
 *
 * Routes:
 *   GET  /                   → the PWA (map + dropdown)
 *   GET  /manifest.webmanifest → PWA install manifest
 *   GET  /sw.js              → tiny service worker (needed for A2HS on iOS)
 *   GET  /api/trips          → index (dropdown data) — no auth
 *   GET  /api/trips/:slug    → one trip JSON — no auth
 *   PUT  /api/trips/:slug    → upsert a trip (needs X-Admin-Token)
 *   DELETE /api/trips/:slug  → remove a trip (needs X-Admin-Token)
 *
 * No login gate on reads. URLs are private-by-obscurity like the other
 * kushal-tools; anyone with the URL can see the pins. No PII on the map.
 */

import { Hono } from "hono";
import type { Env, Trip, TripIndexEntry } from "./types";
import { INDEX_KEY } from "./types";
import { renderApp } from "./app-html";
import { MANIFEST, SW_JS } from "./pwa";

const app = new Hono<{ Bindings: Env }>();

/* ------------------------- static shell ------------------------- */

app.get("/", (c) => c.html(renderApp()));

app.get("/manifest.webmanifest", () =>
  new Response(JSON.stringify(MANIFEST), {
    headers: { "content-type": "application/manifest+json" },
  }),
);

app.get("/sw.js", () =>
  new Response(SW_JS, {
    headers: { "content-type": "application/javascript" },
  }),
);

/* --------------------------- read API --------------------------- */

app.get("/api/trips", async (c) => {
  const raw = await c.env.TRIPS_KV.get(INDEX_KEY);
  const idx: TripIndexEntry[] = raw ? JSON.parse(raw) : [];
  // Newest first, then alpha.
  idx.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return c.json(idx);
});

app.get("/api/trips/:slug", async (c) => {
  const slug = c.req.param("slug");
  const raw = await c.env.TRIPS_KV.get(slug);
  if (!raw) return c.notFound();
  return new Response(raw, { headers: { "content-type": "application/json" } });
});

/* -------------------------- write API --------------------------- */

function authOk(c: any): boolean {
  const tok = c.req.header("x-admin-token") || "";
  return !!tok && tok === c.env.ADMIN_TOKEN;
}

app.put("/api/trips/:slug", async (c) => {
  if (!authOk(c)) return c.text("unauthorized", 401);
  const slug = c.req.param("slug");
  if (slug === INDEX_KEY || !/^[a-z0-9-]{1,64}$/.test(slug)) {
    return c.text("bad slug", 400);
  }
  let trip: Trip;
  try {
    trip = await c.req.json<Trip>();
  } catch {
    return c.text("bad json", 400);
  }
  if (trip.slug !== slug) return c.text("slug mismatch", 400);
  if (!trip.name || !Array.isArray(trip.pins)) return c.text("bad trip", 400);
  trip.updatedAt = new Date().toISOString();
  await c.env.TRIPS_KV.put(slug, JSON.stringify(trip));
  await rebuildIndex(c.env);
  return c.json({ ok: true, slug, pinCount: trip.pins.length });
});

app.delete("/api/trips/:slug", async (c) => {
  if (!authOk(c)) return c.text("unauthorized", 401);
  const slug = c.req.param("slug");
  await c.env.TRIPS_KV.delete(slug);
  await rebuildIndex(c.env);
  return c.json({ ok: true, deleted: slug });
});

/* -------------------------- index maint ------------------------- */

async function rebuildIndex(env: Env): Promise<void> {
  // KV list is eventually consistent but fine for a handful of trips.
  const list = await env.TRIPS_KV.list({ limit: 1000 });
  const out: TripIndexEntry[] = [];
  for (const k of list.keys) {
    if (k.name === INDEX_KEY) continue;
    const raw = await env.TRIPS_KV.get(k.name);
    if (!raw) continue;
    try {
      const t: Trip = JSON.parse(raw);
      out.push({
        slug: t.slug,
        name: t.name,
        dates: t.dates,
        pinCount: (t.pins || []).length,
        updatedAt: t.updatedAt || "",
      });
    } catch {
      // skip
    }
  }
  await env.TRIPS_KV.put(INDEX_KEY, JSON.stringify(out));
}

export default app;
