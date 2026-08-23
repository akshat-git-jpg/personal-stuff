import type { VideoDoc } from './types'

// This shape is the contract plan 234's Cloudflare Worker must also serve —
// do not change a call here without changing it there too.
const base = '/api'

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

export const getVideo = (key: string) => j<VideoDoc>(`${base}/video?key=${encodeURIComponent(key)}`)

export const putDraft = (key: string, num: string, text: string) =>
  j(`${base}/beat/${num}?key=${encodeURIComponent(key)}`, 'PUT', { text })

export const putSay = (key: string, num: string, lines: string[]) =>
  j(`${base}/beat/${num}/say?key=${encodeURIComponent(key)}`, 'PUT', { lines })

export const restoreSay = (key: string, num: string) =>
  j<{ lines: string[] }>(`${base}/beat/${num}/restore?key=${encodeURIComponent(key)}`, 'POST')

export const postFinish = (key: string) => j(`${base}/finish?key=${encodeURIComponent(key)}`, 'POST')
