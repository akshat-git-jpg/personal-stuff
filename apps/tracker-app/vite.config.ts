import path from 'node:path'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Local dev: Vite serves the SPA with HMR on :5173 and proxies the API/auth
  // routes to `wrangler dev` on :8787 (started alongside via `npm run dev:local`).
  // Lets you iterate on UI without rebuilding dist/ + restarting wrangler.
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
      '/dev-login': 'http://localhost:8787',
    },
  },
  // Vitest runs the unit suite in test/; Playwright owns e2e/ (different runner).
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
