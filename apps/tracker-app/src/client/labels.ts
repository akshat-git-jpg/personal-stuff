import { STAGES, stageByStatusCol } from "../shared/pipeline";
import { COLUMN_META, colLabel, colHint, LINK_COLS } from "./columnMeta";

// ── Stage maps, derived from the pipeline (single source of truth) ──────────

// status column → stage label / artifact (first edit link) / assignee / feedback
export const STAGE_NAME: Record<string, string> = {};
export const ARTIFACT_COL: Record<string, string> = {};
export const EMAIL_FOR_STAGE: Record<string, string> = {};
export const FEEDBACK_COL: Record<string, string> = {};
for (const s of STAGES) {
  STAGE_NAME[s.statusCol] = s.label;
  EMAIL_FOR_STAGE[s.statusCol] = s.assigneeCol;
  const link = s.editFields.find((c) => c.endsWith("_link") || c.endsWith("link"));
  if (link) ARTIFACT_COL[s.statusCol] = link;
  if (s.feedbackCol) FEEDBACK_COL[s.statusCol] = s.feedbackCol;
}

export function stageLabelForStatusCol(col: string): string {
  return stageByStatusCol(col)?.label ?? col;
}

// ── Link helpers (link columns + per-column hints come from columnMeta) ──────

export { LINK_COLS };
export const LINK_HINTS: Record<string, string> = Object.fromEntries(
  Object.keys(COLUMN_META).map((c) => [c, colHint(c)]).filter(([, h]) => h),
) as Record<string, string>;

export function isUrl(v: string): boolean { return /^https?:\/\//i.test((v ?? "").trim()); }

// ── ETA countdown badge ──────────────────────────────────────────────────────
// Given an ETA date (yyyy-mm-dd), returns the "days left / days late" chip text
// and a colour tone: green while there's runway, amber on the day, red once late.
export function etaBadge(value: string | undefined): { text: string; tone: string } | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const ts = Date.parse(v);
  if (isNaN(ts)) return null;
  const startOfDay = (d: Date) => { d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOfDay(new Date(ts)) - startOfDay(new Date())) / 86_400_000);
  if (days > 0) return { text: `${days}d left`, tone: "eta-ok" };
  if (days === 0) return { text: "due today", tone: "eta-due" };
  return { text: `${-days}d late`, tone: "eta-late" };
}

// ── Human-readable field label (sourced from columnMeta) ─────────────────────
export function fieldLabel(col: string): string {
  return colLabel(col);
}
