import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

interface AuthEnv {
  Bindings: { APP_PIN: string; SESSION_SECRET: string };
}

const COOKIE = "founders_session";

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Token = "ok.<hmac(secret,'ok')>". Stateless; rotating SESSION_SECRET logs everyone out. */
export async function signSession(secret: string): Promise<string> {
  return `ok.${await hmac(secret, "ok")}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const expected = await signSession(secret);
  // constant-time-ish compare
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export { COOKIE };

export function loginPage(error = false): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<title>Founders Tracker</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d12;
    font-family:system-ui,sans-serif;color:#e7e9ee}
  form{display:grid;gap:14px;width:260px;padding:28px;border:1px solid #232838;
    border-radius:16px;background:#11141c}
  h1{font-size:18px;margin:0 0 4px;text-align:center}
  input{padding:12px;border-radius:10px;border:1px solid #2a3146;background:#0b0d12;
    color:#fff;font-size:16px;text-align:center;letter-spacing:4px}
  button{padding:12px;border:0;border-radius:10px;background:#3b82f6;color:#fff;
    font-size:15px;font-weight:600}
  .err{color:#f87171;font-size:13px;text-align:center;min-height:16px}
</style></head><body>
<form method="POST" action="/login">
  <h1>🚀 Founders Tracker</h1>
  <input name="pin" type="password" inputmode="numeric" placeholder="PIN" autofocus/>
  <div class="err">${error ? "Wrong PIN" : ""}</div>
  <button type="submit">Enter</button>
</form></body></html>`;
}

export async function requireAuth(c: Context<AuthEnv>, next: Next): Promise<Response | void> {
  const ok = await verifySession(getCookie(c, COOKIE), c.env.SESSION_SECRET);
  if (ok) return next();
  if (c.req.path.startsWith("/api/")) return c.json({ error: "unauthorized" }, 401);
  return c.redirect("/login", 302);
}
