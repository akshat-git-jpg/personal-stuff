// ===========================================================================
// `tut-2` — the avatar-tutorial flow ("Tut 2"). THIS is what adding a system
// looks like: a handful of typed stage lines. No column keys, no control grid, no
// RBAC, no migration — the engine derives all of it. Storage is normalized, so
// these stages just become `card_stages` rows.
//
//   Topic(Admin) → Outline(Scriptwriter) → Screen recording(Scriptwriter)
//     → Processing(Admin, no review) → Editing(Video Editor)
//     → Thumbnail(Thumbnail Maker) → Upload(Uploader)
//
// Notes:
//   • The scriptwriter owns BOTH outline and recording (one person, two reviewed
//     stages) — same role on two stages, assigned to the same person per card.
//   • Processing is the admin's own step (run the TY tutorial-pipeline, paste the
//     Drive inputs link). lifecycle "task" ⇒ no reviewer; "Complete" finishes it.
// ===========================================================================
import type { PipelineDef } from "../types";

export const tut2: PipelineDef = {
  id: "tut-2",
  name: "Tut 2",
  stages: [
    { id: "topic", label: "Topic", role: "Admin", lifecycle: "approveOnly", kind: "brief",
      briefFields: ["video_title", "video_notes", "video_description", "category", "subcategory", "topic_date"] },

    { id: "outline", label: "Outline", role: "Scriptwriter", lifecycle: "review", gate: "topic",
      work: { id: "outline_doc", label: "Outline", type: "url", slot: "work_link", required: "submit" } },

    { id: "recording", label: "Screen recording", role: "Scriptwriter", lifecycle: "review", gate: "outline",
      work: { id: "recording_link", label: "Screen recording", type: "url", slot: "work_link", required: "submit" } },

    { id: "processing", label: "Processing", role: "Admin", lifecycle: "task", gate: "recording",
      work: { id: "inputs_link", label: "Editor inputs (Drive)", type: "url", slot: "work_link", required: "submit" } },

    { id: "editing", label: "Editing", role: "Video Editor", lifecycle: "review", gate: "processing",
      work: { id: "final_video", label: "Final video", type: "url", slot: "work_link", required: "submit" } },

    { id: "thumbnail", label: "Thumbnail", role: "Thumbnail Maker", lifecycle: "review", gate: "editing",
      work: { id: "thumbnail_link", label: "Thumbnail", type: "url", slot: "work_link", required: "submit" } },

    { id: "upload", label: "Upload", role: "Uploader", lifecycle: "terminal", gate: "thumbnail",
      needs: ["editing", "thumbnail"],
      work: { id: "yt_link", label: "YouTube link", type: "url", slot: "work_link", required: "submit" },
      extra: [{ id: "yt_upload_date", label: "Upload date", type: "date" }] },
  ],
};
