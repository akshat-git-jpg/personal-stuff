import type { Graph } from '../shared/types'

export class Unauthorized extends Error {}

export async function getGraph(): Promise<Graph> {
  const res = await fetch('/api/graph', { credentials: 'same-origin' })
  if (res.status === 401) throw new Unauthorized('unauthorized')
  if (!res.ok) throw new Error(`load failed (${res.status})`)
  return res.json()
}

export async function login(password: string): Promise<void> {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (res.status === 401) throw new Error('Wrong PIN')
  if (!res.ok) throw new Error('Login failed')
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST' })
}
