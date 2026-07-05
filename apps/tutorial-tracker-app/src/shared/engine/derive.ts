// ===========================================================================
// PER-PIPELINE DERIVATIONS — the facts the RBAC engine reads, all computed from
// a PipelineDef (never hand-maintained). Mirrors the old policy.ts, but keyed
// by pipeline so each system gets its own correct lookups. Results are cached
// per pipeline id.
// ===========================================================================
import type { PipelineDef, StageDef } from "./types";
import { colOf, stageHasEta, stageHasInstruction, stageHasReviewerSlot, workField } from "./types";
import { lifecycle } from "./lifecycle";
import { prevStage } from "./registry";

export type Access = "view" | "edit";
type Row = Record<string, string | undefined>;

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

// --- status / gate ---------------------------------------------------------

/** Blank/unknown ALWAYS normalizes to the lifecycle's first status (To Do) —
 *  never to Need Changes. A fresh card can't land in "Requires Fix". */
export function statusOf(s: StageDef, row: Row): string {
  const lc = lifecycle(s.lifecycle);
  const v = (row[colOf(s, "status")] ?? "").trim();
  return (lc.statuses as readonly string[]).includes(v) ? v : lc.statuses[0];
}

export function isStageComplete(s: StageDef, row: Row): boolean {
  return statusOf(s, row) === lifecycle(s.lifecycle).done;
}

/** A stage is reachable once its single upstream gate stage is complete. */
export function isGateOpen(p: PipelineDef, s: StageDef, row: Row): boolean {
  const prev = prevStage(p, s);
  return prev ? isStageComplete(prev, row) : true;
}

/** Does this card have a reviewer assigned for this stage? Blank ⇒ auto-complete. */
export function stageHasReviewer(s: StageDef, row: Row): boolean {
  return stageHasReviewerSlot(s) && norm(row[colOf(s, "reviewer")]) !== "";
}

// --- cached per-pipeline derivations ---------------------------------------

interface Derived {
  /** statusCol -> the values only an approver may set. */
  approverOnly: Record<string, string[]>;
  /** any editable content col -> the stage's status col that governs its lock. */
  stageOfCol: Record<string, string>;
  /** statusCol -> stage. */
  byStatusCol: Map<string, StageDef>;
  /** feedbackCol -> stage. */
  byFeedbackCol: Map<string, StageDef>;
  /** all reviewer-email cols across the pipeline. */
  reviewerCols: string[];
  /** column access per role (producer roles + Reviewer + Admin handled separately). */
  roleAccess: Record<string, Partial<Record<string, Access>>>;
  /** the status col each producer role owns (its lane). */
  laneOf: Record<string, string>;
  /** every column the pipeline touches. */
  allCols: string[];
}

const cache = new Map<string, Derived>();

function editCols(s: StageDef): string[] {
  const out: string[] = [];
  if (workField(s)) out.push(colOf(s, "work_link"));
  if (stageHasEta(s)) out.push(colOf(s, "eta"));
  for (const f of s.extra ?? []) out.push(f.slot ? colOf(s, f.slot) : f.id);
  return out;
}

function producerAccess(s: StageDef): Partial<Record<string, Access>> {
  const acc: Partial<Record<string, Access>> = { video_title: "view" };
  for (const c of editCols(s)) acc[c] = "edit";
  acc[colOf(s, "status")] = "edit";
  if (stageHasInstruction(s)) acc[colOf(s, "instruction")] = "view";
  if (s.lifecycle === "review") acc[colOf(s, "feedback")] = "view"; // reads send-back notes
  for (const c of s.contextFields ?? []) acc[c] = "view";
  return acc;
}

export function derive(p: PipelineDef): Derived {
  const hit = cache.get(p.id);
  if (hit) return hit;

  const approverOnly: Record<string, string[]> = {};
  const stageOfCol: Record<string, string> = {};
  const byStatusCol = new Map<string, StageDef>();
  const byFeedbackCol = new Map<string, StageDef>();
  const reviewerCols: string[] = [];
  const roleAccess: Record<string, Partial<Record<string, Access>>> = {};
  const laneOf: Record<string, string> = {};
  const allCols = new Set<string>(["video_title", "video_notes", "video_description", "category", "subcategory"]);

  for (const s of p.stages) {
    const statusCol = colOf(s, "status");
    byStatusCol.set(statusCol, s);
    allCols.add(statusCol);
    allCols.add(colOf(s, "assignee"));

    // approver-only status values (reviewed stages)
    if (lifecycle(s.lifecycle).reviewed) {
      approverOnly[statusCol] = s.lifecycle === "review" ? ["Done", "Need Changes"] : ["Done"];
    }
    // stageOfCol: each editable content col + the status col itself map to the status col
    for (const c of editCols(s)) { stageOfCol[c] = statusCol; allCols.add(c); }
    stageOfCol[statusCol] = statusCol;

    if (stageHasInstruction(s)) allCols.add(colOf(s, "instruction"));
    if (s.lifecycle === "review") { byFeedbackCol.set(colOf(s, "feedback"), s); allCols.add(colOf(s, "feedback")); }
    if (stageHasReviewerSlot(s)) { reviewerCols.push(colOf(s, "reviewer")); allCols.add(colOf(s, "reviewer")); }
    for (const c of s.briefFields ?? []) allCols.add(c);
    for (const c of s.contextFields ?? []) allCols.add(c);

    // producer column access + lane (Admin/Reviewer handled in rbac directly)
    roleAccess[s.role] = { ...roleAccess[s.role], ...producerAccess(s) };
    if (!(s.role in laneOf)) laneOf[s.role] = statusCol;
  }

  const d: Derived = {
    approverOnly, stageOfCol, byStatusCol, byFeedbackCol, reviewerCols,
    roleAccess, laneOf, allCols: [...allCols],
  };
  cache.set(p.id, d);
  return d;
}
