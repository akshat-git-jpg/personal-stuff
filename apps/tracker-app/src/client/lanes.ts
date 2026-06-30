import type { Row } from "../shared/rbac";
import { pipeOf, stageByStatusColIn, statesForStage, normalizeStatusIn } from "./stages";

/** The lanes (ordered status values) for a status column — resolved per card's
 *  pipeline. Lanes are stable within a board (all rows share the statusCol). */
export function lanesFor(statusCol: string, sampleRow?: Row): string[] {
  if (!sampleRow) return [];
  const p = pipeOf(sampleRow as Record<string, unknown>);
  const s = stageByStatusColIn(p, statusCol);
  return s ? [...statesForStage(s)] : [];
}

export interface LaneGroup { lane: string; rows: Row[]; }

/**
 * Group rows by their (normalized) value for `statusCol`. Normalization is total
 * — a blank/unknown status always lands in the first lane (To Do) — so there is
 * no stray bucket and a fresh card can't appear under Need Changes.
 */
export function groupByLane(rows: Row[], statusCol: string, lanes: string[]): LaneGroup[] {
  const buckets = new Map<string, Row[]>();
  for (const lane of lanes) buckets.set(lane, []);
  for (const row of rows) {
    const r = row as Record<string, string | undefined>;
    const p = pipeOf(r);
    const stage = stageByStatusColIn(p, statusCol);
    const val = stage ? normalizeStatusIn(stage, r[statusCol]) : (r[statusCol] ?? lanes[0]);
    (buckets.get(val as string) ?? buckets.get(lanes[0])!).push(row);
  }
  return lanes.map((lane) => ({ lane, rows: buckets.get(lane)! }));
}
