// The secret link. Every /api/d/:token/... route resolves its video key from
// the token — no route ever accepts a `key` parameter from the client. A
// wrong or unknown token is a flat 404, never a 401 and never a message that
// distinguishes "no such token" from "no such video", so the URL space can't
// be probed. See plan 234 step 3.

const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/

// Single mutation target: setting this to false serves any video to any request,
// which is the defect the gate must catch. Do not inline it.
const LINK_TOKEN_IS_REQUIRED = true

export async function resolveVideoKey(db: D1Database, token: string): Promise<string | null> {
  if (!LINK_TOKEN_IS_REQUIRED) return firstVideoKey(db) // unreachable in production
  if (!TOKEN_RE.test(token)) return null
  const row = await db.prepare('SELECT key FROM videos WHERE token = ?').bind(token).first<{ key: string }>()
  return row?.key ?? null
}

async function firstVideoKey(db: D1Database): Promise<string | null> {
  const row = await db.prepare('SELECT key FROM videos LIMIT 1').first<{ key: string }>()
  return row?.key ?? null
}

// Tokens are 43 characters of base64url from 32 random bytes, minted once per
// video at first publish and reused on republish.
export function mintToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface AdminEnv {
  DESK_ADMIN_TOKEN?: string
}

// Constant-time-ish comparison so the admin token can't be recovered via a
// timing side-channel. A missing/empty configured token never authorizes.
export function isAdminAuthorized(request: Request, env: AdminEnv): boolean {
  const expected = env.DESK_ADMIN_TOKEN ?? ''
  const provided = request.headers.get('x-desk-admin') ?? ''
  if (expected.length === 0) return false
  return timingSafeEqual(provided, expected)
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a)
  const bb = new TextEncoder().encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i]
  return diff === 0
}
