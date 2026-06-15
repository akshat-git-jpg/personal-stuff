import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During `npm run dev`, proxy API calls to a locally-running wrangler dev.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
