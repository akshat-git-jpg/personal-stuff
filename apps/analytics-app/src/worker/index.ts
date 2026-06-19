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
import { addKeyword, checkVideo, deleteKeyword, getRankings } from "./rankings";

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
  const result = await getVideoStats(c.env);
  return c.json({ ...result, generated_at: Math.floor(Date.now() / 1000) });
});

// ── Keyword rank tracking (this app's own RANKINGS_DB) ──────────────────────
app.get("/api/rankings", requireAuth, async (c) => {
  return c.json({ byVideo: await getRankings(c.env) });
});

app.post("/api/rankings/keywords", requireAuth, async (c) => {
  let body: { yt_video_id?: unknown; keyword?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad request" }, 400);
  }
  if (typeof body.yt_video_id !== "string" || typeof body.keyword !== "string") {
    return c.json({ error: "yt_video_id and keyword are required" }, 400);
  }
  const res = await addKeyword(c.env, body.yt_video_id, body.keyword);
  if ("error" in res) return c.json(res, 400);
  return c.json(res);
});

app.delete("/api/rankings/keywords/:id", requireAuth, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
  await deleteKeyword(c.env, id);
  return c.json({ ok: true });
});

app.post("/api/rankings/check", requireAuth, async (c) => {
  let body: { yt_video_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad request" }, 400);
  }
  if (typeof body.yt_video_id !== "string") {
    return c.json({ error: "yt_video_id is required" }, 400);
  }
  return c.json(await checkVideo(c.env, body.yt_video_id));
});

// Everything else → static assets / SPA fallback.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
