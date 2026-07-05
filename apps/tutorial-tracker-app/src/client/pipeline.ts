/**
 * pipeline.ts — pure helpers for the admin Pipeline matrix + card progress,
 * resolved per the card's own pipeline (engine-backed). No hardcoded stages.
 */
import {
  pipeOf, stagesOf, statusOf, isGateOpen, isStageComplete, isReviewable,
  assigneeColOf, type StageDef, type PipelineDef,
} from "./stages";

type R = Record<string, string>;

export type StepState = "done" | "active" | "pending";

/** done = complete, active = reachable-but-not-done, else pending. */
export function stageStepState(p: PipelineDef, stage: StageDef, row: R): StepState {
  if (isStageComplete(stage, row)) return "done";
  if (isGateOpen(p, stage, row)) return "active";
  return "pending";
}

export interface ProgressStep { stage: StageDef; state: StepState; }
export function progress(row: R): ProgressStep[] {
  const p = pipeOf(row);
  return p.stages.map((s) => ({ stage: s, state: stageStepState(p, s, row) }));
}

/** The single stage a card currently sits in (null when everything is complete). */
export function activeStage(row: R): StageDef | null {
  const p = pipeOf(row);
  return p.stages.find((s) => stageStepState(p, s, row) === "active") ?? null;
}
export function overallLabel(row: R): string {
  return activeStage(row)?.label ?? "Done";
}
export function activeAssigneeEmail(row: R): string {
  const a = activeStage(row);
  if (a) return row[assigneeColOf(a)] ?? "";
  // Everything done → show the last stage's assignee (e.g. the uploader).
  const stages = stagesOf(row);
  const last = stages[stages.length - 1];
  return last ? (row[assigneeColOf(last)] ?? "") : "";
}

/** Sent back: any reviewable stage currently needs changes. */
export function isStalled(row: R): boolean {
  return stagesOf(row).some((s) => isReviewable(s) && statusOf(s, row) === "Need Changes");
}

/** Whole days elapsed since an ISO timestamp (null when blank/unparseable). */
export function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}
