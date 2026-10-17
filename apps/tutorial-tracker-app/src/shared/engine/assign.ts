// ===========================================================================
// ASSIGNMENT RULES — the one check every path that puts a person on a stage runs
// (/api/update, /api/video, /api/apply-defaults, /api/defaults). Each rule
// prevents a card that nobody can move.
// ===========================================================================
import type { PipelineDef, StageDef } from "./types";
import { colOf, stageHasReviewerSlot, stageKind } from "./types";
import { REVIEWER_ROLE } from "./registry";
import { holdsRoleInSystem, type Memberships } from "./memberships";

type Slot = { stage: StageDef; slot: "assignee" | "reviewer"; role: string };

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

/** assignee/reviewer column -> its stage, slot and required role, for ONE pipeline. */
export function assignSlotOf(p: PipelineDef, col: string): Slot | undefined {
  for (const s of p.stages) {
    if (colOf(s, "assignee") === col) return { stage: s, slot: "assignee", role: s.role };
    if (stageHasReviewerSlot(s) && colOf(s, "reviewer") === col) return { stage: s, slot: "reviewer", role: REVIEWER_ROLE };
  }
  return undefined;
}

/** null when `email` may fill `col` on a card whose other slots are `values`; else why not. */
export function assignmentProblem(
  p: PipelineDef, col: string, email: string,
  values: Record<string, string | undefined>, memberships: Memberships,
): string | null {
  const slot = assignSlotOf(p, col);
  const who = norm(email);
  if (!slot || !who) return null;
  if (!holdsRoleInSystem(memberships, p.id, slot.role)) {
    return `That person isn't a ${slot.role} in ${p.name}. Add them to ${p.name} in the Team tab first.`;
  }
  // The brief stage is owned and approved by the admin, so owner == reviewer is fine there.
  if (stageKind(slot.stage) === "brief" || !stageHasReviewerSlot(slot.stage)) return null;
  const other = slot.slot === "assignee" ? colOf(slot.stage, "reviewer") : colOf(slot.stage, "assignee");
  if (norm(values[other]) === who) {
    return `Nobody can review their own work: pick a different ${slot.slot === "assignee" ? "doer" : "reviewer"} for ${slot.stage.label}.`;
  }
  return null;
}

/** Every problem in a set of assignments for one card (or one default set). */
export function assignmentProblems(
  p: PipelineDef, values: Record<string, string | undefined>, team: Map<string, Memberships>,
): { col: string; email: string; message: string }[] {
  const out: { col: string; email: string; message: string }[] = [];
  for (const [col, email] of Object.entries(values)) {
    if (!assignSlotOf(p, col) || !norm(email)) continue;
    const message = assignmentProblem(p, col, email!, values, team.get(norm(email)) ?? {});
    if (message) out.push({ col, email: norm(email), message });
  }
  return out;
}
