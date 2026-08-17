/**
 * types.ts — row shapes mirrored from plan 203's Worker/D1 schema.
 * `/api/state` is the only reader of these; keep in lockstep with `src/worker/db.ts`.
 */

export type Cloth = {
  id: string
  name: string
  photo_key: string | null
  wears: number
  last_worn_at: number | null
  last_washed_at: number | null
  created_at: number
}

export type Look = {
  id: string
  name: string | null
  photo_key: string | null
  created_at: number
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
}

export type TabKey = 'clothes' | 'looks'
