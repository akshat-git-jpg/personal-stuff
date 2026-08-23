// ===========================================================================
// HOLDINGS — the live work a person is standing on.
//
// Removing someone from the team used to be one DELETE against `employees`. It
// never looked at the cards, so every stage they still owned kept their dead
// email: the card vanished from everyone's "My work" (no email matches), nobody
// but an admin could move it, and nothing said so. Work went quiet.
//
// This module answers the one question that prevents that: what unfinished work
// would this removal strand? The Team panel asks before it removes, and refuses
// until the answer is empty.
// ===========================================================================
import type { StageDef } from "./types";
import { colOf, stageHasReviewerSlot } from "./types";
import { PIPELINES, REVIEWER_ROLE } from "./registry";
import { lifecycle } from "./lifecycle";
import { statusOf } from "./derive";

export type HoldingRow = Record<string, string | undefined>;

export interface Holding {
  row_id: string;
  title: string;
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageLabel: string;
  status: string;
  /** The flat column this person sits in — what a reassignment writes to. */
  col: string;
  slot: "doer" | "reviewer";
  /** The role a replacement must hold in this system to take the slot. */
  role: string;
}

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

/** Unfinished — the stage has not reached its lifecycle's done status. A stage
 *  sitting at "To Do" counts: it is assigned, and nobody else can move it. */
export function stageIsLive(s: StageDef, row: HoldingRow): boolean {
  return statusOf(s, row) !== lifecycle(s.lifecycle).done;
}

export interface HoldingsQuery {
  /** Only these system ids — a per-system removal strands only that system. */
  systems?: string[];
  /** Only slots needing one of these roles — for taking a single role away. */
  roles?: string[];
}

/** Every unfinished stage where `email` sits in a doer or reviewer slot. */
export function liveHoldingsFor(email: string, rows: HoldingRow[], q: HoldingsQuery = {}): Holding[] {
  const who = norm(email);
  if (!who) return [];
  const systems = q.systems ? new Set(q.systems) : null;
  const roles = q.roles ? new Set(q.roles) : null;
  const out: Holding[] = [];

  for (const row of rows) {
    const pipe = PIPELINES[(row.pipeline || "standard").trim()] ?? PIPELINES.standard;
    if (systems && !systems.has(pipe.id)) continue;

    for (const stage of pipe.stages) {
      if (!stageIsLive(stage, row)) continue;

      const slots: { slot: "doer" | "reviewer"; col: string; role: string }[] = [
        { slot: "doer", col: colOf(stage, "assignee"), role: stage.role },
      ];
      if (stageHasReviewerSlot(stage)) {
        slots.push({ slot: "reviewer", col: colOf(stage, "reviewer"), role: REVIEWER_ROLE });
      }

      for (const s of slots) {
        if (norm(row[s.col]) !== who) continue;
        if (roles && !roles.has(s.role)) continue;
        out.push({
          row_id: (row.row_id ?? "").trim(),
          title: (row.video_title ?? "").trim() || "(no title)",
          pipelineId: pipe.id,
          pipelineName: pipe.name,
          stageId: stage.id,
          stageLabel: stage.label,
          status: statusOf(stage, row),
          col: s.col,
          slot: s.slot,
          role: s.role,
        });
      }
    }
  }
  return out;
}

/** The roles a membership change would TAKE AWAY, per system.
 *  `before`/`after` are membership maps (systemId → roles). */
export function rolesRemoved(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): { systems: string[]; roles: string[] } {
  const systems = new Set<string>();
  const roles = new Set<string>();
  for (const [sys, had] of Object.entries(before)) {
    if (sys === "*") continue;
    const keeps = new Set(after[sys] ?? []);
    for (const r of had) {
      if (!keeps.has(r)) { systems.add(sys); roles.add(r); }
    }
  }
  return { systems: [...systems], roles: [...roles] };
}
