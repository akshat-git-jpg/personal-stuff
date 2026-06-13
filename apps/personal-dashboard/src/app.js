import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sessionMiddleware } from './auth.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import todosRoutes from './routes/todos.routes.js';
import habitsRoutes from './routes/habits.routes.js';
import remembersRoutes from './routes/remembers.routes.js';
import notesRoutes from './routes/notes.routes.js';
import todayRoutes from './routes/today.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import captureRoutes from './routes/capture.routes.js';
import tagsRoutes from './routes/tags.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Middleware
app.use(express.json());
app.use(sessionMiddleware());

// Static files
app.use(express.static(join(__dirname, '..', 'public')));

// Health check (no auth).
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/habits', habitsRoutes);
app.use('/api/remembers', remembersRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/today', todayRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/capture', captureRoutes);
app.use('/api/tags', tagsRoutes);

// SPA fallback — serve index.html for any non-API route.
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

export default app;
