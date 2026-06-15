/**
 * index.ts
 * Hono entry-point for the yt-analytics Worker.
 *
 * Routes:
 *   POST /api/login   → check shared password, set signed cookie
 *   POST /api/logout  → clear cookie
 *   GET  /api/videos  → de-duplicated per-video / per-link click stats (auth-gated)
 *   GET  *            → serve the SPA via the ASSETS binding
 */

import { Hono } from "hono";
import type { Env } from "./auth";
import {
  checkPassword,
  clearAuthCookie,
  makeToken,
  requireAuth,
  setAuthCookie,
} from "./auth";
import { getVideoStats } from "./analytics";

const app = new Hono<{ Bindings: Env }>();

app.post("/api/login", async (c) => {
  let body: { password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad request" }, 400);
  }
  if (!(await checkPassword(c.env, body.password))) {
    return c.json({ error: "invalid password" }, 401);
  }
  setAuthCookie(c, await makeToken(c.env));
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  clearAuthCookie(c);
  return c.json({ ok: true });
});

app.get("/api/videos", requireAuth, async (c) => {
  const videos = await getVideoStats(c.env);
  return c.json({ videos, generated_at: Math.floor(Date.now() / 1000) });
});

// Everything else → static assets / SPA fallback.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
