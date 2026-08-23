// Serves exactly the local server's API contract (server/local.mjs), prefixed
// with the secret token instead of a client-supplied ?key=. See plan 234 step 4.

import type { Env } from './index'
import type { Beat } from '../types'
import { resolveVideoKey, isAdminAuthorized } from './auth'
import * as db from './db'

const NUM_RE = /^[0-9A-Za-z][0-9A-Za-z.]{0,15}$/

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const notFound = () => json(404, { error: 'not found' })

export async function handleApiRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url
  const { method } = request

  if (pathname === '/api/admin/publish' && method === 'POST') {
    if (!isAdminAuthorized(request, env)) return notFound()
    return handlePublish(request, env)
  }
  if (pathname === '/api/admin/pull' && method === 'GET') {
    if (!isAdminAuthorized(request, env)) return notFound()
    return handlePull(url, env)
  }

  const tokenMatch = pathname.match(/^\/api\/d\/([^/]+)((?:\/.*)?)$/)
  if (!tokenMatch) return notFound()
  const key = await resolveVideoKey(env.DESK_DB, tokenMatch[1])
  if (!key) return notFound()
  const rest = tokenMatch[2]

  if (rest === '/video' && method === 'GET') return handleGetVideo(env, key)

  const beatMatch = rest.match(/^\/beat\/([^/]+)$/)
  if (beatMatch && method === 'PUT') return handlePutBeat(request, env, key, decodeURIComponent(beatMatch[1]))

  const sayMatch = rest.match(/^\/beat\/([^/]+)\/say$/)
  if (sayMatch && method === 'PUT') return handlePutSay(request, env, key, decodeURIComponent(sayMatch[1]))

  const restoreMatch = rest.match(/^\/beat\/([^/]+)\/restore$/)
  if (restoreMatch && method === 'POST') return handleRestore(env, key, decodeURIComponent(restoreMatch[1]))

  if (rest === '/finish' && method === 'POST') return handleFinish(env, key)

  return notFound()
}

function findBeat(beatsJson: string, num: string): Beat | undefined {
  const beats: Beat[] = JSON.parse(beatsJson)
  return beats.find((b) => b.num === num)
}

async function handleGetVideo(env: Env, key: string): Promise<Response> {
  const doc = await db.buildVideoDoc(env.DESK_DB, key)
  if (!doc) return notFound()
  return json(200, doc)
}

async function handlePutBeat(request: Request, env: Env, key: string, num: string): Promise<Response> {
  const row = await db.getVideoRow(env.DESK_DB, key)
  if (!row) return notFound()
  if (!NUM_RE.test(num) || !findBeat(row.beats_json, num)) return json(400, { error: 'invalid beat' })
  if (row.finished) return json(409, { error: 'finished' })
  const body = await request.json().catch(() => ({}))
  const text = typeof (body as { text?: unknown }).text === 'string' ? (body as { text: string }).text : ''
  await db.putAnswer(env.DESK_DB, key, num, text, new Date().toISOString())
  return json(200, { ok: true, savedAt: new Date().toISOString() })
}

async function handlePutSay(request: Request, env: Env, key: string, num: string): Promise<Response> {
  const row = await db.getVideoRow(env.DESK_DB, key)
  if (!row) return notFound()
  const beat = findBeat(row.beats_json, num)
  if (!NUM_RE.test(num) || !beat) return json(400, { error: 'invalid beat' })
  if (row.finished) return json(409, { error: 'finished' })
  const body = await request.json().catch(() => ({}))
  const lines = Array.isArray((body as { lines?: unknown }).lines) ? (body as { lines: string[] }).lines : []
  const originalLines = beat.say ?? []
  await db.putSayEdit(env.DESK_DB, key, num, originalLines, lines, new Date().toISOString())
  return json(200, { ok: true, savedAt: new Date().toISOString() })
}

async function handleRestore(env: Env, key: string, num: string): Promise<Response> {
  const row = await db.getVideoRow(env.DESK_DB, key)
  if (!row) return notFound()
  if (!NUM_RE.test(num) || !findBeat(row.beats_json, num)) return json(400, { error: 'invalid beat' })
  await db.restoreSayEdit(env.DESK_DB, key, num)
  const beat = findBeat(row.beats_json, num)
  return json(200, { lines: beat?.say ?? [] })
}

async function handleFinish(env: Env, key: string): Promise<Response> {
  await db.setFinished(env.DESK_DB, key, true)
  return json(200, { ok: true })
}

async function handlePublish(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { key?: unknown; title?: unknown; beats?: unknown } | null
  if (!body || typeof body.key !== 'string' || typeof body.title !== 'string' || !Array.isArray(body.beats)) {
    return json(400, { error: 'invalid body' })
  }
  const { token } = await db.upsertVideo(env.DESK_DB, {
    key: body.key,
    title: body.title,
    beatsJson: JSON.stringify(body.beats),
    publishedAt: new Date().toISOString(),
  })
  const origin = new URL(request.url).origin
  return json(200, { token, url: `${origin}/d/${token}` })
}

async function handlePull(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get('key')
  if (!key) return json(400, { error: 'missing key' })
  const doc = await db.buildVideoDoc(env.DESK_DB, key)
  if (!doc) return notFound()
  return json(200, { key: doc.key, title: doc.title, draft: doc.draft, says: doc.says, edits: doc.edits, finished: doc.finished })
}
