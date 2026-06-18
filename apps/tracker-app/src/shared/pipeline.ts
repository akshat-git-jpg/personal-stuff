// ---------------------------------------------------------------------------
// THE pipeline definition — single source of truth.
//
// Everything downstream is DERIVED from STAGES: per-role column access, row
// filters, gates, the lifecycle state machine, who-can-do-what transitions,
// lane bucketing, and the human-readable `Access` sheet mirror. There is no
// stage/role metadata anywhere else in the codebase. Change a stage here and
// the rest of the app follows.
// ---------------------------------------------------------------------------
import type { Column } from "./columns";

export type StageId = "topic" | "script" | "recording" | "editing" | "thumbnail" | "upload";

export interface StageDef {
  id: StageId;
  label: string;            // UI display name for the stage
  ownerRole: string;        // the producer role that works this stage
  statusCol: Column;        // the status column that is this stage's lane
  assigneeCol: Column;      // who is assigned to work this stage on a card
  reviewable: boolean;      // does work here go through In Review -> Done/Need Changes?
  terminal: boolean;        // is this the last stage (nothing gates on it)?
  order: number;            // position in the pipeline (0-based)
  editFields: Column[];     // content fields the owner edits at this stage (besides status)
  viewFields: Column[];     // read-only upstream context the owner needs to do the work
  instructionCol?: Column;  // a brief authored for the doer (read-only to them)
  feedbackCol?: Column;     // review send-back note column (reviewable stages only)
  // Which columns the card detail SHOWS when a card is opened while working this
  // stage (presentation only — RBAC still decides what's editable). Omit to use
  // the derived default (brief context + this stage's own fields). This is the
  // single place to curate per-stage/per-role visible fields.
  cardView?: Column[];
  // Fields that MUST be filled before this stage's work can be submitted for
  // review (reviewable stages) or marked complete (terminal upload). Enforced on
  // both the server (authorizeWrite) and the client (disabled button + reason).
  // This is the single place to control "what's required before moving forward".
  requiredFields?: { col: Column; label: string }[];
}

// Status names. Reviewable stages share one lifecycle; the terminal upload stage
// has its own (no review).
export const REVIEW_STATES = ["To Do", "In Progress", "In Review", "Need Changes", "Done"] as const;
// A reviewable stage with no feedback column is approve-only: the reviewer can
// mark it Done but never send it back, so it has no "Need Changes" state.
export const APPROVE_ONLY_STATES = ["To Do", "In Progress", "In Review", "Done"] as const;
export const TERMINAL_STATES = ["To Do", "In Progress", "Uploaded"] as const;
export type ReviewState = typeof REVIEW_STATES[number];
export const DONE = "Done";

export const STAGES: StageDef[] = [
  {
    // The Topic stage is the Admin's job — there is no separate "Ideator" role.
    // Its assignee is the founding admin (admin_email), so admin owns/drives it.
    id: "topic", label: "Topic", ownerRole: "Admin",
    statusCol: "topic_status", assigneeCol: "admin_email",
    reviewable: true, terminal: false, order: 0,
    editFields: ["video_title", "video_notes", "video_description", "category", "subcategory"],
    viewFields: [],
    // No feedbackCol — the Topic is the admin's own brief; send-backs don't need a
    // stored note. Stages without a feedbackCol don't require feedback on sendback.
    // Topic card shows the brief + all assignments + all instructions — NOT the
    // downstream links / feedback / upload fields.
    cardView: [
      "video_title", "video_notes", "video_description", "category", "subcategory", "topic_date",
      "admin_email", "reviewer_email", "script_writer_email", "tutorial_maker_email", "video_editor_email", "uploader_email",
      "script_instruction", "tutorial_instruction", "video_editor_instruction",
    ],
    requiredFields: [{ col: "video_title", label: "title" }, { col: "video_notes", label: "brief notes" }],
  },
  {
    id: "script", label: "Script", ownerRole: "Scriptwriter",
    statusCol: "script_status", assigneeCol: "script_writer_email",
    reviewable: true, terminal: false, order: 1,
    editFields: ["script_link", "script_eta"],
    viewFields: ["video_title", "video_notes", "category", "subcategory"],
    instructionCol: "script_instruction",
    feedbackCol: "script_feedback",
    requiredFields: [{ col: "script_link", label: "script link" }],
  },
  {
    id: "recording", label: "Recording", ownerRole: "Recorder",
    statusCol: "tutorial_status", assigneeCol: "tutorial_maker_email",
    reviewable: true, terminal: false, order: 2,
    editFields: ["tutorial_link", "tutorial_eta"],
    viewFields: ["video_title", "video_notes", "script_link"],
    instructionCol: "tutorial_instruction",
    feedbackCol: "tutorial_feedback",
    requiredFields: [{ col: "tutorial_link", label: "recording link" }],
  },
  {
    id: "editing", label: "Editing", ownerRole: "Video Editor",
    statusCol: "video_editor_status", assigneeCol: "video_editor_email",
    reviewable: true, terminal: false, order: 3,
    editFields: ["video_editor_link", "video_editor_eta"],
    viewFields: ["video_title", "video_notes", "tutorial_link"],
    instructionCol: "video_editor_instruction",
    feedbackCol: "editor_feedback",
    requiredFields: [{ col: "video_editor_link", label: "final video link" }],
  },
  {
    id: "thumbnail", label: "Thumbnail", ownerRole: "Thumbnail Maker",
    statusCol: "thumbnail_status", assigneeCol: "thumbnail_maker_email",
    reviewable: true, terminal: false, order: 4,
    editFields: ["thumbnail_link", "thumbnail_eta"],
    viewFields: ["video_title", "video_notes", "video_editor_link"],
    instructionCol: "thumbnail_instruction",
    feedbackCol: "thumbnail_feedback",
    requiredFields: [{ col: "thumbnail_link", label: "thumbnail link" }],
  },
  {
    id: "upload", label: "Upload", ownerRole: "Uploader",
    statusCol: "yt_upload_status", assigneeCol: "uploader_email",
    reviewable: false, terminal: true, order: 5,
    editFields: ["yt_link", "yt_upload_date", "short_links", "actual_links", "yt_eta"],
    viewFields: ["video_title", "video_description", "video_editor_link", "thumbnail_link"],
    requiredFields: [{ col: "yt_link", label: "YouTube link" }],
  },
];

// --- Role roster (derived) -------------------------------------------------
// Producer roles each own one stage; Reviewer + Admin are cross-cutting.
export const PRODUCER_ROLES = STAGES.map((s) => s.ownerRole);
export const REVIEWER_ROLE = "Reviewer";
export const ADMIN_ROLE = "Admin";
export const ALL_ROLES = [...new Set([...PRODUCER_ROLES, REVIEWER_ROLE, ADMIN_ROLE])];

// The founding admin — fixed. Can't be edited/removed from the Team panel or the
// card's Admin field (enforced in the UI and the team-management worker routes).
export const PROTECTED_ADMIN_EMAIL = "seankerman25@gmail.com";

// --- Lookups ---------------------------------------------------------------
const BY_ID = new Map(STAGES.map((s) => [s.id, s]));
const BY_STATUS = new Map(STAGES.map((s) => [s.statusCol, s]));
const BY_OWNER = new Map(STAGES.map((s) => [s.ownerRole, s]));

export function stageById(id: string): StageDef | undefined { return BY_ID.get(id as StageId); }
export function stageByStatusCol(col: string): StageDef | undefined { return BY_STATUS.get(col as Column); }
export function stageByOwnerRole(role: string): StageDef | undefined { return BY_OWNER.get(role); }
export function prevStage(stage: StageDef): StageDef | undefined {
  return STAGES.find((s) => s.order === stage.order - 1);
}
export function nextStage(stage: StageDef): StageDef | undefined {
  return STAGES.find((s) => s.order === stage.order + 1);
}

export function statesFor(stage: StageDef): readonly string[] {
  if (!stage.reviewable) return TERMINAL_STATES;
  return stage.feedbackCol ? REVIEW_STATES : APPROVE_ONLY_STATES;
}

// Required fields for `stage` that are still empty on `row`. Empty list = the
// stage's work is complete enough to submit / mark done.
export function missingRequired(stage: StageDef, row: CellLookup): { col: Column; label: string }[] {
  return (stage.requiredFields ?? []).filter((f) => !String(row[f.col] ?? "").trim());
}

// The columns the card detail shows when a card is opened while working `stage`.
// Uses the stage's explicit `cardView` when set, else a derived default: the
// title + the upstream context it needs + its own assignee/instruction/work/feedback.
export function cardFieldsFor(stage: StageDef): Column[] {
  if (stage.cardView) return [...new Set(stage.cardView)];
  // NB: no feedbackCol — review feedback is written via "Request changes" and
  // read via the Need-Changes banner, never as an editable field.
  const fields: Column[] = [
    "video_title",
    ...stage.viewFields,
    stage.assigneeCol,
    ...(stage.instructionCol ? [stage.instructionCol] : []),
    ...stage.editFields,
  ];
  return [...new Set(fields)];
}

// --- Total lane normalization ----------------------------------------------
// CRITICAL invariant: every raw status value maps to exactly one valid lane.
// Blank / unknown ALWAYS resolves to "To Do" — NEVER to "Need Changes". This is
// what makes "freshly-created card mysteriously in Requires Fix" impossible.
export function normalizeStatus(stage: StageDef, raw: string | undefined): string {
  const v = (raw ?? "").trim();
  const states = statesFor(stage);
  return (states as readonly string[]).includes(v) ? v : "To Do";
}

// Row params use a permissive index type so callers can pass enriched rows
// (e.g. the board's BoardRow with _stages/_actions) without a cast.
type CellLookup = Record<string, unknown>;

export function statusOf(stage: StageDef, row: CellLookup): string {
  return normalizeStatus(stage, row[stage.statusCol] as string | undefined);
}

// A stage is "complete" (gates the next stage open) when its status is Done, or
// for the terminal upload stage, Uploaded.
export function isStageComplete(stage: StageDef, row: CellLookup): boolean {
  const s = statusOf(stage, row);
  return stage.reviewable ? s === DONE : s === "Uploaded";
}

// --- Gating ----------------------------------------------------------------
// A stage is reachable when its immediately-upstream stage is complete. The
// first stage (topic) has no gate.
export function isGateOpen(stage: StageDef, row: CellLookup): boolean {
  const prev = prevStage(stage);
  if (!prev) return true;
  return isStageComplete(prev, row);
}
