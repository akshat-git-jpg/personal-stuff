import { Hono } from "hono";
import type { Env } from "./auth";
import {
  clearSession,
  getSessionEmail,
  handleCallback,
  startLogin,
} from "./auth";
import { INDEX_KEY, blobKey, thumbKey } from "../shared";

const app = new Hono<{ Bindings: Env }>();

// ---- Auth (public) ---------------------------------------------------------

app.get("/api/auth/login", (c) => startLogin(c));
app.get("/api/auth/callback", (c) => handleCallback(c));

app.post("/api/auth/logout", (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

app.get("/api/me", async (c) => {
  const email = await getSessionEmail(c);
  if (!email) return c.json({ error: "unauthenticated" }, 401);
  return c.json({ email });
});

// ---- Gate: everything below requires a valid session -----------------------

app.use("/api/*", async (c, next) => {
  const email = await getSessionEmail(c);
  if (!email) return c.json({ error: "unauthenticated" }, 401);
  await next();
});

// ---- Index (metadata) ------------------------------------------------------

app.get("/api/index", async (c) => {
  const obj = await c.env.DOCS.get(INDEX_KEY);
  if (!obj) return c.json({ items: [] });
  return new Response(obj.body, {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});

app.put("/api/index", async (c) => {
  const text = await c.req.text();
  try {
    JSON.parse(text); // reject malformed index before persisting
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  await c.env.DOCS.put(INDEX_KEY, text, {
    httpMetadata: { contentType: "application/json" },
  });
  return c.json({ ok: true });
});

// ---- Blobs (the actual files) ----------------------------------------------

app.put("/api/blob/:id", async (c) => {
  const id = c.req.param("id");
  if (!c.req.raw.body) return c.json({ error: "empty body" }, 400);
  await c.env.DOCS.put(blobKey(id), c.req.raw.body, {
    httpMetadata: { contentType: c.req.header("Content-Type") || "application/octet-stream" },
  });
  return c.json({ ok: true });
});

app.get("/api/blob/:id", async (c) => {
  const id = c.req.param("id");
  const obj = await c.env.DOCS.get(blobKey(id));
  if (!obj) return c.json({ error: "not found" }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("ETag", obj.httpEtag);
  if (c.req.query("download")) {
    const name = c.req.query("name") || id;
    headers.set("Content-Disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
  }
  return new Response(obj.body, { headers });
});

app.delete("/api/blob/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DOCS.delete([blobKey(id), thumbKey(id)]);
  return c.json({ ok: true });
});

// ---- Thumbnails (small image previews for the grid) ------------------------

app.put("/api/thumb/:id", async (c) => {
  const id = c.req.param("id");
  if (!c.req.raw.body) return c.json({ error: "empty body" }, 400);
  await c.env.DOCS.put(thumbKey(id), c.req.raw.body, {
    httpMetadata: { contentType: c.req.header("Content-Type") || "image/jpeg" },
  });
  return c.json({ ok: true });
});

app.get("/api/thumb/:id", async (c) => {
  const id = c.req.param("id");
  const obj = await c.env.DOCS.get(thumbKey(id));
  if (!obj) return c.json({ error: "not found" }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=86400");
  headers.set("ETag", obj.httpEtag);
  return new Response(obj.body, { headers });
});

// ---- Static assets (SPA) ---------------------------------------------------

app.all("*", (c) => {
  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    return c.json({ error: "not found" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: String(err?.message ?? err) }, 500);
});

export default app;
