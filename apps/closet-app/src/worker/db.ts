/**
 * db.ts
 * D1 data access for clothes, looks, tags and the wear/wash event log.
 * Thin, typed helpers — no ORM. Follows apps/lists-app/src/worker/db.ts.
 */

import type { Env } from './auth'

export interface Cloth {
  id: string
  name: string
  photo_key: string | null
  wears: number
  last_worn_at: number | null
  last_washed_at: number | null
  created_at: number
}

export interface Look {
  id: string
  name: string | null
  photo_key: string | null
  created_at: number
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
}

const CLOTH_COLS = 'id, name, photo_key, wears, last_worn_at, last_washed_at, created_at'
const LOOK_COLS = 'id, name, photo_key, created_at'

/**
 * The whole app state in one round trip. The owner has tens of items, not
 * thousands, so tag filtering happens in the browser — the same call the
 * lists-app makes ("Search filters items already loaded in the browser").
 * Clothes come back highest-count-first, which is the order the UI shows.
 */
export async function getState(env: Env): Promise<AppState> {
  const [clothes, looks, tags, itemTags] = await Promise.all([
    env.DB.prepare(`SELECT ${CLOTH_COLS} FROM clothes ORDER BY wears DESC, name COLLATE NOCASE`).all<Cloth>(),
    env.DB.prepare(`SELECT ${LOOK_COLS} FROM looks ORDER BY created_at DESC`).all<Look>(),
    env.DB.prepare('SELECT id, name, created_at FROM tags ORDER BY name').all<Tag>(),
    env.DB.prepare('SELECT item_type, item_id, tag_id FROM item_tags').all<ItemTag>(),
  ])
  return {
    clothes: clothes.results ?? [],
    looks: looks.results ?? [],
    tags: tags.results ?? [],
    item_tags: itemTags.results ?? [],
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

// ── Clothes ────────────────────────────────────────────────────────────────

export async function createCloth(
  env: Env,
  name: string,
  photoKey: string | null,
  tagIds: string[],
): Promise<Cloth> {
  const cloth: Cloth = {
    id: crypto.randomUUID(),
    name,
    photo_key: photoKey,
    wears: 0,
    last_worn_at: null,
    last_washed_at: null,
    created_at: Date.now(),
  }
  await env.DB.prepare(
    'INSERT INTO clothes (id, name, photo_key, wears, last_worn_at, last_washed_at, created_at) VALUES (?, ?, ?, 0, NULL, NULL, ?)',
  )
    .bind(cloth.id, cloth.name, cloth.photo_key, cloth.created_at)
    .run()
  await setItemTags(env, 'cloth', cloth.id, tagIds)
  return cloth
}

/**
 * Patch a cloth. Only the fields present in `patch` change — `undefined` means
 * "leave it alone", which is why photo_key uses a two-state check (a caller CAN
 * send null to clear the photo).
 */
export async function updateCloth(
  env: Env,
  id: string,
  patch: { name?: string; photo_key?: string | null; tagIds?: string[] },
): Promise<Cloth | null> {
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE clothes SET name = ? WHERE id = ?').bind(patch.name, id).run()
  }
  if (patch.photo_key !== undefined) {
    await env.DB.prepare('UPDATE clothes SET photo_key = ? WHERE id = ?').bind(patch.photo_key, id).run()
  }
  if (patch.tagIds !== undefined) {
    await setItemTags(env, 'cloth', id, patch.tagIds)
    await pruneOrphanTags(env)
  }
  return getCloth(env, id)
}

export async function deleteCloth(env: Env, id: string): Promise<void> {
  // Cascade by hand — FK enforcement isn't relied upon (same as lists-app).
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE cloth_id = ?').bind(id),
    env.DB.prepare("DELETE FROM item_tags WHERE item_type = 'cloth' AND item_id = ?").bind(id),
    env.DB.prepare('DELETE FROM clothes WHERE id = ?').bind(id),
  ])
  await pruneOrphanTags(env)
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
  photoKey: string | null,
  tagIds: string[],
): Promise<Look> {
  const look: Look = { id: crypto.randomUUID(), name, photo_key: photoKey, created_at: Date.now() }
  await env.DB.prepare('INSERT INTO looks (id, name, photo_key, created_at) VALUES (?, ?, ?, ?)')
    .bind(look.id, look.name, look.photo_key, look.created_at)
    .run()
  await setItemTags(env, 'look', look.id, tagIds)
  return look
}

export async function updateLook(
  env: Env,
  id: string,
  patch: { name?: string | null; photo_key?: string | null; tagIds?: string[] },
): Promise<Look | null> {
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE looks SET name = ? WHERE id = ?').bind(patch.name, id).run()
  }
  if (patch.photo_key !== undefined) {
    await env.DB.prepare('UPDATE looks SET photo_key = ? WHERE id = ?').bind(patch.photo_key, id).run()
  }
  if (patch.tagIds !== undefined) {
    await setItemTags(env, 'look', id, patch.tagIds)
    await pruneOrphanTags(env)
  }
  return getLook(env, id)
}

export async function deleteLook(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM item_tags WHERE item_type = 'look' AND item_id = ?").bind(id),
    env.DB.prepare('DELETE FROM looks WHERE id = ?').bind(id),
  ])
  await pruneOrphanTags(env)
}
