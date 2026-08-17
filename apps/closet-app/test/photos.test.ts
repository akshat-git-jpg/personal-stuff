import { describe, it, expect } from 'vitest'
import { photoIndex } from '../src/client/filter'
import type { Photo } from '../src/client/types'

const p = (item_type: 'cloth' | 'look', item_id: string, r2_key: string, position: number): Photo => ({
  id: `${item_id}-${position}`,
  item_type,
  item_id,
  r2_key,
  position,
})

// As returned by /api/state: already ordered by (item_type, item_id, position).
const ROWS: Photo[] = [
  p('cloth', 'C1', 'front.jpg', 0),
  p('cloth', 'C1', 'back.jpg', 1),
  p('cloth', 'C1', 'worn.jpg', 2),
  p('cloth', 'C2', 'solo.jpg', 0),
  p('look', 'L1', 'look-a.jpg', 0),
  p('look', 'L1', 'look-b.jpg', 1),
]

describe('photoIndex', () => {
  it('groups an item’s photos with the cover first', () => {
    expect(photoIndex(ROWS, 'cloth').get('C1')).toEqual(['front.jpg', 'back.jpg', 'worn.jpg'])
  })

  it('keeps the two item types apart', () => {
    const clothes = photoIndex(ROWS, 'cloth')
    const looks = photoIndex(ROWS, 'look')
    expect(clothes.has('L1')).toBe(false)
    expect(looks.has('C1')).toBe(false)
    expect(looks.get('L1')).toEqual(['look-a.jpg', 'look-b.jpg'])
  })

  it('returns nothing for an item with no photos, so callers fall back', () => {
    expect(photoIndex(ROWS, 'cloth').get('C-none')).toBeUndefined()
    expect(photoIndex([], 'cloth').size).toBe(0)
  })

  it('handles a single-photo item — that photo is the cover', () => {
    expect(photoIndex(ROWS, 'cloth').get('C2')).toEqual(['solo.jpg'])
  })

  /**
   * Guards the contract, not the implementation: the SERVER decides the cover by
   * `position`, so the client must preserve arrival order rather than re-sorting
   * by key name or id. If someone "tidies" this with a .sort(), this fails.
   */
  it('preserves server order even when keys sort differently alphabetically', () => {
    const rows: Photo[] = [p('cloth', 'C9', 'zebra.jpg', 0), p('cloth', 'C9', 'apple.jpg', 1)]
    expect(photoIndex(rows, 'cloth').get('C9')).toEqual(['zebra.jpg', 'apple.jpg'])
  })
})
