/**
 * ringer.ts — the one owner setting dayboard stores: is routine-ringer muted?
 *
 *   GET /api/ringer      (cookie)        → { muted }
 *   PUT /api/ringer      (cookie)        → body { muted: boolean }
 *   GET /ringer/state    (Bearer token)  → { muted }  read by routine-ringer on the VPS
 *
 * Lives in SETTINGS_KV, never CACHE_KV: CACHE_KV is safe to purge, and a purge must
 * not silently unmute the phone.
 */
import type { Context } from 'hono'
import type { Env } from './auth'

export const MUTE_KEY = 'ringer:muted'

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function isMuted(kv: KVNamespace): Promise<boolean> {
  // KV's minimum edge cache; a toggle still takes up to ~30-60 s to reach routine-ringer.
  return (await kv.get(MUTE_KEY, { cacheTtl: 30 })) === '1'
}

export async function getRinger(c: Context<{ Bindings: Env }>): Promise<Response> {
  return c.json({ muted: await isMuted(c.env.SETTINGS_KV) })
}

export async function putRinger(c: Context<{ Bindings: Env }>): Promise<Response> {
  const body = await c.req.json<{ muted?: unknown }>().catch(() => ({}) as { muted?: unknown })
  if (typeof body.muted !== 'boolean') return c.json({ error: 'muted must be a boolean' }, 400)
  if (body.muted) await c.env.SETTINGS_KV.put(MUTE_KEY, '1')
  else await c.env.SETTINGS_KV.delete(MUTE_KEY)
  return c.json({ muted: body.muted })
}

export async function ringerState(c: Context<{ Bindings: Env }>): Promise<Response> {
  const expected = c.env.RINGER_TOKEN ?? ''
  const got = (c.req.header('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || !safeEqual(got, expected)) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ muted: await isMuted(c.env.SETTINGS_KV) })
}
