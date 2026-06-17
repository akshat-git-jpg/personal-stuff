import type { Column } from "../shared/columns";
import type { Row } from "../shared/rbac";
import { STAGES, stageByStatusCol, statesFor, normalizeStatus } from "../shared/pipeline";

/** The lanes (ordered status values) for a given status column. */
export function lanesFor(statusCol: string): string[] {
  const s = stageByStatusCol(statusCol);
  return s ? [...statesFor(s)] : [];
}

/** Admin can switch which status column drives the board. */
export const ADMIN_LANE_OPTIONS: Column[] = STAGES.map((s) => s.statusCol);

export interface LaneGroup { lane: string; rows: Row[]; }

/**
 * Group rows by their (normalized) value for `statusCol`. Normalization is total
 * — a blank/unknown status always lands in "To Do", never in a stray bucket — so
 * there is no "Other / needs fixing" lane and a fresh card can't appear under
 * Need Changes.
 */
export function groupByLane(rows: Row[], statusCol: Column, lanes: string[]): LaneGroup[] {
  const stage = stageByStatusCol(statusCol);
  const buckets = new Map<string, Row[]>();
  for (const lane of lanes) buckets.set(lane, []);
  for (const row of rows) {
    const val = stage ? normalizeStatus(stage, row[statusCol]) : (row[statusCol] ?? "To Do");
    (buckets.get(val) ?? buckets.get(lanes[0])!).push(row);
  }
  return lanes.map((lane) => ({ lane, rows: buckets.get(lane)! }));
}
