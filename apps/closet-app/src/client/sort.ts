/**
 * sort.ts — how the two grids order themselves.
 *
 * Pure and free of React so the orderings can be pinned by tests. Every
 * function copies before sorting: the arrays come from component state and
 * an in-place .sort() would mutate it.
 */

import type { Cloth, Look } from './types'

export type ClothSort = 'most-worn' | 'name' | 'newest' | 'last-worn'
export type LookSort = 'newest' | 'oldest' | 'name'

export const CLOTH_SORTS: { value: ClothSort; label: string }[] = [
  { value: 'most-worn', label: 'Most worn' },
  { value: 'last-worn', label: 'Last worn' },
  { value: 'name', label: 'A → Z' },
  { value: 'newest', label: 'Newest' },
]

export const LOOK_SORTS: { value: LookSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'A → Z' },
]

/**
 * Case-insensitive, and numeric so "Shirt 2" comes before "Shirt 10" instead
 * of after it (plain string compare puts "10" first).
 */
const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })

export function sortClothes(clothes: Cloth[], sort: ClothSort): Cloth[] {
  const out = [...clothes]
  switch (sort) {
    case 'name':
      return out.sort((a, b) => byName(a.name, b.name))
    case 'newest':
      return out.sort((a, b) => b.created_at - a.created_at)
    case 'last-worn':
      // Never-worn items have no timestamp; they belong at the BOTTOM of a
      // "last worn" list rather than sorting as if worn at the epoch.
      return out.sort((a, b) => {
        const av = a.last_worn_at
        const bv = b.last_worn_at
        if (av === null && bv === null) return byName(a.name, b.name)
        if (av === null) return 1
        if (bv === null) return -1
        return bv - av
      })
    case 'most-worn':
    default:
      // The default, and the reason there is no wash limit: whatever needs
      // washing floats to the top on its own. Ties break by name so the grid
      // does not reshuffle randomly between loads.
      return out.sort((a, b) => b.wears - a.wears || byName(a.name, b.name))
  }
}

export function sortLooks(looks: Look[], sort: LookSort): Look[] {
  const out = [...looks]
  switch (sort) {
    case 'oldest':
      return out.sort((a, b) => a.created_at - b.created_at)
    case 'name':
      // A look's name is optional. Unnamed ones go last, newest first among
      // themselves, so "A → Z" never opens with a run of blanks.
      return out.sort((a, b) => {
        const an = a.name?.trim() ?? ''
        const bn = b.name?.trim() ?? ''
        if (!an && !bn) return b.created_at - a.created_at
        if (!an) return 1
        if (!bn) return -1
        return byName(an, bn)
      })
    case 'newest':
    default:
      return out.sort((a, b) => b.created_at - a.created_at)
  }
}

const KEY = { clothes: 'closet.sort.clothes', looks: 'closet.sort.looks' } as const

/** Remember the choice per tab — the two grids sort by different things. */
export function loadSort<T extends string>(tab: 'clothes' | 'looks', fallback: T, allowed: readonly T[]): T {
  try {
    const raw = localStorage.getItem(KEY[tab])
    return allowed.includes(raw as T) ? (raw as T) : fallback
  } catch {
    // Private mode / storage disabled — the default ordering is fine.
    return fallback
  }
}

export function saveSort(tab: 'clothes' | 'looks', value: string): void {
  try {
    localStorage.setItem(KEY[tab], value)
  } catch {
    // Not being able to remember the preference must never break the grid.
  }
}
