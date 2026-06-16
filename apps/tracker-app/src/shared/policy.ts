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

// The founding admin — fixed. Can't be edited/removed from the Team panel or the
// card's Admin field (enforced in the UI and the team-management worker routes).
export const PROTECTED_ADMIN_EMAIL = "seankerman25@gmail.com";

export const APPROVER_ONLY_VALUES: Partial<Record<Column, string[]>> = {
  script_status:       ["Done"],
  tutorial_status:     ["Done"],
  video_editor_status: ["Done"],
};

// Maps an editable doer field -> the stage status column that governs its lock.
// Once that status is "Done", the (non-approver) doer can no longer edit the field.
export const STAGE_OF_COL: Partial<Record<Column, Column>> = {
  script_link:          "script_status",
  script_status:        "script_status",
  tutorial_link:        "tutorial_status",
  tutorial_status:      "tutorial_status",
  video_editor_link:    "video_editor_status",
  video_editor_status:  "video_editor_status",
};

export const POLICY: Record<string, RolePolicy> = {
  "Admin": { all: true, rows: "all", laneStatus: "topic_status" },

  "Reviewer": {
    access: {
      video_title:"view", video_notes:"view", video_description:"view",
      category:"view", subcategory:"view",
      script_writer_email:"view", script_instruction:"view", script_link:"view", script_status:"edit", script_feedback:"edit",
      tutorial_maker_email:"view", tutorial_instruction:"view", tutorial_link:"view", tutorial_status:"edit", tutorial_feedback:"edit",
      video_editor_email:"view", video_editor_instruction:"view", video_editor_link:"view", video_editor_status:"edit", editor_feedback:"edit",
      yt_upload_status:"edit", yt_upload_date:"edit", yt_link:"edit",
      short_links:"view", actual_links:"view",
      last_updated:"view",
    },
    rows: { match: "reviewer_email", gate: { col: "video_editor_status", equals: "Done" } },
    laneStatus: "yt_upload_status",
  },

  "Script Writer": {
    access: {
      video_title:"view", video_notes:"view", category:"view", subcategory:"view",
      script_instruction:"view", script_link:"edit", script_status:"edit", script_feedback:"view",
    },
    rows: { match: "script_writer_email", gate: { col: "topic_status", equals: "Ready" } },
    laneStatus: "script_status",
  },

  "Tutorial Maker": {
    access: {
      video_title:"view", video_notes:"view", category:"view", subcategory:"view",
      script_link:"view",                      // the approved script to record from
      tutorial_instruction:"view", tutorial_link:"edit", tutorial_status:"edit", tutorial_feedback:"view",
    },
    rows: { match: "tutorial_maker_email", gate: { col: "script_status", equals: "Done" } },
    laneStatus: "tutorial_status",
  },

  "Video Editor": {
    access: {
      video_title:"view", video_notes:"view", category:"view", subcategory:"view",
      tutorial_link:"view",                    // the approved recording to edit from
      video_editor_instruction:"view", video_editor_link:"edit", video_editor_status:"edit", editor_feedback:"view",
    },
    rows: { match: "video_editor_email", gate: { col: "tutorial_status", equals: "Done" } },
    laneStatus: "video_editor_status",
  },
};
