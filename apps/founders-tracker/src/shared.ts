// Domain types shared between the React client and the Cloudflare Worker.

export type Owner = "khushi" | "kushal";
export const OWNERS: Owner[] = ["khushi", "kushal"];

export type TaskStatus = "open" | "done";
export type Cadence = "daily" | "monthly" | "weekly";

/** A tracked action item. */
export interface Task {
  id: number;
  title: string;
  owner: Owner;
  /** 'YYYY-MM-DD' (Asia/Kolkata) or null when no deadline is set. */
  eta: string | null;
  notes: string | null;
  status: TaskStatus;
  /** Manual ordering within (owner, status). Ascending = top of list. */
  sortOrder: number;
  /** Source recurring template, or null for manual tasks. */
  templateId: number | null;
  /** Period this was generated for, e.g. '2026-06' or '2026-W25'; null if manual. */
  periodKey: string | null;
  createdAt: string;
  /** ISO timestamp set when marked done; null while open. */
  completedAt: string | null;
}

export interface TaskInput {
  title: string;
  owner: Owner;
  eta?: string | null; // 'YYYY-MM-DD' or null
  notes?: string | null;
}

export interface TaskPatch {
  title?: string;
  owner?: Owner;
  eta?: string | null;
  notes?: string | null;
  status?: TaskStatus;
}

/** A recurring-task definition managed entirely from the UI. */
export interface Template {
  id: number;
  title: string;
  owner: Owner;
  notes: string | null;
  cadence: Cadence;
  /** monthly: 1-31 (clamped to month length). weekly: 0-6 (0=Mon … 6=Sun). daily: unused. */
  dueDay: number;
  active: boolean;
  createdAt: string;
}

export interface TemplateInput {
  title: string;
  owner: Owner;
  notes?: string | null;
  cadence: Cadence;
  dueDay: number;
  active?: boolean;
}

/** Per-person score over their completed tasks. */
export interface OwnerScore {
  owner: Owner;
  /** done tasks that had an ETA at completion. */
  scored: number;
  onTime: number;
  late: number;
  /** mean days late over the `late` tasks; 0 when none. */
  avgDaysLate: number;
  /** done tasks completed with no ETA — untracked, earns nothing. */
  noEta: number;
  /** onTime / scored * 100, rounded; null when scored === 0. */
  onTimePct: number | null;
}

export interface Scoreboard {
  khushi: OwnerScore;
  kushal: OwnerScore;
}
