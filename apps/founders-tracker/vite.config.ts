import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

const isVitest = typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.env?.VITEST;
const webPort = Number((globalThis as any).process?.env?.WEB_PORT) || 5173;

export default defineConfig({
  plugins: [
    react(),
    !isVitest && cloudflare(),
  ].filter(Boolean) as any,
  server: { port: webPort, strictPort: true },
});
