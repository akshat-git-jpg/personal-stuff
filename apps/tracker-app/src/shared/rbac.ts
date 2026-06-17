import type { Column } from "./columns";
import { COLUMNS } from "./columns";
import { POLICY, APPROVER_ROLES, APPROVER_ONLY_VALUES, STAGE_OF_COL } from "./policy";
import {
  STAGES, stageByStatusCol, statusOf, isGateOpen, missingRequired,
  ADMIN_ROLE, REVIEWER_ROLE, type StageDef,
} from "./pipeline";

export type Row = Partial<Record<Column, string>>;

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

// ---------------------------------------------------------------------------
// Single-role helpers (kept for back-compat + direct use)
// ---------------------------------------------------------------------------

export function visibleColumns(role: string): Column[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.all) return [...COLUMNS];
  const acc = p.access ?? {};
  // row_id is always included for addressing/updates (UI hides it from display).
  return COLUMNS.filter(c => c === "row_id" || acc[c] !== undefined);
}

export function canEdit(role: string, col: Column): boolean {
  const p = POLICY[role]; if (!p) return false;
  if (p.all) return true;
  return (p.access?.[col]) === "edit";
}

export function filterRows(role: string, email: string, rows: Row[]): Row[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.rows === "all") return rows;
  const col = p.rows.match;
  const gate = p.rows.gate;
  const want = norm(email);
  return rows.filter(r => {
    if (norm(r[col]) !== want) return false;
    if (gate && (r[gate.col] || "").trim() !== gate.equals) return false;
    return true;
  });
}

export function projectRow(role: string, row: Row): Row {
  const out: Row = {};
  for (const c of visibleColumns(role)) out[c] = row[c];
  return out;
}

export function stageRows(role: string, rows: Row[]): Row[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.rows === "all") return rows;
  const col = p.rows.match; const gate = p.rows.gate;
  return rows.filter(r => {
    if (!(r[col] || "").trim()) return false;
    if (gate && (r[gate.col] || "").trim() !== gate.equals) return false;
    return true;
  });
}

export function peopleFor(role: string, rows: Row[]): string[] {
  const p = POLICY[role]; if (!p || p.rows === "all") return [];
  const col = p.rows.match;
  const set = new Set<string>();
  for (const r of rows) { const v = (r[col] || "").trim(); if (v) set.add(v); }
  return [...set].sort();
}

export function isApprover(role: string): boolean {
  return APPROVER_ROLES.has(role);
}

export function canSetValue(role: string, col: Column, value: string): boolean {
  if (!canEdit(role, col)) return false;
  const restricted = APPROVER_ONLY_VALUES[col];
  if (restricted && restricted.includes(value) && !isApprover(role)) return false;
  return true;
}

export function isRowLockedFor(role: string, row: Row): boolean {
  if (isApprover(role)) return false;
  const p = POLICY[role]; if (!p) return true;
  const owned = p.laneStatus;
  return (row[owned] || "").trim() === "Done";
}

// ---------------------------------------------------------------------------
// Multi-role union helpers
// ---------------------------------------------------------------------------

export function visibleColumnsForRoles(roles: string[]): Column[] {
  const visible = new Set<Column>();
  for (const role of roles) for (const col of visibleColumns(role)) visible.add(col);
  return COLUMNS.filter(c => visible.has(c));
}

export function canEditForRoles(roles: string[], col: Column): boolean {
  return roles.some(r => canEdit(r, col));
}

export function canSetValueForRoles(roles: string[], col: Column, value: string): boolean {
  return roles.some(r => canSetValue(r, col, value));
}

export function isApproverRoles(roles: string[]): boolean {
  return roles.some(r => isApprover(r));
}

export function isAdminRoles(roles: string[]): boolean {
  return roles.includes(ADMIN_ROLE);
}

export function filterRowsForRoles(roles: string[], email: string, rows: Row[]): Row[] {
  if (roles.some(r => POLICY[r]?.rows === "all")) return rows;
  const seen = new Set<string>();
  const result: Row[] = [];
  for (const role of roles) {
    for (const row of filterRows(role, email, rows)) {
      const id = (row.row_id || "").trim();
      const key = id || JSON.stringify(row);
      if (!seen.has(key)) { seen.add(key); result.push(row); }
    }
  }
  return result;
}

export function projectRowForRoles(roles: string[], row: Row): Row {
  const out: Row = {};
  for (const c of visibleColumnsForRoles(roles)) out[c] = row[c];
  return out;
}

/**
 * The stages this user gets a "My work" board for — one per stage whose owner
 * role they hold, in pipeline order. Stage-centric (not role-centric) so the
 * Admin gets the Topic board (Admin owns Topic) alongside any other role they
 * hold (e.g. Uploader). Reviewer owns no stage, so a pure Reviewer gets none.
 */
export function workerStagesForRoles(roles: string[]): { statusCol: Column; role: string }[] {
  const seen = new Set<Column>();
  const result: { statusCol: Column; role: string }[] = [];
  for (const stage of STAGES) {
    if (!roles.includes(stage.ownerRole) || seen.has(stage.statusCol)) continue;
    seen.add(stage.statusCol);
    result.push({ statusCol: stage.statusCol, role: stage.ownerRole });
  }
  return result;
}

// ===========================================================================
// Card-aware authority (the real enforcement layer)
//
// Approving / sending back a card is NOT a pure role check — it depends on who
// is the card's assigned reviewer. These functions take the row + email and are
// the single source of truth the worker enforces and the client renders from.
// ===========================================================================

/** Does this user own (work) a given stage on a given card? */
export function ownsStage(roles: string[], email: string, stage: StageDef, row: Row): boolean {
  if (!roles.includes(stage.ownerRole)) return false;
  return norm(row[stage.assigneeCol]) === norm(email);
}

/**
 * Can this user review (approve / send back) a given stage on a given card?
 * Reviewing is NOT an Admin power — it must be granted explicitly. The user must
 * hold the Reviewer role AND be the card's assigned reviewer, the stage must be
 * reviewable, and you can NEVER review work you submitted yourself. (An Admin who
 * also holds Reviewer and is the assigned reviewer qualifies like anyone else.)
 */
export function canReview(roles: string[], email: string, stage: StageDef, row: Row): boolean {
  if (!stage.reviewable) return false;
  if (!roles.includes(REVIEWER_ROLE)) return false;
  if (norm(row.reviewer_email) !== norm(email)) return false;
  // Can't review your own work — EXCEPT the admin-owned Topic stage, where the
  // owner (admin) and the reviewer can legitimately be the same person.
  if (stage.ownerRole !== ADMIN_ROLE && norm(row[stage.assigneeCol]) === norm(email)) return false;
  return true;
}

export interface Transition {
  stageId: string;
  statusCol: Column;
  to: string;
  label: string;
  kind: "start" | "submit" | "approve" | "reject" | "advance" | "reopen";
  // Who performs this transition. The doer drives a stage's work; the reviewer
  // approves/sends back. A person who is both sees each set only in its own
  // context (My work = doer, Review queue = reviewer).
  by: "doer" | "reviewer";
  requiresFeedback?: boolean;
  // Set when the transition is allowed by role but blocked by an unmet
  // prerequisite (e.g. required fields not filled). The UI shows the button
  // disabled with this reason; the server rejects the write with it too.
  disabledReason?: string;
}

/** Allowed status transitions for ONE stage of a card, for this user. */
export function transitionsForStage(roles: string[], email: string, stage: StageDef, row: Row): Transition[] {
  const out: Transition[] = [];
  const status = statusOf(stage, row);
  const admin = isAdminRoles(roles);
  const owner = admin || ownsStage(roles, email, stage, row);
  const reviewer = canReview(roles, email, stage, row);
  const gateOpen = isGateOpen(stage, row);
  const doer = { stageId: stage.id, statusCol: stage.statusCol, by: "doer" as const };
  const rev = { stageId: stage.id, statusCol: stage.statusCol, by: "reviewer" as const };

  // Submitting / completing a stage is blocked until its required fields are filled.
  const missing = missingRequired(stage, row);
  const blockReason = missing.length ? `Add the ${missing.map((f) => f.label).join(", ")} first.` : undefined;

  if (stage.reviewable) {
    if (owner && gateOpen) {
      if (status === "To Do") out.push({ ...doer, to: "In Progress", label: "Start", kind: "start" });
      if (status === "In Progress") out.push({ ...doer, to: "In Review", label: "Submit for review", kind: "submit", disabledReason: blockReason });
      if (status === "Need Changes") {
        out.push({ ...doer, to: "In Progress", label: "Resume editing", kind: "start" });
        out.push({ ...doer, to: "In Review", label: "Resubmit for review", kind: "submit", disabledReason: blockReason });
      }
    }
    if (reviewer) {
      // A stage with no feedback column is approve-only — the reviewer can mark it
      // Done but never send it back (e.g. Topic).
      const canSendBack = !!stage.feedbackCol;
      if (status === "In Review") {
        out.push({ ...rev, to: "Done", label: "Approve", kind: "approve" });
        if (canSendBack) out.push({ ...rev, to: "Need Changes", label: "Request changes", kind: "reject", requiresFeedback: true });
      }
      if (status === "Done" && canSendBack) out.push({ ...rev, to: "Need Changes", label: "Reopen (request changes)", kind: "reopen", requiresFeedback: true });
    }
  } else {
    // Terminal upload stage — no review.
    if (owner && gateOpen) {
      if (status === "To Do") out.push({ ...doer, to: "In Progress", label: "Start upload", kind: "start" });
      if (status === "In Progress") out.push({ ...doer, to: "Uploaded", label: "Mark uploaded", kind: "advance", disabledReason: blockReason });
    }
  }
  return out;
}

/** Every stage of a card this user participates in, with their allowed transitions. */
export function transitionsForCard(roles: string[], email: string, row: Row) {
  return STAGES
    .map((s) => ({ stage: s, transitions: transitionsForStage(roles, email, s, row) }))
    .filter((x) => x.transitions.length > 0)
    .map((x) => ({ stageId: x.stage.id, statusCol: x.stage.statusCol, transitions: x.transitions }));
}

/**
 * Which stages does this card belong to in THIS user's "My work" lanes?
 * For each stage whose owner role the user holds and whose gate is open:
 *  • the Admin-owned Topic stage is shown wholesale (no per-card assignee match —
 *    the admin owns every topic);
 *  • every other stage shows only the cards assigned to this user.
 * (Admin oversight of all cards lives in the Board/Pipeline tabs, not here.)
 */
export function cardStagesForUser(roles: string[], email: string, row: Row): string[] {
  const out = new Set<string>();
  for (const s of STAGES) {
    if (!roles.includes(s.ownerRole) || !isGateOpen(s, row)) continue;
    if (s.ownerRole !== ADMIN_ROLE && norm(row[s.assigneeCol]) !== norm(email)) continue;
    out.add(s.statusCol);
  }
  return [...out];
}

/** Cards (reviewable stages) currently awaiting THIS user's review. */
export function reviewQueueForUser(roles: string[], email: string, rows: Row[]) {
  const items: { row: Row; stage: StageDef; submittedBy: string }[] = [];
  for (const row of rows) {
    for (const s of STAGES) {
      if (!s.reviewable) continue;
      if (statusOf(s, row) !== "In Review") continue;
      if (!canReview(roles, email, s, row)) continue;
      items.push({ row, stage: s, submittedBy: row[s.assigneeCol] || "" });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Field-level edit authority + locks (card + stage + user aware)
// ---------------------------------------------------------------------------

export interface WriteCheck { ok: boolean; reason?: string }

/**
 * THE single server-side authorization for any cell write. The worker calls this
 * and nothing else. Returns ok + a human-readable reason when denied (surfaced
 * in the UI as the lock tooltip).
 */
export function authorizeWrite(roles: string[], email: string, col: Column, value: string, row: Row): WriteCheck {
  const admin = isAdminRoles(roles);

  // 1) Status columns — must be an allowed transition for this user/card, and any
  //    prerequisite (required fields) must be met.
  const statusStage = stageByStatusCol(col);
  if (statusStage) {
    const t = transitionsForStage(roles, email, statusStage, row).find((x) => x.to === value);
    if (!t) return { ok: false, reason: deniedStatusReason(roles, email, statusStage, row, value) };
    if (t.disabledReason) return { ok: false, reason: t.disabledReason };
    return { ok: true };
  }

  // 2) Feedback columns — only the card's reviewer (or admin) writes send-back notes.
  const fbStage = STAGES.find((s) => s.feedbackCol === col);
  if (fbStage) {
    if (admin || canReview(roles, email, fbStage, row)) return { ok: true };
    return { ok: false, reason: "Only the reviewer can write review feedback." };
  }

  // 3) Content edit-fields — only the stage owner, while the stage is open.
  const governing = STAGE_OF_COL[col];
  if (governing) {
    const stage = stageByStatusCol(governing)!;
    if (admin) return { ok: true };
    if (!ownsStage(roles, email, stage, row)) return { ok: false, reason: `Only the assigned ${stage.ownerRole} can edit this.` };
    if (!isGateOpen(stage, row)) return { ok: false, reason: "The previous stage isn't approved yet." };
    const status = statusOf(stage, row);
    if (status === "In Review") return { ok: false, reason: "Locked — submitted for review." };
    if (status === "Done") return { ok: false, reason: "Locked — approved." };
    if (!canEditForRoles(roles, col)) return { ok: false, reason: "You don't have edit access to this field." };
    return { ok: true };
  }

  // 4) Assignees, instructions, reviewer_email, etc. Admin can always edit these;
  //    the card's assigned reviewer can edit the fields their role grants (so they
  //    can route work — set the downstream freelancers + write their instructions).
  if (admin) return { ok: true };
  const isCardReviewer = roles.includes(REVIEWER_ROLE) && norm(row.reviewer_email) === norm(email);
  if (isCardReviewer && canEditForRoles(roles, col)) return { ok: true };
  return { ok: false, reason: "Only an admin or the card's reviewer can edit this." };
}

function deniedStatusReason(roles: string[], email: string, stage: StageDef, row: Row, value: string): string {
  if (APPROVER_ONLY_VALUES[stage.statusCol]?.includes(value)) {
    return "Only the reviewer can approve or request changes.";
  }
  if (!isGateOpen(stage, row)) return "The previous stage isn't approved yet.";
  if (!ownsStage(roles, email, stage, row) && !isAdminRoles(roles)) {
    return `Only the assigned ${stage.ownerRole} can change this.`;
  }
  return "That status change isn't allowed from here.";
}

/**
 * Is a content field locked for this user on this card, and why?
 * (For rendering inputs as disabled-with-reason.) Returns null when editable.
 */
export function fieldLockReason(roles: string[], email: string, col: Column, row: Row): string | null {
  // Reuse the write authorization, ignoring the specific value (status cols are
  // handled via transitions/buttons, not free inputs).
  const check = authorizeWrite(roles, email, col, "", row);
  return check.ok ? null : (check.reason || "Locked.");
}
