// Google "Sign in with Google" (OAuth 2.0 authorization-code flow) + a signed
// session cookie. The vault is gated to a single allow-listed email.
//
// Trust model: the ID token is fetched over TLS directly from Google's token
// endpoint, so per OIDC §3.1.3.7 we can trust its claims without re-verifying
// the JWT signature. We still check `email_verified` and the allow-list.

import type { Context } from "hono";

export interface Env {
  ASSETS: Fetcher;
  DOCS: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  /** The one email allowed to sign in, e.g. "kushalbakliwal25@gmail.com". */
  ALLOWED_EMAIL: string;
}

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SESSION_COOKIE = "kdsess";
const STATE_COOKIE = "kdstate";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---- base64url + bytes -----------------------------------------------------

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

// ---- HMAC signing ----------------------------------------------------------

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return b64urlEncode(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---- cookies ---------------------------------------------------------------

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name: string, value: string, maxAgeSec: number): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  return attrs.join("; ");
}

// ---- session token ---------------------------------------------------------

interface SessionPayload {
  email: string;
  exp: number; // ms epoch
}

async function makeSession(email: string, secret: string): Promise<string> {
  const payload: SessionPayload = { email, exp: Date.now() + SESSION_TTL_MS };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await sign(body, secret);
  return `${body}.${sig}`;
}

async function readSession(token: string, secret: string): Promise<SessionPayload | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(body, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(dec.decode(b64urlDecode(body))) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Returns the signed-in email, or null. */
export async function getSessionEmail(c: Context<{ Bindings: Env }>): Promise<string | null> {
  const token = parseCookies(c.req.header("Cookie"))[SESSION_COOKIE];
  if (!token) return null;
  const payload = await readSession(token, c.env.SESSION_SECRET);
  return payload?.email ?? null;
}

// ---- OAuth flow ------------------------------------------------------------

const redirectUri = (c: Context) => new URL(c.req.url).origin + "/api/auth/callback";

/** Step 1: redirect the user to Google's consent screen. */
export async function startLogin(c: Context<{ Bindings: Env }>): Promise<Response> {
  const state = b64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(c),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  c.header("Set-Cookie", cookie(STATE_COOKIE, state, 600));
  return c.redirect(`${AUTHORIZE_URL}?${params.toString()}`, 302);
}

/** Step 2: Google redirects back here with ?code & ?state. */
export async function handleCallback(c: Context<{ Bindings: Env }>): Promise<Response> {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = parseCookies(c.req.header("Cookie"))[STATE_COOKIE];

  if (!code || !state || !cookieState || state !== cookieState) {
    return c.redirect("/?error=state", 302);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(c),
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) return c.redirect("/?error=token", 302);

  const tokens = (await resp.json()) as { id_token?: string };
  if (!tokens.id_token) return c.redirect("/?error=noidtoken", 302);

  const claims = decodeIdToken(tokens.id_token);
  const email = String(claims?.email ?? "").toLowerCase();
  const verified = claims?.email_verified === true || claims?.email_verified === "true";
  const allowed = c.env.ALLOWED_EMAIL.toLowerCase();

  if (!email || !verified || email !== allowed) {
    return c.redirect("/?error=denied", 302);
  }

  const token = await makeSession(email, c.env.SESSION_SECRET);
  c.header("Set-Cookie", cookie(SESSION_COOKIE, token, SESSION_TTL_MS / 1000));
  // Clear the one-time state cookie.
  c.header("Set-Cookie", cookie(STATE_COOKIE, "", 0), { append: true });
  return c.redirect("/", 302);
}

export function clearSession(c: Context<{ Bindings: Env }>): void {
  c.header("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
}

function decodeIdToken(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(dec.decode(b64urlDecode(parts[1])));
  } catch {
    return null;
  }
}
