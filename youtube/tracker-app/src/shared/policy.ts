import type { Column } from "./columns";
import { GROUPS } from "./columns";

export const APPROVER_ROLES = new Set(["Admin", "Reviewer"]);

export const APPROVER_ONLY_VALUES: Partial<Record<Column, string[]>> = {
  tutorial_status: ["Done"],
  video_editor_status: ["Done"],
};
// A role sees: "all" rows, OR rows where `match` = their email — optionally
// GATED so the row only appears once an upstream stage is complete
// (e.g. Editor only sees a video after tutorial_status === "Done").
type RowRule = "all" | { match: Column; gate?: { col: Column; equals: string } };
export interface RolePolicy {
  visibleGroups: (keyof typeof GROUPS)[] | "*";
  readonlyGroups: (keyof typeof GROUPS)[];
  editable: Column[];          // explicit editable columns; Admin uses "*" semantics handled in rbac
  rows: RowRule;
  laneStatus: Column;          // which status column drives this role's board
}
export const POLICY: Record<string, RolePolicy> = {
  "Admin":          { visibleGroups: "*", readonlyGroups: [], editable: [], rows: "all", laneStatus: "topic_status" },
  "Reviewer":       { visibleGroups: "*", readonlyGroups: [], editable: ["yt_upload_status","yt_upload_date","yt_link","topic_status","tutorial_status","video_editor_status","tutorial_feedback","editor_feedback"], rows: { match: "reviewer_email", gate: { col: "video_editor_status", equals: "Done" } }, laneStatus: "yt_upload_status" },
  "Tutorial Maker": { visibleGroups: ["meta","tutorial"], readonlyGroups: ["meta"], editable: ["tutorial_link","tutorial_status"], rows: { match: "tutorial_maker_email" }, laneStatus: "tutorial_status" },
  "Editor":         { visibleGroups: ["meta","tutorial","editor"], readonlyGroups: ["meta","tutorial"], editable: ["video_editor_link","video_editor_status"], rows: { match: "video_editor_email", gate: { col: "tutorial_status", equals: "Done" } }, laneStatus: "video_editor_status" },
};
