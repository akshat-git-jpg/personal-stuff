/**
 * filterModel.ts — the admin filter shape and the pure predicates over it.
 *
 * Split out of Filters.tsx so that file exports only its component (React Fast
 * Refresh needs that), and so PipelineBoard can ask "does this row match?"
 * without importing the bar's UI.
 */
import type { Row } from "../shared/rbac";
import { activeStage, daysSince } from "./pipeline";
import { stagesOf, assigneeColOf, statusOf, statusColOf, sinceOf } from "./stages";

/** How long a stage may sit untouched before it counts as needing a nudge. */
const NUDGE_AFTER_DAYS = { "Need Changes": 2, "In Review": 2, "To Do": 3 } as const;

export type Bucket = "" | "nudge" | "review" | "moving" | "published";

export interface AdminFilters {
  q: string;          // title search
  bucket: Bucket;     // quick "what state is it in" bucket, or "" for everything
  assignee: string;   // email (lowercase) or ""
  category: string;   // raw category value or ""
  stage: string;      // stage id or ""
}

export const EMPTY_FILTERS: AdminFilters = { q: "", bucket: "", assignee: "", category: "", stage: "" };

export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "", label: "Everything" },
  { key: "nudge", label: "Needs a nudge" },
  { key: "review", label: "With reviewers" },
  { key: "moving", label: "Being worked on" },
  { key: "published", label: "Published" },
];

/**
 * Which bucket a card falls in. Every card lands in exactly one, so the chip
 * counts always add up to the total — no card can hide from all of them.
 */
export function bucketOf(row: Row): Exclude<Bucket, ""> {
  const r = row as Record<string, string>;
  const stage = activeStage(r);
  if (!stage) return "published";
  const status = statusOf(stage, r);
  const age = daysSince(sinceOf(r as Record<string, unknown>, statusColOf(stage))) ?? 0;
  const limit = NUDGE_AFTER_DAYS[status as keyof typeof NUDGE_AFTER_DAYS];
  if (status === "Need Changes") return age >= limit ? "nudge" : "moving";
  if (status === "In Review") return age >= limit ? "nudge" : "review";
  if (status === "To Do" && age >= (limit ?? 3)) return "nudge";
  return "moving";
}

export function rowMatchesFilters(row: Row, filters: AdminFilters): boolean {
  const r = row as Record<string, string>;
  if (filters.q && !(r.video_title ?? "").toLowerCase().includes(filters.q.toLowerCase())) return false;
  if (filters.bucket && bucketOf(row) !== filters.bucket) return false;
  if (filters.stage && (activeStage(r)?.id ?? "done") !== filters.stage) return false;
  if (filters.assignee) {
    const cols = stagesOf(r).map(assigneeColOf);
    const hit = cols.some((c) => (r[c] ?? "").trim().toLowerCase() === filters.assignee);
    if (!hit) return false;
  }
  if (filters.category && (r.category ?? "") !== filters.category) return false;
  return true;
}
