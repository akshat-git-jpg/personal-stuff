import type { VideoDoc } from './types'

// This shape is the contract plan 234's Cloudflare Worker must also serve —
// do not change a call here without changing it there too. The call shapes
// (function signatures, argument order) never change between the two modes;
// only how the URL is built does.
//
// Local mode (server/local.mjs): base is `/api`, and every route takes the
// video key as a `?key=` query param.
// Hosted mode (the Worker): the URL carries a secret token instead
// (`/d/<token>`), and every route resolves its own key from that token — the
// client never sends a key at all in this mode.
const HOSTED_PATH = /^\/d\/([^/]+)/
const hostedToken = HOSTED_PATH.exec(window.location.pathname)?.[1] ?? null
const base = hostedToken ? `/api/d/${hostedToken}` : '/api'
const keyQuery = (key: string) => (hostedToken ? '' : `?key=${encodeURIComponent(key)}`)

async function j<T = { ok: true }>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${method} ${url} -> ${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

export const getVideo = (key: string) => j<VideoDoc>(`${base}/video${keyQuery(key)}`)

export const putDraft = (key: string, num: string, text: string) =>
  j(`${base}/beat/${num}${keyQuery(key)}`, 'PUT', { text })

export const putSay = (key: string, num: string, lines: string[]) =>
  j(`${base}/beat/${num}/say${keyQuery(key)}`, 'PUT', { lines })

export const restoreSay = (key: string, num: string) =>
  j<{ lines: string[] }>(`${base}/beat/${num}/restore${keyQuery(key)}`, 'POST')

export const postFinish = (key: string) => j(`${base}/finish${keyQuery(key)}`, 'POST')
