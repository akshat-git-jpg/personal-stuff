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

// In hosted mode the secret token in the path IS the video identity — there is
// no ?key= and there must not be one. App.tsx has to know that, or it bails on
// an empty key and renders "no ?key= in the URL" for every freelancer link,
// which is exactly what shipped on 2026-08-23.
export const isHosted = hostedToken !== null

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

// A beat field added after a video was published is ABSENT from that video's
// stored snapshot, and the UI must not crash on it. Hosted mode serves
// `beats_json` written into D1 at publish time, and local mode is served by a
// long-running node process that imported the parser at startup — so a freshly
// added field is missing in both until a republish or a restart.
//
// Seen live 2026-08-27: `demo` was added, the Vite frontend hot-reloaded, the
// API process did not, and `beat.demo.length` on undefined blanked the whole
// page. Every freelancer holding an older link would have hit the same thing.
// Normalising here, at the one place a document enters the app, is what keeps
// that from being a crash.
function normalizeDoc(doc: VideoDoc): VideoDoc {
  return {
    ...doc,
    beats: (doc.beats ?? []).map((b) => ({
      ...b,
      demo: b.demo ?? [],
      show: b.show ?? [],
      edit: b.edit ?? [],
      facts: b.facts ?? [],
      rules: b.rules ?? [],
    })),
  }
}

export const getVideo = (key: string) =>
  j<VideoDoc>(`${base}/video${keyQuery(key)}`).then(normalizeDoc)

export const putDraft = (key: string, num: string, text: string) =>
  j(`${base}/beat/${num}${keyQuery(key)}`, 'PUT', { text })

export const putSay = (key: string, num: string, lines: string[]) =>
  j(`${base}/beat/${num}/say${keyQuery(key)}`, 'PUT', { lines })

export const restoreSay = (key: string, num: string) =>
  j<{ lines: string[] }>(`${base}/beat/${num}/restore${keyQuery(key)}`, 'POST')

export const postFinish = (key: string) => j(`${base}/finish${keyQuery(key)}`, 'POST')
