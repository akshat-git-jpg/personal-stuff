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
import { setCookie } from "hono/cookie";
import type { Env, Variables } from "./auth";
import {
  getUser,
  loginRedirect,
  logout,
  oauthCallback,
  requireSession,
} from "./auth";
import { getAccessToken, readRows, updateCell } from "./sheets";
import { filterRows, projectRow, visibleColumns, canEdit, peopleFor } from "../shared/rbac";
import { loadTeam, lookupRole } from "./roles";
import { COLUMNS } from "../shared/columns";
import type { Column } from "../shared/columns";

// ---------------------------------------------------------------------------
// KV-backed read cache for board rows (~15 s TTL)
// ---------------------------------------------------------------------------

const BOARD_CACHE_KEY = "board:rows";
const BOARD_CACHE_TTL = 60; // seconds (KV minimum is 60; acceptable staleness for board reads)

async function cachedReadRows(env: Env): Promise<ReturnType<typeof readRows>> {
  const cached = await env.SESSIONS.get(BOARD_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as Awaited<ReturnType<typeof readRows>>;
    } catch {
      // Corrupt cache entry — fall through to fresh read
    }
  }
  const token = await getAccessToken(env.GOOGLE_SA_JSON);
  const rows = await readRows(token, env.SHEET_ID);
  await env.SESSIONS.put(BOARD_CACHE_KEY, JSON.stringify(rows), {
    expirationTtl: BOARD_CACHE_TTL,
  });
  return rows;
}

async function bustBoardCache(env: Env): Promise<void> {
  await env.SESSIONS.delete(BOARD_CACHE_KEY);
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Auth routes (no session required)
// ---------------------------------------------------------------------------

app.get("/auth/login", loginRedirect);
app.get("/auth/callback", oauthCallback);
app.post("/auth/logout", logout);

// ---------------------------------------------------------------------------
// Dev mode routes (unauthenticated; only active when DEV_AUTH=1)
// ---------------------------------------------------------------------------

// GET /api/auth-mode → { dev: boolean }
// Always public — lets the frontend know if dev-login buttons should be shown.
app.get("/api/auth-mode", (c) => {
  return c.json({ dev: c.env.DEV_AUTH === "1" });
});

// GET /dev-login?role=<role>&email=<email>
// Creates a real KV session and 302-redirects to /.
// Only available when DEV_AUTH=1; otherwise 404.
app.get("/dev-login", async (c) => {
  if (c.env.DEV_AUTH !== "1") {
    return c.text("Not found", 404);
  }

  const role  = c.req.query("role")  ?? "";
  const email = c.req.query("email") ?? "";

  if (!role || !email) {
    return c.text("Missing role or email query param", 400);
  }

  const SESSION_TTL = 604800; // 7 days (matches oauthCallback)
  const sessionId   = crypto.randomUUID();
  const sessionData = JSON.stringify({ email, role, createdAt: new Date().toISOString() });

  await c.env.SESSIONS.put(`session:${sessionId}`, sessionData, {
    expirationTtl: SESSION_TTL,
  });

  // Set HttpOnly session cookie (mirrors oauthCallback)
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: false, // localhost — not https
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  return c.redirect("/", 302);
});

// ---------------------------------------------------------------------------
// API routes (session required)
// ---------------------------------------------------------------------------

app.use("/api/*", requireSession);

app.get("/api/me", (c) => {
  return c.json(getUser(c));
});

// GET /api/team
// Admin-only: returns list of all team members with name, email, role.
app.get("/api/team", async (c) => {
  const { role } = getUser(c);
  if (role !== "Admin") {
    return c.json([], 200);
  }
  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const team = await loadTeam(token, c.env.SHEET_ID);
  return c.json(team);
});

// GET /api/board
// Returns the filtered, projected board for the current user's role.
// Restricted columns are stripped by projectRow — that is the security boundary.
// Admins may pass ?asUser=<email> to preview a specific team member's exact view.
app.get("/api/board", async (c) => {
  const { email, role } = getUser(c);
  const isAdmin = role === "Admin";

  const asUser = c.req.query("asUser");

  let effectiveRole = role;
  let effectiveEmail = email;
  let viewingAs: { email: string; role: string | null } | null = null;

  // Honor asUser ONLY when the session user is an Admin.
  if (isAdmin && asUser) {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    const targetRole = await lookupRole(saToken, c.env.SHEET_ID, asUser);
    if (!targetRole) {
      // User exists in no role mapping — return an empty informational response.
      return c.json({
        role: effectiveRole,
        viewingAs: { email: asUser, role: null },
        readOnly: true,
        columns: [],
        rows: [],
        notice: "This user has no role mapping in the Employes tab.",
      });
    }
    effectiveRole = targetRole;
    effectiveEmail = asUser.trim().toLowerCase();
    viewingAs = { email: asUser, role: effectiveRole };
  }

  const allRows = await cachedReadRows(c.env);

  const filteredRows = filterRows(effectiveRole, effectiveEmail, allRows);
  const projected = filteredRows.map((r) => projectRow(effectiveRole, r));

  return c.json({
    role: effectiveRole,
    viewingAs,
    readOnly: !!viewingAs,
    columns: visibleColumns(effectiveRole),
    rows: projected,
    // Legacy fields kept for any existing clients that read them:
    people: viewingAs ? peopleFor(effectiveRole, allRows) : [],
  });
});

// POST /api/update
// Body: { row_id: string, col: Column, value: string }
// Server-side enforces RBAC — do NOT trust the client.
app.post("/api/update", async (c) => {
  const { role } = getUser(c);

  let body: { row_id?: string; col?: string; value?: string };
  try {
    body = await c.req.json<{ row_id?: string; col?: string; value?: string }>();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const { row_id, col, value } = body;

  if (!row_id || !col || value === undefined) {
    return c.json({ error: "missing required fields: row_id, col, value" }, 400);
  }

  // Validate col is a known column
  if (!(COLUMNS as readonly string[]).includes(col)) {
    return c.json({ error: "unknown column", col }, 400);
  }

  const typedCol = col as Column;

  // RBAC: server-side edit-lock — do NOT trust the client
  if (!canEdit(role, typedCol)) {
    return c.json({ error: "forbidden", col }, 403);
  }

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  await updateCell(token, c.env.SHEET_ID, row_id, typedCol, value);

  // Cache bust so next board fetch sees the updated value
  await bustBoardCache(c.env);

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// SPA catch-all — serve dist via ASSETS binding
// ---------------------------------------------------------------------------

app.get("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
