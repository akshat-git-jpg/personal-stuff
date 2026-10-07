import { describe, expect, it } from 'vitest'
import app from '../src/worker/index'
import { MUTE_KEY } from '../src/worker/ringer'

function fakeKV() {
  const m = new Map<string, string>()
  return {
    store: m,
    get: async (k: string, _opts?: unknown) => m.get(k) ?? null,
    put: async (k: string, v: string) => { m.set(k, v) },
    delete: async (k: string) => { m.delete(k) },
  }
}

async function cookieFor(env: Record<string, unknown>): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'pw' }),
  }, env)
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

function makeEnv() {
  const settings = fakeKV()
  const env = {
    APP_PASSWORD: 'pw', SESSION_SECRET: 's3cret', RINGER_TOKEN: 'ring-token',
    SETTINGS_KV: settings, CACHE_KV: fakeKV(),
  }
  return { env, settings }
}

describe('ringer mute switch', () => {
  it('starts unmuted, mutes, then unmutes', async () => {
    const { env, settings } = makeEnv()
    const cookie = await cookieFor(env)
    const get = async () => (await app.request('/api/ringer', { headers: { Cookie: cookie } }, env)).json()
    const put = (muted: unknown) => app.request('/api/ringer', {
      method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted }),
    }, env)

    expect(await get()).toEqual({ muted: false })
    expect((await put(true)).status).toBe(200)
    expect(settings.store.get(MUTE_KEY)).toBe('1')
    expect(await get()).toEqual({ muted: true })
    await put(false)
    expect(settings.store.has(MUTE_KEY)).toBe(false)
    expect(await get()).toEqual({ muted: false })
  })

  it('rejects a non-boolean body', async () => {
    const { env } = makeEnv()
    const cookie = await cookieFor(env)
    const res = await app.request('/api/ringer', {
      method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: 'yes' }),
    }, env)
    expect(res.status).toBe(400)
  })

  it('needs the cookie for the board routes', async () => {
    const { env } = makeEnv()
    expect((await app.request('/api/ringer', {}, env)).status).toBe(401)
  })

  it('serves the state to routine-ringer only with the token', async () => {
    const { env, settings } = makeEnv()
    settings.store.set(MUTE_KEY, '1')
    const ok = await app.request('/ringer/state', { headers: { Authorization: 'Bearer ring-token' } }, env)
    expect(await ok.json()).toEqual({ muted: true })
    expect((await app.request('/ringer/state', { headers: { Authorization: 'Bearer nope' } }, env)).status).toBe(401)
    expect((await app.request('/ringer/state', {}, env)).status).toBe(401)
  })

  it('refuses everyone when RINGER_TOKEN is not set', async () => {
    const { env } = makeEnv()
    const res = await app.request('/ringer/state', { headers: { Authorization: 'Bearer ' } }, { ...env, RINGER_TOKEN: '' })
    expect(res.status).toBe(401)
  })
})
