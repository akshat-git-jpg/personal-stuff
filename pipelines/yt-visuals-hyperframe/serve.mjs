// serve.mjs — a tiny zero-dependency local server for the card gallery.
//
//   npm run serve         (or:  node serve.mjs)
//   → open the printed http://localhost:4321
//
// Reads the card files LIVE on every load and every Copy click — edit a card,
// refresh, and the preview + Copy reflect it immediately (no rebuild step).
//
// Cards are fixed 1920x1080 with a PAUSED GSAP timeline (so the renderer can seek
// them deterministically). To SHOW them we:
//   • serve any card with ?play → injects a script that plays the timeline on a loop
//   • scale the 1920x1080 card down to fit the preview box / window
// The raw file (no ?play) is what Copy hands you — clean, unmodified HTML.

import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const IGNORE = new Set(["node_modules", "assets", "compositions", ".git"]);
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4",
  ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff",
};

const isDir = async (p) => { try { return (await stat(p)).isDirectory(); } catch { return false; } };
const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };
const pretty = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// injected into a card when served with ?play. The cards are a fixed 1920x1080
// #root with a PAUSED timeline. This (a) scales #root to fit whatever viewport it's
// shown in (preview box or full window), and (b) loops the timeline so motion shows.
// Only applied in ?play mode — the raw file (what Copy gives you) is untouched.
// Injected with ?play. We do NOT touch the card's own CSS (that would break its
// internal centering) — we only loop the paused timeline. Scaling the 1920x1080
// card to fit is done OUTSIDE, by scaling the iframe (see the gallery + viewWrapper).
const PLAY_SCRIPT =
  "<scr" + "ipt>(function(){function play(){var t=window.__timelines||{};" +
  "Object.keys(t).forEach(function(k){var tl=t[k];if(tl&&tl.play){tl.repeat(-1);tl.repeatDelay(0.8);tl.play();}});}" +
  "play();[100,400,900].forEach(function(d){setTimeout(play,d);});})();</scr" + "ipt>";

// full-window view of one card (the Open button target). The card renders at its
// native 1920x1080 inside the iframe; we scale + center the iframe to the window.
const viewWrapper = (card) => `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${card}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
#wrap{position:fixed;inset:0;display:grid;place-items:center}
iframe{width:1920px;height:1080px;border:0;transform-origin:center center}</style></head>
<body><div id="wrap"><iframe id="f" src="/${card}?play"></iframe></div>
<scr${""}ipt>function fit(){document.getElementById('f').style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')';}addEventListener('resize',fit);fit();</scr${""}ipt>
</body></html>`;

// scan <type>/<card>/index.html, live
async function listCards() {
  const cards = [];
  for (const type of await readdir(ROOT)) {
    if (IGNORE.has(type) || !(await isDir(join(ROOT, type)))) continue;
    for (const card of await readdir(join(ROOT, type))) {
      const file = join(ROOT, type, card, "index.html");
      if (!(await isFile(file))) continue;
      const html = await readFile(file, "utf8");
      const m = html.match(/<title>([^<]*)<\/title>/i);
      cards.push({ type, card, rel: `${type}/${card}/index.html`, title: (m && m[1].trim()) || pretty(card) });
    }
  }
  return cards.sort((a, b) => (a.type + a.card).localeCompare(b.type + b.card));
}

const GALLERY = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>YT Visuals — Hyperframes (live)</title>
<style>
  :root { --bg:#0f0b07; --panel:#181210; --line:rgba(255,255,255,0.10);
    --text:#f5ede2; --dim:rgba(245,237,226,0.55); --accent:#fb923c; --ok:#34d399; --err:#ff6b6b;
    --font:"Inter",-apple-system,system-ui,sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--font); background:radial-gradient(ellipse at 50% -10%, #2a1708, var(--bg) 55%);
    color:var(--text); min-height:100vh; padding:40px 32px 80px; }
  header { max-width:1400px; margin:0 auto 28px; }
  h1 { font-size:30px; font-weight:800; letter-spacing:-0.5px; }
  header p { color:var(--dim); margin-top:8px; font-size:15px; max-width:720px; }
  .live { display:inline-block; font-size:12px; font-weight:700; color:var(--ok); border:1px solid var(--ok);
    border-radius:999px; padding:2px 10px; margin-left:10px; vertical-align:middle; letter-spacing:1px; }
  section { max-width:1400px; margin:0 auto 44px; }
  h2 { font-size:15px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--accent);
    margin-bottom:18px; display:flex; align-items:center; gap:10px; }
  .count { font-size:12px; color:var(--dim); background:var(--panel); border:1px solid var(--line);
    border-radius:999px; padding:2px 9px; letter-spacing:0; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(360px,1fr)); gap:22px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
  .preview { position:relative; width:100%; aspect-ratio:16/9; background:#000; border-bottom:1px solid var(--line); overflow:hidden; }
  .preview iframe { position:absolute; top:0; left:0; width:1920px; height:1080px; border:0; transform-origin:top left; }
  .meta { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; }
  .names { min-width:0; }
  .title { font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .file { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--dim); margin-top:3px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .actions { display:flex; gap:8px; flex-shrink:0; }
  .btn { font:inherit; font-size:13px; font-weight:600; border-radius:9px; padding:9px 14px; cursor:pointer;
    border:1px solid var(--line); background:transparent; color:var(--text); text-decoration:none; display:inline-block; }
  .btn.copy { background:var(--accent); color:#1a0f05; border-color:transparent; }
  .btn.copy.done { background:var(--ok); color:#042b1c; }
  .btn.copy.err { background:var(--err); color:#2b0404; }
  .empty { max-width:1400px; margin:0 auto; color:var(--dim); }
</style>
</head>
<body>
  <header>
    <h1>YT Visuals — Hyperframes <span class="live">LIVE</span></h1>
    <p>Reads the card files straight from disk — edit a card, refresh this page, and the
      preview + <strong>Copy HTML</strong> update right away (no rebuild). Previews loop
      the motion; <strong>Open</strong> shows the card full-screen. Copy hands you the
      card's current HTML to edit with Gemini and paste into the render tool.</p>
  </header>
  <div id="root"></div>
  <script>
    const fetchCard = (rel) => fetch("/" + rel, { cache: "no-store" }).then((r) => r.text());

    // scale each 1920px iframe to its box — ResizeObserver fires after layout, so
    // the scale is always right (no measure-too-early bugs).
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const f = e.target.querySelector("iframe");
        if (f) f.style.transform = "scale(" + (e.contentRect.width / 1920) + ")";
      }
    });

    (async () => {
      const root = document.getElementById("root");
      const cards = await fetch("/api/cards", { cache: "no-store" }).then((r) => r.json());
      if (!cards.length) {
        root.innerHTML = '<p class="empty">No cards yet. Add one at &lt;type&gt;/&lt;card&gt;/index.html and refresh.</p>';
        return;
      }
      const byType = {};
      for (const c of cards) (byType[c.type] = byType[c.type] || []).push(c);

      for (const type of Object.keys(byType).sort()) {
        const list = byType[type];
        const sec = document.createElement("section");
        sec.innerHTML = '<h2>' + type + ' <span class="count">' + list.length + '</span></h2>';
        const grid = document.createElement("div");
        grid.className = "grid";
        for (const c of list) {
          const el = document.createElement("div");
          el.className = "card";
          const box = document.createElement("div");
          box.className = "preview";
          const frame = document.createElement("iframe");
          frame.setAttribute("scrolling", "no");
          frame.src = "/" + c.rel + "?play";        // server injects the play-loop
          box.appendChild(frame);
          ro.observe(box);                            // scale the iframe to fit the box
          const meta = document.createElement("div");
          meta.className = "meta";
          meta.innerHTML =
            '<div class="names"><div class="title">' + c.title + '</div>' +
            '<div class="file">' + c.rel + '</div></div>';
          const actions = document.createElement("div");
          actions.className = "actions";
          const copy = document.createElement("button");
          copy.className = "btn copy";
          copy.textContent = "Copy HTML";
          copy.onclick = async () => {
            try {
              const html = await fetchCard(c.rel); // re-read the file NOW (clean, no ?play)
              try { await navigator.clipboard.writeText(html); }
              catch { const ta = document.createElement("textarea"); ta.value = html; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
              copy.classList.add("done"); copy.textContent = "Copied ✓";
            } catch {
              copy.classList.add("err"); copy.textContent = "Failed";
            }
            setTimeout(() => { copy.className = "btn copy"; copy.textContent = "Copy HTML"; }, 1400);
          };
          const open = document.createElement("a");
          open.className = "btn";
          open.href = "/view?card=" + encodeURIComponent(c.rel);
          open.target = "_blank";
          open.textContent = "Open";
          actions.append(copy, open);
          meta.appendChild(actions);
          el.append(box, meta);
          grid.appendChild(el);
        }
        sec.appendChild(grid);
        root.appendChild(sec);
      }
    })();
  </script>
</body>
</html>`;

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/" || url.pathname === "/index") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    return res.end(GALLERY);
  }
  if (url.pathname === "/api/cards") {
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    return res.end(JSON.stringify(await listCards()));
  }
  if (url.pathname === "/view") {
    const card = (url.searchParams.get("card") || "").replace(/^\/+/, "");
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    return res.end(viewWrapper(card));
  }

  // static files (card HTML, assets) — read live, no caching, no path traversal
  const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(ROOT, safe);
  if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end("forbidden"); }
  try {
    const isHtml = extname(filePath) === ".html";
    if (isHtml && url.searchParams.has("play")) {
      let html = await readFile(filePath, "utf8");
      html = html.includes("</body>") ? html.replace("</body>", PLAY_SCRIPT + "</body>") : html + PLAY_SCRIPT;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      return res.end(html);
    }
    const data = await readFile(filePath);
    res.setHeader("content-type", (MIME[extname(filePath)] || "application/octet-stream") + (isHtml ? "; charset=utf-8" : ""));
    res.setHeader("cache-control", "no-store");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(PORT, () => console.log(`Live gallery → http://localhost:${PORT}  (Ctrl+C to stop)`));
