// Minimal PWA service worker: cache the app shell for instant launches.
// API calls (/api/*) always go to the network — never cached.
const CACHE = "gym-shell-v2";

// Never cache on a dev host. The browser fetches this file directly (bypassing
// any active worker), so bumping it is what lets an already-installed stale
// worker be replaced.
const DEV_HOST = ["localhost", "127.0.0.1"].includes(self.location.hostname);
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  if (DEV_HOST) {
    e.waitUntil(self.skipWaiting());
    return;
  }
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (DEV_HOST) return; // dev: always straight to the vite server
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  // Network-first for navigations (fresh app), cache fallback when offline.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/")));
    return;
  }
  // Cache-first for static assets.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    })),
  );
});
