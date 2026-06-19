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
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"/>
<meta name="theme-color" content="#0b0d12"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Founders Tracker</title>
<style>
  :root{--bg:#0b0d12;--panel:#11141c;--line:#232838;--ink:#e7e9ee;--muted:#8b93a7;--blue:#3b82f6}
  *{box-sizing:border-box;margin:0}
  html,body{height:100%}
  body{min-height:100dvh;display:grid;place-items:center;padding:1.4rem;background:var(--bg);
    color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased;position:relative;overflow:hidden}
  body::before{content:"";position:fixed;inset:0;pointer-events:none;
    background:radial-gradient(60% 50% at 50% -8%,rgba(59,130,246,.18),transparent 62%),
      radial-gradient(45% 40% at 92% 100%,rgba(59,130,246,.08),transparent 60%)}
  .gate{position:relative;width:100%;max-width:340px;text-align:center;
    animation:rise .55s cubic-bezier(.2,.7,.2,1) both}
  .logo{font-size:2.4rem;line-height:1;filter:drop-shadow(0 4px 14px rgba(59,130,246,.35))}
  h1{font-size:1.5rem;font-weight:700;letter-spacing:-.01em;margin-top:.5rem}
  .hint{color:var(--muted);font-size:.8rem;margin-top:.4rem;letter-spacing:.01em}
  form{margin-top:1.6rem;display:grid;gap:.7rem}
  input{width:100%;padding:.95rem 1rem;text-align:center;font:inherit;font-size:1.15rem;
    font-weight:600;letter-spacing:.35em;color:#fff;background:#0b0d12;
    border:1px solid var(--line);border-radius:12px;
    transition:border-color .2s ease,box-shadow .2s ease}
  input::placeholder{letter-spacing:.12em;font-weight:500;color:#566076}
  input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px rgba(59,130,246,.22)}
  input.bad{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.18)}
  button{padding:.95rem 1rem;border:0;border-radius:12px;cursor:pointer;background:var(--blue);
    color:#fff;font:inherit;font-size:.98rem;font-weight:600;letter-spacing:.02em;
    transition:filter .18s ease,transform .12s ease}
  button:hover{filter:brightness(1.07)}
  button:active{transform:translateY(1px)}
  .msg{min-height:1.05rem;font-size:.76rem;color:#fca5a5;letter-spacing:.02em}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<div class="gate" id="gate"${error ? ' style="animation:shake .4s"' : ""}>
  <div class="logo">🚀</div>
  <h1>Founders Tracker</h1>
  <p class="hint">Khushi &amp; Kushal &middot; enter your PIN</p>
  <form method="POST" action="/login">
    <input name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="Enter PIN" autofocus class="${error ? "bad" : ""}"/>
    <button type="submit">Enter &#8594;</button>
    <p class="msg">${error ? "Wrong PIN. Try again." : ""}</p>
  </form>
</div></body></html>`;
}

export async function requireAuth(c: Context<AuthEnv>, next: Next): Promise<Response | void> {
  const ok = await verifySession(getCookie(c, COOKIE), c.env.SESSION_SECRET);
  if (ok) return next();
  if (c.req.path.startsWith("/api/")) return c.json({ error: "unauthorized" }, 401);
  return c.redirect("/login", 302);
}
