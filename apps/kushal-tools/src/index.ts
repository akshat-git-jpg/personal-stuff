/**
 * index.ts
 * Hono entry-point for the KushalTools hub Worker.
 *
 * Routes:
 *   POST /api/login   → check shared passphrase, set signed cookie
 *   POST /api/logout  → clear cookie
 *   GET  *            → serve the hub if the cookie is valid, else the login page
 *
 * There is no static-assets binding on purpose: both pages are rendered here so
 * the PIN gate protects the hub itself (a static asset would be served before
 * the Worker could check auth).
 */

import { Hono } from "hono";
import type { Env } from "./auth";
import {
  checkPassword,
  clearAuthCookie,
  getAuthCookie,
  makeToken,
  setAuthCookie,
  verifyToken,
} from "./auth";
import { renderHub, renderLogin } from "./hub";

const app = new Hono<{ Bindings: Env }>();

app.post("/api/login", async (c) => {
  let body: { password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad request" }, 400);
  }
  if (!checkPassword(c.env, body.password)) {
    return c.json({ error: "invalid password" }, 401);
  }
  setAuthCookie(c, await makeToken(c.env));
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  clearAuthCookie(c);
  return c.json({ ok: true });
});

// Everything else: gated HTML.
app.get("*", async (c) => {
  const authed = await verifyToken(c.env, getAuthCookie(c));
  const html = authed ? renderHub() : renderLogin();
  return c.html(html);
});

export default app;
