/**
 * hub.ts
 * The two pages this Worker serves, as HTML strings:
 *   - renderHub()   → the card grid (shown once the PIN cookie is valid)
 *   - renderLogin() → the password gate
 *
 * To add an app later, add one line to APPS. Nothing else changes.
 */

type App = {
  name: string;
  url: string;
  /** short label, e.g. the host — shown in mono under the name */
  host: string;
  /** one-word category, drives the accent dot grouping (purely cosmetic) */
  kind: "app" | "infra" | "page";
};

const APPS: App[] = [
  { name: "Gym Tracker", host: "kushal-gym.agrolloo.com", url: "https://kushal-gym.agrolloo.com", kind: "app" },
  { name: "Kushal Docs", host: "kushal-docs.agrolloo.com", url: "https://kushal-docs.agrolloo.com", kind: "app" },
  { name: "Personal Dashboard", host: "my-dashboard.agrolloo.com", url: "https://my-dashboard.agrolloo.com", kind: "app" },
  { name: "Tutorials Tracker", host: "tutorials-tracker.agrolloo.com", url: "https://tutorials-tracker.agrolloo.com", kind: "app" },
  { name: "YT Analytics", host: "yt-analytics.agrolloo.com", url: "https://yt-analytics.agrolloo.com", kind: "app" },
  { name: "URL Shortener", host: "go.agrolloo.com", url: "https://go.agrolloo.com", kind: "infra" },
  { name: "Hyperframes Renderer", host: "render2.agrolloo.com", url: "https://render2.agrolloo.com", kind: "infra" },
  { name: "Keto Kitchen", host: "keto-kitchen.agrolloo.com", url: "https://keto-kitchen.agrolloo.com", kind: "page" },
];

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0d0c0b"/><text x="16" y="22" font-family="Georgia,serif" font-size="18" fill="#e8a13a" text-anchor="middle" font-style="italic">k</text></svg>`,
  );

const HEAD = `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0d0c0b" />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" href="${FAVICON}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />`;

const BASE_CSS = `
  :root {
    --bg: #0d0c0b;
    --ink: #f3ede2;
    --muted: #8c857a;
    --line: rgba(243, 237, 226, 0.10);
    --line-strong: rgba(243, 237, 226, 0.20);
    --accent: #e8a13a;
    --accent-soft: rgba(232, 161, 58, 0.14);
    --card: rgba(255, 252, 245, 0.026);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    -webkit-font-smoothing: antialiased;
    min-height: 100dvh;
    position: relative;
    overflow-x: hidden;
  }
  /* atmosphere: two soft light pools + grain */
  body::before {
    content: "";
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
      radial-gradient(60% 50% at 18% 0%, rgba(232, 161, 58, 0.10), transparent 60%),
      radial-gradient(55% 45% at 92% 8%, rgba(86, 124, 168, 0.10), transparent 62%);
  }
  body::after {
    content: "";
    position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.4;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
    mix-blend-mode: overlay;
  }
  .wrap { position: relative; z-index: 1; }
`;

export function renderHub(): string {
  const cards = APPS.map((a, i) => {
    const delay = (i * 60).toString();
    return `
      <a class="card" href="${a.url}" target="_blank" rel="noopener" style="--d:${delay}ms">
        <span class="dot dot--${a.kind}"></span>
        <span class="card__body">
          <span class="card__name">${a.name}</span>
          <span class="card__host">${a.host}</span>
        </span>
        <span class="card__go" aria-hidden="true">&#8599;</span>
      </a>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>${HEAD}
<title>KushalTools</title>
<style>
${BASE_CSS}
  .wrap {
    max-width: 1040px;
    margin: 0 auto;
    padding: clamp(2.4rem, 6vw, 5rem) clamp(1.2rem, 4vw, 2.4rem) 4rem;
  }
  header { margin-bottom: clamp(2rem, 5vw, 3.4rem); }
  .eyebrow {
    font-size: 0.72rem; letter-spacing: 0.34em; text-transform: uppercase;
    color: var(--muted); display: flex; align-items: center; gap: 0.7rem;
    animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .eyebrow::after { content: ""; flex: 1; height: 1px; background: var(--line); }
  h1 {
    font-family: "Instrument Serif", Georgia, serif;
    font-weight: 400;
    font-size: clamp(3rem, 9vw, 5.6rem);
    line-height: 0.95; letter-spacing: -0.01em;
    margin-top: 0.5rem;
    animation: rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) 0.06s both;
  }
  h1 em { font-style: italic; color: var(--accent); }
  .sub {
    margin-top: 0.9rem; color: var(--muted); font-size: 0.82rem;
    letter-spacing: 0.02em; max-width: 30ch;
    animation: rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) 0.12s both;
  }
  .grid {
    display: grid; gap: 0.9rem;
    grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  }
  .card {
    position: relative; display: flex; align-items: center; gap: 0.95rem;
    padding: 1.15rem 1.2rem;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--card);
    color: var(--ink); text-decoration: none;
    overflow: hidden;
    transition: transform 0.32s cubic-bezier(0.2, 0.7, 0.2, 1),
                border-color 0.32s ease, background 0.32s ease;
    animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
    animation-delay: var(--d);
  }
  /* sweeping accent edge that grows on hover */
  .card::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
    background: var(--accent); transform: scaleY(0); transform-origin: top;
    transition: transform 0.34s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .card:hover {
    transform: translateY(-4px);
    border-color: var(--line-strong);
    background: rgba(255, 252, 245, 0.05);
  }
  .card:hover::before { transform: scaleY(1); }
  .dot {
    width: 8px; height: 8px; border-radius: 50%; flex: none;
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  .dot--app { background: var(--accent); }
  .dot--infra { background: #6f9fd0; box-shadow: 0 0 0 4px rgba(111, 159, 208, 0.14); }
  .dot--page { background: #9fce8f; box-shadow: 0 0 0 4px rgba(159, 206, 143, 0.14); }
  .card__body { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
  .card__name {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: 1.42rem; line-height: 1.05; letter-spacing: 0.01em;
  }
  .card__host {
    font-size: 0.72rem; color: var(--muted); letter-spacing: 0.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .card__go {
    margin-left: auto; font-size: 1.05rem; color: var(--muted);
    transition: transform 0.3s ease, color 0.3s ease;
  }
  .card:hover .card__go { color: var(--accent); transform: translate(2px, -2px); }
  footer {
    margin-top: 2.6rem; padding-top: 1.3rem; border-top: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: center;
    color: var(--muted); font-size: 0.7rem; letter-spacing: 0.03em;
    animation: rise 0.8s ease 0.5s both;
  }
  footer a { color: var(--muted); text-decoration: none; }
  footer a:hover { color: var(--accent); }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="eyebrow">Personal &nbsp;&middot;&nbsp; agrolloo.com</p>
      <h1>Kushal<em>Tools</em></h1>
      <p class="sub">Everything I&rsquo;ve shipped, one tap away. Tap a card to open it.</p>
    </header>
    <main class="grid">${cards}</main>
    <footer>
      <span>${APPS.length} tools</span>
      <a href="/logout" data-logout>Sign out &#8594;</a>
    </footer>
  </div>
  <script>
    document.querySelector('[data-logout]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/logout', { method: 'POST' });
      location.href = '/';
    });
  </script>
</body>
</html>`;
}

export function renderLogin(error = false): string {
  return `<!doctype html>
<html lang="en">
<head>${HEAD}
<title>KushalTools &middot; Locked</title>
<style>
${BASE_CSS}
  .wrap {
    min-height: 100dvh; display: grid; place-items: center;
    padding: 1.4rem;
  }
  .gate {
    width: 100%; max-width: 360px; text-align: center;
    animation: rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .mark {
    font-family: "Instrument Serif", Georgia, serif; font-style: italic;
    font-size: 2.8rem; color: var(--accent); line-height: 1;
  }
  h1 {
    font-family: "Instrument Serif", Georgia, serif; font-weight: 400;
    font-size: 2rem; margin-top: 0.4rem; letter-spacing: -0.01em;
  }
  .hint { color: var(--muted); font-size: 0.74rem; letter-spacing: 0.04em; margin-top: 0.5rem; }
  form { margin-top: 1.8rem; display: flex; flex-direction: column; gap: 0.7rem; }
  input {
    width: 100%; padding: 0.95rem 1rem; text-align: center;
    background: var(--card); color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 12px; font: inherit; font-size: 0.95rem; letter-spacing: 0.15em;
    transition: border-color 0.25s ease;
  }
  input:focus { outline: none; border-color: var(--accent); }
  input.err { border-color: #d8553f; }
  button {
    padding: 0.95rem 1rem; border: none; border-radius: 12px; cursor: pointer;
    background: var(--accent); color: #1a1206; font: inherit; font-weight: 500;
    letter-spacing: 0.05em; transition: filter 0.2s ease, transform 0.2s ease;
  }
  button:hover { filter: brightness(1.06); }
  button:active { transform: translateY(1px); }
  .msg { min-height: 1rem; font-size: 0.72rem; color: #e07a64; letter-spacing: 0.03em; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="gate" id="gate">
      <div class="mark">k</div>
      <h1>KushalTools</h1>
      <p class="hint">Enter the passphrase to continue</p>
      <form id="f">
        <input id="pw" type="password" name="password" placeholder="passphrase"
               autocomplete="current-password" autofocus class="${error ? "err" : ""}" />
        <button type="submit">Unlock &#8594;</button>
        <p class="msg" id="msg">${error ? "Wrong passphrase. Try again." : ""}</p>
      </form>
    </div>
  </div>
  <script>
    const f = document.getElementById('f');
    const pw = document.getElementById('pw');
    const msg = document.getElementById('msg');
    const gate = document.getElementById('gate');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = '';
      pw.classList.remove('err');
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw.value }),
      });
      if (r.ok) { location.href = '/'; return; }
      pw.classList.add('err');
      msg.textContent = 'Wrong passphrase. Try again.';
      gate.style.animation = 'shake 0.4s';
      gate.addEventListener('animationend', () => { gate.style.animation = ''; }, { once: true });
      pw.select();
    });
  </script>
</body>
</html>`;
}
