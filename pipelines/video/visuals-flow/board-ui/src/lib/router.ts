export type Tab = 'run' | 'card-plan' | 'intro' | 'storyboard' | 'final-cut' | 'calibrate';

// ONE table, both hash maps computed from it (plan 193 — this used to be
// three parallel structures listing the same five tabs).
//   button: false means the tab has no header button — it is reachable only
//   by hash. `calibrate` is the only one today: preserve that, and preserve
//   `run`'s empty hash (no hash routes to it — owner decision 2026-07-24, the
//   Run tab exists so someone who has not watched the terminal can open one
//   URL and see status).
interface TabRow { id: Tab; label: string; hash: string; button: boolean }
const TAB_TABLE: TabRow[] = [
  { id: 'run', label: 'Run', hash: '', button: true },
  { id: 'card-plan', label: 'Card Plan', hash: '#card-plan', button: true },
  { id: 'intro', label: 'Intro', hash: '#intro', button: true },
  { id: 'storyboard', label: 'Storyboard', hash: '#storyboard', button: true },
  { id: 'final-cut', label: 'Final Cut', hash: '#final-cut', button: true },
  { id: 'calibrate', label: 'Calibrate', hash: '#calibrate', button: false },
];

export const TABS: { id: Tab; label: string }[] = TAB_TABLE
  .filter((t) => t.button)
  .map((t) => ({ id: t.id, label: t.label }));

const HASH_TAB: Record<string, Tab> = Object.fromEntries(
  TAB_TABLE.filter((t) => t.hash).map((t) => [t.hash, t.id]),
);
export const TAB_HASH: Record<Tab, string> = Object.fromEntries(
  TAB_TABLE.map((t) => [t.id, t.hash]),
) as Record<Tab, string>;

// No hash lands on Run — see TAB_TABLE's comment.
export function tabForHash(hash: string): Tab { return HASH_TAB[hash] ?? 'run'; }
// Tab switch preserves ?video= (owner-reported regression when broken).
export function urlForTab(tab: Tab, loc: { pathname: string; search: string }): string {
  return loc.pathname + loc.search + TAB_HASH[tab];
}
// Video switch preserves the tab hash (same).
export function urlForVideo(slug: string, loc: { pathname: string; hash: string }): string {
  return loc.pathname + '?video=' + encodeURIComponent(slug) + loc.hash;
}
export function videoFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('video');
}

// The button rows filtered down to what THIS video's flow actually reviews,
// in table order — this is what makes an intro:"cards" video's Intro tab not
// render (plan 193; before it, AppHeader mapped the module-level TABS
// unconditionally, so a tab whose step did not apply still got a button that
// could only ever show an empty state).
export function visibleTabs(all: { id: Tab; label: string }[], applicable: string[]): { id: Tab; label: string }[] {
  return all.filter((t) => applicable.includes(t.id));
}
