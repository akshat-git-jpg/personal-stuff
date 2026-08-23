import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { handleApiRequest } from '../routes'
import type { Env } from '../index'
import { createD1Stub } from '../../../test/d1-stub.mjs'
import { makeReadBeat } from '../../test/fixtures'
import type { VideoDoc } from '../../types'

const ADMIN_TOKEN = 'admin-secret-123'

function makeEnv(): Env {
  return {
    DESK_DB: createD1Stub() as unknown as D1Database,
    ASSETS: { fetch: async () => new Response('', { status: 404 }) } as unknown as Fetcher,
    DESK_ADMIN_TOKEN: ADMIN_TOKEN,
  }
}

async function call(env: Env, method: string, path: string, body?: unknown): Promise<Response> {
  const url = new URL(`https://x${path}`)
  const request = new Request(url, {
    method,
    headers: { 'x-desk-admin': ADMIN_TOKEN, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return handleApiRequest(request, env, url)
}

async function publish(env: Env, beats: unknown[], title = 'Video One'): Promise<string> {
  const res = await call(env, 'POST', '/api/admin/publish', { key: 'v1', title, beats })
  const { token } = (await res.json()) as { token: string }
  return token
}

describe('GET /api/d/:token/video', () => {
  it('composes a VideoDoc with the same keys as types.ts VideoDoc exactly', async () => {
    const env = makeEnv()
    const token = await publish(env, [makeReadBeat({ num: '1' })])
    const res = await call(env, 'GET', `/api/d/${token}/video`)
    expect(res.status).toBe(200)
    const doc = (await res.json()) as VideoDoc
    const expectedKeys: (keyof VideoDoc)[] = ['key', 'title', 'beats', 'draft', 'edits', 'says', 'finished']
    expect(Object.keys(doc).sort()).toEqual(expectedKeys.slice().sort())
  })
})

describe('an unknown token', () => {
  it('is a flat 404 with {"error":"not found"} — not 401, not distinguished from an unpublished key', async () => {
    const env = makeEnv()
    const res = await call(env, 'GET', `/api/d/${'Z'.repeat(43)}/video`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
  })
})

describe('admin auth', () => {
  it('rejects a wrong x-desk-admin with 404', async () => {
    const env = makeEnv()
    const url = new URL('https://x/api/admin/pull?key=v1')
    const request = new Request(url, { headers: { 'x-desk-admin': 'nope' } })
    const res = await handleApiRequest(request, env, url)
    expect(res.status).toBe(404)
  })
})

describe('publish', () => {
  it('replaces the videos row and leaves answers rows intact', async () => {
    const env = makeEnv()
    const beat = makeReadBeat({ num: '1' })
    const token = await publish(env, [beat], 'Old title')
    await call(env, 'PUT', `/api/d/${token}/beat/1`, { text: "his answer" })

    const res2 = await call(env, 'POST', '/api/admin/publish', { key: 'v1', title: 'New title', beats: [beat] })
    expect(res2.status).toBe(200)

    const doc = (await (await call(env, 'GET', `/api/d/${token}/video`)).json()) as VideoDoc
    expect(doc.title).toBe('New title')
    expect(doc.draft['1']).toBe('his answer')
  })

  it('reuses the existing token on republish', async () => {
    const env = makeEnv()
    const beat = makeReadBeat({ num: '1' })
    const token1 = await publish(env, [beat], 'T1')
    const token2 = await publish(env, [beat], 'T2')
    expect(token2).toBe(token1)
  })
})

describe('PUT /api/d/:token/beat/:num/say', () => {
  it('stores the original on the first edit; a second edit leaves original_json unchanged', async () => {
    const env = makeEnv()
    const beat = makeReadBeat({ num: '1', say: ['original line one', 'original line two'] })
    const token = await publish(env, [beat])

    await call(env, 'PUT', `/api/d/${token}/beat/1/say`, { lines: ['edited once'] })
    await call(env, 'PUT', `/api/d/${token}/beat/1/say`, { lines: ['edited twice'] })

    const doc = (await (await call(env, 'GET', `/api/d/${token}/video`)).json()) as VideoDoc
    expect(doc.says['1']).toEqual(['edited twice'])
    expect(doc.edits['1'].original).toEqual(['original line one', 'original line two'])
  })
})

describe('POST /api/d/:token/beat/:num/restore', () => {
  it('deletes the say_edits row and returns the parsed original lines', async () => {
    const env = makeEnv()
    const beat = makeReadBeat({ num: '1', say: ['the real original'] })
    const token = await publish(env, [beat])
    await call(env, 'PUT', `/api/d/${token}/beat/1/say`, { lines: ['edited'] })

    const restoreRes = await call(env, 'POST', `/api/d/${token}/beat/1/restore`)
    expect(restoreRes.status).toBe(200)
    expect(await restoreRes.json()).toEqual({ lines: ['the real original'] })

    const doc = (await (await call(env, 'GET', `/api/d/${token}/video`)).json()) as VideoDoc
    expect(doc.says['1']).toBeUndefined()
    expect(doc.edits['1']).toBeUndefined()
  })
})

describe('PUT /api/d/:token/beat/:num', () => {
  it('returns 409 {error: finished} once the video is finished', async () => {
    const env = makeEnv()
    const beat = makeReadBeat({ num: '1' })
    const token = await publish(env, [beat])
    await call(env, 'POST', `/api/d/${token}/finish`)

    const res = await call(env, 'PUT', `/api/d/${token}/beat/1`, { text: 'too late' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'finished' })
  })

  it('returns 400 for an unknown beat num', async () => {
    const env = makeEnv()
    const token = await publish(env, [makeReadBeat({ num: '1' })])
    const res = await call(env, 'PUT', `/api/d/${token}/beat/999`, { text: 'x' })
    expect(res.status).toBe(400)
  })
})

describe('migration', () => {
  it('creates all three tables', async () => {
    const db = createD1Stub()
    // test_cmd always runs from apps/yt-script-desk (see plan 234 test_cmd).
    const migrationPath = join(process.cwd(), 'migrations', '0001_init.sql')
    await db.exec(readFileSync(migrationPath, 'utf8'))
    expect(db.tableNames().sort()).toEqual(['answers', 'say_edits', 'videos'])
  })
})
