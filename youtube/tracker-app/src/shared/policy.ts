import type { Column } from "./columns";

export type Access = "view" | "edit";
type RowRule = "all" | { match: Column; gate?: { col: Column; equals: string } };
export interface RolePolicy {
  all?: boolean;                                   // Admin: sees + edits everything
  access?: Partial<Record<Column, Access>>;        // columns not listed = hidden
  rows: RowRule;
  laneStatus: Column;
}
export const APPROVER_ROLES = new Set(["Admin", "Reviewer"]);
export const APPROVER_ONLY_VALUES: Partial<Record<Column, string[]>> = {
  tutorial_status: ["Done"],
  video_editor_status: ["Done"],
};
export const POLICY: Record<string, RolePolicy> = {
  "Admin": { all: true, rows: "all", laneStatus: "topic_status" },

  "Reviewer": {
    access: {
      video_title:"view", video_notes:"view", video_description:"view",
      category:"view", subcategory:"view",
      tutorial_instruction:"view", tutorial_link:"view", tutorial_status:"edit", tutorial_feedback:"edit",
      video_editor_instruction:"view", video_editor_link:"view", video_editor_status:"edit", editor_feedback:"edit",
      yt_upload_status:"edit", yt_upload_date:"edit", yt_link:"edit",
      short_links:"view", actual_links:"view",
      tutorial_maker_email:"view", video_editor_email:"view",
    },
    rows: { match: "reviewer_email", gate: { col: "video_editor_status", equals: "Done" } },
    laneStatus: "yt_upload_status",
  },

  "Tutorial Maker": {
    access: {
      video_title:"view", video_notes:"view", category:"view", subcategory:"view",
      tutorial_instruction:"view", tutorial_link:"edit", tutorial_status:"edit", tutorial_feedback:"view",
    },
    rows: { match: "tutorial_maker_email" },
    laneStatus: "tutorial_status",
  },

  "Editor": {
    access: {
      video_title:"view", video_notes:"view", category:"view", subcategory:"view",
      tutorial_link:"view",                                  // the script to work from (view only)
      video_editor_instruction:"view", video_editor_link:"edit", video_editor_status:"edit", editor_feedback:"view",
    },
    rows: { match: "video_editor_email", gate: { col: "tutorial_status", equals: "Done" } },
    laneStatus: "video_editor_status",
  },
};
