import type { Exercise } from "../shared";

export type Gym = "main" | "anu" | "home";

export const ANU_TAB = "Anu Gym";
export const HOME_TAB = "Home Gym";

/** Tabs that carry their own per-row Muscle Group column, i.e. one tab holding
 *  every muscle group. The main gym instead uses one tab PER muscle group. */
export const MIXED_TABS: Record<string, Gym> = { [ANU_TAB]: "anu", [HOME_TAB]: "home" };

export const GYMS: { id: Gym; label: string; short: string }[] = [
  { id: "main", label: "Main", short: "Main" },
  { id: "anu", label: "Anu", short: "Anu" },
  { id: "home", label: "Home", short: "Home" },
];

const LABELS: Record<Gym, string> = {
  main: "Main Gym",
  anu: "Anu Gym",
  home: "Home",
};
export const gymLabel = (g: Gym) => LABELS[g];

/** Short uppercase badge for a gym — used on plan rows and picker rows. */
export const gymBadge = (g: Gym) => g.toUpperCase();

/** The tab a mixed gym lives in. Undefined for the main gym, which spans many. */
export const tabOfGym = (g: Gym): string | undefined =>
  g === "anu" ? ANU_TAB : g === "home" ? HOME_TAB : undefined;

/** Which gym a tab belongs to. */
export const gymOfTab = (tab: string): Gym => MIXED_TABS[tab] ?? "main";

/** Which gym a log entry / exercise belongs to, by its ID prefix. */
export const gymOfId = (id: string): Gym => {
  const u = id.toUpperCase();
  if (u.startsWith("ANU")) return "anu";
  if (u.startsWith("HOME")) return "home";
  return "main";
};

/** A tappable group on a gym's home: a real tab (main) or a muscle slice of the
 *  Anu tab (anu). */
export interface GroupSpec {
  tab: string;
  label: string;
  muscle?: string; // set for Anu muscle slices
}

export const specGym = (s: GroupSpec): Gym => gymOfTab(s.tab);

/** Distinct muscle groups in a mixed tab, in first-seen order. */
export function mixedMuscles(list: Exercise[]): string[] {
  const seen: string[] = [];
  for (const e of list) {
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
