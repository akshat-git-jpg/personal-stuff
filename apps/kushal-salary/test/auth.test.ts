import { describe, expect, it } from 'vitest'
import app from '../src/worker/index'

const ENV = {
  APP_PASSWORD: '1234',
  SESSION_SECRET: 'x'.repeat(40),
  INGEST_TOKEN: 'tok',
  DB: {} as unknown as D1Database,
  SLIPS: {} as unknown as R2Bucket,
  ASSETS: {} as unknown as Fetcher,
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }, ENV)

describe('auth gates', () => {
  it('salary data needs a cookie or the bearer', async () => {
    expect((await app.request('/api/salary', {}, ENV)).status).toBe(401)
  })
  it('month ingest without a bearer is rejected', async () => {
    expect((await post('/api/months', {})).status).toBe(401)
  })
  it('note ingest with a wrong bearer is rejected', async () => {
    expect((await post('/api/notes', {}, { Authorization: 'Bearer wrong' })).status).toBe(401)
  })
  it('payslip PDF download is cookie-only, the bearer is not enough', async () => {
    const res = await app.request('/api/months/2025-05/pdf', { headers: { Authorization: 'Bearer tok' } }, ENV)
    expect(res.status).toBe(401)
  })
  it('letter PDF download is cookie-only too', async () => {
    const res = await app.request('/api/notes/x/pdf', { headers: { Authorization: 'Bearer tok' } }, ENV)
    expect(res.status).toBe(401)
  })
  it('PDF upload without a bearer is rejected', async () => {
    const res = await app.request('/api/months/2025-05/pdf', { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: 'x' }, ENV)
    expect(res.status).toBe(401)
  })
  it('wrong PIN is rejected', async () => {
    expect((await post('/api/login', { password: '0000' })).status).toBe(401)
  })
  it('right PIN sets the session cookie', async () => {
    const res = await post('/api/login', { password: '1234' })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie') ?? '').toContain('ksalary_auth=')
  })
  it('unknown api path is a 404', async () => {
    expect((await app.request('/api/nope', {}, ENV)).status).toBe(404)
  })
})
