// Week plan (Mon–Sun) — REVIEW PROTOTYPE STORE.
//
// The plan lives in localStorage and nowhere else. Production moves it to a
// `plan` table in D1 behind /api/plan; this module is the single seam that
// gets swapped, so every component above it stays unchanged.

import { useEffect, useState } from "react";
import type { Exercise } from "../shared";
import { MIXED_TABS } from "./gym";

const KEY = "gym.plan.v1";
const SEEDED = "gym.plan.seeded";

/** Sunday-based, matching Date.getDay(). */
export type DayIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Display order — the week starts Monday. */
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

/** day index -> ordered exercise ids. */
export type Plan = Record<string, string[]>;

/** The muscle-group tag for an exercise: the per-row column in the mixed Anu
 *  tab, the tab name everywhere else. Derived, never stored on a plan row. */
export const muscleOf = (ex: Exercise): string =>
  MIXED_TABS[ex.tab] ? ex.muscleGroup || "Other" : ex.tab;

export const todayIdx = (): DayIdx => new Date().getDay() as DayIdx;

// ---- storage + subscription ------------------------------------------------

let cache: Plan | null = null;
const listeners = new Set<() => void>();

function read(): Plan {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Plan) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function write(next: Plan): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
  for (const fn of listeners) fn();
}

export const dayIds = (day: DayIdx): string[] => read()[String(day)] ?? [];

export function addToDay(day: DayIdx, exerciseId: string): void {
  const cur = dayIds(day);
  if (cur.includes(exerciseId)) return; // a day holds an exercise at most once
  write({ ...read(), [String(day)]: [...cur, exerciseId] });
}

export function removeFromDay(day: DayIdx, exerciseId: string): void {
  write({ ...read(), [String(day)]: dayIds(day).filter((id) => id !== exerciseId) });
}

export function setDayOrder(day: DayIdx, orderedIds: string[]): void {
  write({ ...read(), [String(day)]: orderedIds });
}

/** Which days an exercise appears on, in Mon-first display order. */
export function daysFor(exerciseId: string): DayIdx[] {
  const plan = read();
  return WEEK.filter((d) => (plan[String(d)] ?? []).includes(exerciseId));
}

/** Seed a plausible split the first time the app runs, so the week is worth
 *  looking at immediately: one muscle group per weekday, Sunday rest.
 *  Review-prototype only — production ships an empty plan. */
export function seedOnce(all: Exercise[]): void {
  if (localStorage.getItem(SEEDED) || all.length === 0) return;
  const byMuscle = new Map<string, Exercise[]>();
  for (const ex of all) {
    if (MIXED_TABS[ex.tab]) continue; // seed from the main gym only
    const m = muscleOf(ex);
    if (!byMuscle.has(m)) byMuscle.set(m, []);
    byMuscle.get(m)!.push(ex);
  }
  const muscles = [...byMuscle.keys()].slice(0, 6);
  const next: Plan = {};
  muscles.forEach((m, i) => {
    next[String(WEEK[i])] = byMuscle
      .get(m)!
      .slice(0, 5)
      .map((e) => e.id);
  });
  localStorage.setItem(SEEDED, "1");
  write(next);
}

/** Subscribe a component to plan changes. */
export function usePlan(): Plan {
  const [plan, setPlan] = useState<Plan>(read);
  useEffect(() => {
    const fn = () => setPlan({ ...read() });
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return plan;
}
