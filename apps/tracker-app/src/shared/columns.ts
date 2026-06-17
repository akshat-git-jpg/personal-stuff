// The full Master column set, in logical order. This is the app's logical view;
// physical sheet order does NOT have to match — all Sheets I/O is keyed by header
// name (see worker/sheets.ts), so columns can be added here and the migration just
// appends any missing headers to the sheet without disturbing existing data.
//
// Every pipeline stage owns exactly one assignee column (ideator/script_writer/
// tutorial_maker/video_editor/uploader _email) and — if reviewable — one feedback
// column (topic/script/tutorial/editor _feedback). reviewer_email is the single
// card-level reviewer that approves ALL reviewable stages of that card.
export const COLUMNS = [
  "video_title","video_notes","video_description","category","subcategory","topic_status","topic_date","admin_email",
  "script_writer_email","script_instruction","script_link","script_status","script_feedback",
  "tutorial_maker_email","tutorial_instruction","tutorial_link","tutorial_status","tutorial_feedback",
  "video_editor_email","video_editor_instruction","video_editor_link","video_editor_status","editor_feedback",
  "reviewer_email","uploader_email","yt_upload_status","yt_upload_date","yt_link","short_links","actual_links",
  "row_id","last_updated",
] as const;
export type Column = typeof COLUMNS[number];

// GROUPS kept for any importers that still reference it; not used by rbac.
export const GROUPS = {
  meta:     ["video_title","video_notes","video_description","category","subcategory","topic_status","topic_date"],
  script:   ["script_writer_email","script_instruction","script_link","script_status","script_feedback"],
  tutorial: ["tutorial_maker_email","tutorial_instruction","tutorial_link","tutorial_status","tutorial_feedback"],
  editor:   ["video_editor_email","video_editor_instruction","video_editor_link","video_editor_status","editor_feedback"],
  publish:  ["reviewer_email","uploader_email","yt_upload_status","yt_upload_date","yt_link","short_links","actual_links"],
  assign:   ["reviewer_email","admin_email"],
} satisfies Record<string, Column[]>;
export type Group = keyof typeof GROUPS;
