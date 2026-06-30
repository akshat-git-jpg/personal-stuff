// ===========================================================================
// PIPELINE REGISTRY — the list of all systems + lookups + a validator.
//
// To add a system: write a PipelineDef (see definitions/) and add it here. That
// is the ONLY edit. Everything downstream — column access, control grid, board,
// gates, role roster, emails — derives from these defs.
//
// validatePipelines() runs in the test suite AND at worker boot, so a malformed
// def (dangling gate, unknown lifecycle, duplicate ids, missing reviewer slot)
// fails loud and early instead of breaking a live card. Typed defs catch the
// rest at compile time.
// ===========================================================================
import type { PipelineDef, StageDef } from "./types";
import { colOf, stageHasReviewerSlot, workField } from "./types";
import { lifecycle } from "./lifecycle";
import { standard } from "./definitions/standard";
import { tut2 } from "./definitions/tut-2";

export const PIPELINES: Record<string, PipelineDef> = {
  [standard.id]: standard,
  [tut2.id]: tut2,
};

export const DEFAULT_PIPELINE_ID = standard.id;

/** The founding admin — fixed. Can't be edited/removed from the Team panel or the
 *  card's Admin field (enforced in the UI + the team-management worker routes). */
export const PROTECTED_ADMIN_EMAIL = "seankerman25@gmail.com";

/** Lightweight pipeline summaries for the client (picker, tabs, matrix columns). */
export function pipelineSummaries() {
  return Object.values(PIPELINES).map((p) => ({
    id: p.id, name: p.name,
    stages: p.stages.map((s) => ({ id: s.id, label: s.label, role: s.role })),
  }));
}

export function getPipeline(id: string | undefined | null): PipelineDef {
  return PIPELINES[id ?? ""] ?? PIPELINES[DEFAULT_PIPELINE_ID];
}

export function pipelineIds(): string[] {
  return Object.keys(PIPELINES);
}

/** The full role roster, derived: every stage owner role across all pipelines,
 *  plus the cross-cutting Reviewer + Admin. Adding a new role = naming it in a
 *  stage's `role`; it shows up here (and in the Team dropdown) automatically. */
export const REVIEWER_ROLE = "Reviewer";
export const ADMIN_ROLE = "Admin";
export function allRoles(): string[] {
  const roles = new Set<string>([ADMIN_ROLE, REVIEWER_ROLE]);
  for (const p of Object.values(PIPELINES)) for (const s of p.stages) roles.add(s.role);
  return [...roles];
}

// --- Per-pipeline stage lookups (cached) -----------------------------------
const byId = new Map<string, Map<string, StageDef>>();
function stageMap(p: PipelineDef): Map<string, StageDef> {
  let m = byId.get(p.id);
  if (!m) { m = new Map(p.stages.map((s) => [s.id, s])); byId.set(p.id, m); }
  return m;
}
export function stageById(p: PipelineDef, id: string): StageDef | undefined {
  return stageMap(p).get(id);
}
export function prevStage(p: PipelineDef, s: StageDef): StageDef | undefined {
  return s.gate ? stageById(p, s.gate) : undefined;
}
export function nextStage(p: PipelineDef, s: StageDef): StageDef | undefined {
  return p.stages.find((x) => x.gate === s.id);
}

// --- Validation -------------------------------------------------------------
export interface ValidationIssue { pipeline: string; stage?: string; message: string; }

export function validatePipeline(p: PipelineDef): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const colKeys = new Map<string, string>(); // flat-Row col -> stageId, to catch accidental clashes

  if (!p.id || !p.name) issues.push({ pipeline: p.id || "(unnamed)", message: "pipeline needs id + name" });
  if (p.stages.length === 0) issues.push({ pipeline: p.id, message: "pipeline has no stages" });

  p.stages.forEach((s, i) => {
    const at = (message: string) => issues.push({ pipeline: p.id, stage: s.id, message });
    if (ids.has(s.id)) at(`duplicate stage id "${s.id}"`);
    ids.add(s.id);

    // lifecycle must exist
    if (!lifecycle(s.lifecycle)) at(`unknown lifecycle "${s.lifecycle}"`);

    // gate must reference a real, EARLIER stage (linear flow)
    if (i === 0 && s.gate) at(`first stage must not have a gate (got "${s.gate}")`);
    if (i > 0) {
      if (!s.gate) at("non-first stage must declare a gate");
      else if (!p.stages.some((x) => x.id === s.gate)) at(`gate points to unknown stage "${s.gate}"`);
      else if (p.stages.findIndex((x) => x.id === s.gate) >= i) at(`gate "${s.gate}" is not an earlier stage (flow must be linear)`);
    }

    // reviewed lifecycle ⇒ stage should expose a reviewer slot (else it can never leave In Review)
    if (lifecycle(s.lifecycle).reviewed && !stageHasReviewerSlot(s)) {
      at(`lifecycle "${s.lifecycle}" is reviewed but hasReviewer is false`);
    }

    // flat-Row column-key collisions within a pipeline would corrupt data
    const slots: import("./types").SlotKey[] = ["status", "assignee", "reviewer", "work_link", "eta", "instruction", "feedback"];
    for (const slot of slots) {
      const key = colOf(s, slot);
      const prev = colKeys.get(key);
      if (prev && prev !== s.id) at(`column key "${key}" collides with stage "${prev}"`);
      colKeys.set(key, s.id);
    }

    // a work stage must resolve a deliverable field
    if ((s.kind ?? "work") === "work" && !workField(s)) at("work stage has no deliverable field");
  });

  return issues;
}

export function validatePipelines(): ValidationIssue[] {
  return Object.values(PIPELINES).flatMap(validatePipeline);
}

/** Throw if any pipeline is malformed. Call at worker boot. */
export function assertPipelinesValid(): void {
  const issues = validatePipelines();
  if (issues.length) {
    const lines = issues.map((i) => `  [${i.pipeline}${i.stage ? `/${i.stage}` : ""}] ${i.message}`);
    throw new Error(`Invalid pipeline definition(s):\n${lines.join("\n")}`);
  }
}
