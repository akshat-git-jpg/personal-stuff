import { Hono } from "hono";

export interface Env {
  DB: D1Database;
  APP_PIN: string;
  SESSION_SECRET: string;
  ASSETS: { fetch: typeof fetch };
}

const app = new Hono<{ Bindings: Env }>();
app.get("/api/ping", (c) => c.json({ ok: true }));

export default app;
