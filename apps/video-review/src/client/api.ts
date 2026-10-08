import type { HomeView, Note, Project, ProjectView } from '../shared/types'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new HttpError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const P = (token: string) => `/api/p/${encodeURIComponent(token)}`

export const api = {
  me: () => call<{ owner: boolean }>('/api/me'),
  login: (password: string) => call('/api/login', json('POST', { password })),
  logout: () => call('/api/logout', { method: 'POST' }),
  home: () => call<HomeView>('/api/projects'),
  createProject: (title: string) => call<Project>('/api/projects', json('POST', { title })),
  project: (token: string) => call<ProjectView>(P(token)),
  deleteProject: (token: string) => call(P(token), { method: 'DELETE' }),
  startUpload: (token: string, facts: Record<string, unknown>) =>
    call<{ version_id: string; part_size: number }>(`${P(token)}/uploads`, json('POST', facts)),
  uploadStatus: (token: string, vid: string) =>
    call<{ size: number; part_size: number; parts: number[] }>(`${P(token)}/uploads/${vid}`),
  putPart: (token: string, vid: string, n: number, blob: Blob, signal?: AbortSignal) =>
    call(`${P(token)}/uploads/${vid}/parts/${n}`, { method: 'PUT', body: blob, signal }),
  completeUpload: (token: string, vid: string) => call(`${P(token)}/uploads/${vid}/complete`, { method: 'POST' }),
  cancelUpload: (token: string, vid: string) => call(`${P(token)}/uploads/${vid}`, { method: 'DELETE' }),
  videoUrl: (token: string, vid: string) => `${P(token)}/versions/${vid}/video`,
  addNote: (token: string, vid: string, n: Pick<Note, 't' | 'x' | 'y' | 'text'>) =>
    call<Note>(`${P(token)}/versions/${vid}/notes`, json('POST', n)),
  updateNote: (token: string, n: Pick<Note, 'id' | 't' | 'x' | 'y' | 'text'>) => call(`${P(token)}/notes/${n.id}`, json('PUT', n)),
  deleteNote: (token: string, id: string) => call(`${P(token)}/notes/${id}`, { method: 'DELETE' }),
  markFinal: (token: string, version_id: string) => call(`${P(token)}/final`, json('POST', { version_id })),
}
