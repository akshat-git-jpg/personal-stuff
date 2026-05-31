import type { Exercise } from "../shared";

export type Gym = "main" | "anu";

export const ANU_TAB = "Anu Gym";

export const GYMS: { id: Gym; label: string; short: string }[] = [
  { id: "main", label: "Main Gym", short: "Main" },
  { id: "anu", label: "Anu Gym", short: "Anu" },
];

export const gymLabel = (g: Gym) => (g === "anu" ? "Anu Gym" : "Main Gym");

/** Which gym a tab belongs to. */
export const gymOfTab = (tab: string): Gym => (tab === ANU_TAB ? "anu" : "main");

/** Which gym a log entry / exercise belongs to, by its ID prefix (ANU* = Anu). */
export const gymOfId = (id: string): Gym =>
  id.toUpperCase().startsWith("ANU") ? "anu" : "main";

/** A tappable group on a gym's home: a real tab (main) or a muscle slice of the
 *  Anu tab (anu). */
export interface GroupSpec {
  tab: string;
  label: string;
  muscle?: string; // set for Anu muscle slices
}

export const specGym = (s: GroupSpec): Gym => gymOfTab(s.tab);

/** Distinct muscle groups in the Anu tab, in first-seen order. */
export function anuMuscles(anu: Exercise[]): string[] {
  const seen: string[] = [];
  for (const e of anu) {
    const m = e.muscleGroup || "Other";
    if (!seen.includes(m)) seen.push(m);
  }
  return seen;
}

/** Rebuild the full Anu tab order after reordering just one muscle's slice:
 *  keep every other exercise where it is, drop the reordered ids into the
 *  slots the muscle's exercises occupied. */
export function rebuildSliceOrder(
  full: Exercise[],
  muscle: string,
  newSliceIds: string[],
): string[] {
  const queue = [...newSliceIds];
  return full.map((e) => ((e.muscleGroup || "Other") === muscle ? queue.shift() ?? e.id : e.id));
}
