import type { Column } from "./columns";
import { GROUPS } from "./columns";
type RowRule = "all" | { match: Column };
export interface RolePolicy {
  visibleGroups: (keyof typeof GROUPS)[] | "*";
  readonlyGroups: (keyof typeof GROUPS)[];
  editable: Column[];          // explicit editable columns; Admin uses "*" semantics handled in rbac
  rows: RowRule;
  laneStatus: Column;          // which status column drives this role's board
}
export const POLICY: Record<string, RolePolicy> = {
  "Admin":          { visibleGroups: "*", readonlyGroups: [], editable: [], rows: "all", laneStatus: "topic_status" },
  "Reviewer":       { visibleGroups: "*", readonlyGroups: [], editable: ["yt_upload_status","yt_upload_date","yt_link","topic_status"], rows: { match: "reviewer_email" }, laneStatus: "yt_upload_status" },
  "Tutorial Maker": { visibleGroups: ["meta","tutorial"], readonlyGroups: ["meta"], editable: ["tutorial_link","tutorial_status"], rows: { match: "tutorial_maker_email" }, laneStatus: "tutorial_status" },
  "Editor":         { visibleGroups: ["meta","tutorial","editor"], readonlyGroups: ["meta","tutorial"], editable: ["video_editor_link","video_editor_status"], rows: { match: "video_editor_email" }, laneStatus: "video_editor_status" },
};
