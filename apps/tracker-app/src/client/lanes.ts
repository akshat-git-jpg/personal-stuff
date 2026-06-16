import type { Column } from "../shared/columns";
import type { Row } from "../shared/rbac";

export const LANES: Record<string, string[]> = {
  script_status:       ["To Do","In Progress","In Review","Done"],
  tutorial_status:     ["To Do","In Progress","In Review","Done"],
  video_editor_status: ["To Do","In Progress","In Review","Done"],
  yt_upload_status:    ["To Do","Draft","Published"],
  topic_status:        ["To Do","Ready"],
};

export const OTHER_LANE = "Other / needs fixing";

// Admin can switch which status column drives the board:
export const ADMIN_LANE_OPTIONS: Column[] = [
  "topic_status",
  "script_status",
  "tutorial_status",
  "video_editor_status",
  "yt_upload_status",
];

export interface LaneGroup {
  lane: string;
  rows: Row[];
}

/**
 * Pure helper: group rows by their value for `laneStatus`.
 * Rows whose value isn't in `lanes` (or is missing) go into OTHER_LANE.
 */
export function groupByLane(
  rows: Row[],
  laneStatus: Column,
  lanes: string[],
): LaneGroup[] {
  const buckets = new Map<string, Row[]>();
  for (const lane of lanes) buckets.set(lane, []);
  buckets.set(OTHER_LANE, []);

  for (const row of rows) {
    const val = row[laneStatus] ?? "";
    if (lanes.includes(val)) {
      buckets.get(val)!.push(row);
    } else {
      buckets.get(OTHER_LANE)!.push(row);
    }
  }

  const result: LaneGroup[] = lanes.map(lane => ({ lane, rows: buckets.get(lane)! }));
  const otherRows = buckets.get(OTHER_LANE)!;
  if (otherRows.length > 0) result.push({ lane: OTHER_LANE, rows: otherRows });
  return result;
}
