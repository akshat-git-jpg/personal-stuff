import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // dev only: the built app is served by server.mjs itself
  server: { port: Number(process.env.WEB_PORT) || 5174, proxy: { '/api': 'http://localhost:4340' } },
  test: { environment: 'node' },
});
