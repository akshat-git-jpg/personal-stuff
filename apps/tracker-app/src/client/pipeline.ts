/**
 * pipeline.ts — pure helpers for the admin Pipeline matrix, derived from the
 * shared pipeline definition. No hardcoded stage names.
 */
import {
  STAGES, isStageComplete, isGateOpen, statusOf, type StageDef,
} from "../shared/pipeline";

export type StepState = "done" | "active" | "pending";

/** A stage is done when complete, active when reachable-but-not-done, else pending. */
export function stageStepState(stage: StageDef, row: Record<string, string>): StepState {
  if (isStageComplete(stage, row)) return "done";
  if (isGateOpen(stage, row)) return "active";
  return "pending";
}

export interface ProgressStep { stage: StageDef; state: StepState; }
export function progress(row: Record<string, string>): ProgressStep[] {
  return STAGES.map((s) => ({ stage: s, state: stageStepState(s, row) }));
}

/** The single stage a card currently sits in (null when everything is complete). */
export function activeStage(row: Record<string, string>): StageDef | null {
  return STAGES.find((s) => stageStepState(s, row) === "active") ?? null;
}
export function overallLabel(row: Record<string, string>): string {
  return activeStage(row)?.label ?? "Done";
}
export function activeAssigneeEmail(row: Record<string, string>): string {
  const a = activeStage(row);
  return a ? (row[a.assigneeCol] ?? "") : (row.uploader_email ?? "");
}

/** Sent back: any reviewable stage currently needs changes. */
export function isStalled(row: Record<string, string>): boolean {
  return STAGES.some((s) => s.reviewable && statusOf(s, row) === "Need Changes");
}

export function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

/** Stuck: still in flight and untouched for >3 days. */
export function isStuck(row: Record<string, string>): boolean {
  if (!activeStage(row)) return false;
  const d = daysSince(row.last_updated);
  return d !== null && d > 3;
}
