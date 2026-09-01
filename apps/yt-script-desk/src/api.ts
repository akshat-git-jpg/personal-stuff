import type { Approval, SourceDoc, VideoDoc } from './types'

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
type LegacyBeat = { show?: string[]; edit?: string[] }
const asLegacy = (b: unknown): LegacyBeat => b as LegacyBeat

function normalizeDoc(doc: VideoDoc): VideoDoc {
  return {
    ...doc,
    beats: (doc.beats ?? []).map((b) => ({
      ...b,
      demo: b.demo ?? [],
      ask: b.ask ?? [],
      // A snapshot published BEFORE the 2026-08-28 lane merge carries `show` and
      // `edit` instead of `video`. Fold them here, in the one place a document
      // enters the app, so an already-published desk link keeps rendering.
      video: b.video ?? [...(asLegacy(b).show ?? []), ...(asLegacy(b).edit ?? [])],
      // A snapshot published BEFORE the 2026-08-29 section-card change carries
      // no `notes` at all. The instruction column spreads it, so undefined here
      // is a crash on an already-published link, not a missing block.
      notes: b.notes ?? [],
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

// Staged instruction edits. Local mode only — the hosted Worker has no such
// route, and the freelancer must not be able to rewrite his own brief.
export const putNotes = (key: string, num: string, lines: string[]) =>
  j(`${base}/beat/${num}/notes${keyQuery(key)}`, 'PUT', { lines })

export const restoreNotes = (key: string, num: string) =>
  j<{ lines: string[] }>(`${base}/beat/${num}/notes/restore${keyQuery(key)}`, 'POST')

export const restoreSay = (key: string, num: string) =>
  j<{ lines: string[] }>(`${base}/beat/${num}/restore${keyQuery(key)}`, 'POST')

// Approval. LOCAL ONLY, like edit mode and staged notes: the hosted Worker has no such
// route, so a freelancer cannot sign off his own brief even by crafting the request.
export const approveScript = (key: string) =>
  j<{ approval: Approval }>(`${base}/approve${keyQuery(key)}`, 'POST')

export const unapproveScript = (key: string) =>
  j<{ approval: Approval }>(`${base}/approve${keyQuery(key)}`, 'DELETE')

export const postFinish = (key: string) => j(`${base}/finish${keyQuery(key)}`, 'POST')

// Edit mode. LOCAL ONLY, and deliberately so: the hosted Worker serves a frozen
// snapshot out of D1 and has no file to write. The freelancer READS the plan;
// the owner is the only one who edits it, on his own machine, against the real
// markdown. `isHosted` gates the button, and there is no hosted route to hit.
export const getSource = (key: string) => j<SourceDoc>(`${base}/source${keyQuery(key)}`)

export type SaveSourceResult = {
  ok: true
  stamp: string | null
  text: string
  edit: SourceDoc['edit']
  doc: VideoDoc
}

// The whole file goes back on every save. It is 37KB against a server on
// localhost, and it buys the thing that matters: one code path, one atomic
// write, and no partial-update protocol that could half-apply.
export const putSource = (key: string, text: string, stamp: string | null) =>
  j<SaveSourceResult>(`${base}/source${keyQuery(key)}`, 'PUT', { text, stamp })
