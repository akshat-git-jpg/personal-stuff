import { describe, it, expect } from 'vitest'
import app from '../src/worker/index'

function memKV() {
  const m = new Map<string, string>()
  return {
    get: async (k: string) => (m.has(k) ? m.get(k)! : null),
    put: async (k: string, v: string) => { m.set(k, v) },
    delete: async (k: string) => { m.delete(k) },
  } as unknown as KVNamespace
}
function env() {
  return {
    APP_PASSWORD: 'testpw',
    SESSION_SECRET: 'super-secret-session-key-1234567890',
    BLOCKS_KV: memKV(),
    ASSETS: {} as unknown as Fetcher,
  }
}
async function loginCookie(ENV: ReturnType<typeof env>): Promise<string> {
  const res = await app.request('/auth/login',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'testpw' }) }, ENV)
  const setc = res.headers.get('set-cookie') || ''
  const m = setc.match(/tb_session=([^;]+)/)
  return m ? m[1] : ''
}

describe('timeblock API', () => {
  it('rejects wrong password', async () => {
    const res = await app.request('/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'nope' }) }, env())
    expect(res.status).toBe(401)
  })
  it('accepts correct password and sets tb_session cookie', async () => {
    const ENV = env()
    const res = await app.request('/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'testpw' }) }, ENV)
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie') || '').toContain('tb_session=')
  })
  it('blocks /api/day without a cookie', async () => {
    const res = await app.request('/api/day?date=2026-07-09', { method: 'GET' }, env())
    expect(res.status).toBe(401)
  })
  it('round-trips a day: PUT then GET returns normalized blocks', async () => {
    const ENV = env()
    const token = await loginCookie(ENV)
    const put = await app.request('/api/day',
      { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `tb_session=${token}` },
        body: JSON.stringify({ date: '2026-07-09', blocks: [{ start: 4, end: 6, labelId: 'deep', title: 'Write report' }] }) }, ENV)
    expect(put.status).toBe(200)
    const get = await app.request('/api/day?date=2026-07-09', { headers: { Cookie: `tb_session=${token}` } }, ENV)
    expect(get.status).toBe(200)
    const j = await get.json() as { blocks: Array<{ start: number; end: number; labelId: string; title: string }> }
    expect(j.blocks).toEqual([{ id: 1, start: 4, end: 6, labelId: 'deep', title: 'Write report' }])
  })
  it('rejects a bad date', async () => {
    const ENV = env()
    const token = await loginCookie(ENV)
    const res = await app.request('/api/day?date=notadate', { headers: { Cookie: `tb_session=${token}` } }, ENV)
    expect(res.status).toBe(400)
  })
})
