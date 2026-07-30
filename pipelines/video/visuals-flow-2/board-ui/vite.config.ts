import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // same bundle works under /app/ (migration) and / (post-cutover)
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    // dev only: the built app is served by lib/board.mjs itself
    proxy: Object.fromEntries(
      ['/api', '/card', '/calibrate-card', '/slice', '/vo.mp3', '/run-log', '/run-videos',
       '/save', '/approve', '/card-feedback', '/versions', '/video', '/status',
       '/feedback-final', '/feedback-image']
        .map((p) => [p, 'http://localhost:4322']),
    ),
  },
  test: { environment: 'node' },
});
