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
 *   getUser(c) → { email, roles }
 */

import type { Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { getAccessToken } from "./sheets";
import { lookupRoles } from "./roles";

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
  /** Set to "1" in .dev.vars only. Unset in production — branch is dead in prod. */
  DEV_AUTH?: string;
  // Email notifications via Resend (optional; silently no-op if absent)
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  NOTIFY_REDIRECT?: string;
  APP_URL?: string;
  // Affiliate-link generation (App A) — shares the redirector's KV + D1.
  CLICKS_KV: KVNamespace;
  DB: D1Database;
  GEMINI_API_KEY: string;
  LINK_DOMAIN: string;
  AFFILIATE_PROGRAMS_SHEET_URL: string;
};

export type Variables = {
  user: { email: string; roles: string[] };
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

  // Look up roles in the Employes sheet
  let roles: string[];
  try {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    roles = await lookupRoles(saToken, c.env.SHEET_ID, email);
  } catch (err) {
    console.error("[auth] Role lookup failed:", err);
    return c.text("Role lookup failed", 502);
  }

  if (roles.length === 0) {
    return c.html(
      `<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0806;
             color:rgba(255,247,238,0.92);font-family:Inter,-apple-system,BlinkMacSystemFont,system-ui,sans-serif}
        .box{max-width:420px;text-align:center;padding:32px}
        h1{font-size:20px;font-weight:700;margin:0 0 10px}
        p{font-size:14px;line-height:1.6;color:rgba(255,243,230,0.6);margin:0 0 6px}
        .email{color:rgba(255,243,230,0.85)}
        a{color:#fb923c;text-decoration:none}
      </style></head><body>
      <div class="box">
        <h1>Not authorized</h1>
        <p>This account (<span class="email">${email}</span>) doesn&rsquo;t have access yet.</p>
        <p>Please contact your admin to be granted access.</p>
        <p style="margin-top:18px"><a href="/auth/login">Try a different account</a></p>
      </div></body></html>`,
      403,
    );
  }

  // Create opaque session in KV
  const sessionId = crypto.randomUUID();
  const sessionData = JSON.stringify({ email, roles, createdAt: new Date().toISOString() });
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
  // Dev-only auth bypass: DEV_AUTH is never set in production, so this branch
  // is dead in prod. Allows curl with arbitrary roles during local development.
  if (c.env.DEV_AUTH === "1") {
    const devEmail = c.req.header("X-Dev-Email");
    const devRoles = c.req.header("X-Dev-Roles");
    if (devEmail && devRoles) {
      c.set("user", { email: devEmail, roles: devRoles.split(",").map(r => r.trim()).filter(Boolean) });
      await next();
      return;
    }
  }

  const sessionId = getCookie(c, "session");
  if (!sessionId) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const raw = await c.env.SESSIONS.get(`session:${sessionId}`);
  if (!raw) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let session: { email: string; roles?: string[]; role?: string };
  try {
    session = JSON.parse(raw) as { email: string; roles?: string[]; role?: string };
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }

  // Roles are resolved LIVE from the Employes tab on every request — the session
  // only proves identity (email). This is the single source of truth, so adding
  // or removing a role in the Team tab takes effect immediately, with no re-login,
  // for the person who changed AND for anyone else. If the live lookup fails, fall
  // back to the roles snapshotted in the session at login.
  // Roles are read LIVE from the Employes tab every request, so adding/removing a
  // role takes effect immediately (no re-login, no cache lag). The session only
  // proves identity.
  let roles: string[];
  try {
    const saToken = await getAccessToken(c.env.GOOGLE_SA_JSON);
    roles = await lookupRoles(saToken, c.env.SHEET_ID, session.email);
  } catch (err) {
    console.warn("[auth] live role lookup failed; using session roles:", err);
    roles = session.roles ?? (session.role ? [session.role] : []);
  }
  c.set("user", { email: session.email, roles });
  await next();
}

// ---------------------------------------------------------------------------
// getUser helper
// ---------------------------------------------------------------------------

export function getUser(c: Context<{ Bindings: Env; Variables: Variables }>): {
  email: string;
  roles: string[];
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
