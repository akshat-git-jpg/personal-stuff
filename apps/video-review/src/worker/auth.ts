// Owner PIN gate with a stateless signed cookie (same scheme as kushal-salary). Freelancers use the project token instead.
import type { Context, Next } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

export type Env = {
  ASSETS: Fetcher
  DB: D1Database
  VIDEOS: R2Bucket
  APP_PASSWORD: string
  SESSION_SECRET: string
  PART_MB?: string
}

const COOKIE = 'vreview_auth'
const SESSION_TTL = 60 * 60 * 24 * 30

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message))))
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const now = () => Math.floor(Date.now() / 1000)

export function checkPassword(env: Env, password: unknown): boolean {
  return typeof password === 'string' && !!env.APP_PASSWORD && safeEqual(password, env.APP_PASSWORD)
}

export async function makeToken(env: Env): Promise<string> {
  const exp = String(now() + SESSION_TTL)
  return `${exp}.${await hmac(env.SESSION_SECRET, exp)}`
}

export async function isOwner(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const token = getCookie(c, COOKIE)
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = token.slice(0, dot)
  if (!(Number(exp) >= now())) return false
  return safeEqual(token.slice(dot + 1), await hmac(c.env.SESSION_SECRET, exp))
}

function cookie(c: Context<{ Bindings: Env }>, value: string, maxAge: number) {
  const secure = new URL(c.req.url).protocol === 'https:'
  setCookie(c, COOKIE, value, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge })
}

export const setAuthCookie = (c: Context<{ Bindings: Env }>, token: string) => cookie(c, token, SESSION_TTL)
export const clearAuthCookie = (c: Context<{ Bindings: Env }>) => cookie(c, '', 0)

export async function requireOwner(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  if (!(await isOwner(c))) return c.json({ error: 'unauthorized' }, 401)
  await next()
}

/** Random URL-safe id; 22 chars gives ~131 bits for project links. */
export function randomId(len = 22): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (const b of bytes) out += alphabet[b % 62]
  return out
}
