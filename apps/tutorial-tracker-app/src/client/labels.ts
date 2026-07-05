import { COLUMN_META, colHint, LINK_COLS, PUBLIC_LINK_HINT } from "./columnMeta";
import { fieldLabelOf } from "../shared/engine/labels";
import { PIPELINES } from "../shared/engine/registry";
import { colOf, workField } from "../shared/engine/types";

// ── Link helpers (link columns + per-column hints come from columnMeta) ──────

export { LINK_COLS };

// Every stage deliverable that's a URL must be a publicly-viewable link, so the
// public-share hint applies to each work-link column across ALL pipelines (not
// just the curated Standard ones). Curated COLUMN_META hints layer on top.
const WORK_LINK_HINTS: Record<string, string> = {};
for (const p of Object.values(PIPELINES)) for (const s of p.stages) {
  const wf = workField(s);
  if (wf && wf.type === "url") WORK_LINK_HINTS[colOf(s, "work_link")] = PUBLIC_LINK_HINT;
}
export const LINK_HINTS: Record<string, string> = {
  ...WORK_LINK_HINTS,
  ...(Object.fromEntries(
    Object.keys(COLUMN_META).map((c) => [c, colHint(c)]).filter(([, h]) => h),
  ) as Record<string, string>),
};

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
  return fieldLabelOf(col);
}
