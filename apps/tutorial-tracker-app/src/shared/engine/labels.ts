// ===========================================================================
// FIELD LABELS — the one place a flat-Row column maps to a human label, derived
// from the pipeline definitions (each FieldDef.label / stage label). Used by the
// client form AND by server gate/lock messages, so "Add the … first." reads
// "Editor inputs (Drive)", not the humanized key "processing work link".
// ===========================================================================
import { PIPELINES } from "./registry";
import { colOf, stageHasReviewerSlot, stageHasInstruction, stageHasEta, workField } from "./types";
import { columnLabel } from "../columns";

const MAP: Record<string, string> = {};
for (const p of Object.values(PIPELINES)) for (const s of p.stages) {
  MAP[colOf(s, "status")] ??= `${s.label} status`;
  MAP[colOf(s, "assignee")] ??= s.role;
  if (stageHasReviewerSlot(s)) MAP[colOf(s, "reviewer")] ??= `${s.label} reviewer`;
  if (stageHasInstruction(s)) MAP[colOf(s, "instruction")] ??= `${s.label} instructions`;
  if (stageHasEta(s)) MAP[colOf(s, "eta")] ??= `${s.label} ETA`;
  if (s.lifecycle === "review") MAP[colOf(s, "feedback")] ??= `${s.label} feedback`;
  const wf = workField(s);
  if (wf) MAP[colOf(s, "work_link")] ??= wf.label;
  for (const f of s.extra ?? []) MAP[f.slot ? colOf(s, f.slot) : f.id] ??= f.label;
}

/** Human label for a flat-Row column. Pipeline field labels win; brief/meta
 *  columns (video_title, …) fall back to the curated columnLabel. */
export function fieldLabelOf(col: string): string {
  return MAP[col] ?? columnLabel(col);
}
