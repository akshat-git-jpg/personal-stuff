import { describe, it, expect } from 'vitest'
import { tagIndex, filterByTags, lastWornLabel } from '../src/client/filter'
import type { ItemTag } from '../src/client/types'

const ROWS: ItemTag[] = [
  { item_type: 'look', item_id: 'L1', tag_id: 'office' },
  { item_type: 'look', item_id: 'L1', tag_id: 'winter' },
  { item_type: 'look', item_id: 'L2', tag_id: 'office' },
  { item_type: 'look', item_id: 'L3', tag_id: 'winter' },
  { item_type: 'cloth', item_id: 'C1', tag_id: 'office' },
]
const LOOKS = [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }, { id: 'L4' }]

describe('tagIndex', () => {
  it('indexes only the requested item type', () => {
    const idx = tagIndex(ROWS, 'look')
    expect([...(idx.get('L1') ?? [])].sort()).toEqual(['office', 'winter'])
    expect(idx.has('C1')).toBe(false)
  })
})

describe('filterByTags', () => {
  it('returns everything when nothing is selected', () => {
    expect(filterByTags(LOOKS, tagIndex(ROWS, 'look'), [])).toHaveLength(4)
  })

  it('AND filter narrows, never widens', () => {
    const idx = tagIndex(ROWS, 'look')
    const one = filterByTags(LOOKS, idx, ['office']).map((l) => l.id)
    const two = filterByTags(LOOKS, idx, ['office', 'winter']).map((l) => l.id)
    expect(one).toEqual(['L1', 'L2'])
    expect(two).toEqual(['L1'])
    expect(two.length).toBeLessThanOrEqual(one.length)
  })

  it('excludes items with no tags at all once a chip is active', () => {
    expect(filterByTags(LOOKS, tagIndex(ROWS, 'look'), ['office']).map((l) => l.id)).not.toContain('L4')
  })

  it('returns nothing when no item carries the whole set', () => {
    expect(filterByTags(LOOKS, tagIndex(ROWS, 'look'), ['office', 'winter', 'summer'])).toEqual([])
  })
})

describe('lastWornLabel', () => {
  const now = new Date('2026-08-17T21:00:00').getTime()
  it('names never, today, yesterday and N days', () => {
    expect(lastWornLabel(null, now)).toBe('never worn')
    expect(lastWornLabel(new Date('2026-08-17T07:00:00').getTime(), now)).toBe('worn today')
    expect(lastWornLabel(new Date('2026-08-16T23:30:00').getTime(), now)).toBe('worn yesterday')
    expect(lastWornLabel(new Date('2026-08-14T10:00:00').getTime(), now)).toBe('worn 3 days ago')
  })
})
