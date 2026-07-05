// ===========================================================================
// CONTROL DERIVATION — the show / edit / required grid, computed from a stage
// def + its lifecycle + linear position. This REPLACES the hand-written
// control.ts: instead of spelling out every (stage × status × role) cell, we
// encode the regular pattern once and let every pipeline inherit it.
//
// The pattern (mirrors the old tables):
//   worker, work stage:
//     To Do        → context + ETA; edit ETA            (ETA gates "Start")
//     In Progress  → + work link;   edit link (+extras)  (link gates "Submit")
//     In Review    → read-only
//     Need Changes → like In Progress
//     Done/Uploaded→ minimal, read-only
//   worker, brief stage (Topic):
//     shows brief meta + the whole assignee/reviewer block + downstream
//     instructions; edits all but the fixed founding-admin slot; submitting
//     requires the brief + every DOER assignee (reviewers stay optional).
//   reviewer (reviewed stages):
//     sees context + ALL instruction boxes (edit them) + the work link;
//     approving requires the NEXT stage's instruction; sending back requires
//     this stage's feedback.
//
// Genuinely unusual stages use sparse `overrides` on the def. Everything here
// returns flat-Row COLUMN KEYS, so downstream consumers are unchanged.
// ===========================================================================
import type { PipelineDef, StageDef, FieldDef } from "./types";
import {
  colOf, stageKind, stageHasEta, stageHasInstruction, stageHasReviewerSlot, workField, contextFieldsOf,
} from "./types";
import { lifecycle } from "./lifecycle";
import { stageById, nextStage } from "./registry";

export type RoleKind = "worker" | "reviewer";
export interface FieldView { show: string[]; edit: string[]; }

// --- small derivations -----------------------------------------------------

const isDate = (key: string) => /_date$|_eta$/.test(key);

function fieldCol(s: StageDef, f: FieldDef): string {
  return f.slot ? colOf(s, f.slot) : f.id; // slotless fields live in extra_json under their id
}
function extraCols(s: StageDef): string[] {
  return (s.extra ?? []).map((f) => fieldCol(s, f));
}
function instructionCol(s: StageDef): string | undefined {
  return stageHasInstruction(s) ? colOf(s, "instruction") : undefined;
}
function workLinkCol(s: StageDef): string | undefined {
  return workField(s) ? colOf(s, "work_link") : undefined;
}
function etaCol(s: StageDef): string | undefined {
  return stageHasEta(s) ? colOf(s, "eta") : undefined;
}
function feedbackCol(s: StageDef): string | undefined {
  return s.lifecycle === "review" ? colOf(s, "feedback") : undefined; // only "review" has Need Changes
}

/** Every instruction box in the pipeline (the reviewer can brief any stage). */
function allInstructionCols(p: PipelineDef): string[] {
  return p.stages.map(instructionCol).filter(Boolean) as string[];
}

/** The upstream deliverables this stage views (read-only context). */
function needsCols(p: PipelineDef, s: StageDef): string[] {
  const ids = s.needs ?? (s.gate ? [s.gate] : []);
  return ids
    .map((id) => stageById(p, id))
    .map((up) => (up ? workLinkCol(up) : undefined))
    .filter(Boolean) as string[];
}

/** The brief stage's assignment block: every stage's assignee + each reviewed
 *  stage's reviewer, in pipeline order. */
function assignmentBlock(p: PipelineDef): { all: string[]; assignees: string[]; reviewers: string[] } {
  const assignees = p.stages.map((s) => colOf(s, "assignee"));
  const reviewers = p.stages.filter(stageHasReviewerSlot).map((s) => colOf(s, "reviewer"));
  const all = [...new Set([...interleave(p), ...assignees, ...reviewers])];
  return { all, assignees, reviewers };
}
/** assignee then its reviewer, per stage, in order — the natural admin sequence. */
function interleave(p: PipelineDef): string[] {
  return p.stages.flatMap((s) => [
    colOf(s, "assignee"),
    ...(stageHasReviewerSlot(s) ? [colOf(s, "reviewer")] : []),
  ]);
}

// --- the worker grid -------------------------------------------------------

function workerView(p: PipelineDef, s: StageDef, status: string): FieldView {
  if (stageKind(s) === "brief") return briefWorkerView(p, s, status);

  const lc = lifecycle(s.lifecycle);
  const ctx = [...contextFieldsOf(s), ...needsCols(p, s)];
  const instr = instructionCol(s);
  const eta = etaCol(s);
  const link = workLinkCol(s);
  const extras = extraCols(s);
  if (instr) ctx.push(instr);

  const isStart = status === lc.statuses[0];                  // To Do
  const isWorking = status === "In Progress" || status === "Need Changes";
  const isReview = status === "In Review";
  const isDone = status === lc.done;

  if (isStart) return view([...ctx, eta], [eta]);
  if (isWorking) return view([...ctx, eta, link, ...extras], [link, ...extras]);
  if (isReview) return view([...ctx, eta, link, ...extras], []);
  if (isDone) return view(["video_title", eta, link, ...extras], []);
  return view(ctx, []);
}

function briefWorkerView(p: PipelineDef, s: StageDef, status: string): FieldView {
  const lc = lifecycle(s.lifecycle);
  const meta = s.briefFields ?? [];
  const block = assignmentBlock(p);
  const instr = allInstructionCols(p);
  const show = [...meta, ...block.all, ...instr];
  const fixedAssignee = colOf(s, "assignee"); // the founding-admin slot — never editable
  const editable = [...meta.filter((m) => !isDate(m)), ...block.all.filter((c) => c !== fixedAssignee)];

  const isStart = status === lc.statuses[0];          // To Do
  const isWorking = status === "In Progress";
  if (isStart || isWorking) return view(show, editable);
  return view(show, []);                              // In Review / Done: read-only
}

// --- the reviewer grid -----------------------------------------------------

function reviewerView(p: PipelineDef, s: StageDef, status: string): FieldView {
  const lc = lifecycle(s.lifecycle);
  if (!lc.reviewed) return view([], []);             // task / terminal: no reviewer side

  const ctx = stageKind(s) === "brief"
    ? (s.briefFields ?? []).filter((m) => !isDate(m))
    : [...contextFieldsOf(s), ...needsCols(p, s)];
  const instr = allInstructionCols(p);
  const link = workLinkCol(s);
  const showLink = link && status !== "To Do";       // the deliverable appears once work starts
  const isDone = status === lc.done;

  const show = [...ctx, ...instr, ...(showLink ? [link] : [])];
  const edit = isDone ? [] : instr;                  // reviewer edits the instruction boxes until approved
  return view(show, edit);
}

// --- required-field gates (derived) ----------------------------------------

/** Columns a worker must fill to make the forward move FROM `status`. */
export function requiredToSubmitFrom(p: PipelineDef, s: StageDef, status: string): string[] {
  const lc = lifecycle(s.lifecycle);
  if (stageKind(s) === "brief") {
    // To Do→In Progress "Start" is ungated; the real gate is In Progress→In Review "Submit".
    if (status === "In Progress") {
      const meta = (s.briefFields ?? []).filter((m) => !isDate(m));
      const doers = p.stages.filter((x) => stageKind(x) !== "brief").map((x) => colOf(x, "assignee"));
      return [...meta, ...doers];
    }
    return [];
  }
  const isStart = status === lc.statuses[0];
  if (isStart) return req(s, "start");
  if (status === "In Progress" || status === "Need Changes") return req(s, "submit");
  return [];
}

/** Columns the reviewer must fill to APPROVE (→ Done): the next stage's instruction. */
export function requiredToApprove(p: PipelineDef, s: StageDef): string[] {
  const next = nextStage(p, s);
  const col = next ? instructionCol(next) : undefined;
  return col ? [col] : [];
}

/** Columns the reviewer must fill to SEND BACK (→ Need Changes): this stage's feedback. */
export function requiredToSendBack(_p: PipelineDef, s: StageDef): string[] {
  const col = feedbackCol(s);
  return col ? [col] : [];
}

/** Required fields for a given move, by the field's `required` attribute. */
function req(s: StageDef, when: "start" | "submit"): string[] {
  if (when === "start") {
    // ETA (if any) is the start gate, matching the legacy "fill ETA to Start".
    return stageHasEta(s) ? [colOf(s, "eta")] : [];
  }
  // submit: the deliverable + any extra field flagged required:"submit".
  const out: string[] = [];
  const wf = workField(s);
  if (wf && (wf.required ?? "submit") === "submit") out.push(colOf(s, "work_link"));
  for (const f of s.extra ?? []) if (f.required === "submit") out.push(fieldCol(s, f));
  return out;
}

// --- public surface (mirrors the old control.ts consumers) -----------------

export function showColumns(p: PipelineDef, s: StageDef, kind: RoleKind, status: string): string[] {
  const base = kind === "worker" ? workerView(p, s, status) : reviewerView(p, s, status);
  return applyOverrides(s, status, base).show;
}
export function editColumns(p: PipelineDef, s: StageDef, kind: RoleKind, status: string): string[] {
  const base = kind === "worker" ? workerView(p, s, status) : reviewerView(p, s, status);
  return applyOverrides(s, status, base).edit;
}

// --- helpers ---------------------------------------------------------------

function view(show: (string | undefined)[], edit: (string | undefined)[]): FieldView {
  const clean = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])];
  return { show: clean(show), edit: clean(edit) };
}

/** Sparse per-status overrides on the def: hide / lock(show-but-readonly) / show(add). */
function applyOverrides(s: StageDef, status: string, v: FieldView): FieldView {
  const o = s.overrides?.[status];
  if (!o) return v;
  let show = [...v.show];
  let edit = [...v.edit];
  if (o.show) show = [...new Set([...show, ...o.show])];
  if (o.hide) { show = show.filter((c) => !o.hide!.includes(c)); edit = edit.filter((c) => !o.hide!.includes(c)); }
  if (o.lock) edit = edit.filter((c) => !o.lock!.includes(c));
  return { show, edit };
}
