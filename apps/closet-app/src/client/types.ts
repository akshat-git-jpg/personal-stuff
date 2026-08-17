/**
 * types.ts — row shapes mirrored from plan 203's Worker/D1 schema.
 * `/api/state` is the only reader of these; keep in lockstep with `src/worker/db.ts`.
 */

export type Cloth = {
  id: string
  name: string
  wears: number
  last_worn_at: number | null
  last_washed_at: number | null
  created_at: number
}

export type Look = {
  id: string
  name: string | null
  created_at: number
}

/**
 * One picture in an item's catalogue. Arrives as a flat array on `AppState`
 * (like `item_tags`) already sorted by position, so the first row for an item
 * is its cover. Group it with `photoIndex()` from `./filter`.
 */
export type Photo = {
  id: string
  item_type: 'cloth' | 'look'
  item_id: string
  r2_key: string
  position: number
}

export type Tag = {
  id: string
  name: string
  created_at: number
}

export type ItemTag = {
  item_type: 'cloth' | 'look'
  item_id: string
  tag_id: string
}

export type AppState = {
  clothes: Cloth[]
  looks: Look[]
  tags: Tag[]
  item_tags: ItemTag[]
  photos: Photo[]
}

/** What the full-screen viewer is showing. Same shape for both tabs. */
export type ViewingItem = { type: 'cloth' | 'look'; id: string }

export type TabKey = 'clothes' | 'looks'
