/**
 * index.ts
 * Hono entry-point for the kushal-income Worker ("Kushal Money").
 *
 * Routes:
 *   POST /api/login    → check shared password, set signed cookie
 *   POST /api/logout   → clear cookie
 *   GET  /api/ledger   → every payment, statement and source status (auth-gated)
 *   POST /api/tag      → the owner puts rows on a tag, optionally as a rule for their payee (auth-gated)
 *   POST /api/tags     → make a tag; POST /api/tags/:id renames or moves it; DELETE removes an empty one
 *   POST /api/ingest   → the on-demand sync publishes a new ledger (INGEST_TOKEN)
 *   GET  *             → serve the SPA via the ASSETS binding
 *
 * The sync (pipelines/personal-finance/ledger) masks phone numbers, UPI IDs and
 * account numbers before it sends anything, so D1 never holds them.
 */

import { Hono } from "hono";
import type { Env } from "./auth";
import {
  checkIngest,
  checkPassword,
  clearAuthCookie,
  makeToken,
  requireAuth,
  setAuthCookie,
} from "./auth";
import { ingest, read, tag, type TagBody } from "./ledger";
import { createTag, deleteTag, updateTag } from "./tags";

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

app.get("/api/ledger", requireAuth, async (c) => c.json(await read(c.env)));

app.post("/api/tag", requireAuth, async (c) => {
  let body: TagBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad request" }, 400);
  }
  try {
    return c.json({ ok: true, tagged: await tag(c.env, body) });
  } catch (e) {
    return c.json({ error: String((e as Error).message) }, 400);
  }
});

/** Run a tag-tree change; a bad request comes back as a 400 with a plain reason. */
async function tagOp(c: { req: { json: () => Promise<unknown> } }, op: (b: Record<string, unknown>) => Promise<unknown>) {
  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    /* DELETE has no body */
  }
  try {
    return { status: 200 as const, body: { ok: true, tag: await op(body) } };
  } catch (e) {
    return { status: 400 as const, body: { error: String((e as Error).message) } };
  }
}

app.post("/api/tags", requireAuth, async (c) => {
  const r = await tagOp(c, (b) => createTag(c.env, b));
  return c.json(r.body, r.status);
});
app.post("/api/tags/:id", requireAuth, async (c) => {
  const r = await tagOp(c, (b) => updateTag(c.env, c.req.param("id") ?? "", b));
  return c.json(r.body, r.status);
});
app.delete("/api/tags/:id", requireAuth, async (c) => {
  const r = await tagOp(c, () => deleteTag(c.env, c.req.param("id") ?? ""));
  return c.json(r.body, r.status);
});

app.post("/api/ingest", async (c) => {
  if (!checkIngest(c.env, c.req.header("Authorization"))) return c.json({ error: "unauthorized" }, 401);
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad request" }, 400);
  }
  try {
    return c.json({ ok: true, ...(await ingest(c.env, body)) });
  } catch (e) {
    return c.json({ error: String((e as Error).message) }, 400);
  }
});

// Everything else → static assets / SPA fallback.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
