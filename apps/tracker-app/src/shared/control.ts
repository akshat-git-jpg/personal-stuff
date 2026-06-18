// ===========================================================================
// CONTROL TABLES — the human-editable rule sheet.
//
// This is the file YOU edit to control, per stage, per role, per status:
//   • which columns SHOW on the card form
//   • which of those are EDITABLE (the rest are shown but disabled / read-only)
//   • which columns MUST be filled before a status can move forward
//
// Each stage has two tables, because the two roles behave differently:
//
//   worker   — the person who DOES that stage's work. One block per status:
//                show:     columns visible on the form (others are HIDDEN)
//                edit:     of those, the EDITABLE ones (rest are read-only)
//                mustFill: columns required before SUBMITTING / advancing from
//                          this status. NOTE: To Do's forward move is "Start"
//                          (To Do → In Progress), so mustFill on To Do is what
//                          gates starting work. Empty = nothing required.
//                          ("Resume editing" from Need Changes is a backward
//                          move and is never gated.)
//
//   reviewer — the card's assigned Reviewer. The reviewer has TWO forward
//              actions, so requirements hang off the ACTION, not the status:
//                byStatus:   per status, just { show, edit } (visibility).
//                toApprove:  columns required before APPROVE (→ Done).
//                toSendBack: columns required before REQUEST CHANGES
//                            (→ Need Changes). Typically the feedback column.
//
// PIPELINE ORDER: Topic → Script → Recording → Editing → Thumbnail → Upload.
//
// EXAMPLE (worker)
//   "In Progress": { show: [a, b, c], edit: [c], mustFill: [c] }
//   → form shows a, b, c; only c is typeable; a and b are read-only; and you
//     can't submit until c has a value.
//
// NOTES
//   • Admin always sees and edits EVERYTHING — Admin is not tabled here.
//   • A requirement may reference ANY column, including one owned by a
//     different stage. That's how "the reviewer must fill the NEXT worker's
//     instructions before approving" is expressed:
//        approving Topic     requires script_instruction
//        approving Script    requires tutorial_instruction       (the Recorder's)
//        approving Recording requires video_editor_instruction
//        approving Editing   requires thumbnail_instruction
//        approving Thumbnail requires nothing  (Upload has no instruction box)
//     The reviewer sees ALL instruction boxes in every review; only some are
//     required, via `toApprove`. Nothing hardcoded.
//   • ETA: Script / Recording / Editing / Thumbnail / Upload each have an
//     `*_eta` column — a calendar DATE the worker commits to. REQUIRED before
//     To Do → In Progress (in the To Do `mustFill`) and EDITABLE ONLY at To Do —
//     once work starts it shows read-only. Worker-only; Topic has none.
//   • Valid statuses differ per stage:
//       Topic                        : To Do, In Progress, In Review, Done   (approve-only)
//       Script/Record/Edit/Thumbnail : To Do, In Progress, In Review, Need Changes, Done
//       Upload                       : To Do, In Progress, Uploaded          (no review)
//   • Topic is approve-only and Upload is not reviewed → their reviewer
//     `toSendBack` lists are empty.
//   • Column names are type-checked: a misspelled column is a build error.
//
// AVAILABLE COLUMNS (copy names from here):
//   Brief / meta : video_title, video_notes, video_description, category,
//                  subcategory, topic_date
//   Assignments  : admin_email, reviewer_email, script_writer_email,
//                  tutorial_maker_email, video_editor_email, thumbnail_maker_email,
//                  uploader_email
//   Instructions : script_instruction, tutorial_instruction,
//                  video_editor_instruction, thumbnail_instruction
//   ETA (dates)  : script_eta, tutorial_eta, video_editor_eta, thumbnail_eta, yt_eta
//   Script       : script_link, script_feedback
//   Recording    : tutorial_link, tutorial_feedback
//   Editing      : video_editor_link, editor_feedback
//   Thumbnail    : thumbnail_link, thumbnail_feedback
//   Upload       : yt_link, yt_upload_date, short_links, actual_links
// ===========================================================================
import type { Column } from "./columns";

/** Columns visible / editable on a form (no validation). */
export interface FieldView {
  /** Columns visible on the form. Anything not listed is hidden. */
  show: Column[];
  /** Of the shown columns, the ones that are editable. The rest are read-only. */
  edit: Column[];
}

/** A worker's form rules at one status: visibility + the submit gate. */
export interface FormRule extends FieldView {
  /** Columns required before submitting / advancing forward from this status. */
  mustFill: Column[];
}

/** The worker (stage owner) table: one FormRule per status. */
export type WorkerControl = Record<string, FormRule>;

/** The reviewer table: per-status visibility + per-action requirements. */
export interface ReviewerControl {
  /** What the reviewer sees / can edit at each status. */
  byStatus: Record<string, FieldView>;
  /** Columns required before APPROVE (→ Done). May reference another stage's
   *  column (e.g. the next worker's instruction). */
  toApprove: Column[];
  /** Columns required before REQUEST CHANGES (→ Need Changes). Empty if the
   *  stage can't be sent back (Topic is approve-only; Upload isn't reviewed). */
  toSendBack: Column[];
}

/** The worker and reviewer tables for one stage. */
export interface StageControl {
  worker: WorkerControl;
  reviewer: ReviewerControl;
}

/** Which table a viewer reads: the stage owner ("worker") or the card Reviewer. */
export type RoleKind = "worker" | "reviewer";

// ---------------------------------------------------------------------------
// New-video creation form. The fields required to create a card, shared by the
// client modal (renders + validates) and the worker (/api/video validates +
// writes). Add a field here once and it shows up + is enforced on both sides.
// ---------------------------------------------------------------------------
export interface NewVideoField {
  col: Column;
  label: string;
  type: "text" | "textarea" | "combo";
  options?: "category" | "subcategory"; // for combo
}
export const NEW_VIDEO_FIELDS: NewVideoField[] = [
  { col: "video_title", label: "Title", type: "text" },
  { col: "video_notes", label: "Notes / brief", type: "textarea" },
  { col: "category", label: "Category", type: "combo", options: "category" },
  {
    col: "subcategory",
    label: "Subcategory",
    type: "combo",
    options: "subcategory",
  },
];

export const CONTROL: Record<string, StageControl> = {
  // =========================================================================
  // TOPIC  ·  worker = Admin  ·  approve-only (no "Need Changes")  ·  no ETA
  // The setup stage: the Admin writes the brief and assigns everyone (incl. the
  // Thumbnail Maker); the Reviewer writes the starting instructions for each
  // downstream stage. Approving Topic requires the Scriptwriter's instruction.
  // =========================================================================
  topic: {
    worker: {
      "To Do": {
        show: [
          "video_title",
          "video_notes",
          "video_description",
          "category",
          "subcategory",
          "topic_date",
          "admin_email",
          "reviewer_email",
          "script_writer_email",
          "tutorial_maker_email",
          "video_editor_email",
          "thumbnail_maker_email",
          "uploader_email",
          "script_instruction",
          "tutorial_instruction",
          "video_editor_instruction",
          "thumbnail_instruction",
        ],
        edit: [
          "video_title",
          "video_notes",
          "video_description",
          "category",
          "subcategory",
          "reviewer_email",
          "script_writer_email",
          "tutorial_maker_email",
          "video_editor_email",
          "thumbnail_maker_email",
          "uploader_email",
        ],
        mustFill: [],
      },
      "In Progress": {
        show: [
          "video_title",
          "video_notes",
          "video_description",
          "category",
          "subcategory",
          "topic_date",
          "admin_email",
          "reviewer_email",
          "script_writer_email",
          "tutorial_maker_email",
          "video_editor_email",
          "thumbnail_maker_email",
          "uploader_email",
          "script_instruction",
          "tutorial_instruction",
          "video_editor_instruction",
          "thumbnail_instruction",
        ],
        edit: [
          "video_title",
          "video_notes",
          "video_description",
          "category",
          "subcategory",
          "reviewer_email",
          "script_writer_email",
          "tutorial_maker_email",
          "video_editor_email",
          "thumbnail_maker_email",
          "uploader_email",
        ],
        mustFill: [
          "video_title",
          "video_notes",
          "video_description",
          "category",
          "subcategory",
          "topic_date",
          "admin_email",
          "reviewer_email",
          "script_writer_email",
          "tutorial_maker_email",
          "video_editor_email",
          "thumbnail_maker_email",
          "uploader_email",
        ],
      },
      "In Review": {
        show: [
          "video_title",
          "video_notes",
          "video_description",
          "category",
          "subcategory",
          "topic_date",
          "admin_email",
          "reviewer_email",
          "script_writer_email",
          "tutorial_maker_email",
          "video_editor_email",
          "thumbnail_maker_email",
          "uploader_email",
          "script_instruction",
          "tutorial_instruction",
          "video_editor_instruction",
          "thumbnail_instruction",
        ],
        edit: [],
        mustFill: [],
      },
      Done: {
        show: [
          "video_title",
          "video_notes",
          "video_description",
          "category",
          "subcategory",
          "topic_date",
          "admin_email",
          "reviewer_email",
          "script_writer_email",
          "tutorial_maker_email",
          "video_editor_email",
          "thumbnail_maker_email",
          "uploader_email",
          "script_instruction",
          "tutorial_instruction",
          "video_editor_instruction",
          "thumbnail_instruction",
        ],
        edit: [],
        mustFill: [],
      },
    },
    reviewer: {
      byStatus: {
        "To Do": {
          show: [
            "video_title",
            "video_notes",
            "video_description",
            "category",
            "subcategory",
            "reviewer_email",
            "script_writer_email",
            "tutorial_maker_email",
            "video_editor_email",
            "thumbnail_maker_email",
            "uploader_email",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Progress": {
          show: [
            "video_title",
            "video_notes",
            "video_description",
            "category",
            "subcategory",
            "reviewer_email",
            "script_writer_email",
            "tutorial_maker_email",
            "video_editor_email",
            "thumbnail_maker_email",
            "uploader_email",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Review": {
          show: [
            "video_title",
            "video_notes",
            "video_description",
            "category",
            "subcategory",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        Done: {
          show: [
            "video_title",
            "video_notes",
            "video_description",
            "category",
            "subcategory",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [],
        },
      },
      toApprove: ["script_instruction"], // must brief the Scriptwriter before approving the Topic
      toSendBack: [], // Topic is approve-only — can't be sent back
    },
  },

  // =========================================================================
  // SCRIPT  ·  worker = Scriptwriter  ·  reviewer = card Reviewer
  // Approving the Script requires the Recorder's instruction to be written.
  // =========================================================================
  script: {
    worker: {
      "To Do": {
        show: [
          "video_title",
          "video_notes",
          "category",
          "subcategory",
          "script_instruction",
          "script_eta",
        ],
        edit: ["script_eta"],
        mustFill: ["script_eta"],
      },
      "In Progress": {
        show: [
          "video_title",
          "video_notes",
          "category",
          "subcategory",
          "script_instruction",
          "script_eta",
          "script_link",
        ],
        edit: ["script_link"],
        mustFill: ["script_link"],
      },
      "In Review": {
        show: [
          "video_title",
          "video_notes",
          "category",
          "subcategory",
          "script_instruction",
          "script_eta",
          "script_link",
        ],
        edit: [],
        mustFill: [],
      },
      "Need Changes": {
        show: [
          "video_title",
          "video_notes",
          "category",
          "subcategory",
          "script_instruction",
          "script_eta",
          "script_link",
          "script_feedback",
        ],
        edit: ["script_link"],
        mustFill: ["script_link"],
      },
      Done: {
        show: ["video_title", "script_eta", "script_link"],
        edit: [],
        mustFill: [],
      },
    },
    reviewer: {
      byStatus: {
        "To Do": {
          show: [
            "video_title",
            "video_notes",
            "category",
            "subcategory",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Progress": {
          show: [
            "video_title",
            "video_notes",
            "category",
            "subcategory",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "script_link",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Review": {
          show: [
            "video_title",
            "video_notes",
            "category",
            "subcategory",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "script_link",
            "script_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "script_feedback",
          ],
        },
        "Need Changes": {
          show: [
            "video_title",
            "video_notes",
            "category",
            "subcategory",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "script_link",
            "script_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        Done: {
          show: [
            "video_title",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "script_link",
            "script_feedback",
          ],
          edit: [],
        },
      },
      toApprove: ["tutorial_instruction"], // must brief the Recorder before approving the Script
      toSendBack: ["script_feedback"],
    },
  },

  // =========================================================================
  // RECORDING  ·  worker = Recorder  ·  reviewer = card Reviewer
  // Approving the Recording requires the Video Editor's instruction.
  // =========================================================================
  recording: {
    worker: {
      "To Do": {
        show: [
          "video_title",
          "video_notes",
          "script_link",
          "tutorial_instruction",
          "tutorial_eta",
        ],
        edit: ["tutorial_eta"],
        mustFill: ["tutorial_eta"],
      },
      "In Progress": {
        show: [
          "video_title",
          "video_notes",
          "script_link",
          "tutorial_instruction",
          "tutorial_eta",
          "tutorial_link",
        ],
        edit: ["tutorial_link"],
        mustFill: ["tutorial_link"],
      },
      "In Review": {
        show: [
          "video_title",
          "video_notes",
          "script_link",
          "tutorial_instruction",
          "tutorial_eta",
          "tutorial_link",
        ],
        edit: [],
        mustFill: [],
      },
      "Need Changes": {
        show: [
          "video_title",
          "video_notes",
          "script_link",
          "tutorial_instruction",
          "tutorial_eta",
          "tutorial_link",
          "tutorial_feedback",
        ],
        edit: ["tutorial_link"],
        mustFill: ["tutorial_link"],
      },
      Done: {
        show: ["video_title", "tutorial_eta", "tutorial_link"],
        edit: [],
        mustFill: [],
      },
    },
    reviewer: {
      byStatus: {
        "To Do": {
          show: [
            "video_title",
            "video_notes",
            "script_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Progress": {
          show: [
            "video_title",
            "video_notes",
            "script_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "tutorial_link",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Review": {
          show: [
            "video_title",
            "video_notes",
            "script_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "tutorial_link",
            "tutorial_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "tutorial_feedback",
          ],
        },
        "Need Changes": {
          show: [
            "video_title",
            "video_notes",
            "script_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "tutorial_link",
            "tutorial_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        Done: {
          show: [
            "video_title",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "tutorial_link",
            "tutorial_feedback",
          ],
          edit: [],
        },
      },
      toApprove: ["video_editor_instruction"], // must brief the Video Editor before approving the Recording
      toSendBack: ["tutorial_feedback"],
    },
  },

  // =========================================================================
  // EDITING  ·  worker = Video Editor  ·  reviewer = card Reviewer
  // Approving the Editing requires the Thumbnail Maker's instruction (Thumbnail
  // is now the next stage).
  // =========================================================================
  editing: {
    worker: {
      "To Do": {
        show: [
          "video_title",
          "video_notes",
          "tutorial_link",
          "video_editor_instruction",
          "video_editor_eta",
        ],
        edit: ["video_editor_eta"],
        mustFill: ["video_editor_eta"],
      },
      "In Progress": {
        show: [
          "video_title",
          "video_notes",
          "tutorial_link",
          "video_editor_instruction",
          "video_editor_eta",
          "video_editor_link",
        ],
        edit: ["video_editor_link"],
        mustFill: ["video_editor_link"],
      },
      "In Review": {
        show: [
          "video_title",
          "video_notes",
          "tutorial_link",
          "video_editor_instruction",
          "video_editor_eta",
          "video_editor_link",
        ],
        edit: [],
        mustFill: [],
      },
      "Need Changes": {
        show: [
          "video_title",
          "video_notes",
          "tutorial_link",
          "video_editor_instruction",
          "video_editor_eta",
          "video_editor_link",
          "editor_feedback",
        ],
        edit: ["video_editor_link"],
        mustFill: ["video_editor_link"],
      },
      Done: {
        show: ["video_title", "video_editor_eta", "video_editor_link"],
        edit: [],
        mustFill: [],
      },
    },
    reviewer: {
      byStatus: {
        "To Do": {
          show: [
            "video_title",
            "video_notes",
            "tutorial_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Progress": {
          show: [
            "video_title",
            "video_notes",
            "tutorial_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "video_editor_link",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Review": {
          show: [
            "video_title",
            "video_notes",
            "tutorial_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "video_editor_link",
            "editor_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "editor_feedback",
          ],
        },
        "Need Changes": {
          show: [
            "video_title",
            "video_notes",
            "tutorial_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "video_editor_link",
            "editor_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        Done: {
          show: [
            "video_title",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "video_editor_link",
            "editor_feedback",
          ],
          edit: [],
        },
      },
      toApprove: ["thumbnail_instruction"], // must brief the Thumbnail Maker before approving the Editing
      toSendBack: ["editor_feedback"],
    },
  },

  // =========================================================================
  // THUMBNAIL  ·  worker = Thumbnail Maker  ·  reviewer = card Reviewer
  // Comes after Editing, before Upload. Approving it requires nothing (Upload
  // has no instruction box).
  // =========================================================================
  thumbnail: {
    worker: {
      "To Do": {
        show: [
          "video_title",
          "video_notes",
          "video_editor_link",
          "thumbnail_instruction",
          "thumbnail_eta",
        ],
        edit: ["thumbnail_eta"],
        mustFill: ["thumbnail_eta"],
      },
      "In Progress": {
        show: [
          "video_title",
          "video_notes",
          "video_editor_link",
          "thumbnail_instruction",
          "thumbnail_eta",
          "thumbnail_link",
        ],
        edit: ["thumbnail_link"],
        mustFill: ["thumbnail_link"],
      },
      "In Review": {
        show: [
          "video_title",
          "video_notes",
          "video_editor_link",
          "thumbnail_instruction",
          "thumbnail_eta",
          "thumbnail_link",
        ],
        edit: [],
        mustFill: [],
      },
      "Need Changes": {
        show: [
          "video_title",
          "video_notes",
          "video_editor_link",
          "thumbnail_instruction",
          "thumbnail_eta",
          "thumbnail_link",
          "thumbnail_feedback",
        ],
        edit: ["thumbnail_link"],
        mustFill: ["thumbnail_link"],
      },
      Done: {
        show: ["video_title", "thumbnail_eta", "thumbnail_link"],
        edit: [],
        mustFill: [],
      },
    },
    reviewer: {
      byStatus: {
        "To Do": {
          show: [
            "video_title",
            "video_notes",
            "video_editor_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Progress": {
          show: [
            "video_title",
            "video_notes",
            "video_editor_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "thumbnail_link",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        "In Review": {
          show: [
            "video_title",
            "video_notes",
            "video_editor_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "thumbnail_link",
            "thumbnail_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "thumbnail_feedback",
          ],
        },
        "Need Changes": {
          show: [
            "video_title",
            "video_notes",
            "video_editor_link",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "thumbnail_link",
            "thumbnail_feedback",
          ],
          edit: [
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
          ],
        },
        Done: {
          show: [
            "video_title",
            "script_instruction",
            "tutorial_instruction",
            "video_editor_instruction",
            "thumbnail_instruction",
            "thumbnail_link",
            "thumbnail_feedback",
          ],
          edit: [],
        },
      },
      toApprove: [], // Upload (next stage) has no instruction column
      toSendBack: ["thumbnail_feedback"],
    },
  },

  // =========================================================================
  // UPLOAD  ·  worker = Uploader  ·  TERMINAL (no review)
  // Gated on Thumbnail being Done. The Uploader sees the thumbnail_link.
  // The reviewer table is view-only because Upload is not reviewed.
  // =========================================================================
  upload: {
    worker: {
      "To Do": {
        show: [
          "video_title",
          "video_description",
          "video_editor_link",
          "thumbnail_link",
          "yt_eta",
        ],
        edit: ["yt_eta"],
        mustFill: ["yt_eta"],
      },
      "In Progress": {
        show: [
          "video_title",
          "video_description",
          "video_editor_link",
          "thumbnail_link",
          "yt_eta",
          "yt_link",
          "yt_upload_date",
          "short_links",
          "actual_links",
        ],
        edit: ["yt_link", "yt_upload_date", "short_links", "actual_links"],
        mustFill: ["yt_link"],
      },
      Uploaded: {
        show: [
          "video_title",
          "thumbnail_link",
          "yt_eta",
          "yt_link",
          "yt_upload_date",
          "short_links",
          "actual_links",
        ],
        edit: [],
        mustFill: [],
      },
    },
    reviewer: {
      byStatus: {
        "To Do": {
          show: [
            "video_title",
            "video_description",
            "video_editor_link",
            "thumbnail_link",
          ],
          edit: [],
        },
        "In Progress": {
          show: [
            "video_title",
            "video_description",
            "video_editor_link",
            "thumbnail_link",
            "yt_link",
            "yt_upload_date",
            "short_links",
            "actual_links",
          ],
          edit: [],
        },
        Uploaded: {
          show: [
            "video_title",
            "thumbnail_link",
            "yt_link",
            "yt_upload_date",
            "short_links",
            "actual_links",
          ],
          edit: [],
        },
      },
      toApprove: [],
      toSendBack: [], // Upload is not reviewed.
    },
  },
};

// ===========================================================================
// Consumers — the helpers the app reads. Both the React client (form rendering)
// and the Worker (write enforcement / transition gates) call these, so the
// tables above are the single source for what shows, what's editable, and what
// must be filled. Nothing re-derives these rules elsewhere.
// ===========================================================================

function ruleFor(
  stageId: string,
  kind: RoleKind,
  status: string
): FieldView | FormRule | undefined {
  const sc = CONTROL[stageId];
  if (!sc) return undefined;
  return kind === "worker" ? sc.worker[status] : sc.reviewer.byStatus[status];
}

/** Columns shown on the form for (stage, role, status). Anything else is hidden. */
export function showColumns(
  stageId: string,
  kind: RoleKind,
  status: string
): Column[] {
  return ruleFor(stageId, kind, status)?.show ?? [];
}

/** Columns editable on the form for (stage, role, status). The rest are read-only. */
export function editColumns(
  stageId: string,
  kind: RoleKind,
  status: string
): Column[] {
  return ruleFor(stageId, kind, status)?.edit ?? [];
}

/** Columns a worker must fill to make the forward move FROM `status`
 *  (To Do→In Progress "Start", In Progress/Need Changes→In Review "Submit",
 *  In Progress→Uploaded "Mark uploaded"). */
export function requiredToSubmitFrom(
  stageId: string,
  status: string
): Column[] {
  return CONTROL[stageId]?.worker[status]?.mustFill ?? [];
}

/** Columns the reviewer must fill to APPROVE (→ Done) — may be another stage's column. */
export function requiredToApprove(stageId: string): Column[] {
  return CONTROL[stageId]?.reviewer.toApprove ?? [];
}

/** Columns the reviewer must fill to SEND BACK (→ Need Changes). */
export function requiredToSendBack(stageId: string): Column[] {
  return CONTROL[stageId]?.reviewer.toSendBack ?? [];
}

/** A human label for a column, used in "Add the … first." messages. */
export function columnLabel(col: string): string {
  return col.replace(/_/g, " ").replace(/\beta\b/i, "ETA");
}

/** The subset of `cols` that are still empty on `row`. */
export function missingColumns(
  cols: Column[],
  row: Record<string, unknown>
): Column[] {
  return cols.filter((c) => !String(row[c] ?? "").trim());
}
