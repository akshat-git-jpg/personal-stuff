// The full Master column set, in logical order. This is the app's logical view;
// physical sheet order does NOT have to match — all Sheets I/O is keyed by header
// name (see worker/sheets.ts), so columns can be added here and the migration just
// appends any missing headers to the sheet without disturbing existing data.
//
// Every pipeline stage owns exactly one assignee column (ideator/script_writer/
// tutorial_maker/video_editor/thumbnail_maker/uploader _email) and — if reviewable —
// one feedback column (topic/script/tutorial/editor/thumbnail _feedback).
// reviewer_email is the single card-level reviewer that approves ALL reviewable
// stages of that card.
// Each producer stage (Script, Recording, Editing, Thumbnail, Upload) also owns
// an ETA column (*_eta): a calendar deadline the stage's worker commits to when
// they start (To Do -> In Progress). Topic has no ETA.
export const COLUMNS = [
  "video_title","video_notes","video_description","category","subcategory","topic_status","topic_date","admin_email",
  "script_writer_email","script_instruction","script_link","script_status","script_eta","script_feedback",
  "tutorial_maker_email","tutorial_instruction","tutorial_link","tutorial_status","tutorial_eta","tutorial_feedback",
  "video_editor_email","video_editor_instruction","video_editor_link","video_editor_status","video_editor_eta","editor_feedback",
  "thumbnail_maker_email","thumbnail_instruction","thumbnail_link","thumbnail_status","thumbnail_eta","thumbnail_feedback",
  "topic_reviewer_email","script_reviewer_email","tutorial_reviewer_email","video_editor_reviewer_email","thumbnail_reviewer_email",
  "reviewer_email","uploader_email","yt_upload_status","yt_eta","yt_upload_date","yt_link","short_links","actual_links",
  "row_id","last_updated","status_since",
] as const;
// NB: `reviewer_email` is the LEGACY single card-level reviewer (kept for back-compat /
// migration seed). Reviews are now per-stage via the `*_reviewer_email` columns above.
export type Column = typeof COLUMNS[number];

// Columns the card form renders as a calendar date picker (not a text box).
export const DATE_COLUMNS = [
  "topic_date","script_eta","tutorial_eta","video_editor_eta","thumbnail_eta","yt_eta","yt_upload_date",
] as const satisfies readonly Column[];

// ETA columns: date fields that ALSO get a "days left / days late" countdown
// badge (green when there's runway, red once overdue). One per producer stage,
// worker-only, editable only at To Do then locked once work starts.
export const ETA_COLUMNS = [
  "script_eta","tutorial_eta","video_editor_eta","thumbnail_eta","yt_eta",
] as const satisfies readonly Column[];
export const ETA_OF_STAGE: Record<string, Column> = {
  script: "script_eta", recording: "tutorial_eta",
  editing: "video_editor_eta", thumbnail: "thumbnail_eta", upload: "yt_eta",
};

// ---------------------------------------------------------------------------
// COLUMN LABELS — the SINGLE source for the human name of a column. Used by the
// form (field labels) AND by gate messages ("Add the X first."), so the two can
// never diverge. NB: several column NAMES are legacy ("tutorial_*") while the
// product term is "Recording" — that mapping lives here, once.
// ---------------------------------------------------------------------------
export const COLUMN_LABELS: Partial<Record<Column, string>> = {
  video_title: "Video title",
  video_notes: "Notes / brief",
  video_description: "Description",
  category: "Category",
  subcategory: "Subcategory",
  topic_status: "Topic status",
  topic_date: "Topic date",
  admin_email: "Admin",
  reviewer_email: "Reviewer",
  topic_reviewer_email: "Topic reviewer",
  script_reviewer_email: "Script reviewer",
  tutorial_reviewer_email: "Recording reviewer",
  video_editor_reviewer_email: "Editing reviewer",
  thumbnail_reviewer_email: "Thumbnail reviewer",
  script_writer_email: "Scriptwriter",
  tutorial_maker_email: "Recorder",
  video_editor_email: "Video editor",
  thumbnail_maker_email: "Thumbnail maker",
  uploader_email: "Uploader",
  script_instruction: "Script instructions",
  script_link: "Script",
  script_status: "Script status",
  script_eta: "Script ETA",
  script_feedback: "Script feedback",
  tutorial_instruction: "Recording instructions",
  tutorial_link: "Recording",
  tutorial_status: "Recording status",
  tutorial_eta: "Recording ETA",
  tutorial_feedback: "Recording feedback",
  video_editor_instruction: "Editor instructions",
  video_editor_link: "Final video",
  video_editor_status: "Editing status",
  video_editor_eta: "Editing ETA",
  editor_feedback: "Editor feedback",
  thumbnail_instruction: "Thumbnail instructions",
  thumbnail_link: "Thumbnail",
  thumbnail_status: "Thumbnail status",
  thumbnail_eta: "Thumbnail ETA",
  thumbnail_feedback: "Thumbnail feedback",
  yt_upload_status: "Upload status",
  yt_eta: "Upload ETA",
  yt_upload_date: "Upload date",
  yt_link: "YouTube link",
  short_links: "Short links",
  actual_links: "Actual links",
  row_id: "ID",
};

/** Human label for a column — the one true source (falls back to a humanised name). */
export function columnLabel(col: string): string {
  return COLUMN_LABELS[col as Column] ?? col.replace(/_/g, " ").replace(/\beta\b/i, "ETA");
}

// GROUPS kept for any importers that still reference it; not used by rbac.
export const GROUPS = {
  meta:     ["video_title","video_notes","video_description","category","subcategory","topic_status","topic_date"],
  script:   ["script_writer_email","script_instruction","script_link","script_status","script_eta","script_feedback"],
  tutorial: ["tutorial_maker_email","tutorial_instruction","tutorial_link","tutorial_status","tutorial_eta","tutorial_feedback"],
  editor:   ["video_editor_email","video_editor_instruction","video_editor_link","video_editor_status","video_editor_eta","editor_feedback"],
  thumbnail:["thumbnail_maker_email","thumbnail_instruction","thumbnail_link","thumbnail_status","thumbnail_eta","thumbnail_feedback"],
  publish:  ["reviewer_email","uploader_email","yt_upload_status","yt_eta","yt_upload_date","yt_link","short_links","actual_links"],
  assign:   ["reviewer_email","admin_email"],
} satisfies Record<string, Column[]>;
export type Group = keyof typeof GROUPS;
