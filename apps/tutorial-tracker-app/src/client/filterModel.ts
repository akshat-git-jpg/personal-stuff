import type { Row } from "../shared/engine/rbac";
import { activeStage, daysSince } from "./pipeline";
import { stagesOf, assigneeColOf, statusOf, statusColOf, sinceOf, reviewerColOf, etaColOf } from "./stages";
import { etaBadge } from "./labels";

export type Bucket = "needsyou" | "late" | "idle" | "moving" | "published" | "";

export interface AdminFilters {
  q: string;          // title search
  bucket: Bucket;     // quick "what state is it in" bucket, or "" for everything
  assignee: string;   // email (lowercase) or ""
  stage: string;      // stage id or ""
  channel: string;    // channel id or ""
  showPublished: boolean;
}

export const EMPTY_FILTERS: AdminFilters = { q: "", bucket: "", assignee: "", stage: "", channel: "", showPublished: false };

export const BUCKETS: { key: Bucket; label: string; rule: string }[] = [
  { key: "needsyou", label: "Waiting on you", rule: "Submitted and needs your approval" },
  { key: "late",     label: "Late",           rule: "Past the date the doer promised" },
  { key: "idle",     label: "Not moving",     rule: "Nobody has touched it for 3+ days" },
  { key: "moving",   label: "Moving fine",    rule: "On time and being worked on" },
];

/**
 * Which bucket a card falls in. Every card lands in exactly one, so the chip
 * counts always add up to the total — no card can hide from all of them.
 */
export function bucketOf(row: Row, viewerEmail?: string): Exclude<Bucket, ""> {
  const r = row as Record<string, string>;
  const stage = activeStage(r);
  if (!stage) return "published";

  const status = statusOf(stage, r);
  
  // Rule 1: needsyou
  const reviewer = reviewerColOf(stage);
  if (status === "In Review" && reviewer && viewerEmail && (r[reviewer] ?? "").trim().toLowerCase() === viewerEmail.trim().toLowerCase()) {
    return "needsyou";
  }

  // Rule 2: late
  const etaCol = etaColOf(stage);
  const badge = etaCol && r[etaCol] ? etaBadge(r[etaCol]) : null;
  if (badge?.tone === "eta-late") {
    return "late";
  }

  // Rule 3: idle
  const age = daysSince(sinceOf(r as Record<string, unknown>, statusColOf(stage))) ?? 0;
  if (age >= 3) {
    return "idle";
  }

  // Rule 4: moving
  return "moving";
}

export function rowMatchesFilters(row: Row, filters: AdminFilters, viewerEmail?: string): boolean {
  const r = row as Record<string, string>;
  const bucket = bucketOf(row, viewerEmail);
  
  if (!filters.showPublished && bucket === "published") return false;

  if (filters.q && !(r.video_title ?? "").toLowerCase().includes(filters.q.toLowerCase())) return false;
  if (filters.bucket && bucket !== filters.bucket) return false;
  if (filters.stage && (activeStage(r)?.id ?? "done") !== filters.stage) return false;
  if (filters.assignee) {
    const cols = stagesOf(r).map(assigneeColOf);
    const hit = cols.some((c) => (r[c] ?? "").trim().toLowerCase() === filters.assignee);
    if (!hit) return false;
  }
  if (filters.channel && r.channel_id !== filters.channel) return false;
  return true;
}
