/**
 * pwa.ts
 * Minimal PWA glue: web manifest + a stub service worker.
 * The SW does nothing beyond making iOS treat the page as installable.
 */

export const MANIFEST = {
  name: "Trip Planner",
  short_name: "Trips",
  start_url: "/",
  display: "standalone",
  background_color: "#0d0c0b",
  theme_color: "#0d0c0b",
  icons: [
    {
      src:
        "data:image/svg+xml," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="36" fill="#0d0c0b"/><text x="96" y="132" font-family="system-ui,sans-serif" font-size="120" text-anchor="middle">🗺️</text></svg>`,
        ),
      sizes: "192x192",
      type: "image/svg+xml",
    },
  ],
};

// Registering a no-op SW is enough to satisfy the A2HS heuristic on modern browsers.
export const SW_JS = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',(e)=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
`;
