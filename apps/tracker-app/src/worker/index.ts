/**
 * index.ts
 * Hono app entry-point for the Cloudflare Worker.
 *
 * The worker is the single source of truth for what each user may see and do.
 * The client renders exactly what these endpoints return; it never re-derives
 * permissions, gates, or transitions on its own.
 *
 * Routes:
 *   GET  /auth/login      → OAuth redirect
 *   GET  /auth/callback   → OAuth code exchange + session creation
 *   POST /auth/logout     → session teardown
 *   GET  /api/me          → { email, roles }
 *   GET  /api/board       → board for the current user (+ per-row actions/locks/membership)
 *   GET  /api/review-queue→ cards awaiting THIS user's review (assigned reviewer / admin)
 *   POST /api/update      → doer cell write (status transition or content edit)
 *   POST /api/review      → reviewer approve / request-changes (atomic status+feedback)
 *   GET  *                → serve SPA via ASSETS binding
 */

import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { Env, Variables } from "./auth";
import { getUser, loginRedirect, logout, oauthCallback, requireSession } from "./auth";
import {
  getAccessToken, readRows, updateCells, appendRow, deleteRowById,
  upsertEmployee, deleteEmployee, ConflictError,
} from "./sheets";
import { createGeminiClient } from "./gemini";
import { loadAffiliateRecords } from "./affiliate";
import { processVideo } from "./linkgen";
import * as clickstore from "./clickstore";
import {
  visibleColumnsForRoles, canEditForRoles, filterRowsForRoles, projectRowForRoles,
  workerStagesForRoles, isApproverRoles, isAdminRoles, isApprover,
  authorizeWrite, transitionsForCard, transitionsForStage, cardStagesForUser,
  reviewQueueForUser, fieldLockReason, canReview,
  type Row,
} from "../shared/rbac";
import {
  STAGES, stageById, stageByStatusCol, statusOf, PROTECTED_ADMIN_EMAIL,
} from "../shared/pipeline";
import { loadTeam, lookupRoles, VALID_ROLE_NAMES } from "./roles";
import { COLUMNS } from "../shared/columns";
import type { Column } from "../shared/columns";
import { sendNotification } from "./notifications";

// ---------------------------------------------------------------------------
// KV-backed read cache for board rows (~60 s TTL)
// ---------------------------------------------------------------------------

const BOARD_CACHE_KEY = "board:rows";
const BOARD_CACHE_TTL = 60;

async function cachedReadRows(env: Env): Promise<Row[]> {
  const cached = await env.SESSIONS.get(BOARD_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached) as Row[]; } catch { /* fall through */ }
  }
  const token = await getAccessToken(env.GOOGLE_SA_JSON);
  const rows = await readRows(token, env.SHEET_ID);
  await env.SESSIONS.put(BOARD_CACHE_KEY, JSON.stringify(rows), { expirationTtl: BOARD_CACHE_TTL });
  return rows;
}

async function bustBoardCache(env: Env): Promise<void> {
  await env.SESSIONS.delete(BOARD_CACHE_KEY);
}

// ---------------------------------------------------------------------------
// Name helpers
// ---------------------------------------------------------------------------

function buildNamesMap(team: Awaited<ReturnType<typeof loadTeam>>): Record<string, string> {
  const names: Record<string, string> = {};
  for (const m of team) names[m.email.toLowerCase()] = m.name;
  return names;
}

// email -> comma-joined roles, so dropdowns can show "Name — Role(s)" without
// anyone hand-stuffing the role into the name field.
function buildRolesMap(team: Awaited<ReturnType<typeof loadTeam>>): Record<string, string> {
  const roles: Record<string, string> = {};
  for (const m of team) roles[m.email.toLowerCase()] = (m.roles ?? [m.role]).filter(Boolean).join(", ");
  return roles;
}

function displayName(email: string, names: Record<string, string>): string {
  if (!email) return "";
  const key = email.trim().toLowerCase();
  return names[key] || (email.includes("@") ? email.split("@")[0] : email) || email;
}

// assignee column → role label, derived from the pipeline (+ reviewer).
const ASSIGNEE_COL_ROLE: Record<string, string> = (() => {
  const m: Record<string, string> = { reviewer_email: "Reviewer" };
  for (const s of STAGES) m[s.assigneeCol] = s.ownerRole;
  return m;
})();

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---------------------------------------------------------------------------
// Auth routes (no session required)
// ---------------------------------------------------------------------------

app.get("/auth/login", loginRedirect);
app.get("/auth/callback", oauthCallback);
app.post("/auth/logout", logout);

app.get("/api/auth-mode", (c) => c.json({ dev: c.env.DEV_AUTH === "1" }));

// GET /dev-login?email=…[&roles=csv][&role=single] — dev only.
app.get("/dev-login", async (c) => {
  if (c.env.DEV_AUTH !== "1") return c.text("Not found", 404);
  const email = c.req.query("email") ?? "";
  if (!email) return c.text("Missing email query param", 400);

  const SESSION_TTL = 604800;
  let roles: string[] = [];
  try {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    roles = await lookupRoles(saToken, c.env.SHEET_ID, email);
  } catch (err) {
    console.warn("[dev-login] lookupRoles failed:", err);
  }
  if (roles.length === 0) {
    const rolesParam = c.req.query("roles") ?? "";
    const roleParam = c.req.query("role") ?? "";
    if (rolesParam) roles = rolesParam.split(",").map((r) => r.trim()).filter(Boolean);
    else if (roleParam) roles = [roleParam];
  }
  if (roles.length === 0) {
    return c.text(`No roles found for ${email} — add to Employes or pass ?roles=<csv>`, 400);
  }

  const sessionId = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `session:${sessionId}`,
    JSON.stringify({ email, roles, createdAt: new Date().toISOString() }),
    { expirationTtl: SESSION_TTL },
  );
  setCookie(c, "session", sessionId, {
    httpOnly: true, secure: false, sameSite: "Lax", path: "/", maxAge: SESSION_TTL,
  });
  return c.redirect("/", 302);
});

// ---------------------------------------------------------------------------
// API routes (session required)
// ---------------------------------------------------------------------------

app.use("/api/*", requireSession);

app.get("/api/me", (c) => c.json(getUser(c)));

app.get("/api/team", async (c) => {
  const { roles } = getUser(c);
  if (!isApproverRoles(roles)) return c.json([], 200);
  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  return c.json(await loadTeam(token, c.env.SHEET_ID));
});

app.get("/api/roles", (c) => c.json(VALID_ROLE_NAMES));

// POST /api/team {name, email, roles[]} — Admin-only; upsert a teammate. This is
// the SINGLE place roles are assigned to people.
app.post("/api/team", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);

  let body: { name?: string; email?: string; roles?: string[] };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const memberRoles = Array.isArray(body.roles)
    ? body.roles.map((r) => r.trim()).filter((r) => VALID_ROLE_NAMES.includes(r))
    : [];
  if (!name) return c.json({ error: "name is required" }, 400);
  if (!email || !email.includes("@")) return c.json({ error: "a valid email is required" }, 400);
  if (memberRoles.length === 0) return c.json({ error: "at least one valid role is required" }, 400);

  const isFounder = email.toLowerCase() === PROTECTED_ADMIN_EMAIL;
  // Admin is reserved for the founding admin. Nobody else can be granted it; the
  // founder can never lose it (that would lock everyone out of team management).
  const finalRoles = isFounder
    ? (memberRoles.includes("Admin") ? memberRoles : ["Admin", ...memberRoles])
    : memberRoles.filter((r) => r !== "Admin");
  if (finalRoles.length === 0) return c.json({ error: "at least one valid role is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const result = await upsertEmployee(token, c.env.SHEET_ID, name, email, finalRoles.join(", "));
  await bustBoardCache(c.env);
  return c.json({ ok: true, result });
});

app.post("/api/team/delete", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { email?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
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

// ---------------------------------------------------------------------------
// Per-row authority meta — computed once on the server, authoritatively.
// ---------------------------------------------------------------------------

const STATUS_COLS = new Set<string>(STAGES.map((s) => s.statusCol));

function rowMeta(roles: string[], email: string, row: Row) {
  const stages = cardStagesForUser(roles, email, row);          // statusCols this card belongs to (in user's lanes)
  const actions = transitionsForCard(roles, email, row);        // allowed status transitions, per stage
  const locks: Record<string, string> = {};                     // editable content/feedback fields that are currently locked
  for (const col of visibleColumnsForRoles(roles)) {
    if (STATUS_COLS.has(col)) continue;                         // status is driven by action buttons, not free inputs
    if (!canEditForRoles(roles, col)) continue;
    const reason = fieldLockReason(roles, email, col, row);
    if (reason) locks[col] = reason;
  }
  return { _stages: stages, _actions: actions, _locks: locks };
}

// GET /api/board[?asUser=email]
// View-as is a PURE read-only role swap: an admin sees byte-for-byte what the
// target sees (same columns, rows, stage membership, and action buttons), but
// readOnly=true makes it inert. There is no edit elevation — exactly one
// rendering path, so the admin's preview can never diverge from the real user.
app.get("/api/board", async (c) => {
  const { email, roles } = getUser(c);
  const isAdmin = isAdminRoles(roles);
  const asUser = c.req.query("asUser");

  let effRoles = roles;
  let effEmail = email;
  let viewingAs: { email: string; roles: string[] } | null = null;
  let readOnly = false;

  if (isAdmin && asUser) {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    const asRoles = await lookupRoles(saToken, c.env.SHEET_ID, asUser);
    if (asRoles.length === 0) {
      return c.json({
        roles, viewingAs: { email: asUser, roles: [] }, readOnly: true,
        columns: [], rows: [], names: {}, stages: [],
        notice: "This user has no role mapping in the Employes tab.",
      });
    }
    effRoles = asRoles;
    effEmail = asUser.trim().toLowerCase();
    viewingAs = { email: asUser, roles: asRoles };
    readOnly = true; // mirror only — never editable
  }

  const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const [allRows, team] = await Promise.all([
    cachedReadRows(c.env),
    loadTeam(saToken, c.env.SHEET_ID),
  ]);

  const filteredRows = filterRowsForRoles(effRoles, effEmail, allRows);
  // status_since is always attached (outside the per-role column policy) so the
  // board can show "in <status> since N days" for every card.
  const rows = filteredRows.map((r) => ({
    ...projectRowForRoles(effRoles, r),
    ...rowMeta(effRoles, effEmail, r),
    status_since: (r.status_since as string) ?? "",
  }));

  return c.json({
    roles: effRoles,
    viewerEmail: effEmail,
    viewingAs,
    readOnly,
    columns: visibleColumnsForRoles(effRoles),
    rows,
    names: buildNamesMap(team),
    memberRoles: buildRolesMap(team),
    stages: workerStagesForRoles(effRoles),
  });
});

// GET /api/review-queue
// Cards on a reviewable stage at "In Review" that THIS user is assigned to review
// (or all, for admins). Each item shows who submitted it + which stage.
app.get("/api/review-queue", async (c) => {
  const { email, roles } = getUser(c);
  const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const [allRows, team] = await Promise.all([
    cachedReadRows(c.env),
    loadTeam(saToken, c.env.SHEET_ID),
  ]);
  const names = buildNamesMap(team);

  const items = reviewQueueForUser(roles, email, allRows).map(({ row, stage, submittedBy }) => ({
    row_id: (row.row_id ?? "") as string,
    video_title: (row.video_title ?? "") as string,
    stageId: stage.id,
    stage: stage.label,
    statusCol: stage.statusCol,
    submittedBy,
    submittedByName: displayName(submittedBy, names),
    // Attach the same authority meta the board sends, so opening a queue item
    // shows its Approve / Request-changes buttons (and field locks).
    row: { ...projectRowForRoles(roles, row), ...rowMeta(roles, email, row) },
  }));

  return c.json({ count: items.length, items, names });
});

// POST /api/update {row_id, col, value, prev?}
// The doer path: status transitions (Start / Submit / Resume / Resubmit / upload)
// and content-field edits. Reviewer approve/sendback goes through /api/review.
// authorizeWrite is the SINGLE enforcement point.
app.post("/api/update", async (c) => {
  const { roles, email } = getUser(c);

  let body: { row_id?: string; col?: string; value?: string; prev?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const { row_id, col, value, prev } = body;
  if (!row_id || !col || value === undefined) {
    return c.json({ error: "missing required fields: row_id, col, value" }, 400);
  }
  if (!(COLUMNS as readonly string[]).includes(col)) {
    return c.json({ error: "unknown column", col }, 400);
  }
  const typedCol = col as Column;

  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (!targetRow) return c.json({ error: "row not found", row_id }, 404);

  const check = authorizeWrite(roles, email, typedCol, value, targetRow);
  if (!check.ok) return c.json({ error: "forbidden", message: check.reason }, 403);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  try {
    // One read + one batched write (also stamps last_updated). When the column
    // being written is a STATUS column, also stamp status_since so we can show
    // "in <status> since N days" — last_updated changes on any edit, status_since
    // only on a status change.
    const writeValues: Partial<Record<Column, string>> = { [typedCol]: value };
    if (STATUS_COLS.has(typedCol)) writeValues.status_since = new Date().toISOString();
    await updateCells(token, c.env.SHEET_ID, row_id, writeValues,
      prev !== undefined ? { col: typedCol, value: prev } : undefined);
  } catch (err) {
    if (err instanceof ConflictError) {
      return c.json({ error: "conflict", message: "Someone else changed this just now — reloading.", current: err.current }, 409);
    }
    throw err;
  }
  await bustBoardCache(c.env);

  // ── Notifications: run AFTER the response so the action feels instant. ──
  const stage = stageByStatusCol(typedCol);
  const oldValue = ((targetRow[typedCol] ?? "") as string).trim().toLowerCase();
  c.executionCtx.waitUntil((async () => {
    try {
      const videoTitle = (targetRow.video_title ?? "") as string;
      const appUrl = c.env.APP_URL ?? "";

      // Submitted for review → notify the card's assigned reviewer (fallback: approvers).
      if (stage && stage.reviewable && value === "In Review") {
        const team = await loadTeam(token, c.env.SHEET_ID);
        const submitterName = displayName(email, buildNamesMap(team));
        const rowReviewer = ((targetRow.reviewer_email ?? "") as string).trim();
        const recipients = rowReviewer
          ? [rowReviewer]
          : team.filter((m) => (m.roles ?? [m.role]).some(isApprover)).map((m) => m.email);
        await sendNotification(c.env, "submitted", recipients, { title: videoTitle, appUrl, stageLabel: stage.label, actorName: submitterName });
      }

      // Assignment → notify the newly-assigned person.
      const assigneeRole = ASSIGNEE_COL_ROLE[typedCol];
      if (assigneeRole && isAdminRoles(roles) && value.trim() !== "" && value.trim().toLowerCase() !== oldValue) {
        await sendNotification(c.env, "assigned", value.trim(), { title: videoTitle, appUrl, stageLabel: assigneeRole });
      }
    } catch (e) { console.warn("[notify] update notifications failed:", e); }
  })());

  return c.json({ ok: true });
});

// POST /api/review {row_id, stage, action, feedback?}
// The reviewer path. stage = a reviewable stage id (topic|script|recording|editing).
// action = "approve" → Done; "sendback" → Need Changes (feedback required).
// Authority is card-specific: only the card's assigned reviewer (or an admin) may
// act, and never on work they submitted themselves.
app.post("/api/review", async (c) => {
  const { roles, email } = getUser(c);

  let body: { row_id?: string; stage?: string; action?: string; feedback?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const { row_id, stage: stageId, action, feedback } = body;
  if (!row_id || !stageId || !action) {
    return c.json({ error: "missing required fields: row_id, stage, action" }, 400);
  }
  if (action !== "approve" && action !== "sendback") {
    return c.json({ error: "invalid action; must be approve|sendback" }, 400);
  }
  const stage = stageById(stageId);
  if (!stage || !stage.reviewable) {
    return c.json({ error: `invalid stage; must be one of ${STAGES.filter((s) => s.reviewable).map((s) => s.id).join("|")}` }, 400);
  }

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (!targetRow) return c.json({ error: "row not found", row_id }, 404);

  // Authority + valid-transition check (single source of truth).
  if (!canReview(roles, email, stage, targetRow)) {
    return c.json({ error: "forbidden", message: "Only this card's assigned reviewer can review it." }, 403);
  }
  const newStatus = action === "approve" ? "Done" : "Need Changes";
  const transition = transitionsForStage(roles, email, stage, targetRow).find((t) => t.to === newStatus);
  if (!transition) {
    return c.json({ error: "invalid_transition", message: `Can't ${action} from "${statusOf(stage, targetRow)}".` }, 409);
  }
  // Required-field gate (e.g. approving requires the next worker's instruction).
  if (transition.disabledReason) {
    return c.json({ error: "blocked", message: transition.disabledReason }, 400);
  }
  if (action === "sendback" && stage.feedbackCol && !feedback?.trim()) {
    return c.json({ error: "feedback_required", message: "Tell the freelancer what to change." }, 400);
  }

  // One read + one batched write for status (+ feedback), last_updated, status_since.
  const updates: Partial<Record<Column, string>> = {
    [stage.statusCol]: newStatus,
    status_since: new Date().toISOString(),
  };
  if (action === "sendback" && stage.feedbackCol) updates[stage.feedbackCol] = feedback!.trim();
  await updateCells(token, c.env.SHEET_ID, row_id, updates);
  await bustBoardCache(c.env);

  // Notify the submitter (the stage assignee) AFTER the response.
  const assigneeEmail = ((targetRow[stage.assigneeCol] ?? "") as string).trim();
  if (assigneeEmail) {
    const videoTitle = (targetRow.video_title ?? "") as string;
    const appUrl = c.env.APP_URL ?? "";
    c.executionCtx.waitUntil((async () => {
      try {
        const assigneeName = displayName(assigneeEmail, buildNamesMap(await loadTeam(token, c.env.SHEET_ID)));
        await sendNotification(c.env, action === "approve" ? "approved" : "sentBack", assigneeEmail, {
          title: videoTitle, appUrl, stageLabel: stage.label, recipientName: assigneeName, feedback: feedback?.trim(),
        });
      } catch (e) { console.warn("[notify] review notification failed:", e); }
    })());
  }

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin: create / delete videos, generate links
// ---------------------------------------------------------------------------

// POST /api/video — create a new Master row. Always born at the FIRST stage in
// "To Do" with the required brief fields; it can never land mid-pipeline or with
// a blank active status (which is what previously dumped cards into Need Changes).
app.post("/api/video", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);

  let body: {
    video_title?: string; video_notes?: string; category?: string; subcategory?: string;
    reviewer_email?: string;
  };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
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
  const firstStage = STAGES[0]; // topic
  const rowId = await appendRow(token, c.env.SHEET_ID, {
    video_title: title,
    video_notes: notes,
    category,
    subcategory,
    [firstStage.statusCol]: "To Do", // explicit — never blank
    topic_date: today,
    admin_email: PROTECTED_ADMIN_EMAIL, // admin owns the Topic stage
    reviewer_email: (body.reviewer_email ?? "").trim(),
  });

  await bustBoardCache(c.env);
  return c.json({ row_id: rowId });
});

app.post("/api/delete", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { row_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
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

app.post("/api/generate-links", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { row_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
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
      gemini, affiliates, linkDomain: c.env.LINK_DOMAIN,
      existingCodes: () => clickstore.existingCodes(db),
      videoCodeForTitle: (t) => clickstore.videoCodeForTitle(db, t),
      existingSlugs: (code) => clickstore.existingSlugs(db, code),
      insertVideo: (code, t) => clickstore.insertVideo(db, code, t),
      insertLink: (slug, code, tool, url) => clickstore.insertLink(db, slug, code, tool, url),
      kvPut: (k, v) => c.env.CLICKS_KV.put(k, v),
    });
    await updateCells(token, c.env.SHEET_ID, rowId, {
      video_description: result.description,
      actual_links: result.actual_links_text,
      short_links: result.short_links_text,
    });
    await bustBoardCache(c.env);
    return c.json({ description: result.description, links: result.links, non_affiliate_tools: result.non_affiliate_tools });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isContentIssue = /no tools/i.test(msg);
    return c.json(
      { error: isContentIssue ? "no_tools" : "generation_failed", message: msg },
      isContentIssue ? 422 : 500,
    );
  }
});

// ---------------------------------------------------------------------------
// SPA catch-all
// ---------------------------------------------------------------------------

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
