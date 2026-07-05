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
import { getAccessToken, ConflictError } from "./sheets";
import { getStore } from "./datastore";
import { createGeminiClient } from "./gemini";
import { loadAffiliateRecords } from "./affiliate";
import { processVideo } from "./linkgen";
import * as clickstore from "./clickstore";
import {
  visibleColsForRoles, canEditForRoles, projectRowForRoles,
  isApproverRoles, isAdminRoles, isApprover,
  authorizeWrite, transitionsForCard, transitionsForStage, cardStagesForUser, upcomingStagesForUser,
  fieldLockReason, canReview, assignableColsFor, pipeOf,
  allVisibleColsForMemberships, filterRowsForMemberships, workerStagesForMemberships,
  reviewQueueForMemberships, effectiveRolesFor,
  type Row,
} from "../shared/engine/rbac";
import {
  unionRoles, holdsRoleInSystem, type Memberships,
} from "../shared/engine/memberships";
import {
  getPipeline, stageById, PIPELINES, PROTECTED_ADMIN_EMAIL, pipelineSummaries, DEFAULT_PIPELINE_ID,
  rolesForSystem, WILDCARD_SYSTEM, ADMIN_ROLE,
} from "../shared/engine/registry";
import { derive, statusOf } from "../shared/engine/derive";
import { colOf, stageHasReviewerSlot, createFieldsOf } from "../shared/engine/types";
import { lifecycle } from "../shared/engine/lifecycle";
import { VALID_ROLE_NAMES, type TeamMember } from "./roles";
import { loadDefaults, setDefaults, deleteDefaults, resolveDefaults } from "./defaults";
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
  const rows = await getStore(env).readRows();
  await env.SESSIONS.put(BOARD_CACHE_KEY, JSON.stringify(rows), { expirationTtl: BOARD_CACHE_TTL });
  return rows;
}

async function bustBoardCache(env: Env): Promise<void> {
  await env.SESSIONS.delete(BOARD_CACHE_KEY);
}

// ---------------------------------------------------------------------------
// Name helpers
// ---------------------------------------------------------------------------

function buildNamesMap(team: TeamMember[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const m of team) names[m.email.toLowerCase()] = m.name;
  return names;
}

// email -> comma-joined roles, so dropdowns can show "Name — Role(s)" without
// anyone hand-stuffing the role into the name field.
function buildRolesMap(team: TeamMember[]): Record<string, string> {
  const roles: Record<string, string> = {};
  for (const m of team) roles[m.email.toLowerCase()] = (m.roles ?? [m.role]).filter(Boolean).join(", ");
  return roles;
}

// email -> per-system memberships, so the client can scope assignment dropdowns to
// the card's system (a Standard-only freelancer never appears on a Tut-2 card).
function buildMembershipsMap(team: TeamMember[]): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const m of team) out[m.email.toLowerCase()] = m.memberships ?? {};
  return out;
}

function displayName(email: string, names: Record<string, string>): string {
  if (!email) return "";
  const key = email.trim().toLowerCase();
  return names[key] || (email.includes("@") ? email.split("@")[0] : email) || email;
}

// assignee/reviewer column → role label, derived across ALL pipelines (for the
// "you were assigned" notification). Cols are pipeline-specific so they don't clash.
const ASSIGNEE_COL_ROLE: Record<string, string> = (() => {
  const m: Record<string, string> = { reviewer_email: "Reviewer" };
  for (const p of Object.values(PIPELINES)) for (const s of p.stages) {
    m[colOf(s, "assignee")] = s.role;
    if (stageHasReviewerSlot(s)) m[colOf(s, "reviewer")] = "Reviewer";
  }
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
    roles = await getStore(c.env).lookupRoles(email);
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
  return c.json(await getStore(c.env).loadTeam());
});

// Valid roles per system (its doer roles + Reviewer); ?system omitted ⇒ full roster.
app.get("/api/roles", (c) => {
  const system = c.req.query("system");
  if (system && PIPELINES[system]) return c.json(rolesForSystem(system));
  return c.json(VALID_ROLE_NAMES);
});

// The list of systems (id + name), for the system-scoped Team tab.
app.get("/api/systems", (c) => c.json(pipelineSummaries().map((p) => ({ id: p.id, name: p.name }))));

// POST /api/team {name, email, memberships} — Admin-only; replace a teammate's
// FULL per-system membership set. This is the SINGLE place people↔system↔role is
// assigned. memberships = { systemId: roles[] }; "*" carries cross-system Admin.
app.post("/api/team", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);

  let body: { name?: string; email?: string; memberships?: Record<string, string[]> };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!name) return c.json({ error: "name is required" }, 400);
  if (!email || !email.includes("@")) return c.json({ error: "a valid email is required" }, 400);

  // Sanitize each system's roles against what's valid there; drop unknown systems.
  const clean: Memberships = {};
  for (const [sys, list] of Object.entries(body.memberships ?? {})) {
    if (sys !== WILDCARD_SYSTEM && !PIPELINES[sys]) continue;
    const valid = sys === WILDCARD_SYSTEM ? new Set([ADMIN_ROLE]) : new Set(rolesForSystem(sys));
    const rs = (Array.isArray(list) ? list : []).map((r) => r.trim()).filter((r) => valid.has(r));
    if (rs.length) clean[sys] = [...new Set(rs)];
  }

  // Admin is reserved for the founding admin (cross-system "*"); nobody else gets
  // it, and the founder can never lose it (that would lock out team management).
  const isFounder = email === PROTECTED_ADMIN_EMAIL;
  if (isFounder) clean[WILDCARD_SYSTEM] = [ADMIN_ROLE];
  else delete clean[WILDCARD_SYSTEM];

  if (Object.keys(clean).length === 0) return c.json({ error: "assign at least one role in one system" }, 400);

  const result = await getStore(c.env).saveMemberships(name, email, clean);
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
  const removed = await getStore(c.env).deleteEmployee(email);
  await bustBoardCache(c.env);
  return c.json({ ok: removed });
});

// ---------------------------------------------------------------------------
// Assignment defaults (admin) — default people per (category, subcategory) combo.
// Stored in D1 (TRACKER_DB) regardless of the card backend.
// ---------------------------------------------------------------------------

app.get("/api/defaults", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json([], 200);
  const pipeline = getPipeline(c.req.query("pipeline")).id;
  return c.json(await loadDefaults(c.env.TRACKER_DB, pipeline));
});

// The columns a default set can fill (doers + per-stage reviewers) for a pipeline.
app.get("/api/defaults/cols", (c) => c.json(assignableColsFor(getPipeline(c.req.query("pipeline")))));

app.post("/api/defaults", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { pipeline?: string; category?: string; subcategory?: string; assignments?: Record<string, string> };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const category = (body.category ?? "").trim();
  if (!category) return c.json({ error: "category is required" }, 400);
  const pipe = getPipeline(body.pipeline);
  // Keep only this system's assignable columns (doers + per-stage reviewers).
  const validCols = new Set(assignableColsFor(pipe));
  const assignments: Record<string, string> = {};
  for (const [col, email] of Object.entries(body.assignments ?? {})) {
    if (validCols.has(col)) assignments[col] = (email ?? "").trim();
  }
  await setDefaults(c.env.TRACKER_DB, pipe.id, category, body.subcategory ?? "", assignments);
  return c.json({ ok: true });
});

app.post("/api/defaults/delete", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { pipeline?: string; category?: string; subcategory?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  if (!(body.category ?? "").trim()) return c.json({ error: "category is required" }, 400);
  await deleteDefaults(c.env.TRACKER_DB, getPipeline(body.pipeline).id, body.category!.trim(), body.subcategory ?? "");
  return c.json({ ok: true });
});

// POST /api/apply-defaults {row_id} — fill this card's BLANK assignee/reviewer
// fields from the defaults for its (category, subcategory). Never overwrites.
app.post("/api/apply-defaults", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { row_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const rowId = (body.row_id ?? "").trim();
  if (!rowId) return c.json({ error: "row_id is required" }, 400);

  const store = getStore(c.env);
  const allRows = await cachedReadRows(c.env);
  const target = allRows.find((r) => (r.row_id || "").trim() === rowId);
  if (!target) return c.json({ error: "row not found", row_id: rowId }, 404);

  const targetPipe = pipeOf(target);
  const defaults = await resolveDefaults(c.env.TRACKER_DB, targetPipe.id, (target.category as string) ?? "", (target.subcategory as string) ?? "");
  const cardCols = new Set(assignableColsFor(targetPipe)); // only this card's pipeline cols
  const updates: Record<string, string> = {};
  for (const [col, email] of Object.entries(defaults)) {
    if (!cardCols.has(col)) continue;
    if (String(target[col] ?? "").trim()) continue; // fill blanks only
    updates[col] = email;
  }
  if (Object.keys(updates).length) { await store.updateCells(rowId, updates); await bustBoardCache(c.env); }
  return c.json({ applied: updates });
});

// ---------------------------------------------------------------------------
// Per-row authority meta — computed once on the server, authoritatively.
// ---------------------------------------------------------------------------

const STATUS_COLS = new Set<string>(
  Object.values(PIPELINES).flatMap((p) => p.stages.map((s) => colOf(s, "status"))),
);

// `roles` here are the EFFECTIVE roles for this card's system (caller collapses
// the user's memberships via effectiveRolesFor) — so meta is system-correct.
function rowMeta(roles: string[], email: string, row: Row) {
  const p = pipeOf(row);                                        // resolve this card's pipeline
  const stages = cardStagesForUser(roles, email, row);          // statusCols this card belongs to (in user's lanes)
  const upcoming = upcomingStagesForUser(roles, email, row);
  const actions = transitionsForCard(roles, email, row);        // allowed status transitions, per stage
  const locks: Record<string, string> = {};                     // editable content/feedback fields that are currently locked
  for (const col of visibleColsForRoles(roles, p)) {
    if (STATUS_COLS.has(col)) continue;                         // status is driven by action buttons, not free inputs
    if (!canEditForRoles(roles, p, col)) continue;
    const reason = fieldLockReason(roles, email, col, row);
    if (reason) locks[col] = reason;
  }
  return { _stages: stages, _upcoming: upcoming, _actions: actions, _locks: locks };
}

// GET /api/board[?asUser=email]
// View-as is a PURE read-only role swap: an admin sees byte-for-byte what the
// target sees (same columns, rows, stage membership, and action buttons), but
// readOnly=true makes it inert. There is no edit elevation — exactly one
// rendering path, so the admin's preview can never diverge from the real user.
app.get("/api/board", async (c) => {
  const { email, roles, memberships } = getUser(c);
  const isAdmin = isAdminRoles(roles);
  const asUser = c.req.query("asUser");
  const store = getStore(c.env);

  let effMemberships = memberships;
  let effEmail = email;
  let viewingAs: { email: string; roles: string[] } | null = null;
  let readOnly = false;

  if (isAdmin && asUser) {
    const asMemberships = await store.lookupMemberships(asUser);
    const asRoles = unionRoles(asMemberships);
    if (asRoles.length === 0) {
      return c.json({
        roles, viewingAs: { email: asUser, roles: [] }, readOnly: true,
        columns: [], rows: [], names: {}, stages: [], pipelines: pipelineSummaries(), memberships: {},
        notice: "This user has no role mapping in the team.",
      });
    }
    effMemberships = asMemberships;
    effEmail = asUser.trim().toLowerCase();
    viewingAs = { email: asUser, roles: asRoles };
    readOnly = true; // mirror only — never editable
  }

  const [allRows, team] = await Promise.all([
    cachedReadRows(c.env),
    store.loadTeam(),
  ]);

  const filteredRows = filterRowsForMemberships(effMemberships, effEmail, allRows);
  // status_since is always attached (outside the per-role column policy) so the
  // board can show "in <status> since N days" for every card. Per-card authority
  // uses the EFFECTIVE roles for that card's system.
  const rows = filteredRows.map((r) => {
    const eff = effectiveRolesFor(effMemberships, r);
    const extraSinceCols: Record<string, string> = {};
    if (isAdmin) {
      for (const k of Object.keys(r)) {
        if (k.endsWith("_since")) extraSinceCols[k] = (r as any)[k] as string;
      }
    }
    return {
      ...projectRowForRoles(eff, r),
      ...rowMeta(eff, effEmail, r),
      status_since: (r.status_since as string) ?? "",
      ...extraSinceCols,
    };
  });

  return c.json({
    roles: unionRoles(effMemberships),
    viewerEmail: effEmail,
    viewingAs,
    readOnly,
    columns: allVisibleColsForMemberships(effMemberships),
    rows,
    names: buildNamesMap(team),
    memberRoles: buildRolesMap(team),
    memberships: buildMembershipsMap(team),
    stages: workerStagesForMemberships(effMemberships),
    pipelines: pipelineSummaries(),
  });
});

// GET /api/review-queue
// Cards on a reviewable stage at "In Review" that THIS user is assigned to review
// (or all, for admins). Each item shows who submitted it + which stage.
app.get("/api/review-queue", async (c) => {
  const { email, memberships } = getUser(c);
  const [allRows, team] = await Promise.all([
    cachedReadRows(c.env),
    getStore(c.env).loadTeam(),
  ]);
  const names = buildNamesMap(team);

  const items = reviewQueueForMemberships(memberships, email, allRows).map(({ row, stage, submittedBy }) => {
    const eff = effectiveRolesFor(memberships, row);
    return {
      row_id: (row.row_id ?? "") as string,
      video_title: (row.video_title ?? "") as string,
      stageId: stage.id,
      stage: stage.label,
      statusCol: colOf(stage, "status"),
      submittedBy,
      submittedByName: displayName(submittedBy, names),
      // Attach the same authority meta the board sends, so opening a queue item
      // shows its Approve / Request-changes buttons (and field locks).
      row: { ...projectRowForRoles(eff, row), ...rowMeta(eff, email, row) },
    };
  });

  return c.json({ count: items.length, items, names });
});

// POST /api/update {row_id, col, value, prev?}
// The doer path: status transitions (Start / Submit / Resume / Resubmit / upload)
// and content-field edits. Reviewer approve/sendback goes through /api/review.
// authorizeWrite is the SINGLE enforcement point.
app.post("/api/update", async (c) => {
  const { roles, email, memberships } = getUser(c);

  let body: { row_id?: string; col?: string; value?: string; prev?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const { row_id, col, value, prev } = body;
  if (!row_id || !col || value === undefined) {
    return c.json({ error: "missing required fields: row_id, col, value" }, 400);
  }
  const typedCol = col;

  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (!targetRow) return c.json({ error: "row not found", row_id }, 404);

  const pipe = pipeOf(targetRow);
  if (!derive(pipe).allCols.includes(col)) {
    return c.json({ error: "unknown column", col }, 400);
  }

  const effRoles = effectiveRolesFor(memberships, targetRow);
  const check = authorizeWrite(effRoles, email, typedCol, value, targetRow);
  if (!check.ok) return c.json({ error: "forbidden", message: check.reason }, 403);

  const store = getStore(c.env);

  // System-membership guard: a person can only be assigned to a doer/reviewer slot
  // on a card whose system they belong to (reviewers may span systems). This backs
  // up the system-scoped dropdowns server-side, so an out-of-system assignment is
  // rejected even via a hand-rolled request.
  if (value.trim() && new Set(assignableColsFor(pipe)).has(typedCol)) {
    const requiredRole = ASSIGNEE_COL_ROLE[typedCol];
    const assigneeM = await store.lookupMemberships(value.trim());
    if (requiredRole && !holdsRoleInSystem(assigneeM, pipe.id, requiredRole)) {
      return c.json({ error: "not_in_system", message: `That person isn't a ${requiredRole} in ${pipe.name}. Add them to ${pipe.name} in the Team tab first.` }, 400);
    }
  }

  try {
    // One read + one batched write (also stamps last_updated). When the column
    // being written is a STATUS column, also stamp status_since so we can show
    // "in <status> since N days" — last_updated changes on any edit, status_since
    // only on a status change.
    const writeValues: Record<string, string> = { [typedCol]: value };
    if (STATUS_COLS.has(typedCol)) writeValues.status_since = new Date().toISOString();
    await store.updateCells(row_id, writeValues,
      prev !== undefined ? { col: typedCol, value: prev } : undefined);
  } catch (err) {
    if (err instanceof ConflictError) {
      return c.json({ error: "conflict", message: "Someone else changed this just now — reloading.", current: err.current }, 409);
    }
    throw err;
  }
  
  const stage = derive(pipe).byStatusCol.get(typedCol);
  const oldValue = ((targetRow[typedCol] ?? "") as string).trim().toLowerCase();
  
  if (STATUS_COLS.has(typedCol) && stage) {
    c.executionCtx.waitUntil((async () => {
      try {
        const trans = lifecycle(stage.lifecycle).transitions.find((t) => t.to === value && t.from === oldValue);
        const rawType = trans?.kind ?? "submit";
        const type = ["start", "submit", "advance"].includes(rawType) ? "complete" : rawType;
        await store.logEvent({
          card_id: row_id,
          stage_id: stage.id,
          type: type,
          actor: email,
        });
      } catch (err) {
        console.error("Failed to log card event:", err);
      }
    })());
  }

  await bustBoardCache(c.env);

  // ── Notifications: run AFTER the response so the action feels instant. ──
  c.executionCtx.waitUntil((async () => {
    try {
      const videoTitle = (targetRow.video_title ?? "") as string;
      const appUrl = c.env.APP_URL ?? "";

      // Submitted for review → notify the stage's assigned reviewer (fallback: approvers).
      if (stage && lifecycle(stage.lifecycle).reviewed && value === "In Review") {
        const team = await store.loadTeam();
        const submitterName = displayName(email, buildNamesMap(team));
        // Notify THIS stage's assigned reviewer (per-stage). Fallback: all approvers.
        const stageReviewer = stageHasReviewerSlot(stage) ? ((targetRow[colOf(stage, "reviewer")] ?? "") as string).trim() : "";
        const recipients = stageReviewer
          ? [stageReviewer]
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
  const { email, memberships } = getUser(c);

  let body: { row_id?: string; stage?: string; action?: string; feedback?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const { row_id, stage: stageId, action, feedback } = body;
  if (!row_id || !stageId || !action) {
    return c.json({ error: "missing required fields: row_id, stage, action" }, 400);
  }
  if (action !== "approve" && action !== "sendback") {
    return c.json({ error: "invalid action; must be approve|sendback" }, 400);
  }
  const store = getStore(c.env);
  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (!targetRow) return c.json({ error: "row not found", row_id }, 404);

  const pipe = pipeOf(targetRow);
  const stage = stageById(pipe, stageId);
  if (!stage || !lifecycle(stage.lifecycle).reviewed) {
    return c.json({ error: `invalid stage; must be one of ${pipe.stages.filter((s) => lifecycle(s.lifecycle).reviewed).map((s) => s.id).join("|")}` }, 400);
  }
  const feedbackCol = stage.lifecycle === "review" ? colOf(stage, "feedback") : null;
  const effRoles = effectiveRolesFor(memberships, targetRow);

  // Authority + valid-transition check (single source of truth).
  if (!canReview(effRoles, email, stage, targetRow)) {
    return c.json({ error: "forbidden", message: "Only this card's assigned reviewer can review it." }, 403);
  }
  const newStatus = action === "approve" ? "Done" : "Need Changes";
  const transition = transitionsForStage(effRoles, email, stage, targetRow, pipe).find((t) => t.to === newStatus);
  if (!transition) {
    return c.json({ error: "invalid_transition", message: `Can't ${action} from "${statusOf(stage, targetRow)}".` }, 409);
  }
  // Required-field gate (e.g. approving requires the next worker's instruction).
  if (transition.disabledReason) {
    return c.json({ error: "blocked", message: transition.disabledReason }, 400);
  }
  if (action === "sendback" && feedbackCol && !feedback?.trim()) {
    return c.json({ error: "feedback_required", message: "Tell the freelancer what to change." }, 400);
  }

  // One read + one batched write for status (+ feedback), last_updated, status_since.
  const updates: Record<string, string> = {
    [colOf(stage, "status")]: newStatus,
    status_since: new Date().toISOString(),
  };
  if (action === "sendback" && feedbackCol) updates[feedbackCol] = feedback!.trim();
  await store.updateCells(row_id, updates);
  
  c.executionCtx.waitUntil((async () => {
    try {
      const currentStatus = statusOf(stage, targetRow as any);
      const type = action === "approve" ? "approve" : (currentStatus === "Done" ? "reopen" : "sendback");
      await store.logEvent({
        card_id: row_id,
        stage_id: stage.id,
        type: type,
        actor: email,
        detail: (action === "sendback" || type === "reopen") ? feedback?.trim() : undefined,
      });
    } catch (err) {
      console.error("Failed to log review event:", err);
    }
  })());

  await bustBoardCache(c.env);

  // Notify the submitter (the stage assignee) AFTER the response.
  const assigneeEmail = ((targetRow[colOf(stage, "assignee")] ?? "") as string).trim();
  if (assigneeEmail) {
    const videoTitle = (targetRow.video_title ?? "") as string;
    const appUrl = c.env.APP_URL ?? "";
    c.executionCtx.waitUntil((async () => {
      try {
        const assigneeName = displayName(assigneeEmail, buildNamesMap(await store.loadTeam()));
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

  let body: Record<string, string>;
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }

  // Which system this video runs on (defaults to standard).
  const pipe = getPipeline((body.pipeline ?? DEFAULT_PIPELINE_ID).trim());

  // Validate + collect the creation fields from the shared config (control.ts),
  // so the required set can't drift from the client modal.
  const values: Record<string, string> = {};
  for (const f of createFieldsOf(pipe)) {
    const v = (body[f.col] ?? "").trim();
    if (!v) return c.json({ error: `${f.label} is required`, col: f.col }, 400);
    values[f.col] = v;
  }

  const today = new Date().toISOString().slice(0, 10);
  const firstStage = pipe.stages[0]; // the brief/topic stage
  // Pre-fill assignees/reviewers from the defaults for this (category, subcategory),
  // keeping only columns that exist in THIS pipeline.
  const defaults = await resolveDefaults(c.env.TRACKER_DB, pipe.id, values.category ?? "", values.subcategory ?? "");
  const cardCols = new Set(assignableColsFor(pipe));
  const filteredDefaults = Object.fromEntries(Object.entries(defaults).filter(([col]) => cardCols.has(col)));
  const rowId = await getStore(c.env).appendRow({
    ...filteredDefaults,                          // default assignees/reviewers for the combo
    ...values,                                    // the brief fields (win on any overlap)
    pipeline: pipe.id,                            // stamp the system
    [colOf(firstStage, "status")]: "To Do",       // explicit — never blank
    topic_date: today,
    [colOf(firstStage, "assignee")]: PROTECTED_ADMIN_EMAIL, // admin owns the brief stage
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

  try {
    await getStore(c.env).deleteRowById(rowId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "row not found", row_id: rowId }, 404);
    return c.json({ error: msg }, 500);
  }
  await bustBoardCache(c.env);
  return c.json({ ok: true, row_id: rowId });
});

app.get("/api/card-events", async (c) => {
  const { memberships, email } = getUser(c);
  const row_id = c.req.query("row_id")?.trim();
  if (!row_id) return c.json({ error: "missing row_id" }, 400);

  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (!targetRow) return c.json({ error: "row not found" }, 404);

  // Authorize with board visibility
  const visible = filterRowsForMemberships(memberships, email, [targetRow]);
  if (visible.length === 0) return c.json({ error: "forbidden" }, 403);

  const store = getStore(c.env);
  const [events, team] = await Promise.all([
    store.listEvents(row_id),
    store.loadTeam()
  ]);

  const names = buildNamesMap(team);
  const enrichedEvents = events.map((e) => ({
    ...e,
    actorName: displayName(e.actor, names)
  }));

  return c.json({ events: enrichedEvents });
});

app.post("/api/generate-links", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { row_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const rowId = (body.row_id ?? "").trim();
  if (!rowId) return c.json({ error: "row_id is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON); // for the (separate) affiliate-programs sheet
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
    await getStore(c.env).updateCells(rowId, {
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
