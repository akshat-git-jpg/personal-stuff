/**
 * db.ts
 * D1 data access for clothes, looks, tags and the wear/wash event log.
 * Thin, typed helpers — no ORM. Follows apps/lists-app/src/worker/db.ts.
 */

import type { Env } from './auth'

export interface Cloth {
  id: string
  name: string
  wears: number
  last_worn_at: number | null
  last_washed_at: number | null
  created_at: number
}

export interface Look {
  id: string
  name: string | null
  created_at: number
}

/**
 * One picture belonging to one cloth or look. An item is a catalogue: it may
 * hold any number of these. `position` orders them and position 0 IS the cover,
 * so there is no separate cover flag that could disagree with the ordering.
 */
export interface Photo {
  id: string
  item_type: 'cloth' | 'look'
  item_id: string
  r2_key: string
  position: number
}

export interface Tag {
  id: string
  name: string
  created_at: number
}

export interface ItemTag {
  item_type: 'cloth' | 'look'
  item_id: string
  tag_id: string
}

export interface ClothEvent {
  id: string
  cloth_id: string
  type: 'wear' | 'wash'
  prev_wears: number
  at: number
}

export interface AppState {
  clothes: Cloth[]
  looks: Look[]
  tags: Tag[]
  item_tags: ItemTag[]
  photos: Photo[]
}

const CLOTH_COLS = 'id, name, wears, last_worn_at, last_washed_at, created_at'
const LOOK_COLS = 'id, name, created_at'

/**
 * The whole app state in one round trip. The owner has tens of items, not
 * thousands, so tag filtering happens in the browser — the same call the
 * lists-app makes ("Search filters items already loaded in the browser").
 * Clothes come back highest-count-first, which is the order the UI shows.
 *
 * `photos` is a flat array the client groups by item, exactly like `item_tags`
 * — already ordered, so the first row per item is that item's cover.
 */
export async function getState(env: Env): Promise<AppState> {
  const [clothes, looks, tags, itemTags, photos] = await Promise.all([
    env.DB.prepare(`SELECT ${CLOTH_COLS} FROM clothes ORDER BY wears DESC, name COLLATE NOCASE`).all<Cloth>(),
    env.DB.prepare(`SELECT ${LOOK_COLS} FROM looks ORDER BY created_at DESC`).all<Look>(),
    env.DB.prepare('SELECT id, name, created_at FROM tags ORDER BY name').all<Tag>(),
    env.DB.prepare('SELECT item_type, item_id, tag_id FROM item_tags').all<ItemTag>(),
    env.DB
      .prepare('SELECT id, item_type, item_id, r2_key, position FROM photos ORDER BY item_type, item_id, position')
      .all<Photo>(),
  ])
  return {
    clothes: clothes.results ?? [],
    looks: looks.results ?? [],
    tags: tags.results ?? [],
    item_tags: itemTags.results ?? [],
    photos: photos.results ?? [],
  }
}

export function getCloth(env: Env, id: string): Promise<Cloth | null> {
  return env.DB.prepare(`SELECT ${CLOTH_COLS} FROM clothes WHERE id = ?`).bind(id).first<Cloth>()
}

export function getLook(env: Env, id: string): Promise<Look | null> {
  return env.DB.prepare(`SELECT ${LOOK_COLS} FROM looks WHERE id = ?`).bind(id).first<Look>()
}

// ── Tags ───────────────────────────────────────────────────────────────────

/**
 * Canonical tag spelling. One vocabulary is shared across both tabs, so
 * "Office ", "office" and "OFFICE" must land on ONE row or the chip list
 * grows duplicates that filter differently.
 */
export function normaliseTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Map raw tag strings to tag ids, creating the ones that don't exist yet.
 * Two D1 reads on purpose: INSERT OR IGNORE can lose a race with a concurrent
 * request, so the table is re-read afterwards instead of trusting the ids we
 * generated. Returns ids in the caller's (de-duplicated) order.
 */
export async function resolveTagIds(env: Env, raw: string[]): Promise<string[]> {
  const names = [...new Set(raw.map(normaliseTag).filter((n) => n.length > 0))]
  if (names.length === 0) return []

  const holes = names.map(() => '?').join(',')
  const read = () =>
    env.DB.prepare(`SELECT id, name FROM tags WHERE name IN (${holes})`)
      .bind(...names)
      .all<{ id: string; name: string }>()

  const found = await read()
  const byName = new Map((found.results ?? []).map((r) => [r.name, r.id]))
  const missing = names.filter((n) => !byName.has(n))

  if (missing.length > 0) {
    const now = Date.now()
    await env.DB.batch(
      missing.map((name) =>
        env.DB.prepare('INSERT OR IGNORE INTO tags (id, name, created_at) VALUES (?, ?, ?)')
          .bind(crypto.randomUUID(), name, now),
      ),
    )
    const after = await read()
    for (const r of after.results ?? []) byName.set(r.name, r.id)
  }

  return names.map((n) => byName.get(n)).filter((id): id is string => typeof id === 'string')
}

/** Replace an item's tag set with exactly `tagIds`. */
export async function setItemTags(
  env: Env,
  itemType: 'cloth' | 'look',
  itemId: string,
  tagIds: string[],
): Promise<void> {
  const stmts = [
    env.DB.prepare('DELETE FROM item_tags WHERE item_type = ? AND item_id = ?').bind(itemType, itemId),
    ...tagIds.map((tagId) =>
      env.DB.prepare('INSERT OR IGNORE INTO item_tags (item_type, item_id, tag_id) VALUES (?, ?, ?)')
        .bind(itemType, itemId, tagId),
    ),
  ]
  await env.DB.batch(stmts)
}

/**
 * Drop tags nothing references any more. Called after every tag-set change and
 * every delete, so the chip row only ever shows tags that can actually filter
 * something.
 */
export async function pruneOrphanTags(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM item_tags)').run()
}

// ── Photos ─────────────────────────────────────────────────────────────────
//
// This module never touches R2. Every function that stops referencing a key
// RETURNS the keys that became unreferenced, and the route layer deletes those
// objects — so bucket writes stay in one place (src/worker/index.ts).

/** Every r2 key an item holds, cover (position 0) first. */
export async function itemPhotoKeys(
  env: Env,
  itemType: 'cloth' | 'look',
  itemId: string,
): Promise<string[]> {
  const rows = await env.DB
    .prepare('SELECT r2_key FROM photos WHERE item_type = ? AND item_id = ? ORDER BY position')
    .bind(itemType, itemId)
    .all<{ r2_key: string }>()
  return (rows.results ?? []).map((r) => r.r2_key)
}

/**
 * Of `keys`, the ones no photo row points at any more.
 *
 * The check matters: the same object could be attached to two items, and
 * deleting it because ONE reference went away would blank the other item's
 * picture. Only a key with zero remaining rows is safe to remove from R2.
 */
async function unreferenced(env: Env, keys: string[]): Promise<string[]> {
  const candidates = [...new Set(keys)]
  if (candidates.length === 0) return []
  const holes = candidates.map(() => '?').join(',')
  const still = await env.DB
    .prepare(`SELECT DISTINCT r2_key FROM photos WHERE r2_key IN (${holes})`)
    .bind(...candidates)
    .all<{ r2_key: string }>()
  const referenced = new Set((still.results ?? []).map((r) => r.r2_key))
  return candidates.filter((k) => !referenced.has(k))
}

/**
 * Replace an item's photo set with exactly `keys`, in that order — the array
 * index becomes `position`, so `keys[0]` is the new cover. Reordering, adding,
 * removing and "make this the cover" are all this one call from the client's
 * point of view, which is why there are no separate reorder endpoints.
 *
 * Returns the keys whose objects are now safe to delete from R2.
 */
export async function setItemPhotos(
  env: Env,
  itemType: 'cloth' | 'look',
  itemId: string,
  keys: string[],
): Promise<string[]> {
  const had = await itemPhotoKeys(env, itemType, itemId)
  const wanted = [...new Set(keys.filter((k) => typeof k === 'string' && k.length > 0))]
  const now = Date.now()

  await env.DB.batch([
    env.DB.prepare('DELETE FROM photos WHERE item_type = ? AND item_id = ?').bind(itemType, itemId),
    ...wanted.map((key, i) =>
      env.DB
        .prepare(
          'INSERT INTO photos (id, item_type, item_id, r2_key, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(crypto.randomUUID(), itemType, itemId, key, i, now),
    ),
  ])

  return unreferenced(
    env,
    had.filter((k) => !wanted.includes(k)),
  )
}

/** Drop every photo row for an item. Returns keys now safe to delete from R2. */
async function clearItemPhotos(env: Env, itemType: 'cloth' | 'look', itemId: string): Promise<string[]> {
  const had = await itemPhotoKeys(env, itemType, itemId)
  await env.DB.prepare('DELETE FROM photos WHERE item_type = ? AND item_id = ?').bind(itemType, itemId).run()
  return unreferenced(env, had)
}

// ── Clothes ────────────────────────────────────────────────────────────────

export async function createCloth(
  env: Env,
  name: string,
  photoKeys: string[],
  tagIds: string[],
): Promise<Cloth> {
  const cloth: Cloth = {
    id: crypto.randomUUID(),
    name,
    wears: 0,
    last_worn_at: null,
    last_washed_at: null,
    created_at: Date.now(),
  }
  await env.DB.prepare(
    'INSERT INTO clothes (id, name, wears, last_worn_at, last_washed_at, created_at) VALUES (?, ?, 0, NULL, NULL, ?)',
  )
    .bind(cloth.id, cloth.name, cloth.created_at)
    .run()
  await setItemTags(env, 'cloth', cloth.id, tagIds)
  await setItemPhotos(env, 'cloth', cloth.id, photoKeys)
  return cloth
}

/**
 * Patch a cloth. Only the fields present in `patch` change — `undefined` means
 * "leave it alone". `photoKeys` is the item's WHOLE ordered photo set, so the
 * same field expresses add, remove, reorder and change-cover.
 *
 * Returns the cloth plus the r2 keys whose objects the caller should now delete.
 */
export async function updateCloth(
  env: Env,
  id: string,
  patch: { name?: string; photoKeys?: string[]; tagIds?: string[] },
): Promise<{ cloth: Cloth | null; droppedKeys: string[] }> {
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE clothes SET name = ? WHERE id = ?').bind(patch.name, id).run()
  }
  if (patch.tagIds !== undefined) {
    await setItemTags(env, 'cloth', id, patch.tagIds)
    await pruneOrphanTags(env)
  }
  const droppedKeys =
    patch.photoKeys !== undefined ? await setItemPhotos(env, 'cloth', id, patch.photoKeys) : []

  return { cloth: await getCloth(env, id), droppedKeys }
}

/** Delete a cloth. Returns the r2 keys the caller should delete from the bucket. */
export async function deleteCloth(env: Env, id: string): Promise<string[]> {
  // Cascade by hand — FK enforcement isn't relied upon (same as lists-app).
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE cloth_id = ?').bind(id),
    env.DB.prepare("DELETE FROM item_tags WHERE item_type = 'cloth' AND item_id = ?").bind(id),
    env.DB.prepare('DELETE FROM clothes WHERE id = ?').bind(id),
  ])
  await pruneOrphanTags(env)
  return clearItemPhotos(env, 'cloth', id)
}

// ── Wear / wash / undo ─────────────────────────────────────────────────────

async function record(
  env: Env,
  clothId: string,
  type: 'wear' | 'wash',
): Promise<{ cloth: Cloth; event_id: string } | null> {
  const cur = await env.DB.prepare('SELECT wears FROM clothes WHERE id = ?').bind(clothId).first<{ wears: number }>()
  if (!cur) return null

  const now = Date.now()
  const eventId = crypto.randomUUID()
  const update =
    type === 'wear'
      ? env.DB.prepare('UPDATE clothes SET wears = wears + 1, last_worn_at = ? WHERE id = ?').bind(now, clothId)
      : env.DB.prepare('UPDATE clothes SET wears = 0, last_washed_at = ? WHERE id = ?').bind(now, clothId)

  await env.DB.batch([
    env.DB.prepare('INSERT INTO events (id, cloth_id, type, prev_wears, at) VALUES (?, ?, ?, ?, ?)')
      .bind(eventId, clothId, type, cur.wears, now),
    update,
  ])

  const cloth = await getCloth(env, clothId)
  return cloth ? { cloth, event_id: eventId } : null
}

export const recordWear = (env: Env, clothId: string) => record(env, clothId, 'wear')
export const recordWash = (env: Env, clothId: string) => record(env, clothId, 'wash')

/**
 * Reverse one event and delete it.
 *
 * `prev_wears` (the count BEFORE the event) makes this exact for both kinds:
 * a wash-undo restores the real number rather than guessing. Timestamps are
 * re-derived from the events that REMAIN, so undoing the only wear leaves
 * last_worn_at NULL instead of a stale time. A mis-tap should vanish from
 * history, so the row is hard-deleted rather than flagged.
 */
export async function undoEvent(env: Env, eventId: string): Promise<Cloth | null> {
  const ev = await env.DB.prepare('SELECT id, cloth_id, type, prev_wears, at FROM events WHERE id = ?')
    .bind(eventId)
    .first<ClothEvent>()
  if (!ev) return null

  await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run()

  const lastWorn = await env.DB
    .prepare("SELECT MAX(at) AS at FROM events WHERE cloth_id = ? AND type = 'wear'")
    .bind(ev.cloth_id)
    .first<{ at: number | null }>()
  const lastWashed = await env.DB
    .prepare("SELECT MAX(at) AS at FROM events WHERE cloth_id = ? AND type = 'wash'")
    .bind(ev.cloth_id)
    .first<{ at: number | null }>()

  await env.DB.prepare('UPDATE clothes SET wears = ?, last_worn_at = ?, last_washed_at = ? WHERE id = ?')
    .bind(ev.prev_wears, lastWorn?.at ?? null, lastWashed?.at ?? null, ev.cloth_id)
    .run()

  return getCloth(env, ev.cloth_id)
}

// ── Looks ──────────────────────────────────────────────────────────────────

export async function createLook(
  env: Env,
  name: string | null,
  photoKeys: string[],
  tagIds: string[],
): Promise<Look> {
  const look: Look = { id: crypto.randomUUID(), name, created_at: Date.now() }
  await env.DB.prepare('INSERT INTO looks (id, name, created_at) VALUES (?, ?, ?)')
    .bind(look.id, look.name, look.created_at)
    .run()
  await setItemTags(env, 'look', look.id, tagIds)
  await setItemPhotos(env, 'look', look.id, photoKeys)
  return look
}

/** Same contract as `updateCloth`: `photoKeys` is the whole ordered set. */
export async function updateLook(
  env: Env,
  id: string,
  patch: { name?: string | null; photoKeys?: string[]; tagIds?: string[] },
): Promise<{ look: Look | null; droppedKeys: string[] }> {
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE looks SET name = ? WHERE id = ?').bind(patch.name, id).run()
  }
  if (patch.tagIds !== undefined) {
    await setItemTags(env, 'look', id, patch.tagIds)
    await pruneOrphanTags(env)
  }
  const droppedKeys =
    patch.photoKeys !== undefined ? await setItemPhotos(env, 'look', id, patch.photoKeys) : []

  return { look: await getLook(env, id), droppedKeys }
}

/** Delete a look. Returns the r2 keys the caller should delete from the bucket. */
export async function deleteLook(env: Env, id: string): Promise<string[]> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM item_tags WHERE item_type = 'look' AND item_id = ?").bind(id),
    env.DB.prepare('DELETE FROM looks WHERE id = ?').bind(id),
  ])
  await pruneOrphanTags(env)
  return clearItemPhotos(env, 'look', id)
}
