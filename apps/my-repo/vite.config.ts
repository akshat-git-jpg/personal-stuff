import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Local dev: Vite serves the SPA on :5173 and proxies /api to `wrangler dev` on :8787.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT || 8787}`,
    },
  },
})
