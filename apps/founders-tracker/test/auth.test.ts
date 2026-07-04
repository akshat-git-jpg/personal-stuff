import { describe, it, expect } from 'vitest'
import { signSession, verifySession } from '../src/worker/auth'

const SECRET = 'test-secret-1234567890-1234567890'

describe('founders-tracker auth helpers', () => {
  it('signs and verifies session token successfully', async () => {
    const token = await signSession(SECRET)
    expect(token).toBeDefined()
    expect(token.startsWith('ok.')).toBe(true)

    const isValid = await verifySession(token, SECRET)
    expect(isValid).toBe(true)
  })

  it('rejects invalid or tampered session token', async () => {
    const token = await signSession(SECRET)
    const tampered = token + 'a'
    const isValid = await verifySession(tampered, SECRET)
    expect(isValid).toBe(false)
  })

  it('rejects verification if secret is different', async () => {
    const token = await signSession(SECRET)
    const isValid = await verifySession(token, SECRET + '-different')
    expect(isValid).toBe(false)
  })

  it('rejects undefined or empty tokens', async () => {
    expect(await verifySession(undefined, SECRET)).toBe(false)
    expect(await verifySession('', SECRET)).toBe(false)
  })
})
