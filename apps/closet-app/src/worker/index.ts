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

/** Drop an R2 object we are about to stop referencing. Never throws. */
async function dropPhoto(c: { env: Env }, key: string | null | undefined): Promise<void> {
  if (!key) return
  await c.env.PHOTOS.delete(key).catch(() => undefined)
}

// ── Clothes ────────────────────────────────────────────────────────────────

app.post('/api/clothes', async (c) => {
  const body = await c.req.json<{ name?: string; tags?: unknown; photo_key?: string }>().catch(() => ({} as { name?: string; tags?: unknown; photo_key?: string }))
  const name = clean(body.name)
  if (!name) return c.json({ error: 'Name is required' }, 400)
  const tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  return c.json(await db.createCloth(c.env, name, clean(body.photo_key) || null, tagIds), 201)
})

app.patch('/api/clothes/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getCloth(c.env, id)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req
    .json<{ name?: string; tags?: unknown; photo_key?: string | null }>()
    .catch(() => ({}) as { name?: string; tags?: unknown; photo_key?: string | null })

  const patch: { name?: string; photo_key?: string | null; tagIds?: string[] } = {}

  if (body.name !== undefined) {
    const name = clean(body.name)
    if (!name) return c.json({ error: 'Name is required' }, 400)
    patch.name = name
  }
  if (body.photo_key !== undefined) {
    const next = body.photo_key === null ? null : clean(body.photo_key) || null
    if (next !== existing.photo_key) await dropPhoto(c, existing.photo_key)
    patch.photo_key = next
  }
  if (body.tags !== undefined) {
    patch.tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  }

  return c.json(await db.updateCloth(c.env, id, patch))
})

app.delete('/api/clothes/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getCloth(c.env, id)
  if (existing) {
    await dropPhoto(c, existing.photo_key)
    await db.deleteCloth(c.env, id)
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

app.post('/api/looks', async (c) => {
  const body = await c.req.json<{ name?: string; tags?: unknown; photo_key?: string }>().catch(() => ({} as { name?: string; tags?: unknown; photo_key?: string }))
  const photoKey = clean(body.photo_key) || null
  if (!photoKey) return c.json({ error: 'photo_key is required' }, 400)
  const tagIds = await db.resolveTagIds(c.env, tagList(body.tags))
  return c.json(await db.createLook(c.env, clean(body.name) || null, photoKey, tagIds), 201)
})

app.patch('/api/looks/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getLook(c.env, id)
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req
    .json<{ name?: string | null; tags?: unknown; photo_key?: string }>()
    .catch(() => ({}) as { name?: string | null; tags?: unknown; photo_key?: string })

  const patch: { name?: string | null; photo_key?: string | null; tagIds?: string[] } = {}
  if (body.name !== undefined) patch.name = body.name === null ? null : clean(body.name) || null
  if (body.photo_key !== undefined) {
    const next = clean(body.photo_key) || null
    if (next && next !== existing.photo_key) {
      await dropPhoto(c, existing.photo_key)
      patch.photo_key = next
    }
  }
  if (body.tags !== undefined) patch.tagIds = await db.resolveTagIds(c.env, tagList(body.tags))

  return c.json(await db.updateLook(c.env, id, patch))
})

app.delete('/api/looks/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await db.getLook(c.env, id)
  if (existing) {
    await dropPhoto(c, existing.photo_key)
    await db.deleteLook(c.env, id)
  }
  return c.json({ ok: true })
})

// ── SPA fallback ───────────────────────────────────────────────────────────
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
