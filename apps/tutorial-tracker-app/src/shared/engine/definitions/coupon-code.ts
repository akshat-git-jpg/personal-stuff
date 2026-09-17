// ===========================================================================
// `coupon-code` — the short coupon-code flow. Four stages, one per deliverable.
//
//   Topic(Admin) → Video(Video Editor) → Thumbnail(Thumbnail Maker) → Upload(Uploader)
//
// One person makes the whole video here — there is no separate script or
// recording stage. Roles are reused from the other systems so the global role
// roster does not grow; memberships stay scoped per system.
// ===========================================================================
import type { PipelineDef } from "../types";

export const couponCode: PipelineDef = {
  id: "coupon-code",
  name: "Coupon Code",
  stages: [
    { id: "topic", label: "Topic", role: "Admin", lifecycle: "approveOnly", kind: "brief",
      briefFields: ["video_title", "video_notes", "video_description", "topic_date"] },

    { id: "video", label: "Video", role: "Video Editor", lifecycle: "review", gate: "topic",
      contextFields: ["video_title", "video_notes"],
      work: { id: "final_video", label: "Final video", type: "url", slot: "work_link", required: "submit" } },

    { id: "thumbnail", label: "Thumbnail", role: "Thumbnail Maker", lifecycle: "review", gate: "video",
      work: { id: "thumbnail_link", label: "Thumbnail", type: "url", slot: "work_link", required: "submit" } },

    { id: "upload", label: "Upload", role: "Uploader", lifecycle: "terminal", gate: "thumbnail",
      needs: ["video", "thumbnail"],
      contextFields: ["video_title", "video_description"],
      work: { id: "yt_link", label: "YouTube link", type: "url", slot: "work_link", required: "submit" },
      extra: [{ id: "yt_upload_date", label: "Upload date", type: "date" }] },
  ],
};
