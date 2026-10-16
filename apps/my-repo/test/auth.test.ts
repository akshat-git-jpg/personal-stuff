import { describe, expect, it } from 'vitest'
import app from '../src/worker/index'

const ENV = { APP_PASSWORD: '1234', SESSION_SECRET: 'x'.repeat(40), ASSETS: {} as unknown as Fetcher }
const post = (path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, ENV)

describe('auth gate', () => {
  it('the graph needs the PIN cookie', async () => {
    expect((await app.request('/api/graph', {}, ENV)).status).toBe(401)
  })
  it('version is public and carries no graph', async () => {
    const res = await app.request('/api/version', {}, ENV)
    expect(res.status).toBe(200)
    expect(Object.keys(await res.json()).sort()).toEqual(['scannedAt', 'sha'])
  })
  it('wrong PIN is rejected, right PIN opens the graph', async () => {
    expect((await post('/api/login', { password: '0000' })).status).toBe(401)
    const res = await post('/api/login', { password: '1234' })
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
    expect(cookie).toContain('myrepo_auth=')
    const graph = await app.request('/api/graph', { headers: { Cookie: cookie } }, ENV)
    expect(graph.status).toBe(200)
  })
})
