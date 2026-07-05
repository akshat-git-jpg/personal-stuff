// ===========================================================================
// RBAC ENGINE — card-aware authority, pipeline-aware. Port of the legacy
// rbac.ts, but it resolves each card's pipeline (from row.pipeline) and reads
// per-pipeline derivations (derive.ts) + the convention control grid
// (control.ts). Same enforcement semantics, now generic across systems.
//
// The board response carries per-row _stages/_actions/_locks computed here, so
// the client never re-derives permissions — one rendering path for everyone,
// including admin "view as".
// ===========================================================================
import type { PipelineDef, StageDef } from "./types";
import { colOf, stageHasReviewerSlot, stageKind, stageHasEta, stageHasInstruction, workField } from "./types";
import { getPipeline, PIPELINES, ADMIN_ROLE, REVIEWER_ROLE } from "./registry";
import { effectiveRoles, unionRoles, type Memberships } from "./memberships";
import { lifecycle } from "./lifecycle";
import {
  derive, statusOf, isGateOpen, stageHasReviewer, type Access,
} from "./derive";
import {
  requiredToSubmitFrom, requiredToApprove,
} from "./control";
import { fieldLabelOf } from "./labels";

export type Row = Record<string, string | undefined>;

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

/** Resolve the pipeline a card runs on (defaults to standard for legacy rows). */
export function pipeOf(row: Row): PipelineDef {
  return getPipeline(row.pipeline);
}

// --- column access per role (derived per pipeline) -------------------------

function reviewerAccess(p: PipelineDef): Partial<Record<string, Access>> {
  const acc: Partial<Record<string, Access>> = {
    video_title: "view", video_notes: "view", video_description: "view",
    category: "view", subcategory: "view",
  };
  for (const s of p.stages) {
    acc[colOf(s, "status")] = "edit";                          // approve / send back
    acc[colOf(s, "assignee")] = "view";
    if (stageHasReviewerSlot(s)) acc[colOf(s, "reviewer")] = "view";
    if (stageHasInstruction(s)) acc[colOf(s, "instruction")] = "edit"; // route work
    if (s.lifecycle === "review") acc[colOf(s, "feedback")] = "edit";  // send-back note
    if (workField(s)) acc[colOf(s, "work_link")] = "view";
    if (stageHasEta(s)) acc[colOf(s, "eta")] = "view";
  }
  return acc;
}

/** Columns these roles can SEE on a card of pipeline `p`. */
export function visibleColsForRoles(roles: string[], p: PipelineDef): string[] {
  if (roles.includes(ADMIN_ROLE)) return [...derive(p).allCols];
  const d = derive(p);
  const visible = new Set<string>();
  for (const role of roles) {
    if (role === REVIEWER_ROLE) { for (const c of Object.keys(reviewerAccess(p))) visible.add(c); continue; }
    const acc = d.roleAccess[role];
    if (acc) for (const c of Object.keys(acc)) visible.add(c);
  }
  return d.allCols.filter((c) => visible.has(c));
}

function accessFor(roles: string[], p: PipelineDef, col: string): Access | undefined {
  if (roles.includes(ADMIN_ROLE)) return "edit";
  let best: Access | undefined;
  const d = derive(p);
  for (const role of roles) {
    const acc = role === REVIEWER_ROLE ? reviewerAccess(p) : d.roleAccess[role];
    const a = acc?.[col];
    if (a === "edit") return "edit";
    if (a === "view") best = "view";
  }
  return best;
}
export function canEditForRoles(roles: string[], p: PipelineDef, col: string): boolean {
  return accessFor(roles, p, col) === "edit";
}

// --- role kind helpers -----------------------------------------------------

export function isAdminRoles(roles: string[]): boolean { return roles.includes(ADMIN_ROLE); }
export function isApproverRoles(roles: string[]): boolean {
  return roles.includes(ADMIN_ROLE) || roles.includes(REVIEWER_ROLE);
}
export function isApprover(role: string): boolean { return role === ADMIN_ROLE || role === REVIEWER_ROLE; }

// --- multi-pipeline aggregates (the worker's no-row, cross-system helpers) --

/** Across ALL pipelines, the work-stage lanes a user owns (their "My work"). */
export function workerStagesForRoles(roles: string[]): { pipelineId: string; stageId: string; statusCol: string; role: string; label: string }[] {
  const out: { pipelineId: string; stageId: string; statusCol: string; role: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const p of Object.values(PIPELINES)) {
    for (const s of p.stages) {
      if (!roles.includes(s.role)) continue;
      const key = `${p.id}:${colOf(s, "status")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ pipelineId: p.id, stageId: s.id, statusCol: colOf(s, "status"), role: s.role, label: s.label });
    }
  }
  return out;
}

/** Union of columns visible to these roles across all pipelines (board `columns`). */
export function allVisibleColsForRoles(roles: string[]): string[] {
  const set = new Set<string>();
  for (const p of Object.values(PIPELINES)) for (const c of visibleColsForRoles(roles, p)) set.add(c);
  return [...set];
}

/** Columns a default-set can fill for a pipeline: each stage's doer (except the
 *  fixed brief/admin) + its reviewer, in order. */
export function assignableColsFor(p: PipelineDef): string[] {
  return p.stages.flatMap((s) => [
    ...(stageKind(s) !== "brief" ? [colOf(s, "assignee")] : []),
    ...(stageHasReviewerSlot(s) ? [colOf(s, "reviewer")] : []),
  ]);
}

// --- membership-aware entry points -----------------------------------------
// A user's authority is a set of per-system memberships. Because every check is
// FOR ONE CARD, and a card knows its system, we collapse the memberships into the
// effective roles for that card's system and hand them to the role-based checks
// below — so the core RBAC is unchanged. Reviewer membership in a set of systems
// "just works": a card in a system the user reviews yields Reviewer in its
// effective roles; a card in a system they don't, doesn't.

/** Effective roles for this user on THIS card (its system's roles + cross-system). */
export function effectiveRolesFor(m: Memberships, row: Row): string[] {
  return effectiveRoles(m, pipeOf(row).id);
}

/** Worker lanes ("My work") across every system the user actually works in. */
export function workerStagesForMemberships(m: Memberships) {
  const out: { pipelineId: string; stageId: string; statusCol: string; role: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const p of Object.values(PIPELINES)) {
    const eff = effectiveRoles(m, p.id);
    for (const s of p.stages) {
      if (!eff.includes(s.role)) continue;
      const key = `${p.id}:${colOf(s, "status")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ pipelineId: p.id, stageId: s.id, statusCol: colOf(s, "status"), role: s.role, label: s.label });
    }
  }
  return out;
}

/** Union of columns visible to the user across the systems they belong to. */
export function allVisibleColsForMemberships(m: Memberships): string[] {
  const set = new Set<string>();
  for (const p of Object.values(PIPELINES)) for (const c of visibleColsForRoles(effectiveRoles(m, p.id), p)) set.add(c);
  return [...set];
}

/** Rows the user may see: admins (cross-system) see all; everyone else sees a card
 *  only via their effective roles in that card's system. */
export function filterRowsForMemberships(m: Memberships, email: string, rows: Row[]): Row[] {
  if (unionRoles(m).includes(ADMIN_ROLE)) return rows;
  return rows.filter((r) => canSeeRow(effectiveRolesFor(m, r), email, r));
}

/** Cross-system review queue: scans every card, keeps those In Review the user is
 *  the assigned reviewer for — naturally spanning every system they review. */
export function reviewQueueForMemberships(m: Memberships, email: string, rows: Row[]) {
  const items: { row: Row; stage: StageDef; submittedBy: string }[] = [];
  for (const row of rows) {
    const eff = effectiveRolesFor(m, row);
    const p = pipeOf(row);
    for (const s of p.stages) {
      if (!lifecycle(s.lifecycle).reviewed) continue;
      if (statusOf(s, row) !== "In Review") continue;
      if (!canReview(eff, email, s, row)) continue;
      items.push({ row, stage: s, submittedBy: row[colOf(s, "assignee")] || "" });
    }
  }
  return items;
}

// --- card-aware authority --------------------------------------------------

/** Does this user own (work) a given stage on a given card? */
export function ownsStage(roles: string[], email: string, s: StageDef, row: Row): boolean {
  if (!roles.includes(s.role)) return false;
  return norm(row[colOf(s, "assignee")]) === norm(email);
}

/** Can this user review (approve / send back) this stage on this card?
 *  Must hold Reviewer AND be this stage's assigned reviewer; never your own work
 *  (except the admin-owned brief stage, where owner == reviewer is legitimate). */
export function canReview(roles: string[], email: string, s: StageDef, row: Row): boolean {
  if (!lifecycle(s.lifecycle).reviewed) return false;
  if (!roles.includes(REVIEWER_ROLE)) return false;
  if (!stageHasReviewerSlot(s) || norm(row[colOf(s, "reviewer")]) !== norm(email)) return false;
  if (stageKind(s) !== "brief" && norm(row[colOf(s, "assignee")]) === norm(email)) return false;
  return true;
}

export interface Transition {
  stageId: string;
  statusCol: string;
  to: string;
  label: string;
  kind: "start" | "submit" | "approve" | "reject" | "advance" | "reopen";
  by: "doer" | "reviewer";
  requiresFeedback?: boolean;
  disabledReason?: string;
}

function blockReasonFor(cols: string[], row: Row): string | undefined {
  const missing = cols.filter((c) => !String(row[c] ?? "").trim());
  return missing.length ? `Add the ${missing.map(fieldLabelOf).join(", ")} first.` : undefined;
}

/** Allowed status transitions for ONE stage of a card, for this user. */
export function transitionsForStage(roles: string[], email: string, s: StageDef, row: Row, p = pipeOf(row)): Transition[] {
  const status = statusOf(s, row);
  const admin = isAdminRoles(roles);
  const owner = admin || ownsStage(roles, email, s, row);
  const reviewer = canReview(roles, email, s, row);
  const gateOpen = isGateOpen(p, s, row);
  const lc = lifecycle(s.lifecycle);
  const statusCol = colOf(s, "status");
  // A reviewable stage with NO reviewer assigned auto-completes: submit → Done.
  const autoComplete = lc.reviewed && !stageHasReviewer(s, row);

  const out: Transition[] = [];
  for (const tr of lc.transitions) {
    if (tr.from !== status) continue;
    if (autoComplete) {
      if (tr.kind === "submit" || (status === "In Review" && tr.kind === "approve")) {
        if (owner && gateOpen) {
          out.push({
            stageId: s.id, statusCol, to: lc.done,
            label: tr.kind === "submit" ? "Submit & complete" : "Complete",
            kind: "advance", by: "doer", disabledReason: blockReasonFor(requiredToSubmitFrom(p, s, status), row),
          });
        }
        continue;
      }
      if (tr.by === "reviewer") continue;
    }
    if (tr.by === "doer" ? !(owner && gateOpen) : !reviewer) continue;
    const disabledReason =
      tr.gate === "submit" || tr.gate === "start" ? blockReasonFor(requiredToSubmitFrom(p, s, status), row)
      : tr.gate === "approve" ? blockReasonFor(requiredToApprove(p, s), row)
      : undefined;
    out.push({
      stageId: s.id, statusCol, to: tr.to, label: tr.label,
      kind: tr.kind, by: tr.by, requiresFeedback: tr.needsFeedback, disabledReason,
    });
  }
  return out;
}

export function transitionsForCard(roles: string[], email: string, row: Row) {
  const p = pipeOf(row);
  return p.stages
    .map((s) => ({ stage: s, transitions: transitionsForStage(roles, email, s, row, p) }))
    .filter((x) => x.transitions.length > 0)
    .map((x) => ({ stageId: x.stage.id, statusCol: colOf(x.stage, "status"), transitions: x.transitions }));
}

/** Which stages of this card belong in THIS user's "My work" lanes. */
export function cardStagesForUser(roles: string[], email: string, row: Row): string[] {
  const p = pipeOf(row);
  const out = new Set<string>();
  for (const s of p.stages) {
    if (!roles.includes(s.role) || !isGateOpen(p, s, row)) continue;
    if (stageKind(s) !== "brief" && norm(row[colOf(s, "assignee")]) !== norm(email)) continue;
    out.add(colOf(s, "status"));
  }
  return [...out];
}

/** Stages of this card assigned to the user whose gate is NOT open yet — their
 *  "up next" work. Mirrors cardStagesForUser with the gate check inverted. */
export function upcomingStagesForUser(roles: string[], email: string, row: Row): string[] {
  const p = pipeOf(row);
  const out = new Set<string>();
  for (const s of p.stages) {
    if (!roles.includes(s.role) || isGateOpen(p, s, row)) continue;
    if (stageKind(s) !== "brief" && norm(row[colOf(s, "assignee")]) !== norm(email)) continue;
    if (stageKind(s) === "brief") continue; // a brief stage with a closed gate can't exist (stage 0 has no gate)
    out.add(colOf(s, "status"));
  }
  return [...out];
}

/** Cards (reviewable stages) currently awaiting THIS user's review. */
export function reviewQueueForUser(roles: string[], email: string, rows: Row[]) {
  const items: { row: Row; stage: StageDef; submittedBy: string }[] = [];
  for (const row of rows) {
    const p = pipeOf(row);
    for (const s of p.stages) {
      if (!lifecycle(s.lifecycle).reviewed) continue;
      if (statusOf(s, row) !== "In Review") continue;
      if (!canReview(roles, email, s, row)) continue;
      items.push({ row, stage: s, submittedBy: row[colOf(s, "assignee")] || "" });
    }
  }
  return items;
}

// --- row visibility + projection -------------------------------------------

/** Can this user see this card at all? Admin: yes. Else: owns an assigned stage
 *  (gate open or not) or is an assigned reviewer on any stage. */
export function canSeeRow(roles: string[], email: string, row: Row): boolean {
  if (isAdminRoles(roles)) return true;
  const p = pipeOf(row);
  for (const s of p.stages) {
    if (roles.includes(s.role) && norm(row[colOf(s, "assignee")]) === norm(email)) return true;
    if (roles.includes(REVIEWER_ROLE) && stageHasReviewerSlot(s) && norm(row[colOf(s, "reviewer")]) === norm(email)) return true;
  }
  return false;
}

export function filterRowsForRoles(roles: string[], email: string, rows: Row[]): Row[] {
  if (isAdminRoles(roles)) return rows;
  return rows.filter((r) => canSeeRow(roles, email, r));
}

export function projectRowForRoles(roles: string[], row: Row): Row {
  const p = pipeOf(row);
  const cols = new Set(visibleColsForRoles(roles, p));
  const out: Row = {};
  // row_id + pipeline always pass through for addressing/resolution.
  for (const sys of ["row_id", "pipeline", "last_updated", "status_since"]) if (sys in row) out[sys] = row[sys];
  for (const c of cols) out[c] = row[c];
  return out;
}

// --- field-level write authorization (THE single server check) -------------

export interface WriteCheck { ok: boolean; reason?: string }

export function authorizeWrite(roles: string[], email: string, col: string, value: string, row: Row): WriteCheck {
  const admin = isAdminRoles(roles);
  const p = pipeOf(row);
  const d = derive(p);

  // 1) Status columns — must be an allowed transition + prerequisites met.
  const statusStage = d.byStatusCol.get(col);
  if (statusStage) {
    const t = transitionsForStage(roles, email, statusStage, row, p).find((x) => x.to === value);
    if (!t) return { ok: false, reason: deniedStatusReason(roles, email, statusStage, row, p, value) };
    if (t.disabledReason) return { ok: false, reason: t.disabledReason };
    return { ok: true };
  }

  // 2) Feedback columns — only the stage's reviewer (or admin).
  const fbStage = d.byFeedbackCol.get(col);
  if (fbStage) {
    if (admin || canReview(roles, email, fbStage, row)) return { ok: true };
    return { ok: false, reason: "Only the reviewer can write review feedback." };
  }

  // 3) Content edit-fields — only the stage owner, while the stage is open.
  const governing = d.stageOfCol[col];
  if (governing) {
    const stage = d.byStatusCol.get(governing)!;
    if (admin) return { ok: true };
    if (!ownsStage(roles, email, stage, row)) return { ok: false, reason: `Only the assigned ${stage.role} can edit this.` };
    if (!isGateOpen(p, stage, row)) return { ok: false, reason: "The previous stage isn't approved yet." };
    const status = statusOf(stage, row);
    if (status === "In Review") return { ok: false, reason: "Locked — submitted for review." };
    if (status === lifecycle(stage.lifecycle).done) return { ok: false, reason: "Locked — approved." };
    if (!canEditForRoles(roles, p, col)) return { ok: false, reason: "You don't have edit access to this field." };
    return { ok: true };
  }

  // 4) Assignees, instructions, reviewer cols — admin always; the card's reviewer
  //    can edit fields their role grants (route work + write instructions).
  if (admin) return { ok: true };
  const isCardReviewer = roles.includes(REVIEWER_ROLE)
    && d.reviewerCols.some((rc) => norm(row[rc]) === norm(email));
  if (isCardReviewer && canEditForRoles(roles, p, col)) return { ok: true };
  return { ok: false, reason: "Only an admin or the card's reviewer can edit this." };
}

function deniedStatusReason(roles: string[], email: string, s: StageDef, row: Row, p: PipelineDef, value: string): string {
  if (derive(p).approverOnly[colOf(s, "status")]?.includes(value)) {
    return "Only the reviewer can approve or request changes.";
  }
  if (!isGateOpen(p, s, row)) return "The previous stage isn't approved yet.";
  if (!ownsStage(roles, email, s, row) && !isAdminRoles(roles)) {
    return `Only the assigned ${s.role} can change this.`;
  }
  return "That status change isn't allowed from here.";
}

export function fieldLockReason(roles: string[], email: string, col: string, row: Row): string | null {
  const check = authorizeWrite(roles, email, col, "", row);
  return check.ok ? null : (check.reason || "Locked.");
}
