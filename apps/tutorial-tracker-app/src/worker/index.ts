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
 *   POST /api/submit      → doer submit for review (atomic status+note; note required)
 *   POST /api/review      → reviewer approve / request-changes (atomic status+feedback)
 *   GET  *                → serve SPA via ASSETS binding
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { setCookie } from "hono/cookie";
import type { Env, Variables } from "./auth";
import { getUser, loginRedirect, logout, oauthCallback, requireSession } from "./auth";
import { getAccessToken, ConflictError, SheetsError } from "./sheets";
import { getStore } from "./datastore";
import { type AffiliateRecord } from "./affiliate";
import { loadCatalog, type CatalogEnv } from "./catalog";
import { resolveSelection, externalCollisions, buildPlan, renderDescription, validateDescription, planHash, generateVideoCode } from "./linkgen";
import * as clickstore from "./clickstore";
import { normalizeTargetUrl, creditWarnings } from "./linkhealth";
import {
  listPrograms, getProgram, upsertProgram, deleteProgram, validateTargetUrl,
  toSlug, NETWORKS, APPROVAL_STATUSES, COUPON_STATUSES, KINDS,
  type ProgramInput,
} from "./programs";
import { readSheetForImport, harvestExternalTools } from "./programs-import";
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
import { mintSlug } from "../shared/slug";
import { derive, statusOf } from "../shared/engine/derive";
import { colOf, stageHasReviewerSlot, createFieldsOf, requiredToCreate } from "../shared/engine/types";
import { lifecycle, eventTypeFor } from "../shared/engine/lifecycle";
import { liveHoldingsFor, rolesRemoved } from "../shared/engine/holdings";
import { VALID_ROLE_NAMES, type TeamMember } from "./roles";
import { loadDefaults, setDefaults, deleteDefaults, resolveDefaults } from "./defaults";
import { sendNotification } from "./notifications";
import { structuralIssues, buildReport, type GuardIssue } from "./linkguard";
import { probeAll, type ProbeOne } from "./linkprobe";
import { sendTelegram } from "./notify-telegram";
import { syncYouTubeId } from "./ytsync";

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
// KV-backed cache for the affiliate-programs sheet (~5 min TTL)
//
// FIVE endpoints each read this one Google Sheet on every request. Opening the
// Links tab was enough to get HTTP 429 (rate limited) back from Google, which
// escaped as a bare 500 — "Couldn't fetch link drift (HTTP 500)" with no clue
// why. The sheet changes a few times a week, so caching it costs nothing.
// ---------------------------------------------------------------------------

const AFFILIATE_CACHE_KEY = "affiliates:records";
const AFFILIATE_CACHE_TTL = 300;
/** Last-known-good copy, kept far longer than the fresh window. A drift report
 *  built from a ten-minute-old sheet beats an error page every time. */
const AFFILIATE_STALE_KEY = "affiliates:records:last";
const AFFILIATE_STALE_TTL = 604800;   // 7 days

/** Why the affiliate sheet could not be read, in words a person can act on. */
function sheetFailure(err: unknown): { status: 429 | 502; message: string } {
  if (err instanceof SheetsError) {
    if (err.rateLimited) {
      return { status: 429, message: "Google is rate-limiting the affiliate sheet right now. Try again in a minute." };
    }
    if (err.status === 403) {
      return { status: 502, message: "The tracker's service account can't read the affiliate sheet — re-share it with that account." };
    }
    if (err.status === 404) {
      return { status: 502, message: "The affiliate sheet wasn't found — check AFFILIATE_PROGRAMS_SHEET_URL." };
    }
    return { status: 502, message: `The affiliate sheet couldn't be read (Google returned ${err.status}).` };
  }
  return { status: 502, message: "The affiliate sheet couldn't be read." };
}

async function cachedAffiliates(env: Env): Promise<Record<string, AffiliateRecord>> {
  const fresh = await env.SESSIONS.get(AFFILIATE_CACHE_KEY);
  if (fresh) {
    try { return JSON.parse(fresh) as Record<string, AffiliateRecord>; } catch { /* fall through */ }
  }
  try {
    const records = await loadCatalog(env as unknown as CatalogEnv, () => getAccessToken(env.GOOGLE_SA_JSON));
    const body = JSON.stringify(records);
    await env.SESSIONS.put(AFFILIATE_CACHE_KEY, body, { expirationTtl: AFFILIATE_CACHE_TTL });
    await env.SESSIONS.put(AFFILIATE_STALE_KEY, body, { expirationTtl: AFFILIATE_STALE_TTL });
    return records;
  } catch (err) {
    // Refresh failed. Serve the last good copy if we have one — being a few
    // minutes behind is not worth an error page.
    const stale = await env.SESSIONS.get(AFFILIATE_STALE_KEY);
    if (stale) {
      try { return JSON.parse(stale) as Record<string, AffiliateRecord>; } catch { /* fall through */ }
    }
    // Nothing cached at all: say exactly what went wrong, in one sentence.
    const { status, message } = sheetFailure(err);
    throw new HTTPException(status, {
      res: Response.json({ error: "affiliate_sheet_unavailable", message }, { status }),
    });
  }
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

type CheckKind = "structural" | "chain" | "manual";
interface CheckRow { ran_at: number; kind: CheckKind; checked: number; ok_count: number; issue_count: number; unverifiable: number; issues_json: string; notified: number; }
async function recordLinkCheck(env: Env, kind: CheckKind, checked: number, issues: GuardIssue[], unverifiable: number, notified: boolean): Promise<void> {
  await env.TRACKER_DB.prepare("INSERT INTO link_checks (ran_at, kind, checked, ok_count, issue_count, unverifiable, issues_json, notified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(Math.floor(Date.now() / 1000), kind, checked, Math.max(0, checked - issues.length), issues.length, unverifiable, JSON.stringify(issues), notified ? 1 : 0).run();
}
async function runStructural(env: Env, kind: CheckKind = "structural"): Promise<GuardIssue[]> {
  const [programs, links, videoRows] = await Promise.all([
    listPrograms(env.TRACKER_DB),
    clickstore.allLinks(env.DB),
    env.DB.prepare("SELECT video_code, yt_video_id FROM videos").all<{ video_code: string; yt_video_id: string | null }>(),
  ]);
  const kv: Record<string, string> = {};
  await Promise.all(links.map(async (link) => { const value = await env.CLICKS_KV.get(link.slug); if (value !== null) kv[link.slug] = value; }));
  const videos = Object.fromEntries(videoRows.results.map((row) => [row.video_code, row.yt_video_id]));
  const issues = structuralIssues({ programs, links, kv, videos }); const report = buildReport(issues, 0, programs.length, false);
  const notified = report ? await sendTelegram(env, report) : false;
  await recordLinkCheck(env, kind, programs.length, issues, 0, notified); return issues;
}
async function runChainProbe(env: Env, onlySlug?: string, kind: CheckKind = "chain"): Promise<GuardIssue[]> {
  const programs = await listPrograms(env.TRACKER_DB);
  const candidates: ProbeOne[] = programs.filter((program) => program.probe_enabled === 1 && !!program.target_url && (!onlySlug || program.slug === onlySlug)).map((program) => ({ slug: program.slug, targetUrl: program.target_url, kind: program.kind }));
  const results = await probeAll(candidates, fetch); const issues: GuardIssue[] = [];
  for (const result of results) { const program = programs.find((item) => item.slug === result.slug); if (!program) continue;
    if (result.finalUrl && program.last_final_url && result.finalUrl !== program.last_final_url) issues.push({ code: "changed_destination", slug: program.slug, detail: `Was ${program.last_final_url}; now ${result.finalUrl}.` });
    await env.TRACKER_DB.prepare("UPDATE programs SET previous_final_url = last_final_url, last_final_url = ?, last_status = ?, last_checked_at = ? WHERE slug = ?").bind(result.finalUrl, result.status, Math.floor(Date.now() / 1000), program.slug).run();
    if (result.status === "no_credit") issues.push({ code: "no_credit_marker", slug: result.slug, detail: result.detail });
    if (result.status === "dead") issues.push({ code: "bad_url", slug: result.slug, detail: result.detail }); }
  const unverifiable = results.filter((result) => result.status === "unverifiable").length; const report = buildReport(issues, unverifiable, candidates.length, true);
  const notified = report ? await sendTelegram(env, report) : false; await recordLinkCheck(env, kind, candidates.length, issues, unverifiable, notified); return issues;
}
async function runUnverifiableDigest(env: Env): Promise<void> {
  const programs = await listPrograms(env.TRACKER_DB); const blocked = programs.filter((program) => program.last_status === "unverifiable");
  const report = buildReport(blocked.map((program) => ({ code: "bad_url" as const, slug: program.slug, detail: "Blocks automated checks; open this destination yourself." })), blocked.length, programs.length, true);
  if (report) await sendTelegram(env, report);
}

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

  // Taking a role (or a whole system) away strands work just as surely as a full
  // removal does — same refusal, scoped to what this save would actually revoke.
  const before = await getStore(c.env).lookupMemberships(email);
  const gone = rolesRemoved(before, clean);
  if (gone.roles.length) {
    const holdings = liveHoldingsFor(email, await cachedReadRows(c.env), gone);
    if (holdings.length) {
      return c.json({
        error: "holds_live_work",
        message: `${name} still has ${holdings.length} unfinished job${holdings.length === 1 ? "" : "s"} needing ${gone.roles.join(", ")}. Hand them to someone else first.`,
        holdings,
      }, 409);
    }
  }

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
  // Refuse while they still stand on unfinished work. Deleting the employee row
  // does NOT touch the cards, so their stages would keep a dead email: invisible
  // in everyone's "My work", movable only by an admin, and nothing would say so.
  const holdings = liveHoldingsFor(email, await cachedReadRows(c.env));
  if (holdings.length) {
    return c.json({
      error: "holds_live_work",
      message: `${email} still has ${holdings.length} unfinished job${holdings.length === 1 ? "" : "s"}. Hand them to someone else first.`,
      holdings,
    }, 409);
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

app.get("/api/defaults/resolve", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({}, 200);
  const pipe = getPipeline(c.req.query("pipeline")).id;
  return c.json(await resolveDefaults(c.env.TRACKER_DB, pipe));
});

// The columns a default set can fill (doers + per-stage reviewers) for a pipeline.
app.get("/api/defaults/cols", (c) => c.json(assignableColsFor(getPipeline(c.req.query("pipeline")))));

app.post("/api/defaults", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { pipeline?: string; assignments?: Record<string, string> };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const pipe = getPipeline(body.pipeline);
  // Keep only this system's assignable columns (doers + per-stage reviewers).
  const validCols = new Set(assignableColsFor(pipe));
  const assignments: Record<string, string> = {};
  for (const [col, email] of Object.entries(body.assignments ?? {})) {
    if (validCols.has(col)) assignments[col] = (email ?? "").trim();
  }
  await setDefaults(c.env.TRACKER_DB, pipe.id, assignments);
  return c.json({ ok: true });
});

app.post("/api/defaults/delete", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { pipeline?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  await deleteDefaults(c.env.TRACKER_DB, getPipeline(body.pipeline).id);
  return c.json({ ok: true });
});

// POST /api/apply-defaults {row_id} — fill this card's BLANK assignee/reviewer
// fields from its SYSTEM's default set. Never overwrites.
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
  const defaults = await resolveDefaults(c.env.TRACKER_DB, targetPipe.id);
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
  // status_since and every per-stage `*_since` are always attached (outside the
  // per-role column policy) so everyone can see "in <status> since N days" per
  // stage — timestamps carry no confidential data, and row/column visibility is
  // already enforced elsewhere. Per-card authority uses the EFFECTIVE roles for
  // that card's system.
  const rows = filteredRows.map((r) => {
    const eff = effectiveRolesFor(effMemberships, r);
    const extraSinceCols: Record<string, string> = {};
    for (const k of Object.keys(r)) {
      if (k.endsWith("_since")) extraSinceCols[k] = (r as any)[k] as string;
    }
    return {
      ...projectRowForRoles(eff, r),
      ...rowMeta(eff, effEmail, r),
      status_since: (r.status_since as string) ?? "",
      ...extraSinceCols,
      // Link-gen fields live in card_extra, so they're not declared pipeline
      // columns and projectRowForRoles drops them. Re-attach them (non-sensitive:
      // the tool list + a public short-code) so the card's Video-tools section can
      // rehydrate the selection on reopen.
      video_tools: (r.video_tools as string) ?? "",
      video_code: (r.video_code as string) ?? "",
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
  const store = getStore(c.env);
  const [allRows, team, submitNotes] = await Promise.all([
    cachedReadRows(c.env),
    store.loadTeam(),
    store.latestSubmitNotes(),
  ]);
  const names = buildNamesMap(team);

  const items = reviewQueueForMemberships(memberships, email, allRows).map(({ row, stage, submittedBy }) => {
    const eff = effectiveRolesFor(memberships, row);
    const rowId = (row.row_id ?? "") as string;
    return {
      row_id: rowId,
      video_title: (row.video_title ?? "") as string,
      stageId: stage.id,
      stage: stage.label,
      statusCol: colOf(stage, "status"),
      submittedBy,
      submittedByName: displayName(submittedBy, names),
      // What the doer said they did. Rendered ON the queue row, because Approve
      // is one click there — a note only readable inside the card would be
      // approved past without ever being seen.
      submitNote: submitNotes.get(`${rowId}:${stage.id}`) ?? "",
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

  // A submit that needs a note is not writable through this endpoint — it would
  // land in the reviewer's queue with nothing to read. /api/submit is the only
  // door, so the note requirement cannot be bypassed with a hand-rolled call.
  const submitStage = derive(pipe).byStatusCol.get(typedCol);
  if (submitStage && transitionsForStage(effRoles, email, submitStage, targetRow, pipe)
    .some((t) => t.to === value && t.requiresNote)) {
    return c.json({ error: "note_required", message: "Submitting for review needs a note. Use /api/submit." }, 400);
  }

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

  // Keep analytics mapping in step without putting the card save at risk.
  if (typedCol === "yt_link") {
    const code = String(targetRow.video_code ?? "").trim();
    c.executionCtx.waitUntil(
      syncYouTubeId(c.env.DB, code, value)
        .then((outcome) => { if (outcome !== "skipped") console.log("ytsync", JSON.stringify({ code, outcome })); })
        .catch((error) => console.error("ytsync failed", error)),
    );
  }
  
  const stage = derive(pipe).byStatusCol.get(typedCol);
  const oldValue = ((targetRow[typedCol] ?? "") as string).trim().toLowerCase();
  
  if (STATUS_COLS.has(typedCol) && stage) {
    c.executionCtx.waitUntil((async () => {
      try {
        await store.logEvent({
          card_id: row_id,
          stage_id: stage.id,
          type: eventTypeFor(stage.lifecycle, oldValue, value),
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

// POST /api/submit {row_id, stage, note}
// The doer's mirror of /api/review: an atomic status+note write for a submit
// that lands in front of a reviewer. The note is NOT optional — a resubmit with
// no word on what changed forces the reviewer to re-review from scratch, which
// is the whole cost this endpoint exists to remove.
app.post("/api/submit", async (c) => {
  const { email, memberships } = getUser(c);

  let body: { row_id?: string; stage?: string; note?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const { row_id, stage: stageId, note } = body;
  if (!row_id || !stageId) {
    return c.json({ error: "missing required fields: row_id, stage" }, 400);
  }

  const store = getStore(c.env);
  const allRows = await cachedReadRows(c.env);
  const targetRow = allRows.find((r) => (r.row_id || "").trim() === row_id);
  if (!targetRow) return c.json({ error: "row not found", row_id }, 404);

  const pipe = pipeOf(targetRow);
  const stage = stageById(pipe, stageId);
  if (!stage) return c.json({ error: "invalid stage", stage: stageId }, 400);

  const statusCol = colOf(stage, "status");
  const effRoles = effectiveRolesFor(memberships, targetRow);
  const fromStatus = statusOf(stage, targetRow);

  // Authority + valid-transition in one check, from the same table the buttons
  // are built from — so what the UI offers and what this accepts cannot drift.
  const transition = transitionsForStage(effRoles, email, stage, targetRow, pipe)
    .find((t) => t.by === "doer" && t.requiresNote);
  if (!transition) {
    return c.json({
      error: "invalid_transition",
      message: `Nothing to submit for review from "${fromStatus}".`,
    }, 409);
  }
  if (transition.disabledReason) {
    return c.json({ error: "blocked", message: transition.disabledReason }, 400);
  }

  const trimmed = (note ?? "").trim();
  if (!trimmed) {
    return c.json({ error: "note_required", message: "Tell the reviewer what you did." }, 400);
  }

  // Belt-and-braces: the status write goes through the same single enforcement
  // point every other doer write does.
  const check = authorizeWrite(effRoles, email, statusCol, transition.to, targetRow);
  if (!check.ok) return c.json({ error: "forbidden", message: check.reason }, 403);

  try {
    await store.updateCells(row_id, {
      [statusCol]: transition.to,
      status_since: new Date().toISOString(),
    }, { col: statusCol, value: fromStatus });
  } catch (err) {
    if (err instanceof ConflictError) {
      return c.json({ error: "conflict", message: "Someone else changed this just now — reloading.", current: err.current }, 409);
    }
    throw err;
  }

  c.executionCtx.waitUntil((async () => {
    try {
      await store.logEvent({
        card_id: row_id,
        stage_id: stage.id,
        type: eventTypeFor(stage.lifecycle, fromStatus, transition.to),
        actor: email,
        detail: trimmed,
      });
    } catch (err) {
      console.error("Failed to log submit event:", err);
    }
  })());

  await bustBoardCache(c.env);

  // Notify this stage's reviewer AFTER the response. The queue row carries the
  // note too, so a missed mail never hides it.
  c.executionCtx.waitUntil((async () => {
    try {
      const team = await store.loadTeam();
      const names = buildNamesMap(team);
      const stageReviewer = stageHasReviewerSlot(stage)
        ? ((targetRow[colOf(stage, "reviewer")] ?? "") as string).trim() : "";
      const recipients = stageReviewer
        ? [stageReviewer]
        : team.filter((m) => (m.roles ?? [m.role]).some(isApprover)).map((m) => m.email);
      await sendNotification(c.env, "submitted", recipients, {
        title: (targetRow.video_title ?? "") as string,
        appUrl: c.env.APP_URL ?? "",
        stageLabel: stage.label,
        actorName: displayName(email, names),
        feedback: trimmed,
      });
    } catch (e) { console.warn("[notify] submit notification failed:", e); }
  })());

  return c.json({ ok: true, status: transition.to });
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

  const fieldLabel = (col: string) => {
    const f = createFieldsOf(pipe).find((x) => x.col === col);
    if (f) return f.label;
    for (const s of pipe.stages) if (colOf(s, "assignee") === col) return s.role;
    return col;
  };
  const missing = requiredToCreate(pipe).filter((col) => col !== "slug" && !String(body[col] ?? "").trim());
  if (missing.length) return c.json({ error: `Missing: ${missing.map(fieldLabel).join(", ")}` }, 400);

  let taken = new Set<string>();
  if (c.env.TRACKER_DB) {
    const rows = await c.env.TRACKER_DB.prepare("SELECT slug FROM cards WHERE slug IS NOT NULL").all<{ slug: string }>();
    taken = new Set(rows.results?.map((r) => r.slug) ?? []);
  }

  // Validate + collect the creation fields from the shared config (control.ts),
  // so the required set can't drift from the client modal.
  const values: Record<string, string> = {};
  for (const f of createFieldsOf(pipe)) {
    const v = (body[f.col] ?? "").trim();
    if (f.col === "slug") {
      const id = crypto.randomUUID().slice(0, 8);
      values.slug = v ? mintSlug(v, taken, id) : mintSlug((body.video_title ?? "").trim(), taken, id);
    } else {
      if (!v) return c.json({ error: `${f.label} is required`, col: f.col }, 400);
      values[f.col] = v;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const firstStage = pipe.stages[0]; // the brief/topic stage
  // Pre-fill assignees/reviewers from the defaults for this (category, subcategory),
  // keeping only columns that exist in THIS pipeline.
  const defaults = await resolveDefaults(c.env.TRACKER_DB, pipe.id);
  const cardCols = new Set(assignableColsFor(pipe));
  const filteredDefaults = Object.fromEntries(Object.entries(defaults).filter(([col]) => cardCols.has(col)));
  
  // The client also sends explicitly chosen assignees/reviewers in the body.
  const explicitAssignees: Record<string, string> = {};
  for (const col of cardCols) {
    if (body[col] !== undefined) explicitAssignees[col] = body[col].trim();
  }

  const rowId = await getStore(c.env).appendRow({
    ...filteredDefaults,                          // default assignees/reviewers for the combo
    ...explicitAssignees,                         // explicit assignees from the create screen
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
  return c.json({ error: "gone", message: "Replaced by /api/link-preview + /api/link-confirm" }, 410);
});

app.get("/api/affiliate-catalog", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const affiliates = await cachedAffiliates(c.env);
  const list = Object.values(affiliates).map(a => ({
    slug: a.tool,
    displayName: a.displayName,
    isApproved: a.isApproved,
    hasCoupon: !!a.couponCode
  }));
  return c.json(list);
});

// POST /api/video-tools {row_id, tools} — Admin-only. Persists the card's tool
// selection. Uses a dedicated route (not /api/update) because video_tools is a
// card_extra passthrough field, not a declared pipeline column, so the generic
// update handler's allCols guard would (correctly) reject it.
app.post("/api/video-tools", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { row_id?: string; tools?: unknown };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const rowId = (body.row_id ?? "").trim();
  if (!rowId) return c.json({ error: "row_id is required" }, 400);
  if (!Array.isArray(body.tools)) return c.json({ error: "tools must be an array" }, 400);
  await getStore(c.env).updateCells(rowId, { video_tools: JSON.stringify(body.tools) });
  await bustBoardCache(c.env);
  return c.json({ ok: true });
});

app.post("/api/link-preview", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { row_id?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const rowId = (body.row_id ?? "").trim();
  if (!rowId) return c.json({ error: "row_id is required" }, 400);

  const allRows = await cachedReadRows(c.env);
  const target = allRows.find((r) => ((r.row_id as string) || "").trim() === rowId);
  if (!target) return c.json({ error: "row not found" }, 404);
  const title = ((target.video_title as string) ?? "").trim();
  
  let tools: any[] = [];
  try {
    const toolsStr = target.video_tools as string;
    if (toolsStr) tools = JSON.parse(toolsStr);
  } catch (e) {
    tools = [];
  }
  if (!tools || tools.length === 0) return c.json({ error: "no_tools", message: "Select at least one tool for this video, then preview." }, 422);

  const affiliates = await cachedAffiliates(c.env);
  const resolved = resolveSelection(tools, affiliates);
  
  let videoCode = (target.video_code as string)?.trim();
  if (!videoCode) {
    // Reserve a real short-code NOW so the preview (and any copied description)
    // shows the FINAL links, not a "(new)" placeholder that would break if pasted.
    // This only creates the videos-table id + stores the code on the card — the
    // redirects (KV), the links rows, and the description write all still wait
    // for Confirm & Save. So no money-affecting artifact is created here.
    videoCode = generateVideoCode(await clickstore.existingCodes(c.env.DB));
    await clickstore.insertVideo(c.env.DB, videoCode, title);
    await getStore(c.env).updateCells(rowId, { video_code: videoCode });
    await bustBoardCache(c.env);
  }

  const items = buildPlan(resolved, videoCode, c.env.LINK_DOMAIN);
  const description = renderDescription(title, items);
  try {
    validateDescription(description, items, c.env.LINK_DOMAIN);
  } catch (err: any) {
    return c.json({ error: "validation", message: err.message }, 500);
  }

  const warnings = externalCollisions(tools, affiliates);
  const blocked = items.filter(i => i.status === "blocked");
  const hash = await planHash(videoCode, items);

  return c.json({ video_code: videoCode, items, description, warnings, blocked, plan_hash: hash });
});

app.post("/api/link-confirm", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { row_id?: string, plan_hash?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const rowId = (body.row_id ?? "").trim();
  const planHashInput = body.plan_hash ?? "";

  const allRows = await cachedReadRows(c.env);
  const target = allRows.find((r) => ((r.row_id as string) || "").trim() === rowId);
  if (!target) return c.json({ error: "row not found" }, 404);
  const title = ((target.video_title as string) ?? "").trim();
  
  let tools: any[] = [];
  try { tools = JSON.parse((target.video_tools as string) || "[]"); } catch (e) { tools = []; }
  
  const affiliates = await cachedAffiliates(c.env);
  const resolved = resolveSelection(tools, affiliates);
  
  let previewVideoCode = (target.video_code as string)?.trim();
  if (!previewVideoCode) {
    previewVideoCode = "(new)";
  }
  const previewItems = buildPlan(resolved, previewVideoCode, c.env.LINK_DOMAIN);
  const hash = await planHash(previewVideoCode, previewItems);
  
  if (hash !== planHashInput) {
    return c.json({ error: "stale", message: "The affiliate sheet changed since you previewed. Re-open the review." }, 409);
  }

  const db = c.env.DB;
  let finalVideoCode = previewVideoCode;
  const codeUpdates: any = {};
  
  if (finalVideoCode === "(new)") {
    finalVideoCode = generateVideoCode(await clickstore.existingCodes(db));
    await clickstore.insertVideo(db, finalVideoCode, title);
    codeUpdates.video_code = finalVideoCode;
  } else if (!((target.video_code as string)?.trim())) {
    codeUpdates.video_code = finalVideoCode;
  }

  const finalItems = buildPlan(resolved, finalVideoCode, c.env.LINK_DOMAIN);
  const description = renderDescription(title, finalItems);
  validateDescription(description, finalItems, c.env.LINK_DOMAIN);

  const existing = await clickstore.existingSlugs(db, finalVideoCode);
  for (const i of finalItems.filter(x => x.status !== "blocked")) {
    const fullSlug = `${finalVideoCode}/${i.slug}`;
    if (!existing.has(fullSlug)) {
      await clickstore.insertLink(db, fullSlug, finalVideoCode, i.slug, i.target_url, i.status === "affiliate" ? "affiliate" : "external");
      await c.env.CLICKS_KV.put(fullSlug, i.target_url);
    }
  }

  const actualItems: [string, string, boolean][] = finalItems
    .filter(i => i.status !== "blocked")
    .map(i => [i.slug, i.target_url, i.status === "affiliate"]);
  const shortPairs: [string, string][] = finalItems
    .filter(i => i.status !== "blocked")
    .map(i => [i.slug, i.short_url]);

  const actual_links = actualItems
    .map(([tool, url, hasAff]) => (hasAff ? `${tool}: ${url}` : `${tool}: ${url} (no affiliate)`))
    .join("\n");
  const short_links = shortPairs
    .map(([tool, url]) => `${tool}: ${url}`)
    .join("\n");

  await getStore(c.env).updateCells(rowId, {
    ...codeUpdates,
    video_description: description,
    actual_links,
    short_links
  });
  await bustBoardCache(c.env);

  return c.json({ ok: true, video_code: finalVideoCode, items: finalItems, description });
});

// GET /api/programs -> the whole catalogue plus the vocabularies the UI renders
app.get("/api/programs", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const programs = await listPrograms(c.env.TRACKER_DB);
  return c.json({
    programs,
    vocab: {
      kinds: KINDS, networks: NETWORKS,
      approvalStatuses: APPROVAL_STATUSES, couponStatuses: COUPON_STATUSES,
    },
  });
});

app.get("/api/link-health", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const [latest, programs] = await Promise.all([
    c.env.TRACKER_DB.prepare("SELECT ran_at, kind, checked, ok_count, issue_count, unverifiable, issues_json, notified FROM link_checks ORDER BY ran_at DESC LIMIT 1").first<CheckRow>(),
    listPrograms(c.env.TRACKER_DB),
  ]);
  return c.json({ latest: latest ?? null, programs });
});

app.post("/api/link-health/recheck", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { slug?: string } = {};
  try { body = await c.req.json(); } catch { /* empty body rechecks structural state */ }
  const structural = await runStructural(c.env, "manual");
  const chain = body.slug?.trim() ? await runChainProbe(c.env, body.slug.trim(), "manual") : [];
  return c.json({ ok: true, issues: [...structural, ...chain] });
});

// GET /api/links -> every minted link, with analytics and last program check.
// Read-only: clicks is written solely by the redirector Worker.
app.get("/api/links", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const [links, counts, rows, programs, dbTitles] = await Promise.all([
    clickstore.allLinks(c.env.DB),
    clickstore.clickCounts(c.env.DB),
    cachedReadRows(c.env),
    listPrograms(c.env.TRACKER_DB),
    clickstore.videoTitles(c.env.DB),
  ]);
  // The videos table is the base layer — it has a title for every code. A tracker
  // card, when one exists, wins because its title is the one being edited. Only 2
  // of 76 cards carry a video_code, so without the base layer 85 of 87 groups
  // rendered as "Untitled video" and looked like deletable test rows.
  const titleByCode: Record<string, string> = { ...dbTitles };
  for (const r of rows as Record<string, unknown>[]) {
    const code = ((r.video_code as string) ?? "").trim();
    const title = ((r.video_title as string) ?? "").trim();
    if (code && title) titleByCode[code] = title;
  }
  const bySlug: Record<string, (typeof programs)[number]> = {};
  for (const p of programs) bySlug[p.slug] = p;
  return c.json({
    links: links.map((l) => ({
      ...l,
      clicks: counts[l.slug] ?? 0,
      video_title: titleByCode[l.video_code] ?? "",
      last_status: bySlug[l.tool]?.last_status ?? null,
      last_final_url: bySlug[l.tool]?.last_final_url ?? null,
      last_checked_at: bySlug[l.tool]?.last_checked_at ?? null,
    })),
  });
});

// POST /api/programs/validate -> what the Add/Edit form calls as you type.
app.post("/api/programs/validate", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { target_url?: string; kind?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const kind = body.kind === "external" ? "external" : "affiliate";
  const validation = validateTargetUrl(body.target_url ?? "", kind);
  return c.json({
    ok: validation.ok,
    value: validation.value ?? "",
    error: validation.error ?? null,
    warnings: validation.ok && validation.value ? creditWarnings(validation.value, kind) : [],
  });
});

// POST /api/programs -> create or update (the Edit path uses the same route)
app.post("/api/programs", async (c) => {
  const { roles, email } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: Partial<ProgramInput> & { name?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }

  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "invalid", message: "Name is required." }, 400);
  const slug = toSlug(body.slug ?? name);
  if (!slug) return c.json({ error: "invalid", message: "Could not build a slug from that name." }, 400);

  const kind = body.kind === "external" ? "external" : "affiliate";
  const validation = validateTargetUrl(body.target_url ?? "", kind);
  if (!validation.ok) return c.json({ error: "invalid", message: validation.error }, 400);

  const pick = <T extends readonly string[]>(vals: T, value: unknown, fallback: T[number]) =>
    (typeof value === "string" && (vals as readonly string[]).includes(value)) ? value as T[number] : fallback;

  await upsertProgram(c.env.TRACKER_DB, {
    slug, name, kind,
    target_url: validation.value ?? "",
    network: pick(NETWORKS, body.network, "other"),
    approval_status: pick(APPROVAL_STATUSES, body.approval_status, "unknown"),
    coupon_status: pick(COUPON_STATUSES, body.coupon_status, "unknown"),
    coupon_code: (body.coupon_code ?? "").trim(),
    coupon_url: (body.coupon_url ?? "").trim(),
    coupon_terms: (body.coupon_terms ?? "").trim(),
    dashboard_url: (body.dashboard_url ?? "").trim(),
    dashboard_credentials: (body.dashboard_credentials ?? "").trim(),
    notes: (body.notes ?? "").trim(),
    probe_enabled: body.probe_enabled === 0 ? 0 : 1,
  }, email ?? "");

  const saved = await getProgram(c.env.TRACKER_DB, slug);
  return c.json({
    ok: true, program: saved,
    warnings: saved?.target_url ? creditWarnings(saved.target_url, kind) : [],
  });
});

// DELETE /api/programs/:slug
app.delete("/api/programs/:slug", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  await deleteProgram(c.env.TRACKER_DB, c.req.param("slug"));
  return c.json({ ok: true });
});

// POST /api/programs/import-from-sheet -> the one-time migration, re-runnable.
app.post("/api/programs/import-from-sheet", async (c) => {
  const { roles, email } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const sheet = await readSheetForImport(token, c.env.AFFILIATE_PROGRAMS_SHEET_URL);
  const allRows = await cachedReadRows(c.env);
  const external = harvestExternalTools(allRows as { row_id?: string; video_tools?: unknown }[]);

  const updatedBy = email ?? "import";
  for (const program of sheet.programs) await upsertProgram(c.env.TRACKER_DB, program, updatedBy);
  for (const program of external.programs) {
    // Never let a harvested external tool clobber a real affiliate programme.
    const existing = await getProgram(c.env.TRACKER_DB, program.slug);
    if (existing) continue;
    await upsertProgram(c.env.TRACKER_DB, program, updatedBy);
  }
  return c.json({
    ok: true,
    imported: { affiliate: sheet.programs.length, external: external.programs.length },
    issues: [...sheet.issues, ...external.issues],
    droppedCells: sheet.droppedCells,
  });
});

app.get("/api/link-drift", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  
  const allRows = await cachedReadRows(c.env);
  const affiliates = await cachedAffiliates(c.env);
  
  const drift = [];
  const db = c.env.DB;
  for (const row of allRows) {
    const code = (row.video_code as string)?.trim();
    if (!code) continue;
    const links = await clickstore.linksForVideo(db, code);
    if (!links.length) continue;
    const rowDrift = clickstore.linkDriftDiff(links, affiliates);
    for (const d of rowDrift) {
      drift.push({ ...d, row_id: row.row_id, video_title: row.video_title });
    }
  }
  
  return c.json({ drift });
});

app.post("/api/link-resync", async (c) => {
  const { roles } = getUser(c);
  if (!isAdminRoles(roles)) return c.json({ error: "forbidden" }, 403);
  let body: { slug?: string; target_url?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "invalid JSON body" }, 400); }
  const slug = (body.slug ?? "").trim();
  if (!slug) return c.json({ error: "slug is required" }, 400);

  const db = c.env.DB;
  const linkRow = await db.prepare("SELECT tool FROM links WHERE slug = ?").bind(slug).first<{tool: string}>();
  if (!linkRow) return c.json({ error: "link not found" }, 404);
  
  const affiliates = await cachedAffiliates(c.env);
  const rec = affiliates[linkRow.tool];
  const requestedUrl = body.target_url?.trim();
  if (!requestedUrl && (!rec || !rec.isApproved || !rec.targetUrl.trim())) {
    return c.json({ error: "conflict", message: "Program is not approved or has no URL in the catalogue." }, 409);
  }
  
  // This path writes KV directly, bypassing resolveSelection, so it needs the
  // same validation — otherwise a bad sheet cell can still reach the redirector.
  const norm = normalizeTargetUrl(requestedUrl || rec!.targetUrl);
  if (!norm) {
    return c.json({ error: "conflict", message: "The new destination is not a usable URL." }, 409);
  }
  const url = norm.url;
  await clickstore.updateLinkTarget(db, slug, url);
  await c.env.CLICKS_KV.put(slug, url);

  return c.json({ ok: true, slug, target_url: url, warnings: creditWarnings(url, "affiliate", norm.repaired) });
});

// ---------------------------------------------------------------------------
// SPA catch-all
// ---------------------------------------------------------------------------

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

Object.assign(app, {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // One cron drives all three passes (Workers Free allows 5 per ACCOUNT and three
    // are already spent). Branch on the scheduled date, never on wall-clock now:
    // a retried or delayed invocation must make the same decision.
    const when = new Date(event.scheduledTime);
    ctx.waitUntil(runStructural(env));
    if (when.getUTCDay() === 0) ctx.waitUntil(runChainProbe(env));
    if (when.getUTCDate() === 1) ctx.waitUntil(runUnverifiableDigest(env));
  },
});

export default app;
