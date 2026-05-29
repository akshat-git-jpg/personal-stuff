export const COLUMNS = [
  "row_id","video_title","video_notes","video_description","category","subcategory",
  "topic_status","topic_date","tutorial_maker_email","tutorial_instruction","tutorial_link",
  "tutorial_status","tutorial_feedback","video_editor_email","video_editor_instruction","video_editor_link",
  "video_editor_status","editor_feedback","yt_upload_status","yt_upload_date","yt_link","short_links",
  "actual_links","reviewer_email","admin_email",
] as const;
export type Column = typeof COLUMNS[number];

export const GROUPS = {
  meta:     ["video_title","video_notes","video_description","category","subcategory","topic_status","topic_date"],
  tutorial: ["tutorial_maker_email","tutorial_instruction","tutorial_link","tutorial_status","tutorial_feedback"],
  editor:   ["video_editor_email","video_editor_instruction","video_editor_link","video_editor_status","editor_feedback"],
  publish:  ["yt_upload_status","yt_upload_date","yt_link","short_links","actual_links"],
  assign:   ["reviewer_email","admin_email"],
} satisfies Record<string, Column[]>;
export type Group = keyof typeof GROUPS;
