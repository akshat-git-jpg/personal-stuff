/**
 * index.ts — Hono entry-point for the timeblock Worker.
 *
 *   POST /auth/login          → set session cookie (password gate)
 *   POST /auth/logout         → clear cookie
 *   GET  /api/me              → { authenticated }
 *   GET  /api/day?date=YYYY-MM-DD → { date, blocks }        (auth)
 *   PUT  /api/day             → { date, blocks } upsert     (auth)
 *   GET  *                    → serve static assets (public/) via ASSETS
 */
import { Hono } from 'hono'
import type { Env } from './auth'
import { login, logout, me, requireAuth } from './auth'
import { normalizeDay } from './validate'

const app = new Hono<{ Bindings: Env }>()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

app.post('/auth/login', login)
app.post('/auth/logout', logout)
app.get('/api/me', me)

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/me') return next()
  return requireAuth(c, next)
})

app.get('/api/day', async (c) => {
  const date = c.req.query('date') ?? ''
  if (!DATE_RE.test(date)) return c.json({ error: 'bad date' }, 400)
  const raw = await c.env.BLOCKS_KV.get(`day:${date}`)
  let parsed: unknown = []
  if (raw) { try { parsed = JSON.parse(raw) } catch { parsed = [] } }
  return c.json({ date, blocks: normalizeDay(parsed) })
})

app.put('/api/day', async (c) => {
  const body = await c.req.json<{ date?: string; blocks?: unknown }>().catch(() => ({}) as { date?: string; blocks?: unknown })
  const date = body.date ?? ''
  if (!DATE_RE.test(date)) return c.json({ error: 'bad date' }, 400)
  const blocks = normalizeDay(body.blocks)
  await c.env.BLOCKS_KV.put(`day:${date}`, JSON.stringify(blocks))
  return c.json({ ok: true, blocks })
})

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
