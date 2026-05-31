/**
 * pipeline.ts — pure helpers for the Admin pipeline/overview views.
 * No React imports; unit-testable in isolation.
 */

export type OverallStage = "Script" | "Tutorial" | "Editing" | "Upload" | "Published";
export type StepState = "done" | "active" | "pending";

export interface ProgressStep {
  key: "Script" | "Tutorial" | "Editing" | "Upload" | "Published";
  state: StepState;
}

// ── overallStage ─────────────────────────────────────────────────────────────

export function overallStage(row: Record<string, string>): OverallStage {
  if (row.yt_upload_status === "Published") return "Published";
  if (row.video_editor_status === "Done") return "Upload";
  if (row.tutorial_status === "Done") return "Editing";
  if (row.script_status === "Done") return "Tutorial";
  return "Script";
}

// ── stageState ───────────────────────────────────────────────────────────────

export function stageState(status: string): StepState {
  if (!status) return "pending";
  if (status === "Done" || status === "Published") return "done";
  if (
    status === "In Progress" ||
    status === "In Review" ||
    status === "Draft"
  )
    return "active";
  return "pending";
}

// ── progress ──────────────────────────────────────────────────────────────────

export function progress(row: Record<string, string>): ProgressStep[] {
  const scriptState = stageState(row.script_status ?? "");

  // Tutorial is only active/done if Script is done
  const tutorialRaw = row.tutorial_status ?? "";
  const tutorialState: StepState =
    scriptState !== "done" ? "pending" : stageState(tutorialRaw);

  // Editing is only active/done if Tutorial is done
  const editRaw = row.video_editor_status ?? "";
  const editState: StepState =
    tutorialState !== "done" ? "pending" : stageState(editRaw);

  // Upload is only active/done if Editing is done
  const uploadRaw = row.yt_upload_status ?? "";
  const uploadState: StepState =
    editState !== "done" ? "pending" : stageState(uploadRaw);

  // Published = done iff yt_upload_status === "Published", else pending
  const publishedState: StepState =
    row.yt_upload_status === "Published" ? "done" : "pending";

  return [
    { key: "Script",    state: scriptState    },
    { key: "Tutorial",  state: tutorialState  },
    { key: "Editing",   state: editState      },
    { key: "Upload",    state: uploadState    },
    { key: "Published", state: publishedState },
  ];
}

// ── isStalled ─────────────────────────────────────────────────────────────────
// A row is stalled if it was sent back and is being reworked.

export function isStalled(row: Record<string, string>): boolean {
  const scriptStalled =
    row.script_status === "In Progress" && !!row.script_feedback;
  const tutStalled =
    row.tutorial_status === "In Progress" && !!row.tutorial_feedback;
  const editStalled =
    row.video_editor_status === "In Progress" && !!row.editor_feedback;
  return scriptStalled || tutStalled || editStalled;
}

// ── daysSince ─────────────────────────────────────────────────────────────────

export function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (isNaN(ts)) return null;
  return Math.floor((Date.now() - ts) / 86_400_000);
}

// ── isStuck ───────────────────────────────────────────────────────────────────

export function isStuck(row: Record<string, string>): boolean {
  if (overallStage(row) === "Published") return false;
  const d = daysSince(row.last_updated);
  return d !== null && d > 3;
}

// ── assigneeFor ───────────────────────────────────────────────────────────────

export function assigneeFor(
  row: Record<string, string>,
  stageOrStatusCol: string
): string {
  if (stageOrStatusCol === "Script Writer" || stageOrStatusCol === "script_status") {
    return row.script_writer_email ?? "";
  }
  if (stageOrStatusCol === "Tutorial Maker" || stageOrStatusCol === "tutorial_status") {
    return row.tutorial_maker_email ?? "";
  }
  if (stageOrStatusCol === "Video Editor" || stageOrStatusCol === "video_editor_status") {
    return row.video_editor_email ?? "";
  }
  return "";
}

// ── Stage display metadata ────────────────────────────────────────────────────

export interface StageInfo {
  label: OverallStage;
  color: string;       // CSS variable name (without "var(…)")
  colorVar: string;    // ready-to-use CSS var string
}

export const STAGE_INFO: Record<OverallStage, StageInfo> = {
  Script:    { label: "Script",    color: "--todo",   colorVar: "var(--todo)"   },
  Tutorial:  { label: "Tutorial",  color: "--prog",   colorVar: "var(--prog)"   },
  Editing:   { label: "Editing",   color: "--review", colorVar: "var(--review)" },
  Upload:    { label: "Upload",    color: "--warn",   colorVar: "var(--warn)"   },
  Published: { label: "Published", color: "--done",   colorVar: "var(--done)"   },
};

// ── OVERALL_STAGES ordered list ───────────────────────────────────────────────
export const OVERALL_STAGES: OverallStage[] = [
  "Script",
  "Tutorial",
  "Editing",
  "Upload",
  "Published",
];
