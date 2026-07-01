/**
 * api.ts — typed fetch wrappers around the Worker endpoints.
 * Throws on non-2xx so callers can surface a message; 401 is surfaced as
 * `Unauthorized` so the app can bounce back to the login screen.
 */

import type { AppState, Category, Item } from './types'

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

  createCategory: (name: string) =>
    req<Category>('/api/categories', { method: 'POST', body: JSON.stringify({ name }) }),

  renameCategory: (id: string, name: string) =>
    req<{ ok: true }>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteCategory: (id: string) => req<{ ok: true }>(`/api/categories/${id}`, { method: 'DELETE' }),

  createItem: (categoryId: string, text: string) =>
    req<Item>('/api/items', { method: 'POST', body: JSON.stringify({ category_id: categoryId, text }) }),

  updateItem: (id: string, text: string) =>
    req<{ ok: true }>(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) }),

  deleteItem: (id: string) => req<{ ok: true }>(`/api/items/${id}`, { method: 'DELETE' }),

  reorderCategories: (orderedIds: string[]) =>
    req<{ ok: true }>('/api/reorder', {
      method: 'POST',
      body: JSON.stringify({ type: 'category', orderedIds }),
    }),

  reorderItems: (categoryId: string, orderedIds: string[]) =>
    req<{ ok: true }>('/api/reorder', {
      method: 'POST',
      body: JSON.stringify({ type: 'item', categoryId, orderedIds }),
    }),
}
