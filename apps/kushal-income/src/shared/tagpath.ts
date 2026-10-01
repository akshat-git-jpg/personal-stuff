/**
 * Tag paths like "trip/varkala/food". The sync sends one per row (build.py `path_of`, keep in step);
 * owner tags saved before the tree are old [main, ...subs] lists and convert here.
 */

/** Tags saved before the main/sub split, mapped to [main, sub]. */
const LEGACY: Record<string, [string, string | null]> = {
  taxi: ["commute", "taxi"], auto: ["commute", "taxi"], cab: ["commute", "taxi"], "bike taxi": ["commute", "taxi"],
  metro: ["commute", "metro"], rent: ["home", "rent"], cook: ["home", "cook"], movie: ["entertainment", "movie"],
  protein: ["fitness", "protein"], loan: ["education loan", "emi"], "work tools": ["work", null], salary: ["income", "salary"],
};

const MAINS = [
  "food", "grocery", "commute", "trip", "travel", "shopping", "subscription", "work", "home", "bills", "education loan",
  "health", "personal care", "fitness", "entertainment", "family", "education", "bank", "income", "misc",
];

const TRIP_KIND = /^([a-z0-9-]+)-(stay|food|bus|auto|metro|flight|train)$/;

/** [main, ...subs] from the old free form. */
function mainSub(tags: string[]): string[] {
  const t = [...new Set(tags.map((x) => x.trim().toLowerCase()).filter((x) => x && (x !== "commute" || tags[0] === "commute")))];
  if (!t.length) return [];
  if (t[0] === "bank" && t[1] === "loan") return ["education loan", "emi"];
  if (MAINS.includes(t[0]) && t[0] !== "misc") return t;
  const trip = t.filter((x) => TRIP_KIND.test(x));
  if (trip.length) return ["trip", ...trip];
  if (t[0] === "misc") return t.slice(0, 2);
  const hit = LEGACY[t[0]];
  if (hit) return hit[1] ? [hit[0], hit[1]] : [hit[0], ...t.slice(1, 2)];
  return ["misc", t[0]];
}

/** An old tag list as one path. A trip row becomes trip/<trip>/<kind>, e.g. "varkala-food" -> trip/varkala/food. */
export function pathFromTags(tags: string[], tripLabel?: string | null): string | null {
  const t = mainSub(tags);
  if (!t.length) return null;
  if (t[0] !== "trip") return t.slice(0, 2).join("/");
  const m = t.slice(1).map((x) => x.match(TRIP_KIND)).find(Boolean);
  const label = tripLabel ?? m?.[1] ?? t.slice(1).find((x) => !TRIP_KIND.test(x)) ?? null;
  return ["trip", label, m?.[2]].filter(Boolean).join("/");
}
