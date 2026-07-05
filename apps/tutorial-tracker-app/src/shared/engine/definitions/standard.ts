// ===========================================================================
// `standard` — the existing 6-stage pipeline, reproduced as a definition.
//
// This is the ONE verbose def: it pins legacy flat-Row column keys (`cols`) and
// the historical feedback-column name (`editor_feedback`) so existing cards and
// every flat-Row consumer stay byte-identical after the engine migration.
// New pipelines (see tut-2.ts) omit all of this and are a few lines each.
//
//   Topic(Admin) → Script(Scriptwriter) → Recording(Recorder)
//     → Editing(Video Editor) → Thumbnail(Thumbnail Maker) → Upload(Uploader)
// ===========================================================================
import type { PipelineDef } from "../types";

export const standard: PipelineDef = {
  id: "standard",
  name: "Standard",
  stages: [
    {
      id: "topic", label: "Topic", role: "Admin", lifecycle: "approveOnly", kind: "brief",
      cols: { status: "topic_status", assignee: "admin_email", reviewer: "topic_reviewer_email" },
      briefFields: ["video_title", "video_notes", "video_description", "category", "subcategory", "topic_date"],
    },
    {
      id: "script", label: "Script", role: "Scriptwriter", lifecycle: "review", gate: "topic",
      contextFields: ["video_title", "video_notes", "category", "subcategory"],
      work: { id: "script_link", label: "Script", type: "url", slot: "work_link", required: "submit" },
      cols: {
        status: "script_status", assignee: "script_writer_email", reviewer: "script_reviewer_email",
        work_link: "script_link", eta: "script_eta", instruction: "script_instruction", feedback: "script_feedback",
      },
    },
    {
      id: "recording", label: "Recording", role: "Recorder", lifecycle: "review", gate: "script",
      work: { id: "tutorial_link", label: "Recording", type: "url", slot: "work_link", required: "submit" },
      cols: {
        status: "tutorial_status", assignee: "tutorial_maker_email", reviewer: "tutorial_reviewer_email",
        work_link: "tutorial_link", eta: "tutorial_eta", instruction: "tutorial_instruction", feedback: "tutorial_feedback",
      },
    },
    {
      id: "editing", label: "Editing", role: "Video Editor", lifecycle: "review", gate: "recording",
      work: { id: "video_editor_link", label: "Final video", type: "url", slot: "work_link", required: "submit" },
      cols: {
        status: "video_editor_status", assignee: "video_editor_email", reviewer: "video_editor_reviewer_email",
        work_link: "video_editor_link", eta: "video_editor_eta", instruction: "video_editor_instruction", feedback: "editor_feedback",
      },
    },
    {
      id: "thumbnail", label: "Thumbnail", role: "Thumbnail Maker", lifecycle: "review", gate: "editing",
      work: { id: "thumbnail_link", label: "Thumbnail", type: "url", slot: "work_link", required: "submit" },
      cols: {
        status: "thumbnail_status", assignee: "thumbnail_maker_email", reviewer: "thumbnail_reviewer_email",
        work_link: "thumbnail_link", eta: "thumbnail_eta", instruction: "thumbnail_instruction", feedback: "thumbnail_feedback",
      },
    },
    {
      id: "upload", label: "Upload", role: "Uploader", lifecycle: "terminal", gate: "thumbnail",
      needs: ["editing", "thumbnail"], // uploader views both the final video and the thumbnail
      contextFields: ["video_title", "video_description"], // pastes the description into YouTube
      work: { id: "yt_link", label: "YouTube link", type: "url", slot: "work_link", required: "submit" },
      extra: [
        { id: "yt_upload_date", label: "Upload date", type: "date" },
        { id: "short_links", label: "Short links", type: "textarea" },
        { id: "actual_links", label: "Actual links", type: "textarea" },
      ],
      cols: { status: "yt_upload_status", assignee: "uploader_email", work_link: "yt_link", eta: "yt_eta" },
    },
  ],
};
