import { STAGES, stageByStatusCol } from "../shared/pipeline";

// ── Stage maps, derived from the pipeline (single source of truth) ──────────

// status column → stage label / artifact (first edit link) / assignee / feedback
export const STAGE_NAME: Record<string, string> = {};
export const ARTIFACT_COL: Record<string, string> = {};
export const EMAIL_FOR_STAGE: Record<string, string> = {};
export const FEEDBACK_COL: Record<string, string> = {};
for (const s of STAGES) {
  STAGE_NAME[s.statusCol] = s.label;
  EMAIL_FOR_STAGE[s.statusCol] = s.assigneeCol;
  const link = s.editFields.find((c) => c.endsWith("_link") || c.endsWith("link"));
  if (link) ARTIFACT_COL[s.statusCol] = link;
  if (s.feedbackCol) FEEDBACK_COL[s.statusCol] = s.feedbackCol;
}

export function stageLabelForStatusCol(col: string): string {
  return stageByStatusCol(col)?.label ?? col;
}

// ── Link helpers ────────────────────────────────────────────────────────────

const PUBLIC_LINK_HINT = 'Make sure this link is shared publicly — set it to "Anyone with the link can view"';
export const LINK_HINTS: Record<string, string> = {
  script_link: PUBLIC_LINK_HINT,
  tutorial_link: PUBLIC_LINK_HINT,
  video_editor_link: PUBLIC_LINK_HINT,
  yt_link: PUBLIC_LINK_HINT,
};

export const LINK_COLS = new Set(["script_link", "tutorial_link", "video_editor_link", "yt_link", "short_links", "actual_links"]);
export function isUrl(v: string): boolean { return /^https?:\/\//i.test((v ?? "").trim()); }

// ── Human-readable field labels ──────────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  video_title: "Video title",
  video_notes: "Notes / brief",
  video_description: "Description",
  category: "Category",
  subcategory: "Subcategory",
  topic_status: "Topic status",
  topic_date: "Topic date",
  admin_email: "Admin",
  script_writer_email: "Scriptwriter",
  script_instruction: "Script instructions",
  script_link: "Script",
  script_status: "Script status",
  script_feedback: "Script feedback",
  tutorial_maker_email: "Recorder",
  tutorial_instruction: "Recording instructions",
  tutorial_link: "Recording",
  tutorial_status: "Recording status",
  tutorial_feedback: "Recording feedback",
  video_editor_email: "Video editor",
  video_editor_instruction: "Editor instructions",
  video_editor_link: "Final video",
  video_editor_status: "Editing status",
  editor_feedback: "Editor feedback",
  reviewer_email: "Reviewer",
  uploader_email: "Uploader",
  yt_upload_status: "Upload status",
  yt_upload_date: "Upload date",
  yt_link: "YouTube link",
  short_links: "Short links",
  actual_links: "Actual links",
  row_id: "ID",
};

export function fieldLabel(col: string): string {
  return FIELD_LABELS[col] ?? col.replace(/_/g, " ");
}
