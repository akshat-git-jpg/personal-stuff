/**
 * auth.ts
 * A shared-password gate with a stateless, signed cookie (no KV needed).
 * Copied from the yt-analytics app — same self-validating cookie scheme.
 *
 * The cookie value is `<expiry>.<hmac>` where hmac = HMAC-SHA256(SESSION_SECRET,
 * "<expiry>"). It is self-validating: no server-side session store. Rotating
 * SESSION_SECRET invalidates every outstanding cookie.
 */

import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";

export type Env = {
  APP_PASSWORD: string;
  SESSION_SECRET: string;
};

const COOKIE = "kt_auth";
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days, in seconds

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64url(new Uint8Array(sig));
}

/** Constant-time string compare (equal length only — length is not secret here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function checkPassword(env: Env, password: unknown): boolean {
  if (typeof password !== "string" || !env.APP_PASSWORD) return false;
  return safeEqual(password, env.APP_PASSWORD);
}

export async function makeToken(env: Env): Promise<string> {
  const exp = String(nowSeconds() + SESSION_TTL);
  const sig = await hmac(env.SESSION_SECRET, exp);
  return `${exp}.${sig}`;
}

export async function verifyToken(env: Env, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < nowSeconds()) return false;
  const expected = await hmac(env.SESSION_SECRET, exp);
  return safeEqual(sig, expected);
}

export function setAuthCookie(c: Context<{ Bindings: Env }>, token: string): void {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export function clearAuthCookie(c: Context<{ Bindings: Env }>): void {
  setCookie(c, COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });
}

export function getAuthCookie(c: Context<{ Bindings: Env }>): string | undefined {
  return getCookie(c, COOKIE);
}

export async function requireAuth(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<Response | void> {
  if (!(await verifyToken(c.env, getAuthCookie(c)))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
}
