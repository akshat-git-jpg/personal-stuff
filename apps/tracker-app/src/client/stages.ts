// ===========================================================================
// CLIENT STAGE FACADE — per-card, pipeline-aware stage access, engine-backed.
//
// Every card carries `row.pipeline`; the client resolves that pipeline and uses
// the ENGINE for status / gate / control logic, so each system (including
// Tut-2's `task` lifecycle) renders correctly. This replaces the old global
// `STAGES` + legacy control imports across the client.
// ===========================================================================
import { getPipeline, PIPELINES, pipelineIds } from "../shared/engine/registry";
import {
  colOf, stageHasReviewerSlot, stageHasInstruction, stageHasEta, stageKind, workField,
  type StageDef, type PipelineDef, createFieldsOf, type CreateField,
} from "../shared/engine/types";
import { statusOf as engStatusOf, isGateOpen as engIsGateOpen, isStageComplete as engIsStageComplete } from "../shared/engine/derive";
import { lifecycle } from "../shared/engine/lifecycle";
import {
  showColumns, editColumns, requiredToApprove, requiredToSubmitFrom, type RoleKind,
} from "../shared/engine/control";
import { columnLabel } from "../shared/columns";

type AnyRow = Record<string, unknown>;

// Status helpers — loosened to accept board rows (which carry _stages/_actions).
type StatusRow = Record<string, unknown>;
export const statusOf = (s: StageDef, row: StatusRow): string => engStatusOf(s, row as Record<string, string | undefined>);
export const isGateOpen = (p: PipelineDef, s: StageDef, row: StatusRow): boolean => engIsGateOpen(p, s, row as Record<string, string | undefined>);
export const isStageComplete = (s: StageDef, row: StatusRow): boolean => engIsStageComplete(s, row as Record<string, string | undefined>);

// --- pipeline resolution ----------------------------------------------------
export function pipeOf(row: AnyRow): PipelineDef { return getPipeline(row.pipeline as string | undefined); }
export function stagesOf(row: AnyRow): StageDef[] { return pipeOf(row).stages; }
export function stageByStatusColIn(p: PipelineDef, col: string): StageDef | undefined {
  return p.stages.find((s) => colOf(s, "status") === col);
}
export function stageByIdIn(p: PipelineDef, id: string): StageDef | undefined {
  return p.stages.find((s) => s.id === id);
}

// --- stage field accessors (engine helpers, legacy-name compatible) ---------
export const statusColOf = (s: StageDef) => colOf(s, "status");
export const assigneeColOf = (s: StageDef) => colOf(s, "assignee");
export const reviewerColOf = (s: StageDef) => (stageHasReviewerSlot(s) ? colOf(s, "reviewer") : undefined);
export const feedbackColOf = (s: StageDef) => (s.lifecycle === "review" ? colOf(s, "feedback") : undefined);
export const instructionColOf = (s: StageDef) => (stageHasInstruction(s) ? colOf(s, "instruction") : undefined);
export const workLinkColOf = (s: StageDef) => (workField(s) ? colOf(s, "work_link") : undefined);
export const etaColOf = (s: StageDef) => (stageHasEta(s) ? colOf(s, "eta") : undefined);
export const extraColsOf = (s: StageDef): string[] => (s.extra ?? []).map((f) => (f.slot ? colOf(s, f.slot) : f.id));
export const isBrief = (s: StageDef) => stageKind(s) === "brief";
export const briefFieldsOf = (s: StageDef): string[] => s.briefFields ?? [];
export const isReviewable = (s: StageDef) => lifecycle(s.lifecycle).reviewed;
export const statesForStage = (s: StageDef): readonly string[] => lifecycle(s.lifecycle).statuses;

/** Normalize a raw status to the stage's lifecycle (blank/unknown → first status). */
export function normalizeStatusIn(s: StageDef, raw: string | undefined): string {
  const states = lifecycle(s.lifecycle).statuses as readonly string[];
  const v = (raw ?? "").trim();
  return states.includes(v) ? v : states[0];
}

/** The subset of `cols` still empty on `row` (required-field gate helper). */
export function missingColumns(cols: string[], row: Record<string, unknown>): string[] {
  return cols.filter((c) => !String(row[c] ?? "").trim());
}

export {
  colOf,
  showColumns, editColumns, requiredToApprove, requiredToSubmitFrom,
  lifecycle, getPipeline, PIPELINES, pipelineIds, columnLabel,
  createFieldsOf,
};
export type { StageDef, PipelineDef, RoleKind, CreateField };
