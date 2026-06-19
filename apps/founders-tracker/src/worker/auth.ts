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
<meta name="theme-color" content="#f3ede1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Founders Ledger</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500..700;1,9..144,500..600&family=Hanken+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"/>
<style>
  :root{--paper:#f3ede1;--surface:#fbf7ef;--line:#d4c8b1;--ink:#211b14;--muted:#8c8275;--navy:#1f3a5f;--over:#b23a2e}
  *{box-sizing:border-box;margin:0}
  html,body{height:100%}
  body{min-height:100dvh;display:grid;place-items:center;padding:1.4rem;background:var(--paper);
    background-image:radial-gradient(circle at 20% 10%,rgba(31,58,95,.05),transparent 40%),
      radial-gradient(circle at 85% 95%,rgba(178,58,46,.045),transparent 44%);
    color:var(--ink);font-family:"Hanken Grotesk",system-ui,-apple-system,sans-serif;
    -webkit-font-smoothing:antialiased;position:relative;overflow:hidden}
  .gate{position:relative;width:100%;max-width:330px;text-align:center;
    animation:rise .55s cubic-bezier(.2,.7,.2,1) both}
  .kicker{font-size:.62rem;letter-spacing:.28em;text-transform:uppercase;color:var(--muted);font-weight:700}
  h1{font-family:"Fraunces",Georgia,serif;font-size:2.3rem;font-weight:600;letter-spacing:-.015em;
    margin-top:.55rem;line-height:.95}
  h1 em{font-style:italic;font-weight:500;color:var(--navy)}
  .hint{color:var(--muted);font-size:.82rem;margin-top:.7rem;font-weight:500}
  form{margin-top:1.7rem;display:grid;gap:.65rem}
  input{width:100%;padding:.95rem 1rem;text-align:center;font-family:inherit;font-size:1.15rem;
    font-weight:600;letter-spacing:.35em;color:var(--ink);background:var(--surface);
    border:1px solid var(--line);border-radius:13px;
    transition:border-color .2s ease,box-shadow .2s ease}
  input::placeholder{letter-spacing:.12em;font-weight:500;color:#b3a892}
  input:focus{outline:none;border-color:var(--navy);box-shadow:0 0 0 3px rgba(31,58,95,.15)}
  input.bad{border-color:var(--over);box-shadow:0 0 0 3px rgba(178,58,46,.16)}
  button{padding:.95rem 1rem;border:0;border-radius:13px;cursor:pointer;background:var(--navy);
    color:#fdfaf3;font-family:inherit;font-size:.96rem;font-weight:600;letter-spacing:.01em;
    transition:filter .18s ease,transform .12s ease}
  button:hover{filter:brightness(1.1)}
  button:active{transform:translateY(1px)}
  .msg{min-height:1.05rem;font-size:.76rem;color:var(--over);font-weight:600}
  @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head><body>
<div class="gate" id="gate"${error ? ' style="animation:shake .4s"' : ""}>
  <div class="kicker">Khushi &amp; Kushal</div>
  <h1>Founders <em>Ledger</em></h1>
  <p class="hint">Enter your shared PIN to continue</p>
  <form method="POST" action="/login">
    <input name="pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" autofocus class="${error ? "bad" : ""}"/>
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
