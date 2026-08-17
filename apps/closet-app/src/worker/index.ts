/**
 * index.ts
 * Hono entry-point for the closet-app Worker. Route table lives in
 * plans/203-closet-app-backend.md; see that plan before adding an endpoint.
 */

import { Hono } from 'hono'
import type { Env } from './auth'
import { login, logout, me, requireAuth } from './auth'
import * as db from './db'

const app = new Hono<{ Bindings: Env }>()

const MAX_PHOTO_BYTES = 400 * 1024

// ── Auth ───────────────────────────────────────────────────────────────────
app.post('/auth/login', login)
app.post('/auth/logout', logout)
app.get('/api/me', me)

// Everything under /api except /api/me needs a valid session.
// NOTE: c.req.param() is undefined inside a wildcard middleware — use c.req.path.
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/me') return next()
  return requireAuth(c, next)
})

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const tagList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [])

/**
 * A request's `photo_keys` — the item's WHOLE ordered photo set, cover first.
 * The client always sends the full list, so add / remove / reorder /
 * change-cover are all the same write. Capped so a runaway client cannot
 * attach thousands of rows to one item.
 */
const MAX_PHOTOS_PER_ITEM = 12
const photoKeyList = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter(Boolean))].slice(
        0,
        MAX_PHOTOS_PER_ITEM,
      )
    : []

app.get('/api/state', async (c) => c.json(await db.getState(c.env)))

// ── Photos (R2) ────────────────────────────────────────────────────────────

app.post('/api/photos', async (c) => {
  const type = c.req.header('content-type') ?? ''
  if (!type.startsWith('image/')) return c.json({ error: 'Expected an image body' }, 415)

  const body = await c.req.arrayBuffer()
  if (body.byteLength === 0) return c.json({ error: 'Empty body' }, 400)
  if (body.byteLength > MAX_PHOTO_BYTES) return c.json({ error: 'Photo too large' }, 413)

  const key = `${crypto.randomUUID()}.jpg`
  await c.env.PHOTOS.put(key, body, { httpMetadata: { contentType: 'image/jpeg' } })
  return c.json({ key }, 201)
})

app.get('/api/photos/:key', async (c) => {
  const object = await c.env.PHOTOS.get(c.req.param('key'))
  if (!object) return c.json({ error: 'Not found' }, 404)
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

/**
 * Delete R2 objects the database no longer points at. The db layer decides
 * WHICH keys those are (it checks that nothing else still references them);
 * this is the only place in the Worker that removes from the bucket.
 * Never throws — a failed delete leaks one object, it must not fail the request.
 */
async function dropPhotos(c: { env: Env }, keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => c.env.PHOTOS.delete(key).catch(() => undefined)))
}

// ── Clothes ────────────────────────────────────────────────────────────────

type ClothBody = { name?: string; tags?: unknown; photo_keys?: unknown }

app.post('/api/clothes', async (c) => {
  const body = await c.req.json<ClothBody>().catch(() => ({}) as ClothBody)
  const name = clean(body.name)
  if (!name) return c.json({ error: 'Name is required' }, 400)
  const tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  const cloth = await db.createCloth(c.env, name, photoKeyList(body.photo_keys), tagIds)
  return c.json(cloth, 201)
})

app.patch('/api/clothes/:id', async (c) => {
  const id = c.req.param('id')
  if (!(await db.getCloth(c.env, id))) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<ClothBody>().catch(() => ({}) as ClothBody)
  const patch: { name?: string; photoKeys?: string[]; tagIds?: string[] } = {}

  if (body.name !== undefined) {
    const name = clean(body.name)
    if (!name) return c.json({ error: 'Name is required' }, 400)
    patch.name = name
  }
  if (body.tags !== undefined) patch.tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  if (body.photo_keys !== undefined) patch.photoKeys = photoKeyList(body.photo_keys)

  const { cloth, droppedKeys } = await db.updateCloth(c.env, id, patch)
  await dropPhotos(c, droppedKeys)
  return c.json(cloth)
})

app.delete('/api/clothes/:id', async (c) => {
  const id = c.req.param('id')
  if (await db.getCloth(c.env, id)) {
    await dropPhotos(c, await db.deleteCloth(c.env, id))
  }
  return c.json({ ok: true })
})

app.post('/api/clothes/:id/wear', async (c) => {
  const res = await db.recordWear(c.env, c.req.param('id'))
  return res ? c.json(res) : c.json({ error: 'Not found' }, 404)
})

app.post('/api/clothes/:id/wash', async (c) => {
  const res = await db.recordWash(c.env, c.req.param('id'))
  return res ? c.json(res) : c.json({ error: 'Not found' }, 404)
})

app.post('/api/events/:id/undo', async (c) => {
  const cloth = await db.undoEvent(c.env, c.req.param('id'))
  return cloth ? c.json({ cloth }) : c.json({ error: 'Not found' }, 404)
})

// ── Looks ──────────────────────────────────────────────────────────────────

type LookBody = { name?: string | null; tags?: unknown; photo_keys?: unknown }

app.post('/api/looks', async (c) => {
  const body = await c.req.json<LookBody>().catch(() => ({}) as LookBody)
  const photoKeys = photoKeyList(body.photo_keys)
  // A look IS its photos — one with none would render as an untappable blank.
  if (photoKeys.length === 0) return c.json({ error: 'At least one photo is required' }, 400)
  const tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  const look = await db.createLook(c.env, clean(body.name) || null, photoKeys, tagIds)
  return c.json(look, 201)
})

app.patch('/api/looks/:id', async (c) => {
  const id = c.req.param('id')
  if (!(await db.getLook(c.env, id))) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<LookBody>().catch(() => ({}) as LookBody)
  const patch: { name?: string | null; photoKeys?: string[]; tagIds?: string[] } = {}

  if (body.name !== undefined) patch.name = body.name === null ? null : clean(body.name) || null
  if (body.tags !== undefined) patch.tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  if (body.photo_keys !== undefined) {
    const next = photoKeyList(body.photo_keys)
    // Same reason as create: never let an edit strip a look down to no photos.
    if (next.length === 0) return c.json({ error: 'At least one photo is required' }, 400)
    patch.photoKeys = next
  }

  const { look, droppedKeys } = await db.updateLook(c.env, id, patch)
  await dropPhotos(c, droppedKeys)
  return c.json(look)
})

app.delete('/api/looks/:id', async (c) => {
  const id = c.req.param('id')
  if (await db.getLook(c.env, id)) {
    await dropPhotos(c, await db.deleteLook(c.env, id))
  }
  return c.json({ ok: true })
})

// ── SPA fallback ───────────────────────────────────────────────────────────
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
