// ---------------------------------------------------------------------------
// RBAC policy — DERIVED from the pipeline config (pipeline.ts).
//
// Nothing here is hand-maintained per role. POLICY, APPROVER_ONLY_VALUES and
// STAGE_OF_COL are all computed from STAGES so they can never drift from the
// pipeline definition. The `Access` sheet tab is generated from POLICY too
// (see worker/access-sheet.ts), so the human-readable mirror also can't drift.
// ---------------------------------------------------------------------------
import type { Column } from "./columns";
import {
  STAGES, prevStage, ADMIN_ROLE, REVIEWER_ROLE, REVIEWER_COLS,
  type StageDef,
} from "./pipeline";

export type Access = "view" | "edit";
type RowRule = "all" | { match: Column; gate?: { col: Column; equals: string } } | { anyMatch: Column[] };
export interface RolePolicy {
  all?: boolean;                                   // Admin: sees + edits everything
  access?: Partial<Record<Column, Access>>;        // columns not listed = hidden
  rows: RowRule;
  laneStatus: Column;
}

// Approver-TYPE roles (used for "is this person an approver kind of role" and to
// exclude them from the doer stage-switcher). NOTE: actually being allowed to
// approve a specific card additionally requires being that card's assigned
// reviewer (or Admin) — see rbac.ts canReview/transitionsFor.
export const APPROVER_ROLES = new Set([ADMIN_ROLE, REVIEWER_ROLE]);

export { PROTECTED_ADMIN_EMAIL } from "./pipeline";

// --- Derived: which status values only an approver may set ------------------
// On every reviewable stage, "Done" and "Need Changes" are reviewer-only — a
// doer can never approve their own work or mark it as needing changes.
export const APPROVER_ONLY_VALUES: Partial<Record<Column, string[]>> = (() => {
  const out: Partial<Record<Column, string[]>> = {};
  for (const s of STAGES) {
    if (!s.reviewable) continue;
    // Approve-only stages (no feedback column, e.g. Topic) can't be set to Need Changes by anyone.
    out[s.statusCol] = s.feedbackCol ? ["Done", "Need Changes"] : ["Done"];
  }
  return out;
})();

// --- Derived: editable field -> the stage status column that governs its lock -
export const STAGE_OF_COL: Partial<Record<Column, Column>> = (() => {
  const out: Partial<Record<Column, Column>> = {};
  for (const s of STAGES) {
    for (const f of s.editFields) out[f] = s.statusCol;
    out[s.statusCol] = s.statusCol;
  }
  return out;
})();

// --- Derived: per-role column access for a producer role --------------------
function producerAccess(stage: StageDef): Partial<Record<Column, Access>> {
  const acc: Partial<Record<Column, Access>> = {};
  acc.video_title = "view";
  for (const c of stage.viewFields) acc[c] = "view";
  for (const c of stage.editFields) acc[c] = "edit";
  acc[stage.statusCol] = "edit";
  if (stage.instructionCol) acc[stage.instructionCol] = "view";
  if (stage.feedbackCol) acc[stage.feedbackCol] = "view"; // the doer reads send-back notes
  return acc;
}

// --- Derived: the gate for a producer stage ---------------------------------
function producerRows(stage: StageDef): RowRule {
  const prev = prevStage(stage);
  return prev
    ? { match: stage.assigneeCol, gate: { col: prev.statusCol, equals: "Done" } }
    : { match: stage.assigneeCol };
}

// --- Derived: the Reviewer role sees its assigned cards broadly (read-only),
//     and can edit every stage's status + feedback (to approve / send back). ---
function reviewerAccess(): Partial<Record<Column, Access>> {
  const acc: Partial<Record<Column, Access>> = {
    video_title: "view", video_notes: "view", video_description: "view",
    category: "view", subcategory: "view",
    yt_link: "view", short_links: "view", actual_links: "view",
    last_updated: "view",
  };
  for (const s of STAGES) {
    acc[s.assigneeCol] = "view";                 // sees who's assigned (admin does the assigning)
    if (s.reviewerCol) acc[s.reviewerCol] = "view"; // who reviews each stage
    for (const c of s.viewFields) acc[c] ??= "view";
    for (const c of s.editFields) acc[c] = "view";
    if (s.instructionCol) acc[s.instructionCol] = "edit"; // reviewer writes the starting instructions
    if (s.reviewable) {
      acc[s.statusCol] = "edit";                 // approve / send back
      if (s.feedbackCol) acc[s.feedbackCol] = "view"; // feedback is written via Request-changes, read via banner
    } else {
      acc[s.statusCol] = "view";
    }
  }
  return acc;
}

export const POLICY: Record<string, RolePolicy> = (() => {
  const p: Record<string, RolePolicy> = {
    [ADMIN_ROLE]: { all: true, rows: "all", laneStatus: "topic_status" },
    [REVIEWER_ROLE]: {
      access: reviewerAccess(),
      rows: { anyMatch: REVIEWER_COLS }, // sees cards they review on ANY stage
      laneStatus: STAGES[0].statusCol,
    },
  };
  for (const s of STAGES) {
    // A stage owned by an approver role (e.g. Topic → Admin) gets no separate
    // producer policy — the approver's own policy already covers it. Skipping
    // also prevents overwriting Admin's all-access.
    if (s.ownerRole === ADMIN_ROLE || s.ownerRole === REVIEWER_ROLE) continue;
    p[s.ownerRole] = {
      access: producerAccess(s),
      rows: producerRows(s),
      laneStatus: s.statusCol,
    };
  }
  return p;
})();
