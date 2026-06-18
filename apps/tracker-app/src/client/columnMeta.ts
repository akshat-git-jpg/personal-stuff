// ===========================================================================
// COLUMN METADATA — the input WIDGET + hint per column. Labels are NOT here:
// they live once in shared/columns.ts (COLUMN_LABELS / columnLabel), so the
// form's field label and the gate messages ("Add the X first.") can never
// diverge. This file only decides how a column renders.
//
// Date / ETA-ness stays canonical in shared/columns.ts (DATE_COLUMNS /
// ETA_COLUMNS); `fieldType()` resolves those first, then this map.
// ===========================================================================
import type { Column } from "../shared/columns";
import { DATE_COLUMNS, ETA_COLUMNS, columnLabel } from "../shared/columns";

export type FieldType =
  | "text"      // single-line text input
  | "textarea"  // multi-line (notes, instructions, feedback)
  | "combo"     // pick-from-list with "add new" (category/subcategory)
  | "assignee"  // person dropdown, filtered by the field's role
  | "link"      // URL input with an "Open ↗" affordance
  | "date"      // calendar date picker
  | "eta";      // calendar date picker + "days left / late" countdown badge

export interface ColMeta {
  type: FieldType;
  hint?: string;
  /** For `combo`: which option list to draw from. */
  options?: "category" | "subcategory";
}

export const PUBLIC_LINK_HINT =
  'Make sure this link is shared publicly — set it to "Anyone with the link can view"';

// Widget + hint per renderable column. Status/system columns are absent (never
// shown as fields). Labels come from columnLabel() in shared/columns.ts.
export const COLUMN_META: Partial<Record<Column, ColMeta>> = {
  // Brief / meta
  video_title:       { type: "text" },
  video_notes:       { type: "textarea" },
  video_description: { type: "textarea" },
  category:          { type: "combo", options: "category" },
  subcategory:       { type: "combo", options: "subcategory" },
  topic_date:        { type: "date" },

  // Assignments
  admin_email:          { type: "assignee" },
  reviewer_email:       { type: "assignee" },
  script_writer_email:  { type: "assignee" },
  tutorial_maker_email: { type: "assignee" },
  video_editor_email:   { type: "assignee" },
  thumbnail_maker_email:{ type: "assignee" },
  uploader_email:       { type: "assignee" },
  // Per-stage reviewers (assignee dropdowns filtered to the Reviewer role; blank = no review)
  topic_reviewer_email:        { type: "assignee" },
  script_reviewer_email:       { type: "assignee" },
  tutorial_reviewer_email:     { type: "assignee" },
  video_editor_reviewer_email: { type: "assignee" },
  thumbnail_reviewer_email:    { type: "assignee" },

  // Script
  script_instruction: { type: "textarea" },
  script_link:        { type: "link", hint: PUBLIC_LINK_HINT },
  script_eta:         { type: "eta" },
  script_feedback:    { type: "textarea" },

  // Recording
  tutorial_instruction: { type: "textarea" },
  tutorial_link:        { type: "link", hint: PUBLIC_LINK_HINT },
  tutorial_eta:         { type: "eta" },
  tutorial_feedback:    { type: "textarea" },

  // Editing
  video_editor_instruction: { type: "textarea" },
  video_editor_link:        { type: "link", hint: PUBLIC_LINK_HINT },
  video_editor_eta:         { type: "eta" },
  editor_feedback:          { type: "textarea" },

  // Thumbnail
  thumbnail_instruction: { type: "textarea" },
  thumbnail_link:        { type: "link", hint: PUBLIC_LINK_HINT },
  thumbnail_eta:         { type: "eta" },
  thumbnail_feedback:    { type: "textarea" },

  // Upload
  yt_eta:         { type: "eta" },
  yt_upload_date: { type: "date" },
  yt_link:        { type: "link", hint: PUBLIC_LINK_HINT },
  short_links:    { type: "link" },
  actual_links:   { type: "link" },
};

const DATE_SET = new Set<string>(DATE_COLUMNS);
const ETA_SET = new Set<string>(ETA_COLUMNS);

/** The widget a column renders as. ETA/date are authoritative from columns.ts. */
export function fieldType(col: string): FieldType {
  if (ETA_SET.has(col)) return "eta";
  if (DATE_SET.has(col)) return "date";
  return COLUMN_META[col as Column]?.type ?? "text";
}

/** Display label for a column — delegates to the single shared source. */
export function colLabel(col: string): string {
  return columnLabel(col);
}

/** Public-share / format hint for a column, if any. */
export function colHint(col: string): string | undefined {
  return COLUMN_META[col as Column]?.hint;
}

/** Columns whose value is (or contains) a URL — get "Open ↗" treatment. */
export const LINK_COLS = new Set<string>(
  Object.entries(COLUMN_META).filter(([, m]) => m!.type === "link").map(([c]) => c),
);
