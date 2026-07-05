import type { Column } from "../shared/columns";
import type { Row, Transition } from "../shared/rbac";

// ── Types ──────────────────────────────────────────────────────────────────

export class UnauthorizedError extends Error {
  constructor() { super("Not authenticated"); this.name = "UnauthorizedError"; }
}
export class ForbiddenError extends Error {
  constructor(message?: string) { super(message || "You don't have permission to do this"); this.name = "ForbiddenError"; }
}
export class ConflictError extends Error {
  constructor() { super("Someone else changed this just now"); this.name = "ConflictError"; }
}

/** Per-stage allowed transitions the server computed for this card + user. */
export interface CardActionGroup {
  stageId: string;
  statusCol: string;
  transitions: Transition[];
}

/** A board row plus the server-computed authority meta. */
export type BoardRow = Row & {
  row_id: string;
  pipeline: string;
  _stages?: string[];                 // status cols this card belongs to (in user's lanes)
  _upcoming?: string[];               // stages assigned but gate closed
  _actions?: CardActionGroup[];       // allowed status transitions, per stage
  _locks?: Record<string, string>;    // editable col -> lock reason (absent = editable)
};

export interface WorkerStage { pipelineId: string; stageId: string; statusCol: string; role: string; label: string }
export interface PipelineSummary { id: string; name: string; stages: { id: string; label: string; role: string }[] }

export interface BoardData {
  roles: string[];
  viewerEmail?: string;
  stages: WorkerStage[];
  pipelines: PipelineSummary[];
  columns: Column[];
  rows: BoardRow[];
  viewingAs: { email: string; roles: string[] } | null;
  readOnly?: boolean;
  notice?: string;
  names?: Record<string, string>;
  memberRoles?: Record<string, string>;   // email -> comma-joined roles, for "Name — Role" labels
  memberships?: Record<string, Record<string, string[]>>; // email -> systemId -> roles, for system-scoped dropdowns
}

export interface TeamMember { name: string; email: string; role: string; roles?: string[]; memberships?: Record<string, string[]>; }
export interface MeData { email: string; roles: string[]; }

export interface ReviewItem {
  row_id: string;
  video_title: string;
  stageId: string;
  stage: string;
  statusCol: string;
  submittedBy: string;
  submittedByName: string;
  row: BoardRow;
}
export interface ReviewQueueData { count: number; items: ReviewItem[]; names?: Record<string, string>; }

// ── Helpers ────────────────────────────────────────────────────────────────

async function throwOnError(res: Response): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) throw new UnauthorizedError();
  let message = "";
  try { message = ((await res.json()) as { message?: string }).message ?? ""; } catch { /* ignore */ }
  if (res.status === 409) throw new ConflictError();
  if (res.status === 403) throw new ForbiddenError(message);
  throw new Error(message || `HTTP ${res.status}`);
}

export function displayName(email: string, names?: Record<string, string>): string {
  if (!email) return "";
  const key = email.trim().toLowerCase();
  if (names && names[key]) return names[key];
  return (email.includes("@") ? email.split("@")[0] : email) || email;
}

/** "Name — Role(s)" for dropdowns, so the role is shown automatically. */
export function personLabel(email: string, names?: Record<string, string>, memberRoles?: Record<string, string>): string {
  const name = displayName(email, names);
  const roles = memberRoles?.[email.trim().toLowerCase()];
  return roles ? `${name} — ${roles}` : name;
}

async function postJSON(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── API wrappers ───────────────────────────────────────────────────────────

export async function getBoard(asUser?: string): Promise<BoardData> {
  const url = asUser ? `/api/board?asUser=${encodeURIComponent(asUser)}` : "/api/board";
  const res = await fetch(url, { credentials: "same-origin" });
  await throwOnError(res);
  return res.json() as Promise<BoardData>;
}

export async function getMe(): Promise<MeData> {
  const res = await fetch("/api/me", { credentials: "same-origin" });
  await throwOnError(res);
  return res.json() as Promise<MeData>;
}

export async function getTeam(): Promise<TeamMember[]> {
  const res = await fetch("/api/team", { credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json() as Promise<TeamMember[]>;
}

/** Valid roles for one system (its doer roles + Reviewer); omit `system` for the full roster. */
export async function getRoleOptions(system?: string): Promise<string[]> {
  const url = system ? `/api/roles?system=${encodeURIComponent(system)}` : "/api/roles";
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json() as Promise<string[]>;
}

/** Replace a teammate's full per-system membership set ({ systemId: roles[] }). */
export async function saveTeamMember(input: { name: string; email: string; memberships: Record<string, string[]> }): Promise<void> {
  await throwOnError(await postJSON("/api/team", input));
}
export async function deleteTeamMember(email: string): Promise<void> {
  await throwOnError(await postJSON("/api/team/delete", { email }));
}

/** Doer cell write — status transition or content edit. `prev` enables optimistic concurrency. */
export async function updateCell(row_id: string, col: Column, value: string, prev?: string): Promise<void> {
  await throwOnError(await postJSON("/api/update", { row_id, col, value, prev }));
}

/** Reviewer action on a reviewable stage. */
export async function review(
  row_id: string,
  stageId: string,
  action: "approve" | "sendback",
  feedback?: string,
): Promise<void> {
  await throwOnError(await postJSON("/api/review", { row_id, stage: stageId, action, feedback }));
}

/**
 * Apply a server-issued transition. Reviewer actions (approve / request-changes)
 * go through /api/review; everything else is a plain status write.
 */
export async function applyTransition(
  row_id: string,
  t: Transition,
  currentStatus: string,
  feedback?: string,
): Promise<void> {
  if (t.kind === "approve") return review(row_id, t.stageId, "approve");
  if (t.kind === "reject" || t.kind === "reopen") return review(row_id, t.stageId, "sendback", feedback);
  return updateCell(row_id, t.statusCol as Column, t.to, currentStatus);
}

export async function getReviewQueue(): Promise<ReviewQueueData> {
  const res = await fetch("/api/review-queue", { credentials: "same-origin" });
  if (!res.ok) return { count: 0, items: [], names: {} };
  return res.json() as Promise<ReviewQueueData>;
}

export async function logout(): Promise<void> {
  const res = await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
  if (!res.ok && res.status !== 302) throw new Error(`Logout failed: ${res.status}`);
}

export async function getAuthMode(): Promise<{ dev: boolean }> {
  const res = await fetch("/api/auth-mode", { credentials: "same-origin" });
  if (!res.ok) return { dev: false };
  return res.json() as Promise<{ dev: boolean }>;
}

// ── Affiliate-link generation ────────────────────────────────────────────────

export interface GeneratedLink {
  tool: string; short_url: string; target_url: string; has_affiliate: boolean; coupon: string;
}
export interface GenerateLinksResult {
  description: string; links: GeneratedLink[]; non_affiliate_tools: string[];
}

// Column-keyed creation payload (fields come from createFieldsOf per pipeline).
export async function createVideo(input: Record<string, string>): Promise<{ row_id: string }> {
  const res = await postJSON("/api/video", input);
  await throwOnError(res);
  return res.json() as Promise<{ row_id: string }>;
}

export async function deleteVideo(row_id: string): Promise<void> {
  await throwOnError(await postJSON("/api/delete", { row_id }));
}

// ── Assignment defaults (admin) ──────────────────────────────────────────────

export interface AssignmentDefaultRow { pipeline_id?: string; category: string; subcategory: string; col: string; email: string; }

export async function getDefaults(pipeline?: string): Promise<AssignmentDefaultRow[]> {
  const url = pipeline ? `/api/defaults?pipeline=${encodeURIComponent(pipeline)}` : "/api/defaults";
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json() as Promise<AssignmentDefaultRow[]>;
}
export async function getDefaultCols(pipeline?: string): Promise<string[]> {
  const url = pipeline ? `/api/defaults/cols?pipeline=${encodeURIComponent(pipeline)}` : "/api/defaults/cols";
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json() as Promise<string[]>;
}
export async function saveDefaults(input: { pipeline: string; category: string; subcategory: string; assignments: Record<string, string> }): Promise<void> {
  await throwOnError(await postJSON("/api/defaults", input));
}
export async function deleteDefault(pipeline: string, category: string, subcategory: string): Promise<void> {
  await throwOnError(await postJSON("/api/defaults/delete", { pipeline, category, subcategory }));
}
export async function applyDefaults(row_id: string): Promise<{ applied: Record<string, string> }> {
  const res = await postJSON("/api/apply-defaults", { row_id });
  await throwOnError(res);
  return res.json() as Promise<{ applied: Record<string, string> }>;
}

export async function generateLinks(row_id: string): Promise<GenerateLinksResult> {
  const res = await postJSON("/api/generate-links", { row_id });
  if (!res.ok) {
    if (res.status === 401) throw new UnauthorizedError();
    let msg = `Couldn't generate links (HTTP ${res.status})`;
    try { const b = (await res.json()) as { message?: string }; if (b?.message) msg = b.message; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<GenerateLinksResult>;
}

export interface CardEvent {
  id: number;
  card_id: string;
  stage_id: string;
  type: string;
  actor: string;
  actorName: string;
  detail: string | null;
  created_at: string;
}

export async function getCardEvents(row_id: string): Promise<{ events: CardEvent[] }> {
  try {
    const res = await fetch(`/api/card-events?row_id=${encodeURIComponent(row_id)}`, { credentials: "same-origin" });
    if (!res.ok) return { events: [] };
    return res.json() as Promise<{ events: CardEvent[] }>;
  } catch {
    return { events: [] };
  }
}
