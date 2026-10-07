/**
 * index.ts — Hono entry-point for the dayboard Worker.
 *
 *   POST /auth/login                → set session cookie (password gate)
 *   POST /auth/logout               → clear cookie
 *   GET  /api/me                    → { authenticated }
 *   GET  /api/day?date=YYYY-MM-DD   → one day's DayLayout (auth)
 *   GET|PUT /api/ringer             → phone-ring mute switch (auth)
 *   GET  /ringer/state              → mute switch for routine-ringer (Bearer RINGER_TOKEN)
 *   GET  *                          → serve static assets (public/) via ASSETS
 *
 * Dayboard is a WINDOW onto Google Calendar, never a store: nothing is written to Google.
 * The one write is the ringer mute switch, in SETTINGS_KV (see ringer.ts).
 */
import { Hono } from 'hono'
import type { Env } from './auth'
import { login, logout, me, requireAuth } from './auth'
import { DAY_CACHE_TTL_SEC, fetchDay, type DayResult } from './day'
import { GoogleAuthError } from './google'
import { getRinger, putRinger, ringerState } from './ringer'
import { todayIn } from './time'

const app = new Hono<{ Bindings: Env }>()

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

app.post('/auth/login', login)
app.post('/auth/logout', logout)
app.get('/api/me', me)
app.get('/ringer/state', ringerState)

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/me') return next()
  return requireAuth(c, next)
})

app.get('/api/day', async (c) => {
  const tz = c.env.TIMEZONE || 'Asia/Kolkata'
  const date = c.req.query('date') || todayIn(tz)
  if (!DATE_RE.test(date)) return c.json({ error: 'bad date' }, 400)

  const cacheKey = `day:${date}`
  if (c.req.query('fresh') !== '1') {
    const cached = await c.env.CACHE_KV.get(cacheKey)
    if (cached) {
      try {
        return c.json({ ...(JSON.parse(cached) as DayResult), cached: true })
      } catch {
        // fall through and refetch
      }
    }
  }

  try {
    const result = await fetchDay(
      c.env.CACHE_KV,
      {
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        refreshToken: c.env.GOOGLE_REFRESH_TOKEN,
      },
      date,
      tz,
    )
    await c.env.CACHE_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: DAY_CACHE_TTL_SEC })
    return c.json({ ...result, cached: false })
  } catch (err) {
    // A dead refresh token is the one failure a human has to fix, so it gets its
    // own code and the UI shows "reconnect Google" instead of a generic error.
    if (err instanceof GoogleAuthError) {
      return c.json({ error: 'google_auth', message: err.message }, 502)
    }
    return c.json({ error: 'upstream', message: err instanceof Error ? err.message : String(err) }, 502)
  }
})

app.get('/api/ringer', getRinger)
app.put('/api/ringer', putRinger)

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
