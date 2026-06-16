/**
 * index.ts
 * Hono app entry-point for the Cloudflare Worker.
 *
 * Routes:
 *   GET  /auth/login      → OAuth redirect
 *   GET  /auth/callback   → OAuth code exchange + session creation
 *   POST /auth/logout     → session teardown
 *   GET  /api/me          → returns { email, roles } for the current session
 *   GET  /api/board       → filtered board data (+ names map)
 *   GET  /api/approvals   → items awaiting approval (+ names map)
 *   POST /api/update      → update a single cell (+ email notifications)
 *   POST /api/review      → approve/sendback a review stage (+ email notifications)
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
import { getAccessToken, readRows, updateCell, touchRow, appendRow, deleteRowById, upsertEmployee, deleteEmployee } from "./sheets";
import { createGeminiClient } from "./gemini";
import { loadAffiliateRecords } from "./affiliate";
import { processVideo } from "./linkgen";
import * as clickstore from "./clickstore";
import {
  visibleColumnsForRoles,
  canEditForRoles,
  canSetValueForRoles,
  isApproverRoles,
  filterRowsForRoles,
  projectRowForRoles,
  workerStagesForRoles,
  isFieldLocked,
  isApprover,
} from "../shared/rbac";
import { loadTeam, lookupRoles, VALID_ROLE_NAMES } from "./roles";
import { PROTECTED_ADMIN_EMAIL } from "../shared/policy";
import { COLUMNS } from "../shared/columns";
import type { Column } from "../shared/columns";
import { notify } from "./notify";

// ---------------------------------------------------------------------------
// KV-backed read cache for board rows (~60 s TTL)
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

// ---------------------------------------------------------------------------
// Helper: build email→name map from loadTeam results
// ---------------------------------------------------------------------------

function buildNamesMap(team: Awaited<ReturnType<typeof loadTeam>>): Record<string, string> {
  const names: Record<string, string> = {};
  for (const m of team) {
    names[m.email.toLowerCase()] = m.name;
  }
  return names;
}

// ---------------------------------------------------------------------------
// Helper: resolve a display name from the names map
// ---------------------------------------------------------------------------

function displayName(email: string, names: Record<string, string>): string {
  if (!email) return "";
  const key = email.trim().toLowerCase();
  return names[key] || (email.includes("@") ? email.split("@")[0] : email) || email;
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

// stageCol → { stageName, feedbackCol, assigneeEmailCol }
const STAGE_META: Record<string, { stageName: string; feedbackCol: string; assigneeEmailCol: string }> = {
  script_status:       { stageName: "Script",    feedbackCol: "script_feedback",   assigneeEmailCol: "script_writer_email" },
  tutorial_status:     { stageName: "Recording", feedbackCol: "tutorial_feedback", assigneeEmailCol: "tutorial_maker_email" },
  video_editor_status: { stageName: "Editing",   feedbackCol: "editor_feedback",   assigneeEmailCol: "video_editor_email" },
  yt_upload_status:    { stageName: "Upload",    feedbackCol: "",                  assigneeEmailCol: "" },
};

// assigneeEmailCol → role display name
const ASSIGNEE_ROLE_NAME: Record<string, string> = {
  script_writer_email:  "Script Writer",
  tutorial_maker_email: "Tutorial Maker",
  video_editor_email:   "Video Editor",
  reviewer_email:       "Reviewer",
};

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

// GET /dev-login?email=<email>[&roles=<csv>][&role=<single>]
// Creates a real KV session with roles resolved from Employes tab (real lookup).
// Falls back to ?roles= CSV or ?role= if the email has no roles in the sheet.
// Only available when DEV_AUTH=1; otherwise 404.
app.get("/dev-login", async (c) => {
  if (c.env.DEV_AUTH !== "1") {
    return c.text("Not found", 404);
  }

  const email = c.req.query("email") ?? "";

  if (!email) {
    return c.text("Missing email query param", 400);
  }

  const SESSION_TTL = 604800; // 7 days (matches oauthCallback)

  // Resolve real roles from Employes sheet
  let roles: string[] = [];
  try {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    roles = await lookupRoles(saToken, c.env.SHEET_ID, email);
  } catch (err) {
    console.warn("[dev-login] lookupRoles failed:", err);
  }

  // Fallback: ?roles=<csv> or legacy ?role=<single>
  if (roles.length === 0) {
    const rolesParam = c.req.query("roles") ?? "";
    const roleParam  = c.req.query("role")  ?? "";
    if (rolesParam) {
      roles = rolesParam.split(",").map(r => r.trim()).filter(Boolean);
    } else if (roleParam) {
      roles = [roleParam];
    }
  }

  if (roles.length === 0) {
    return c.text(`No roles found for ${email} — add to Employes or pass ?roles=<csv>`, 400);
  }

  const sessionId   = crypto.randomUUID();
  const sessionData = JSON.stringify({ email, roles, createdAt: new Date().toISOString() });

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
// Approver-only: returns list of all team members with name, email, roles.
app.get("/api/team", async (c) => {
  const { roles } = getUser(c);
  if (!isApproverRoles(roles)) {
    return c.json([], 200);
  }
  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const team = await loadTeam(token, c.env.SHEET_ID);
  return c.json(team);
});

// GET /api/roles — the valid role names (POLICY keys) for the Team panel selector.
app.get("/api/roles", (c) => c.json(VALID_ROLE_NAMES));

// POST /api/team {name, email, roles[]} — Admin-only; upsert a teammate in the Employes tab.
app.post("/api/team", async (c) => {
  const { roles } = getUser(c);
  if (!roles.includes("Admin")) return c.json({ error: "forbidden" }, 403);

  let body: { name?: string; email?: string; roles?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const memberRoles = Array.isArray(body.roles)
    ? body.roles.map((r) => r.trim()).filter((r) => VALID_ROLE_NAMES.includes(r))
    : [];
  if (!name) return c.json({ error: "name is required" }, 400);
  if (!email || !email.includes("@")) return c.json({ error: "a valid email is required" }, 400);
  if (email.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    return c.json({ error: "the founding admin is fixed and can't be edited" }, 403);
  }
  if (memberRoles.length === 0) return c.json({ error: "at least one valid role is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const result = await upsertEmployee(token, c.env.SHEET_ID, name, email, memberRoles.join(", "));
  await bustBoardCache(c.env);
  return c.json({ ok: true, result });
});

// POST /api/team/delete {email} — Admin-only; remove a teammate from the Employes tab.
app.post("/api/team/delete", async (c) => {
  const { roles } = getUser(c);
  if (!roles.includes("Admin")) return c.json({ error: "forbidden" }, 403);

  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const email = (body.email ?? "").trim();
  if (!email) return c.json({ error: "email is required" }, 400);
  if (email.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    return c.json({ error: "the founding admin is fixed and can't be removed" }, 403);
  }

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const removed = await deleteEmployee(token, c.env.SHEET_ID, email);
  await bustBoardCache(c.env);
  return c.json({ ok: removed });
});

// GET /api/board
// Returns the filtered, projected board for the current user's roles.
// Restricted columns are stripped by projectRowForRoles — that is the security boundary.
// Admins may pass ?asUser=<email> to preview a specific team member's exact view.
app.get("/api/board", async (c) => {
  const { email, roles } = getUser(c);
  const isAdmin = roles.includes("Admin");

  const asUser = c.req.query("asUser");

  let effRoles = roles;
  let effEmail = email;
  let viewingAs: { email: string; role: string | null; roles: string[] } | null = null;
  let readOnly = false;
  // Admins keep full edit authority everywhere — including while previewing a
  // team member's board. The board VIEW (columns/rows) follows the previewed
  // member; edit permission is governed separately on the client via canEditAll.
  const canEditAll = isAdmin;

  // Honor asUser ONLY when the session user is an Admin.
  if (isAdmin && asUser) {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    const asRoles = await lookupRoles(saToken, c.env.SHEET_ID, asUser);
    if (asRoles.length === 0) {
      // User exists in no role mapping — return an informational response.
      return c.json({
        role: roles.includes("Admin") ? "Admin" : (roles[0] ?? ""),
        roles,
        viewingAs: { email: asUser, role: null, roles: [] },
        readOnly: true,
        canEditAll: false,
        columns: [],
        rows: [],
        names: {},
        stages: [],
        notice: "This user has no role mapping in the Employes tab.",
      });
    }
    effRoles = asRoles;
    effEmail = asUser.trim().toLowerCase();
    viewingAs = { email: asUser, role: asRoles[0] ?? null, roles: asRoles };
    // Not read-only for an admin — admins can edit while previewing.
    readOnly = false;
  }

  const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const [allRows, team] = await Promise.all([
    cachedReadRows(c.env),
    loadTeam(saToken, c.env.SHEET_ID),
  ]);

  const filteredRows = filterRowsForRoles(effRoles, effEmail, allRows);
  const projected = filteredRows.map((r) => projectRowForRoles(effRoles, r));
  const names = buildNamesMap(team);

  return c.json({
    // `role` kept for client compat — first effective role or "Admin" if present
    role: effRoles.includes("Admin") ? "Admin" : (effRoles[0] ?? ""),
    roles: effRoles,
    viewingAs,
    readOnly,
    canEditAll,
    columns: visibleColumnsForRoles(effRoles),
    rows: projected,
    names,
    stages: workerStagesForRoles(effRoles),
  });
});

// GET /api/approvals
// Returns items currently awaiting approval (script, tutorial, or editing stages at "In Review").
// Available to Approver roles (Admin, Reviewer) only.
app.get("/api/approvals", async (c) => {
  const { email, roles } = getUser(c);
  if (!isApproverRoles(roles)) {
    return c.json({ count: 0, items: [], names: {} }, 200);
  }
  // Scope: Admin sees every in-review item; a (non-admin) Reviewer sees only items for
  // videos assigned to them (reviewer_email) plus videos with no reviewer assigned.
  const isAdmin = roles.includes("Admin");
  const myEmail = email.trim().toLowerCase();

  const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const [allRows, team] = await Promise.all([
    cachedReadRows(c.env),
    loadTeam(saToken, c.env.SHEET_ID),
  ]);

  const names = buildNamesMap(team);

  const STAGE_COLS = ["script_status", "tutorial_status", "video_editor_status"] as const;
  const ASSIGNEE_COL: Record<string, string> = {
    script_status:       "script_writer_email",
    tutorial_status:     "tutorial_maker_email",
    video_editor_status: "video_editor_email",
  };
  const STAGE_LABEL: Record<string, string> = {
    script_status:       "Script",
    tutorial_status:     "Recording",
    video_editor_status: "Editing",
  };

  const items: {
    row_id: string;
    video_title: string;
    stageCol: string;
    stage: string;
    assigneeEmail: string;
    row: ReturnType<typeof projectRowForRoles>;
  }[] = [];

  for (const row of allRows) {
    // Reviewers only see their assigned videos (+ unassigned); admins see all.
    if (!isAdmin) {
      const rowReviewer = ((row.reviewer_email ?? "") as string).trim().toLowerCase();
      if (rowReviewer && rowReviewer !== myEmail) continue;
    }
    for (const stageCol of STAGE_COLS) {
      if ((row[stageCol] ?? "") === "In Review") {
        items.push({
          row_id:        (row.row_id ?? "") as string,
          video_title:   (row.video_title ?? "") as string,
          stageCol,
          stage:         STAGE_LABEL[stageCol],
          assigneeEmail: (row[ASSIGNEE_COL[stageCol] as keyof typeof row] ?? "") as string,
          row:           projectRowForRoles(roles, row),
        });
      }
    }
  }

  return c.json({ count: items.length, items, names });
});

// POST /api/update
// Body: { row_id: string, col: Column, value: string }
// Server-side enforces RBAC — do NOT trust the client.
app.post("/api/update", async (c) => {
  const { roles, email } = getUser(c);

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

  // RBAC check 1: column-level edit permission (any role can edit)
  if (!canEditForRoles(roles, typedCol)) {
    return c.json({ error: "forbidden", col }, 403);
  }

  // RBAC check 2: row-level field lock
  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (targetRow && isFieldLocked(roles, typedCol, targetRow)) {
    return c.json(
      { error: "locked", message: "This item is approved and locked. Ask an admin/reviewer to reopen it." },
      403,
    );
  }

  // RBAC check 3: approver-only values (e.g. only approvers can set status to "Done")
  if (!canSetValueForRoles(roles, typedCol, value)) {
    return c.json(
      { error: "approver_only", message: "Only an admin or reviewer can mark this Done." },
      403,
    );
  }

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  await updateCell(token, c.env.SHEET_ID, row_id, typedCol, value);

  // Best-effort timestamp — never fail the request because of it
  try { await touchRow(token, c.env.SHEET_ID, row_id); } catch { /* no-op */ }

  // Cache bust so next board fetch sees the updated value
  await bustBoardCache(c.env);

  // ── Post-write notifications (best-effort; targetRow came from before the write) ──
  if (targetRow) {
    const videoTitle = (targetRow.video_title ?? "") as string;
    const appUrl = c.env.APP_URL ?? "";

    // Load team for name lookups and approver emails
    const team = await loadTeam(token, c.env.SHEET_ID);
    const names = buildNamesMap(team);
    const submitterName = displayName(email, names);

    // 1. SUBMITTED: status col → "In Review" by a non-approver
    const stageMeta = STAGE_META[typedCol];
    if (
      stageMeta &&
      value === "In Review" &&
      !isApproverRoles(roles)
    ) {
      const { stageName } = stageMeta;
      // Recipients: reviewer_email + admin_email from the row; fallback to all approvers
      const rowReviewerEmail = ((targetRow.reviewer_email ?? "") as string).trim();
      const rowAdminEmail = ((targetRow.admin_email ?? "") as string).trim();
      const explicit = [...new Set([rowReviewerEmail, rowAdminEmail].filter(Boolean))];
      const recipients: string[] = explicit.length > 0
        ? explicit
        : team.filter(m => m.roles ? m.roles.some(r => isApprover(r)) : isApprover(m.role)).map(m => m.email);

      for (const recipient of recipients) {
        void notify(c.env, {
          to: recipient,
          subject: `🔔 New ${stageName} submitted: ${videoTitle}`,
          text: `${submitterName} submitted the ${stageName} for "${videoTitle}" for your review.\n\nOpen the tracker: ${appUrl}`,
        });
      }
    }

    // 2. ASSIGNED: email assignment cols, admin only, new non-empty value different from old
    const assigneeRoleName = ASSIGNEE_ROLE_NAME[typedCol];
    if (
      assigneeRoleName &&
      roles.includes("Admin") &&
      value.trim() !== "" &&
      value.trim().toLowerCase() !== ((targetRow[typedCol] ?? "") as string).trim().toLowerCase()
    ) {
      void notify(c.env, {
        to: value.trim(),
        subject: `📋 You've been assigned: ${videoTitle}`,
        text: `You've been assigned to "${videoTitle}" as ${assigneeRoleName}.\n\nOpen the tracker: ${appUrl}`,
      });
    }
  }

  return c.json({ ok: true });
});

// POST /api/review
// Body: { row_id: string, stage: "script"|"tutorial"|"editor"|"upload", action: "approve"|"sendback", feedback?: string }
// Approvers only. Performs the status update + optional feedback write + email notification.
app.post("/api/review", async (c) => {
  const { roles } = getUser(c);
  if (!isApproverRoles(roles)) {
    return c.json({ error: "forbidden" }, 403);
  }

  let body: { row_id?: string; stage?: string; action?: string; feedback?: string };
  try {
    body = await c.req.json<{ row_id?: string; stage?: string; action?: string; feedback?: string }>();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const { row_id, stage, action, feedback } = body;

  if (!row_id || !stage || !action) {
    return c.json({ error: "missing required fields: row_id, stage, action" }, 400);
  }

  // stage → statusCol / feedbackCol / assigneeEmailCol / stageName
  type StageMap = { statusCol: Column; feedbackCol: Column | ""; assigneeEmailCol: Column | ""; stageName: string };
  const STAGE_MAP: Record<string, StageMap> = {
    script:   { statusCol: "script_status",       feedbackCol: "script_feedback",   assigneeEmailCol: "script_writer_email",  stageName: "script" },
    tutorial: { statusCol: "tutorial_status",      feedbackCol: "tutorial_feedback", assigneeEmailCol: "tutorial_maker_email", stageName: "recording" },
    editor:   { statusCol: "video_editor_status",  feedbackCol: "editor_feedback",   assigneeEmailCol: "video_editor_email",   stageName: "video" },
    upload:   { statusCol: "yt_upload_status",     feedbackCol: "",                  assigneeEmailCol: "reviewer_email",       stageName: "upload" },
  };

  const stageMap = STAGE_MAP[stage];
  if (!stageMap) {
    return c.json({ error: "invalid stage; must be script|tutorial|editor|upload" }, 400);
  }
  if (action !== "approve" && action !== "sendback") {
    return c.json({ error: "invalid action; must be approve|sendback" }, 400);
  }

  const { statusCol, feedbackCol, assigneeEmailCol, stageName } = stageMap;

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);

  // Look up the row for title + assignee
  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (!targetRow) {
    return c.json({ error: "row not found", row_id }, 404);
  }

  const videoTitle = (targetRow.video_title ?? "") as string;
  const assigneeEmail = assigneeEmailCol ? ((targetRow[assigneeEmailCol] ?? "") as string).trim() : "";

  const appUrl = c.env.APP_URL ?? "";
  const team = await loadTeam(token, c.env.SHEET_ID);
  const names = buildNamesMap(team);
  const assigneeName = assigneeEmail ? displayName(assigneeEmail, names) : "";

  if (action === "approve") {
    const newStatus = stage === "upload" ? "Published" : "Done";
    await updateCell(token, c.env.SHEET_ID, row_id, statusCol, newStatus);

    // Best-effort timestamp
    try { await touchRow(token, c.env.SHEET_ID, row_id); } catch { /* no-op */ }

    await bustBoardCache(c.env);

    if (assigneeEmail) {
      void notify(c.env, {
        to: assigneeEmail,
        subject: `✅ Approved: ${videoTitle}`,
        text: `Hi ${assigneeName},\n\nGood news — your ${stageName} for "${videoTitle}" was approved.\n\n${appUrl}`,
      });
    }
  } else {
    // sendback
    const newStatus = stage === "upload" ? "Draft" : "In Progress";
    await updateCell(token, c.env.SHEET_ID, row_id, statusCol, newStatus);
    if (feedbackCol && feedback?.trim()) {
      await updateCell(token, c.env.SHEET_ID, row_id, feedbackCol as Column, feedback.trim());
    }

    // Best-effort timestamp
    try { await touchRow(token, c.env.SHEET_ID, row_id); } catch { /* no-op */ }

    await bustBoardCache(c.env);

    if (assigneeEmail) {
      const feedbackText = feedback?.trim() ?? "";
      void notify(c.env, {
        to: assigneeEmail,
        subject: `✏️ Changes requested: ${videoTitle}`,
        text: `Hi ${assigneeName},\n\nYour ${stageName} for "${videoTitle}" needs changes:\n\n"${feedbackText}"\n\nOpen the tracker to revise: ${appUrl}`,
      });
    }
  }

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Affiliate-link generation (App A) — Admin-only
// ---------------------------------------------------------------------------

// POST /api/video  — create a new Master row.
// Body: { video_title, video_notes?, category?, subcategory?, topic_status? }
app.post("/api/video", async (c) => {
  const { roles } = getUser(c);
  if (!roles.includes("Admin")) return c.json({ error: "forbidden" }, 403);

  let body: {
    video_title?: string;
    video_notes?: string;
    category?: string;
    subcategory?: string;
    topic_status?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const title = (body.video_title ?? "").trim();
  const notes = (body.video_notes ?? "").trim();
  const category = (body.category ?? "").trim();
  const subcategory = (body.subcategory ?? "").trim();
  if (!title) return c.json({ error: "video_title is required" }, 400);
  if (!category) return c.json({ error: "category is required" }, 400);
  if (!subcategory) return c.json({ error: "subcategory is required" }, 400);
  if (!notes) return c.json({ error: "a brief (video_notes) is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const today = new Date().toISOString().slice(0, 10);
  const rowId = await appendRow(token, c.env.SHEET_ID, {
    video_title: title,
    video_notes: notes,
    category: category,
    subcategory: subcategory,
    topic_status: (body.topic_status ?? "To Do").trim(),
    topic_date: today,
  });

  await bustBoardCache(c.env);
  return c.json({ row_id: rowId });
});

// POST /api/delete — permanently delete a video row. Admin only.
// Body: { row_id }
app.post("/api/delete", async (c) => {
  const { roles } = getUser(c);
  if (!roles.includes("Admin")) return c.json({ error: "forbidden" }, 403);

  let body: { row_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const rowId = (body.row_id ?? "").trim();
  if (!rowId) return c.json({ error: "row_id is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  try {
    await deleteRowById(token, c.env.SHEET_ID, rowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "row not found", row_id: rowId }, 404);
    return c.json({ error: msg }, 500);
  }

  await bustBoardCache(c.env);
  return c.json({ ok: true, row_id: rowId });
});

// POST /api/generate-links — generate short links + description for a row.
// Body: { row_id }
app.post("/api/generate-links", async (c) => {
  const { roles } = getUser(c);
  if (!roles.includes("Admin")) return c.json({ error: "forbidden" }, 403);

  let body: { row_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const rowId = (body.row_id ?? "").trim();
  if (!rowId) return c.json({ error: "row_id is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const allRows = await cachedReadRows(c.env);
  const target = allRows.find((r) => ((r.row_id as string) || "").trim() === rowId);
  if (!target) return c.json({ error: "row not found", row_id: rowId }, 404);
  const title = ((target.video_title as string) ?? "").trim();
  if (!title) return c.json({ error: "row has no video_title" }, 400);
  const notes = ((target.video_notes as string) ?? "").trim();

  try {
    const affiliates = await loadAffiliateRecords(token, c.env.AFFILIATE_PROGRAMS_SHEET_URL);
    const gemini = createGeminiClient(c.env.GEMINI_API_KEY);
    const db = c.env.DB;

    const result = await processVideo(title, notes, {
      gemini,
      affiliates,
      linkDomain: c.env.LINK_DOMAIN,
      existingCodes: () => clickstore.existingCodes(db),
      videoCodeForTitle: (t) => clickstore.videoCodeForTitle(db, t),
      existingSlugs: (code) => clickstore.existingSlugs(db, code),
      insertVideo: (code, t) => clickstore.insertVideo(db, code, t),
      insertLink: (slug, code, tool, url) => clickstore.insertLink(db, slug, code, tool, url),
      kvPut: (k, v) => c.env.CLICKS_KV.put(k, v),
    });

    // Write the three publish-asset cells back onto the row.
    await updateCell(token, c.env.SHEET_ID, rowId, "video_description", result.description);
    await updateCell(token, c.env.SHEET_ID, rowId, "actual_links", result.actual_links_text);
    await updateCell(token, c.env.SHEET_ID, rowId, "short_links", result.short_links_text);
    try {
      await touchRow(token, c.env.SHEET_ID, rowId);
    } catch {
      /* no-op */
    }
    await bustBoardCache(c.env);

    return c.json({
      description: result.description,
      links: result.links,
      non_affiliate_tools: result.non_affiliate_tools,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // "No tools" is a content issue (the notes don't name any tools), not a
    // server fault — return 422 so it isn't treated/alerted as a 500.
    const isContentIssue = /no tools/i.test(msg);
    return c.json(
      { error: isContentIssue ? "no_tools" : "generation_failed", message: msg },
      isContentIssue ? 422 : 500,
    );
  }
});

// ---------------------------------------------------------------------------
// SPA catch-all — serve dist via ASSETS binding
// ---------------------------------------------------------------------------

app.get("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
