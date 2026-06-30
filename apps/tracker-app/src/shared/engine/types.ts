// ===========================================================================
// PIPELINE DEFINITION MODEL — the typed shape of a "system".
//
// THIS is the single source of truth for a pipeline. To add a system you write
// one `PipelineDef`; everything else (column access, the control grid, board
// lanes, gates, the role roster, emails) is DERIVED from it by the engine.
// Nothing about a system lives in a second place.
//
// Design rules baked in (confirmed requirements):
//   • linear flow            — each stage gates on the single stage before it
//   • one owner role / stage — plus an optional per-stage reviewer
//   • shared status words    — a stage names a lifecycle template (lifecycle.ts)
//
// Terseness: sensible defaults mean a normal "work" stage is ~4 lines. The
// `standard` pipeline is the verbose one ONLY because it pins legacy column
// keys (`cols`) so existing data + flat-Row consumers stay byte-identical.
// New pipelines omit `cols` and get `${stageId}_${slot}` keys for free.
// ===========================================================================
import type { LifecycleId } from "./lifecycle";

export type FieldType = "url" | "text" | "textarea" | "date" | "combo";

/** The first-class per-stage storage slots (one column each in `card_stages`).
 *  Anything a stage needs beyond these lives in `card_stages.extra_json`. */
export type SlotKey =
  | "status" | "assignee" | "reviewer"   // lifecycle + people
  | "work_link" | "eta" | "instruction" | "feedback"; // the deliverable + co.

/** When a field must be non-empty to make a forward move. */
export type RequiredAt = "start" | "submit" | "approve";

export interface FieldDef {
  id: string;            // logical id, unique within the stage
  label: string;
  type: FieldType;
  slot?: SlotKey;        // first-class slot; omit ⇒ stored in extra_json[id]
  required?: RequiredAt; // the forward move this field gates until filled
}

export interface StageDef {
  id: string;
  label: string;
  role: string;              // owner role — a plain string matched to the Employes tab
  lifecycle: LifecycleId;
  kind?: "brief" | "work";   // default "work". "brief" = Topic-style setup/assignment stage
  gate?: string;             // id of the stage that must be complete first (omit on stage 0)

  hasReviewer?: boolean;     // default = the lifecycle is reviewed
  hasInstruction?: boolean;  // default = (kind === "work") — a brief authored for the doer
  hasEta?: boolean;          // default = (kind === "work") — a date the worker commits to

  /** Upstream stage ids whose deliverables this stage VIEWS (read-only context the
   *  doer needs). Default = [gate] (the immediately-preceding stage). Upload sets
   *  ["editing","thumbnail"] because it needs both the final video and the thumb. */
  needs?: string[];

  /** Brief/meta fields shown as read-only context on a WORK stage. Default
   *  ["video_title","video_notes"]. Upload overrides to show video_description
   *  (what the uploader pastes into YouTube) instead of the internal notes. */
  contextFields?: string[];

  /** The deliverable field. Default: { id:`${stage}_link`, slot:"work_link", type:"url", required:"submit" }. */
  work?: FieldDef;
  /** Rare extra fields beyond the deliverable (e.g. Upload's short_links / actual_links). */
  extra?: FieldDef[];

  /** Brief-only: which card meta fields this stage shows/collects (Topic). */
  briefFields?: string[];

  /** Legacy flat-Row column keys per slot (the `standard` bridge). Default `${stage}_${slot}`. */
  cols?: Partial<Record<SlotKey, string>>;

  /** Sparse control overrides for genuinely unusual stages — per status. */
  overrides?: Record<string, { hide?: string[]; lock?: string[]; show?: string[] }>;
}

export interface PipelineDef {
  id: string;
  name: string;
  stages: StageDef[];
}

// ---------------------------------------------------------------------------
// Resolution helpers — turn the terse StageDef into the concrete facts the
// engine needs (column keys, field list), applying all defaults in ONE place.
// ---------------------------------------------------------------------------

import { lifecycle as lifecycleOf } from "./lifecycle";

export function stageKind(s: StageDef): "brief" | "work" {
  return s.kind ?? "work";
}

export function stageHasReviewerSlot(s: StageDef): boolean {
  return s.hasReviewer ?? lifecycleOf(s.lifecycle).reviewed;
}

export function stageHasInstruction(s: StageDef): boolean {
  // A reviewer authors the instruction, so only reviewed work stages have one.
  return s.hasInstruction ?? (stageKind(s) === "work" && lifecycleOf(s.lifecycle).reviewed);
}

export function contextFieldsOf(s: StageDef): string[] {
  return s.contextFields ?? ["video_title", "video_notes"];
}

export function stageHasEta(s: StageDef): boolean {
  return s.hasEta ?? (stageKind(s) === "work");
}

/** The flat-Row column key for a stage's slot (legacy override or derived). */
export function colOf(s: StageDef, slot: SlotKey): string {
  return s.cols?.[slot] ?? `${s.id}_${slot}`;
}

/** The deliverable field for a work stage (def override or derived default). */
export function workField(s: StageDef): FieldDef | undefined {
  if (stageKind(s) !== "work") return undefined;
  return s.work ?? { id: `${s.id}_link`, label: s.label, type: "url", slot: "work_link", required: "submit" };
}
