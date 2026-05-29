/**
 * index.ts
 * Hono app entry-point for the Cloudflare Worker.
 *
 * Routes:
 *   GET  /auth/login      → OAuth redirect
 *   GET  /auth/callback   → OAuth code exchange + session creation
 *   POST /auth/logout     → session teardown
 *   GET  /api/me          → returns { email, role } for the current session (Task 6 adds /api/board)
 *   GET  *                → serve SPA via ASSETS binding
 */

import { Hono } from "hono";
import type { Env, Variables } from "./auth";
import {
  getUser,
  loginRedirect,
  logout,
  oauthCallback,
  requireSession,
} from "./auth";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Auth routes (no session required)
// ---------------------------------------------------------------------------

app.get("/auth/login", loginRedirect);
app.get("/auth/callback", oauthCallback);
app.post("/auth/logout", logout);

// ---------------------------------------------------------------------------
// API routes (session required)
// ---------------------------------------------------------------------------

app.use("/api/*", requireSession);

app.get("/api/me", (c) => {
  return c.json(getUser(c));
});

// ---------------------------------------------------------------------------
// SPA catch-all — serve dist via ASSETS binding
// ---------------------------------------------------------------------------

app.get("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
