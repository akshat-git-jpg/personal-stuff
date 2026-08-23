import { describe, it, expect } from 'vitest'
import { resolveVideoKey, isAdminAuthorized } from '../auth'
import { createD1Stub } from '../../../test/d1-stub.mjs'

const GOOD_TOKEN = 'A'.repeat(43)

function seededDb(): D1Database {
  const db = createD1Stub()
  db.seed('videos', [
    { key: 'v1', title: 'V1', beats_json: '[]', token: GOOD_TOKEN, finished: 0, published_at: '2026-01-01' },
  ])
  return db as unknown as D1Database
}

describe('resolveVideoKey', () => {
  it('resolves a valid token to its video key', async () => {
    const db = seededDb()
    expect(await resolveVideoKey(db, GOOD_TOKEN)).toBe('v1')
  })

  it('returns null for an unknown token, with the route flattening it to a plain 404', async () => {
    const db = seededDb()
    const unknownButWellFormed = 'B'.repeat(43)
    expect(await resolveVideoKey(db, unknownButWellFormed)).toBeNull()
    // The route layer (routes.test.ts) asserts the actual response is a flat
    // 404 {"error":"not found"} — never 401, never distinguished from an
    // unpublished key. This test pins the auth-layer half of that contract.
  })

  it('rejects a malformed token (too short, wrong charset) without touching the database', async () => {
    const poisoned = {
      prepare() {
        throw new Error('resolveVideoKey touched the database for a malformed token')
      },
    }
    expect(await resolveVideoKey(poisoned as never, 'short')).toBeNull()
    expect(await resolveVideoKey(poisoned as never, 'has spaces and is definitely long enough!!')).toBeNull()
  })

  // The mutation gate (plan 234): `perl -0pi -e 's/const LINK_TOKEN_IS_REQUIRED = true/.../false/'`
  // flips the flag this test exercises through the real function, not by
  // reading source text. On a clean tree this passes; under the mutation the
  // bogus token resolves to a real video and the assertion fails with
  // TOKEN_BYPASSED in its message.
  it('never lets a bogus token resolve to a video (TOKEN_BYPASSED if it does)', async () => {
    const db = seededDb()
    const key = await resolveVideoKey(db, 'this-token-was-never-minted-by-anyone-x')
    expect(key, 'TOKEN_BYPASSED').toBeNull()
  })
})

describe('isAdminAuthorized', () => {
  it('accepts the header when it matches DESK_ADMIN_TOKEN', () => {
    const request = new Request('https://x/api/admin/pull', { headers: { 'x-desk-admin': 'secret-123' } })
    expect(isAdminAuthorized(request, { DESK_ADMIN_TOKEN: 'secret-123' })).toBe(true)
  })

  it('rejects a wrong x-desk-admin header', () => {
    const request = new Request('https://x/api/admin/pull', { headers: { 'x-desk-admin': 'wrong' } })
    expect(isAdminAuthorized(request, { DESK_ADMIN_TOKEN: 'secret-123' })).toBe(false)
  })

  it('rejects a missing header', () => {
    const request = new Request('https://x/api/admin/pull')
    expect(isAdminAuthorized(request, { DESK_ADMIN_TOKEN: 'secret-123' })).toBe(false)
  })

  it('rejects when no admin token is configured at all', () => {
    const request = new Request('https://x/api/admin/pull', { headers: { 'x-desk-admin': '' } })
    expect(isAdminAuthorized(request, {})).toBe(false)
  })
})
