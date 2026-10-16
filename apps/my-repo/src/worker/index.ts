/**
 * Hono entry-point for the my-repo Worker.
 * The graph is built by scripts/scan.mjs at deploy time and bundled here, so it is only ever
 * served behind the PIN cookie. /api/version is public: the maintainer drift check reads it.
 */
import { Hono } from 'hono'
import graph from '../../data/graph.json'
import type { Env } from './auth'
import { checkPassword, clearAuthCookie, makeToken, requireAuth, setAuthCookie } from './auth'

const app = new Hono<{ Bindings: Env }>()

app.post('/api/login', async (c) => {
  let body: { password?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'bad request' }, 400)
  }
  if (!(await checkPassword(c.env, body.password))) return c.json({ error: 'invalid PIN' }, 401)
  setAuthCookie(c, await makeToken(c.env))
  return c.json({ ok: true })
})

app.post('/api/logout', (c) => {
  clearAuthCookie(c)
  return c.json({ ok: true })
})

app.get('/api/version', (c) => c.json({ sha: graph.meta.sha, scannedAt: graph.meta.scannedAt }))

app.get('/api/graph', requireAuth, (c) => {
  c.header('Cache-Control', 'private, no-store')
  return c.json(graph)
})

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
