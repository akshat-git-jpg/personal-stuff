export type Tab = 'run' | 'card-plan' | 'storyboard' | 'final-cut' | 'calibrate';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'card-plan', label: 'Card Plan' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'final-cut', label: 'Final Cut' },
];
const HASH_TAB: Record<string, Tab> = {
  '#card-plan': 'card-plan', '#storyboard': 'storyboard', '#final-cut': 'final-cut', '#calibrate': 'calibrate'
};
export const TAB_HASH: Record<Tab, string> = {
  run: '', 'card-plan': '#card-plan', storyboard: '#storyboard', 'final-cut': '#final-cut', calibrate: '#calibrate'
};
// No hash lands on Run — owner decision 2026-07-24; the Run tab exists so
// someone who has not watched the terminal can open one URL and see status.
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
