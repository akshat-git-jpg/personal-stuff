// ===========================================================================
// COLUMN METADATA — one descriptor per column: its label, the input widget it
// renders as, and an optional hint. This is the single place that decides how a
// column appears on the form. Adding a column = add one entry here (plus the
// column name in shared/columns.ts and its show/edit rules in shared/control.ts).
//
// Date / ETA-ness is NOT duplicated here — it stays canonical in
// shared/columns.ts (DATE_COLUMNS / ETA_COLUMNS), because the worker + control
// logic need it too. `fieldType()` resolves those first, then this map.
// ===========================================================================
import type { Column } from "../shared/columns";
import { DATE_COLUMNS, ETA_COLUMNS } from "../shared/columns";

export type FieldType =
  | "text"      // single-line text input
  | "textarea"  // multi-line (notes, instructions, feedback)
  | "combo"     // pick-from-list with "add new" (category/subcategory)
  | "assignee"  // person dropdown, filtered by the field's role
  | "link"      // URL input with an "Open ↗" affordance
  | "date"      // calendar date picker
  | "eta";      // calendar date picker + "days left / late" countdown badge

export interface ColMeta {
  label: string;
  type: FieldType;
  hint?: string;
  /** For `combo`: which option list to draw from. */
  options?: "category" | "subcategory";
}

export const PUBLIC_LINK_HINT =
  'Make sure this link is shared publicly — set it to "Anyone with the link can view"';

// Every column that can appear on the card form. Status/system columns
// (*_status, row_id, last_updated, status_since) are intentionally absent —
// status is driven by action buttons, and system columns are never shown.
export const COLUMN_META: Partial<Record<Column, ColMeta>> = {
  // Brief / meta
  video_title:       { label: "Video title",   type: "text" },
  video_notes:       { label: "Notes / brief",  type: "textarea" },
  video_description: { label: "Description",     type: "textarea" },
  category:          { label: "Category",        type: "combo", options: "category" },
  subcategory:       { label: "Subcategory",     type: "combo", options: "subcategory" },
  topic_date:        { label: "Topic date",      type: "date" },

  // Assignments
  admin_email:          { label: "Admin",        type: "assignee" },
  reviewer_email:       { label: "Reviewer",     type: "assignee" },
  script_writer_email:  { label: "Scriptwriter", type: "assignee" },
  tutorial_maker_email: { label: "Recorder",     type: "assignee" },
  video_editor_email:   { label: "Video editor", type: "assignee" },
  thumbnail_maker_email:{ label: "Thumbnail maker", type: "assignee" },
  uploader_email:       { label: "Uploader",     type: "assignee" },

  // Script
  script_instruction: { label: "Script instructions", type: "textarea" },
  script_link:        { label: "Script",              type: "link", hint: PUBLIC_LINK_HINT },
  script_eta:         { label: "Script ETA",          type: "eta" },
  script_feedback:    { label: "Script feedback",     type: "textarea" },

  // Recording
  tutorial_instruction: { label: "Recording instructions", type: "textarea" },
  tutorial_link:        { label: "Recording",              type: "link", hint: PUBLIC_LINK_HINT },
  tutorial_eta:         { label: "Recording ETA",          type: "eta" },
  tutorial_feedback:    { label: "Recording feedback",     type: "textarea" },

  // Editing
  video_editor_instruction: { label: "Editor instructions", type: "textarea" },
  video_editor_link:        { label: "Final video",         type: "link", hint: PUBLIC_LINK_HINT },
  video_editor_eta:         { label: "Editing ETA",         type: "eta" },
  editor_feedback:          { label: "Editor feedback",     type: "textarea" },

  // Thumbnail
  thumbnail_instruction: { label: "Thumbnail instructions", type: "textarea" },
  thumbnail_link:        { label: "Thumbnail",              type: "link", hint: PUBLIC_LINK_HINT },
  thumbnail_eta:         { label: "Thumbnail ETA",          type: "eta" },
  thumbnail_feedback:    { label: "Thumbnail feedback",     type: "textarea" },

  // Upload
  yt_eta:         { label: "Upload ETA",  type: "eta" },
  yt_upload_date: { label: "Upload date", type: "date" },
  yt_link:        { label: "YouTube link", type: "link", hint: PUBLIC_LINK_HINT },
  short_links:    { label: "Short links",  type: "link" },
  actual_links:   { label: "Actual links", type: "link" },
};

const DATE_SET = new Set<string>(DATE_COLUMNS);
const ETA_SET = new Set<string>(ETA_COLUMNS);

/** The widget a column renders as. ETA/date are authoritative from columns.ts. */
export function fieldType(col: string): FieldType {
  if (ETA_SET.has(col)) return "eta";
  if (DATE_SET.has(col)) return "date";
  return COLUMN_META[col as Column]?.type ?? "text";
}

/** Display label for a column (falls back to a humanised column name). */
export function colLabel(col: string): string {
  return COLUMN_META[col as Column]?.label ?? col.replace(/_/g, " ");
}

/** Public-share / format hint for a column, if any. */
export function colHint(col: string): string | undefined {
  return COLUMN_META[col as Column]?.hint;
}

/** Columns whose value is (or contains) a URL — get "Open ↗" treatment. */
export const LINK_COLS = new Set<string>(
  Object.entries(COLUMN_META).filter(([, m]) => m!.type === "link").map(([c]) => c),
);
