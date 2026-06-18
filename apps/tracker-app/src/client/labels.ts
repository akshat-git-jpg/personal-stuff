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
  thumbnail_link: PUBLIC_LINK_HINT,
  yt_link: PUBLIC_LINK_HINT,
};

export const LINK_COLS = new Set(["script_link", "tutorial_link", "video_editor_link", "thumbnail_link", "yt_link", "short_links", "actual_links"]);
export function isUrl(v: string): boolean { return /^https?:\/\//i.test((v ?? "").trim()); }

// ── ETA countdown badge ──────────────────────────────────────────────────────
// Given an ETA date (yyyy-mm-dd), returns the "days left / days late" chip text
// and a colour tone: green while there's runway, amber on the day, red once late.
export function etaBadge(value: string | undefined): { text: string; tone: string } | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const ts = Date.parse(v);
  if (isNaN(ts)) return null;
  const startOfDay = (d: Date) => { d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOfDay(new Date(ts)) - startOfDay(new Date())) / 86_400_000);
  if (days > 0) return { text: `${days}d left`, tone: "eta-ok" };
  if (days === 0) return { text: "due today", tone: "eta-due" };
  return { text: `${-days}d late`, tone: "eta-late" };
}

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
  video_editor_eta: "Editing ETA",
  editor_feedback: "Editor feedback",
  script_eta: "Script ETA",
  tutorial_eta: "Recording ETA",
  thumbnail_maker_email: "Thumbnail maker",
  thumbnail_instruction: "Thumbnail instructions",
  thumbnail_link: "Thumbnail",
  thumbnail_status: "Thumbnail status",
  thumbnail_eta: "Thumbnail ETA",
  thumbnail_feedback: "Thumbnail feedback",
  reviewer_email: "Reviewer",
  uploader_email: "Uploader",
  yt_upload_status: "Upload status",
  yt_eta: "Upload ETA",
  yt_upload_date: "Upload date",
  yt_link: "YouTube link",
  short_links: "Short links",
  actual_links: "Actual links",
  row_id: "ID",
};

export function fieldLabel(col: string): string {
  return FIELD_LABELS[col] ?? col.replace(/_/g, " ");
}
