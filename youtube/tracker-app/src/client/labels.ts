// ── Stage → feedback column map ───────────────────────────────────────────
// Maps a doer's owned status column to the feedback column they can read.
export const FEEDBACK_COL: Record<string, string> = {
  tutorial_status:     "tutorial_feedback",
  video_editor_status: "editor_feedback",
};

// ── Human-readable labels ─────────────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  video_title:               "Video title",
  video_notes:               "Notes / brief",
  video_description:         "Description",
  category:                  "Category",
  subcategory:               "Subcategory",
  topic_status:              "Topic status",
  topic_date:                "Topic date",
  tutorial_maker_email:      "Tutorial maker",
  tutorial_instruction:      "Tutorial instructions",
  tutorial_link:             "Tutorial / script link",
  tutorial_status:           "Tutorial status",
  video_editor_email:        "Video editor",
  video_editor_instruction:  "Editor instructions",
  video_editor_link:         "Video link",
  video_editor_status:       "Editing status",
  yt_upload_status:          "Upload status",
  yt_upload_date:            "Upload date",
  yt_link:                   "YouTube link",
  short_links:               "Short links",
  actual_links:              "Actual links",
  reviewer_email:            "Reviewer",
  admin_email:               "Admin",
  row_id:                    "ID",
};

// LANE_LABELS: keyed by status column → raw value → friendly label
// The friendly label is DISPLAY-ONLY; values written to the sheet stay raw.
export const LANE_LABELS: Record<string, Record<string, string>> = {
  tutorial_status: {
    "To Do":       "To Do",
    "In Progress": "Working on it",
    "In Review":   "Submitted for review",
    "Done":        "Done",
  },
  video_editor_status: {
    "To Do":       "To Do",
    "In Progress": "Working on it",
    "In Review":   "Submitted for review",
    "Done":        "Done",
  },
  yt_upload_status: {
    "To Do":    "To Do",
    "Draft":    "Draft",
    "Uploaded": "Uploaded",
  },
  topic_status: {
    "To Do":      "To Do",
    "To Process": "To Process",
    "To Review":  "To Review",
  },
};

/** Return the friendly label for a lane value (falls back to raw value). */
export function laneLabel(laneStatusCol: string, rawValue: string): string {
  return LANE_LABELS[laneStatusCol]?.[rawValue] ?? rawValue;
}

/**
 * Maps lane index → stage key ("todo" | "prog" | "review" | "done").
 * Index 0 → todo, last → done, middle ones cycle prog/review.
 *   4 lanes: [todo, prog, review, done]
 *   3 lanes: [todo, prog, done]
 */
export function laneColor(index: number, total: number): "todo" | "prog" | "review" | "done" {
  if (index === 0) return "todo";
  if (index === total - 1) return "done";
  // For middle indices
  const middleIndex = index - 1; // 0-based among middle lanes
  if (middleIndex % 2 === 0) return "prog";
  return "review";
}
