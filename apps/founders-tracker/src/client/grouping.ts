// Pure task-shaping logic for the tracker view. No React, no fetch — every
// function is (data, today) -> value, so the whole reading experience is
// unit-testable without a DOM.

import type { Task } from "../shared";
import { daysBetweenYmd } from "../habits";
import { fmtEtaShort } from "./dates";

export type Bucket = "overdue" | "today" | "week" | "later" | "undated";

/** Top-to-bottom order of the groups on screen. */
export const BUCKET_ORDER: readonly Bucket[] = ["overdue", "today", "week", "later", "undated"];

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  undated: "No date",
};

/** Urgency is encoded ONCE, on the group header. Rows stay neutral — that is
 *  the entire point of the redesign: when every row is red, none of them is. */
export const BUCKET_TONE: Record<Bucket, "over" | "soon" | "calm"> = {
  overdue: "over",
  today: "soon",
  week: "calm",
  later: "calm",
  undated: "calm",
};

/** Which group a task belongs to. BUCKET_WEEK_IS_SEVEN_DAYS: "This week" is
 *  1..7 days out INCLUSIVE; day 8 is already "Later". */
export function bucketOf(eta: string | null, todayYmd: string): Bucket {
  if (!eta) return "undated";
  const d = daysBetweenYmd(todayYmd, eta);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  return "later";
}

/** The single line of meta a row shows to the right of its title. Overdue rows
 *  earn a lateness count because that is genuinely new information; everything
 *  else just states its date. No bar, no shouting. */
export function metaLabel(eta: string | null, todayYmd: string): string {
  if (!eta) return "no date";
  const d = daysBetweenYmd(todayYmd, eta);
  if (d < 0) return `${fmtEtaShort(eta)} · ${-d}d late`;
  if (d === 0) return "today";
  return fmtEtaShort(eta);
}

export interface BucketGroup {
  bucket: Bucket;
  label: string;
  tone: "over" | "soon" | "calm";
  tasks: Task[];
}

/** Group OPEN tasks for one owner. Groups follow BUCKET_ORDER; empty groups are
 *  dropped (an empty header is noise). Inside a group, manual drag order wins
 *  (sortOrder asc), with id as a stable tiebreak. */
export function groupOpen(tasks: Task[], todayYmd: string): BucketGroup[] {
  const byBucket = new Map<Bucket, Task[]>();
  for (const t of tasks) {
    if (t.status !== "open") continue;
    const b = bucketOf(t.eta, todayYmd);
    const list = byBucket.get(b);
    if (list) list.push(t);
    else byBucket.set(b, [t]);
  }
  const out: BucketGroup[] = [];
  for (const bucket of BUCKET_ORDER) {
    const list = byBucket.get(bucket);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
    out.push({ bucket, label: BUCKET_LABEL[bucket], tone: BUCKET_TONE[bucket], tasks: list });
  }
  return out;
}

/** The full open-lane order after a drag inside one group. The reorder API takes
 *  one flat array for the whole (owner, 'open') lane, so a within-group move has
 *  to be re-flattened against the other groups in BUCKET_ORDER. */
export function flattenOrder(groups: BucketGroup[]): number[] {
  return groups.flatMap((g) => g.tasks.map((t) => t.id));
}
