/**
 * index.ts
 * Hono entry-point for the yt-analytics Worker.
 *
 * Routes:
 *   POST /api/login   → check shared password, set signed cookie
 *   POST /api/logout  → clear cookie
 *   GET  /api/videos  → de-duplicated per-video / per-link click stats (auth-gated)
 *   GET  /api/income  → affiliate income by month and program (auth-gated)
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
import { addKeyword, checkVideo, deleteKeyword, getQuota, getRankings } from "./rankings";

import { DEFAULT_CHANNEL_ID, listChannels } from "./channels";
import incomeSummary from "./income-summary.json";

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

app.get("/api/channels", requireAuth, (c) => {
  const channels = listChannels().map((ch) => ({
    id: ch.id,
    name: ch.name,
    handle: ch.handle,
  }));
  return c.json({ channels, default_channel_id: DEFAULT_CHANNEL_ID });
});

app.get("/api/videos", requireAuth, async (c) => {
  const channelId = c.req.query("channel") || DEFAULT_CHANNEL_ID;
  const channelExists = listChannels().some((ch) => ch.id === channelId);
  if (!channelExists) return c.json({ error: "unknown_channel" }, 400);

  const result = await getVideoStats(c.env, channelId);
  return c.json({ ...result, generated_at: Math.floor(Date.now() / 1000) });
});

// ── Affiliate income ────────────────────────────────────────────────────────
// Static aggregates bundled at build time by scripts/sync-income.mjs, out of
// pipelines/income-analysis/summary.json. Deliberately not live: the bank half
// of this income can only come from a passbook the owner exports by hand, so
// the numbers refresh when `yt-income` is run, not on request.
app.get("/api/income", requireAuth, (c) => c.json(incomeSummary));

// ── Keyword rank tracking (this app's own RANKINGS_DB) ──────────────────────
app.get("/api/rankings", requireAuth, async (c) => {
  const channelId = c.req.query("channel") || DEFAULT_CHANNEL_ID;
  const channelExists = listChannels().some((ch) => ch.id === channelId);
  if (!channelExists) return c.json({ error: "unknown_channel" }, 400);

  const [byVideo, quota] = await Promise.all([getRankings(c.env, channelId), getQuota(c.env)]);
  return c.json({ byVideo, quota });
});

app.post("/api/rankings/keywords", requireAuth, async (c) => {
  const channelId = c.req.query("channel") || DEFAULT_CHANNEL_ID;
  const channelExists = listChannels().some((ch) => ch.id === channelId);
  if (!channelExists) return c.json({ error: "unknown_channel" }, 400);

  let body: { yt_video_id?: unknown; keyword?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad request" }, 400);
  }
  if (typeof body.yt_video_id !== "string" || typeof body.keyword !== "string") {
    return c.json({ error: "yt_video_id and keyword are required" }, 400);
  }
  const res = await addKeyword(c.env, channelId, body.yt_video_id, body.keyword);
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
