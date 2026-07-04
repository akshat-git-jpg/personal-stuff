import { describe, it, expect } from 'vitest'
import app from '../src/worker/index'

const ENV = {
  APP_PASSWORD: 'testpassword',
  SESSION_SECRET: 'super-secret-session-key-1234567890',
  DB: {} as unknown as D1Database, // Mock D1
  ASSETS: {} as unknown as Fetcher, // Mock assets
}

describe('lists-app auth flow', () => {
  it('rejects login with wrong password', async () => {
    const res = await app.request(
      '/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      },
      ENV
    )
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ error: 'Wrong password' })
  })

  it('accepts login with correct password and sets cookie, then verifies me endpoint', async () => {
    const res = await app.request(
      '/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'testpassword' }),
      },
      ENV
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true })
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toContain('lists_session=')

    const match = cookie ? cookie.match(/lists_session=([^;]+)/) : null
    const token = match ? match[1] : ''

    // Now test with verified cookie
    const res2 = await app.request(
      '/api/me',
      {
        method: 'GET',
        headers: { Cookie: `lists_session=${token}` },
      },
      ENV
    )
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2).toEqual({ authenticated: true })
  })

  it('rejects access to /api/state without cookie', async () => {
    const res = await app.request('/api/state', { method: 'GET' }, ENV)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('verifies me endpoint reports false if unauthenticated', async () => {
    const res = await app.request('/api/me', { method: 'GET' }, ENV)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ authenticated: false })
  })
})
