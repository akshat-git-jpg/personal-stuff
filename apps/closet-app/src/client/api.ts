/**
 * api.ts — typed fetch wrappers around the Worker endpoints.
 * Throws on non-2xx so callers can surface a message; 401 is surfaced as
 * `Unauthorized` so the app can bounce back to the login screen.
 */

import type { AppState, Cloth, Look } from './types'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return (await res.json().catch(() => ({}))) as T
}

export const api = {
  me: () => req<{ authenticated: boolean }>('/api/me'),
  login: (password: string) =>
    req<{ ok: true }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),
  state: () => req<AppState>('/api/state'),

  /** Upload raw JPEG bytes. `req` must NOT set a JSON content-type here. */
  uploadPhoto: async (blob: Blob): Promise<{ key: string }> => {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    })
    if (res.status === 401) throw new Error('Unauthorized')
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error || `Upload failed (${res.status})`)
    }
    return (await res.json()) as { key: string }
  },

  // `photo_keys` is always the item's WHOLE ordered photo set, cover first —
  // adding, removing, reordering and changing the cover are all this one field.
  createCloth: (body: { name: string; tags: string[]; photo_keys: string[] }) =>
    req<Cloth>('/api/clothes', { method: 'POST', body: JSON.stringify(body) }),
  updateCloth: (id: string, body: { name?: string; tags?: string[]; photo_keys?: string[] }) =>
    req<Cloth>(`/api/clothes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCloth: (id: string) => req<{ ok: true }>(`/api/clothes/${id}`, { method: 'DELETE' }),

  wear: (id: string) => req<{ cloth: Cloth; event_id: string }>(`/api/clothes/${id}/wear`, { method: 'POST' }),
  wash: (id: string) => req<{ cloth: Cloth; event_id: string }>(`/api/clothes/${id}/wash`, { method: 'POST' }),
  undo: (eventId: string) => req<{ cloth: Cloth }>(`/api/events/${eventId}/undo`, { method: 'POST' }),

  createLook: (body: { name: string | null; tags: string[]; photo_keys: string[] }) =>
    req<Look>('/api/looks', { method: 'POST', body: JSON.stringify(body) }),
  updateLook: (id: string, body: { name?: string | null; tags?: string[]; photo_keys?: string[] }) =>
    req<Look>(`/api/looks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteLook: (id: string) => req<{ ok: true }>(`/api/looks/${id}`, { method: 'DELETE' }),
}
