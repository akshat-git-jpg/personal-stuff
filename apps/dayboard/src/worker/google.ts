/**
 * google.ts — read-only Google Calendar access, over plain fetch.
 *
 * No googleapis client: a Worker only needs three HTTP calls, and the library pulls
 * in a Node-shaped dependency tree for nothing. The refresh token is the same one
 * routine-ringer and the daily-digest already use (tooling/mcp/google-shared), so
 * this app adds no new Google Cloud setup — and no new thing that can be revoked
 * separately.
 *
 * Dayboard NEVER writes. The token carries a read/write calendar scope because it
 * is shared, but every call here is a GET.
 */

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com/calendar/v3'

/** Google access tokens live 3600s; refresh at 50 min so a request never races expiry. */
const TOKEN_TTL_SEC = 50 * 60

/**
 * The cache key carries a fingerprint of the credentials that minted the token.
 * Without it, swapping GOOGLE_REFRESH_TOKEN to a different account keeps serving
 * the OLD account's calendar for up to 50 minutes — which looks exactly like the
 * new token being wrong, and is how an hour gets lost.
 */
async function tokenCacheKey(creds: GoogleCreds): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${creds.clientId}\u0000${creds.refreshToken}`),
  )
  const hex = [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `gcal:access-token:${hex}`
}

export class GoogleAuthError extends Error {}

export type GoogleCreds = {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export type GoogleCalendar = {
  id: string
  summary: string
  backgroundColor: string
  selected: boolean
  primary: boolean
}

export type GoogleEvent = {
  id: string
  summary?: string
  description?: string
  htmlLink?: string
  status?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

/**
 * A cached access token, minted from the refresh token when stale.
 * The cache is a nicety, not correctness: a cold KV just costs one extra round trip.
 */
export async function getAccessToken(kv: KVNamespace, creds: GoogleCreds): Promise<string> {
  const cacheKey = await tokenCacheKey(creds)
  const cached = await kv.get(cacheKey)
  if (cached) return cached

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    // invalid_grant means the refresh token itself is dead — a human must re-mint it.
    const body = await res.text()
    throw new GoogleAuthError(`token refresh failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new GoogleAuthError('token refresh returned no access_token')

  await kv.put(cacheKey, json.access_token, { expirationTtl: TOKEN_TTL_SEC })
  return json.access_token
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError(`calendar API refused (${res.status})`)
  }
  if (!res.ok) throw new Error(`calendar API ${res.status} for ${new URL(url).pathname}`)
  return (await res.json()) as T
}

/**
 * The calendars this board draws, and nothing else.
 *
 * The account carries 13 calendars, 11 of which hold a second "plan" copy of the same
 * day at DIFFERENT times — two Gyms, two Lunches, two Dinners. The owner keeps those
 * unticked in Google and has said the selection is fixed, so this is a hard filter
 * rather than a preference: it also cuts a day fetch from 13 API calls to 2.
 *
 * To show another calendar, add a test to this predicate.
 */
export function isBoardCalendar(c: GoogleCalendar): boolean {
  return c.primary || c.id.endsWith('#holiday@group.v.calendar.google.com')
}

/** Every calendar on the account, with the colour Google already shows for it. */
export async function listCalendars(token: string): Promise<GoogleCalendar[]> {
  const url = `${CAL_API}/users/me/calendarList?minAccessRole=reader&maxResults=250&fields=items(id,summary,backgroundColor,selected,primary)`
  const json = await getJson<{ items?: Partial<GoogleCalendar>[] }>(url, token)
  return (json.items ?? []).map((c) => ({
    id: c.id ?? '',
    summary: c.summary ?? 'Untitled',
    backgroundColor: c.backgroundColor ?? '#7b8394',
    // Google OMITS a false `selected` from a partial (fields=) response, so
    // `!== false` read every unticked calendar as ticked. Must be an explicit true.
    selected: c.selected === true,
    primary: c.primary === true,
  })).filter((c) => c.id !== '')
}

/**
 * One calendar's events in a window. `singleEvents` expands recurring series, which
 * is what makes "every weekday 6:30 Gym" show up on a Monday at all.
 */
export async function listEvents(
  token: string,
  calendarId: string,
  timeMinISO: string,
  timeMaxISO: string,
): Promise<GoogleEvent[]> {
  const url =
    `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events` +
    `?singleEvents=true&orderBy=startTime&maxResults=250` +
    `&timeMin=${encodeURIComponent(timeMinISO)}&timeMax=${encodeURIComponent(timeMaxISO)}` +
    `&fields=items(id,summary,description,htmlLink,status,start,end)`
  const json = await getJson<{ items?: GoogleEvent[] }>(url, token)
  return (json.items ?? []).filter((e) => e.status !== 'cancelled')
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
}

/**
 * Google descriptions are an HTML fragment (the web UI has a rich-text editor).
 * The board renders description text INLINE, so it must arrive as plain text —
 * both to read well at 11px and so nothing a calendar invite carries can inject
 * markup into the page.
 */
export function sanitizeDescription(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)))
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n')
    .trim()
}
