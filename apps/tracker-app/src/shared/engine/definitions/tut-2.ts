// ===========================================================================
// `tut-2` — the avatar-tutorial flow ("Tut 2"). THIS is what adding a system
// looks like: a handful of typed stage lines. No column keys, no control grid, no
// RBAC, no migration — the engine derives all of it. Storage is normalized, so
// these stages just become `card_stages` rows.
//
//   Topic(Admin) → Outline(Scriptwriter) → Recording(Tutorial Maker)
//     → Processing(Processor) → Editing(Video Editor)
//     → Thumbnail(Thumbnail Maker) → Upload(Uploader)
//
// Notes:
//   • Each deliverable is its own reviewable stage, so every part (outline,
//     recording, processed video, edit, thumbnail) is reviewed individually. One
//     person can wear several hats — assign the same person to consecutive roles
//     and the card simply flows back to them when the prior stage's gate opens.
//     Roles only decide WHO is assignable per stage; they never affect the flow.
//   • Processing is a real role now (was the Admin's own step). It's reviewable
//     like the rest — leave its reviewer blank on a card and submitting it
//     auto-completes to Done (no review), per the lifecycle.
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

    { id: "recording", label: "Screen recording", role: "Tutorial Maker", lifecycle: "review", gate: "outline",
      work: { id: "recording_link", label: "Screen recording", type: "url", slot: "work_link", required: "submit" } },

    { id: "processing", label: "Processing", role: "Processor", lifecycle: "review", gate: "recording",
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
