/**
 * index.ts
 * Hono entry-point for the Cloudflare Worker.
 *
 *   POST /auth/login            → set session cookie (password gate)
 *   POST /auth/logout           → clear cookie
 *   GET  /api/me                → { authenticated }
 *   GET  /api/state             → { categories, items }   (auth)
 *   POST /api/categories        → create                  (auth)
 *   PATCH/DELETE /api/categories/:id                       (auth)
 *   POST /api/items             → create                  (auth)
 *   PATCH/DELETE /api/items/:id                            (auth)
 *   POST /api/reorder           → persist drag order       (auth)
 *   GET  *                      → serve the SPA via ASSETS
 */

import { Hono } from 'hono'
import type { Env } from './auth'
import { login, logout, me, requireAuth } from './auth'
import * as db from './db'

const app = new Hono<{ Bindings: Env }>()

// ── Auth ───────────────────────────────────────────────────────────────────
app.post('/auth/login', login)
app.post('/auth/logout', logout)
app.get('/api/me', me)

// ── Everything under /api (except /api/me) requires a valid session ──────────
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/me') return next()
  return requireAuth(c, next)
})

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

app.get('/api/state', async (c) => c.json(await db.getState(c.env)))

// Categories
app.post('/api/categories', async (c) => {
  const { name } = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string })
  const n = clean(name)
  if (!n) return c.json({ error: 'Name is required' }, 400)
  return c.json(await db.createCategory(c.env, n), 201)
})

app.patch('/api/categories/:id', async (c) => {
  const { name } = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string })
  const n = clean(name)
  if (!n) return c.json({ error: 'Name is required' }, 400)
  await db.renameCategory(c.env, c.req.param('id'), n)
  return c.json({ ok: true })
})

app.delete('/api/categories/:id', async (c) => {
  await db.deleteCategory(c.env, c.req.param('id'))
  return c.json({ ok: true })
})

// Items
app.post('/api/items', async (c) => {
  const { category_id, text } = await c.req
    .json<{ category_id?: string; text?: string }>()
    .catch(() => ({}) as { category_id?: string; text?: string })
  const cid = clean(category_id)
  const t = clean(text)
  if (!cid) return c.json({ error: 'category_id is required' }, 400)
  if (!t) return c.json({ error: 'Text is required' }, 400)
  return c.json(await db.createItem(c.env, cid, t), 201)
})

app.patch('/api/items/:id', async (c) => {
  const { text } = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
  const t = clean(text)
  if (!t) return c.json({ error: 'Text is required' }, 400)
  await db.updateItem(c.env, c.req.param('id'), t)
  return c.json({ ok: true })
})

app.delete('/api/items/:id', async (c) => {
  await db.deleteItem(c.env, c.req.param('id'))
  return c.json({ ok: true })
})

// Reorder (drag-and-drop persistence)
app.post('/api/reorder', async (c) => {
  type ReorderBody = { type?: string; orderedIds?: string[]; categoryId?: string }
  const body = await c.req.json<ReorderBody>().catch(() => ({}) as ReorderBody)
  const ids = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter((x): x is string => typeof x === 'string')
    : []
  if (body.type === 'category') {
    await db.reorderCategories(c.env, ids)
  } else if (body.type === 'item') {
    const cid = clean(body.categoryId)
    if (!cid) return c.json({ error: 'categoryId is required for item reorder' }, 400)
    await db.reorderItems(c.env, cid, ids)
  } else {
    return c.json({ error: 'Unknown reorder type' }, 400)
  }
  return c.json({ ok: true })
})

// ── SPA fallback — serve static assets for everything else ───────────────────
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
