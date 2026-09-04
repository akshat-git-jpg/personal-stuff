/**
 * index.ts
 * Hono entry-point for the yt-income Worker.
 *
 * Routes:
 *   POST /api/login   → check shared password, set signed cookie
 *   POST /api/logout  → clear cookie
 *   GET  /api/revenue → attributed revenue by month (auth-gated)
 *   GET  *            → serve the SPA via the ASSETS binding
 *
 * The revenue figures are a build-time snapshot, copied out of
 * pipelines/income-analysis/summary.json by scripts/sync-summary.mjs. The page
 * never calls PayPal, impact.com or PartnerStack — this Worker holds no such
 * credentials, which is the point.
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
import summary from "./summary.json";

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

app.get("/api/revenue", requireAuth, (c) => c.json(summary));

// Everything else → static assets / SPA fallback.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
