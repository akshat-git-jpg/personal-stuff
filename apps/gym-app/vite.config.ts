import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// No @types/node in this app, so read the env off globalThis rather than
// pulling a dependency in just for a port number.
const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export default defineConfig({
  plugins: [react(), cloudflare()],
  // The Cloudflare vite plugin runs the Worker in-process, so client + API
  // share one port. Env-overridable so several local apps can run at once —
  // the local-apps dashboard injects WEB_PORT per app. The default keeps
  // standalone `npm run dev` on :5173.
  server: {
    port: Number(env.WEB_PORT) || 5173,
    strictPort: true,
  },
});
