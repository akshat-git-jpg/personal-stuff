import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker gives installability + instant launches in production.
// In dev it is actively harmful: it caches static assets cache-first, so a
// module fetched once is pinned and code changes never reach the browser. So
// in dev, tear it down instead of registering it.
if (import.meta.env.DEV) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    for (const r of regs) r.unregister();
  });
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
