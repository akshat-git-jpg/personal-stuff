import { useGym } from "./store";
import type { PlanRow } from "../shared";

export type DayIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6;   // Sunday-based, matches Date.getDay()
export const WEEK: DayIdx[] = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const DAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type Plan = Record<string, string[]>;

let current: PlanRow[] = [];
let mutators: {
  add: (day: number, id: string) => void;
  remove: (day: number, id: string) => void;
  reorder: (day: number, ids: string[]) => void;
} | null = null;

/** Called once by GymProvider on every render with the live plan + mutators. */
export function publishPlan(rows: PlanRow[], m: NonNullable<typeof mutators>): void {
  current = rows;
  mutators = m;
}

export const dayIds = (day: DayIdx): string[] =>
  current
    .filter((r) => r.day === day)
    .sort((a, b) => a.position - b.position)
    .map((r) => r.exerciseId);

export function daysFor(exerciseId: string): DayIdx[] {
  return WEEK.filter((d) => current.some((r) => r.day === d && r.exerciseId === exerciseId));
}

export const addToDay = (day: DayIdx, exerciseId: string): void =>
  mutators?.add(day, exerciseId);
export const removeFromDay = (day: DayIdx, exerciseId: string): void =>
  mutators?.remove(day, exerciseId);
export const setDayOrder = (day: DayIdx, orderedIds: string[]): void =>
  mutators?.reorder(day, orderedIds);

export const todayIdx = (): DayIdx => new Date().getDay() as DayIdx;

/** Subscribe to plan changes. Backed by the store, so this is just a selector. */
export function usePlan(): Plan {
  const { plan } = useGym();
  const out: Plan = {};
  for (const d of WEEK) out[String(d)] = [];
  for (const r of [...plan].sort((a, b) => a.position - b.position)) {
    (out[String(r.day)] ??= []).push(r.exerciseId);
  }
  return out;
}

// And muscleOf needs to change. Wait, muscleOf takes an Exercise.
// Let me look at the plan description for muscleOf.
// `muscleOf` changes from a tab-name test to the data: `ex.gym === "main" ? ex.tab : ex.muscleGroup || "Other"`.

import type { Exercise } from "../shared";

export const muscleOf = (ex: Exercise): string =>
  ex.gym === "main" ? ex.tab : ex.muscleGroup || "Other";
