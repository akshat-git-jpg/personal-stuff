/**
 * auth.ts
 * Single-password gate with a stateless, signed session cookie.
 * No KV/DB lookup: the cookie is `${exp}.${HMAC-SHA256(exp)}`, signed with
 * SESSION_SECRET. (House pattern, ported from apps/timeblock — decisions.md
 * 2026-07-01.)
 *
 * Every /api/* route sits behind requireAuth. Before this existed the whole
 * API — including the POST/PUT/DELETE writes — was reachable by anyone on the
 * internet; the only gate was client-side, which is not a gate.
 */
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "./google";

const COOKIE_NAME = "gym_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${await hmac(secret, exp)}`;
}

async function verifyToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!secret || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

function isSecure(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export async function login(c: Context<{ Bindings: Env }>): Promise<Response> {
  const body = await c.req
    .json<{ password?: string }>()
    .catch(() => ({}) as { password?: string });
  const password = body.password ?? "";
  const expected = c.env.APP_PASSWORD ?? "";
  const secret = c.env.SESSION_SECRET ?? "";
  if (!expected || !secret) return c.json({ error: "Server not configured" }, 500);
  // Compare HMACs, not raw strings: equal-length digests keep safeEqual
  // constant-time even when the two passwords differ in length.
  const ok = safeEqual(await hmac(secret, password), await hmac(secret, expected));
  if (!ok) return c.json({ error: "Wrong password" }, 401);
  setCookie(c, COOKIE_NAME, await makeToken(secret), {
    httpOnly: true,
    secure: isSecure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return c.json({ ok: true });
}

export function logout(c: Context<{ Bindings: Env }>): Response {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
}

export async function me(c: Context<{ Bindings: Env }>): Promise<Response> {
  const token = getCookie(c, COOKIE_NAME);
  return c.json({ authenticated: await verifyToken(c.env.SESSION_SECRET ?? "", token) });
}

export async function requireAuth(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  const token = getCookie(c, COOKIE_NAME);
  if (!(await verifyToken(c.env.SESSION_SECRET ?? "", token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}
