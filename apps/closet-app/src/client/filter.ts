/**
 * filter.ts — pure helpers for the tag chip row and the tile sub-lines.
 * Kept free of React and of `fetch` so vitest can pin the behaviour directly.
 */

import type { ItemTag, Photo } from './types'

/**
 * item id → its photo keys, cover first.
 *
 * `/api/state` already returns `photos` ordered by position, so this only has
 * to group; it deliberately does NOT re-sort, because position is the single
 * source of truth for which picture is the cover.
 */
export function photoIndex(photos: Photo[], itemType: 'cloth' | 'look'): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const p of photos) {
    if (p.item_type !== itemType) continue
    const list = index.get(p.item_id)
    if (list) list.push(p.r2_key)
    else index.set(p.item_id, [p.r2_key])
  }
  return index
}

/** item id → the set of tag ids it carries, for one tab's item type. */
export function tagIndex(itemTags: ItemTag[], itemType: 'cloth' | 'look'): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>()
  for (const row of itemTags) {
    if (row.item_type !== itemType) continue
    const set = index.get(row.item_id) ?? new Set<string>()
    set.add(row.tag_id)
    index.set(row.item_id, set)
  }
  return index
}

/**
 * Items carrying EVERY selected tag — AND, not OR.
 *
 * Stacking `office` + `winter` must NARROW the grid. If this ever becomes
 * `.some()`, adding a chip widens the result set, which is the opposite of what
 * a filter is for and is invisible until the gallery is big.
 */
export function filterByTags<T extends { id: string }>(
  items: T[],
  index: Map<string, Set<string>>,
  selected: string[],
): T[] {
  if (selected.length === 0) return items
  return items.filter((item) => {
    const owned = index.get(item.id)
    if (!owned) return false
    return selected.every((t) => owned.has(t))
  })
}

/** Midnight of the day `ms` falls in, so "yesterday 11pm" is not "today". */
function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * The small grey line under a cloth's count. Calendar days, not elapsed hours —
 * the owner thinks in nights, not in 24-hour windows.
 */
export function lastWornLabel(lastWornAt: number | null, now: number): string {
  if (lastWornAt === null) return 'never worn'
  const days = Math.round((startOfDay(now) - startOfDay(lastWornAt)) / 86_400_000)
  if (days <= 0) return 'worn today'
  if (days === 1) return 'worn yesterday'
  return `worn ${days} days ago`
}
