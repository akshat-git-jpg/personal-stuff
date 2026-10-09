import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // dev only: the built app is served by ../serve.mjs
  server: { proxy: { '/api': 'http://localhost:4371', '/audio': 'http://localhost:4371' } },
});
