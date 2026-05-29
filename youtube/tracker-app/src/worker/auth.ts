/**
 * auth.ts
 * Google OAuth 2.0 Authorization Code flow + opaque KV sessions.
 *
 * Handlers:
 *   loginRedirect  GET /auth/login     → redirect to Google consent screen
 *   oauthCallback  GET /auth/callback  → exchange code, verify email, create session
 *   logout         POST /auth/logout   → destroy session + clear cookie
 *
 * Middleware:
 *   requireSession → validates session cookie, sets c.var.user
 *
 * Helper:
 *   getUser(c) → { email, role }
 */

import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { getAccessToken } from "./sheets";
import { lookupRole } from "./roles";

// ---------------------------------------------------------------------------
// Env / variable types (shared across auth + index)
// ---------------------------------------------------------------------------

export type Env = {
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SHEET_ID: string;
  SESSION_SECRET: string;
  GOOGLE_SA_JSON: string;
};

export type Variables = {
  user: { email: string; role: string };
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const STATE_TTL = 600;    // 10 minutes
const SESSION_TTL = 604800; // 7 days

interface IdTokenPayload {
  email?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

/** base64url-decode a JWT segment (no padding required). */
function decodeJwtPayload(token: string): IdTokenPayload {
  const segment = token.split(".")[1];
  // Restore standard base64 padding
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  return JSON.parse(atob(b64)) as IdTokenPayload;
}

// ---------------------------------------------------------------------------
// loginRedirect  GET /auth/login
// ---------------------------------------------------------------------------

export async function loginRedirect(c: Context<{ Bindings: Env }>): Promise<Response> {
  const state = crypto.randomUUID();

  // Store state in KV for CSRF validation (TTL = 10 min)
  await c.env.SESSIONS.put(`state:${state}`, "1", { expirationTtl: STATE_TTL });

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return c.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`, 302);
}

// ---------------------------------------------------------------------------
// oauthCallback  GET /auth/callback
// ---------------------------------------------------------------------------

export async function oauthCallback(c: Context<{ Bindings: Env }>): Promise<Response> {
  const { code, state } = c.req.query() as { code?: string; state?: string };

  // Validate CSRF state
  if (!state) {
    return c.text("Missing state parameter", 400);
  }
  const storedState = await c.env.SESSIONS.get(`state:${state}`);
  if (!storedState) {
    return c.text("Invalid or expired state — please try logging in again", 400);
  }
  // Consume the state immediately (one-shot)
  await c.env.SESSIONS.delete(`state:${state}`);

  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  // Exchange code for tokens
  const tokenBody = new URLSearchParams({
    code,
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    console.error(`[auth] Token exchange failed (${tokenResp.status}): ${text}`);
    return c.text("Token exchange failed", 502);
  }

  const tokenJson = (await tokenResp.json()) as {
    id_token?: string;
    access_token?: string;
    error?: string;
  };

  if (!tokenJson.id_token) {
    console.error("[auth] No id_token in token response");
    return c.text("Token response missing id_token", 502);
  }

  // Decode the id_token payload (trusted — came directly from Google over TLS)
  let payload: IdTokenPayload;
  try {
    payload = decodeJwtPayload(tokenJson.id_token);
  } catch (err) {
    console.error("[auth] Failed to decode id_token payload:", err);
    return c.text("Failed to decode identity token", 500);
  }

  const { email, email_verified } = payload;

  if (!email || email_verified !== true) {
    return c.text("Email not verified", 403);
  }

  // Look up role in the Employes sheet
  let role: string | null;
  try {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    role = await lookupRole(saToken, c.env.SHEET_ID, email);
  } catch (err) {
    console.error("[auth] Role lookup failed:", err);
    return c.text("Role lookup failed", 502);
  }

  if (role === null) {
    return c.html(
      `<!DOCTYPE html><html><body>
      <p>No access &mdash; your email <strong>${email}</strong> isn&rsquo;t registered.</p>
      <p>Ask your admin to add you to the <em>Employes</em> tab.</p>
      </body></html>`,
      403,
    );
  }

  // Create opaque session in KV
  const sessionId = crypto.randomUUID();
  const sessionData = JSON.stringify({ email, role, createdAt: new Date().toISOString() });
  await c.env.SESSIONS.put(`session:${sessionId}`, sessionData, {
    expirationTtl: SESSION_TTL,
  });

  // Set HttpOnly session cookie
  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL,
  });

  return c.redirect("/", 302);
}

// ---------------------------------------------------------------------------
// requireSession middleware
// ---------------------------------------------------------------------------

export async function requireSession(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
): Promise<Response | void> {
  const sessionId = getCookie(c, "session");
  if (!sessionId) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const raw = await c.env.SESSIONS.get(`session:${sessionId}`);
  if (!raw) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let session: { email: string; role: string };
  try {
    session = JSON.parse(raw) as { email: string; role: string };
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("user", { email: session.email, role: session.role });
  await next();
}

// ---------------------------------------------------------------------------
// getUser helper
// ---------------------------------------------------------------------------

export function getUser(c: Context<{ Bindings: Env; Variables: Variables }>): {
  email: string;
  role: string;
} {
  return c.get("user");
}

// ---------------------------------------------------------------------------
// logout  POST /auth/logout
// ---------------------------------------------------------------------------

export async function logout(c: Context<{ Bindings: Env }>): Promise<Response> {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`);
  }

  // Clear the cookie by setting Max-Age=0
  setCookie(c, "session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  return c.body(null, 200);
}
