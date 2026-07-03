#!/usr/bin/env node
/* ============================================================================
   serve.mjs — contact-sheet gallery for the Devsplainers kit (SPEC §6 Step 3).
   Built fresh for this project (NOT copied from any POC).

   Run from the hyperframes/ project root:
     node serve.mjs            # http://localhost:4321
     PORT=5000 node serve.mjs

   "/" renders every scene under kit/examples/ and videos/<v>/scenes/ as a scaled
   live tile. Each tile seeks its paused timeline to progress(1) on load, so you
   review the FINAL composed look of every scene at a glance — the static review
   gate. Everything else is served as static files (the kit symlink resolves
   through the file server, so scenes load their tokens/atoms/fonts normally).
   Zero third-party deps.
   ============================================================================ */
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT || 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

function findScenes() {
  const scenes = [];
  const exDir = join(ROOT, 'kit', 'examples');
  if (existsSync(exDir)) {
    for (const d of readdirSync(exDir)) {
      if (existsSync(join(exDir, d, 'index.html'))) scenes.push({ group: 'examples', path: `kit/examples/${d}`, name: d });
    }
  }
  const vidDir = join(ROOT, 'videos');
  if (existsSync(vidDir)) {
    for (const v of readdirSync(vidDir)) {
      const scDir = join(vidDir, v, 'scenes');
      if (!existsSync(scDir)) continue;
      for (const s of readdirSync(scDir)) {
        if (existsSync(join(scDir, s, 'index.html'))) scenes.push({ group: v, path: `videos/${v}/scenes/${s}`, name: s });
      }
    }
  }
  return scenes;
}

function gallery() {
  const scenes = findScenes();
  const tiles = scenes.map((s) => `
    <figure class="tile">
      <div class="frame"><iframe src="/${s.path}/index.html" scrolling="no" loading="lazy"></iframe></div>
      <figcaption><span class="g">${s.group}</span> ${s.name}
        <a href="/${s.path}/index.html" target="_blank">open ↗</a></figcaption>
    </figure>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Devsplainers kit — contact sheet</title>
<style>
  :root { --w: 460px; --scale: calc(460 / 1920); }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0d0d0d; color: #f5f5f5; font: 14px/1.4 ui-monospace, monospace; padding: 28px; }
  h1 { font-size: 18px; letter-spacing: .1em; text-transform: uppercase; margin: 0 0 4px; }
  .sub { color: #8a8a8a; margin: 0 0 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: 24px; }
  .tile { margin: 0; }
  .frame { width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid #2a2a2a; border-radius: 10px; background: #000; position: relative; }
  .frame iframe { width: 1920px; height: 1080px; border: 0; transform: scale(0.2396); transform-origin: top left; pointer-events: none; }
  figcaption { margin-top: 8px; color: #f5f5f5; display: flex; align-items: center; gap: 10px; }
  figcaption .g { color: #facc15; text-transform: uppercase; font-size: 11px; letter-spacing: .08em; }
  figcaption a { margin-left: auto; color: #2e7dff; text-decoration: none; }
  .empty { color: #8a8a8a; }
</style></head><body>
  <h1>Devsplainers kit — contact sheet</h1>
  <p class="sub">${scenes.length} scene(s) · each tile shows the final composed frame · review the look, then lock it</p>
  <div class="grid">${tiles || '<p class="empty">No scenes found under kit/examples/ or videos/*/scenes/.</p>'}</div>
  <script>
    // Scenes register a paused timeline; jump each to its end so the tile shows
    // the finished look (not the pre-entrance "from" state). Same-origin = OK.
    document.querySelectorAll('iframe').forEach((f) => {
      f.addEventListener('load', () => {
        const seek = (tries) => {
          try {
            const tl = f.contentWindow.__timelines && f.contentWindow.__timelines.main;
            if (tl) return tl.progress(1);
          } catch (e) {}
          if (tries > 0) setTimeout(() => seek(tries - 1), 120);
        };
        seek(20);
      });
    });
  </script>
</body></html>`;
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/' || url === '/index') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(gallery());
  }
  const target = resolve(ROOT, '.' + url);
  if (!target.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    if (statSync(target).isDirectory()) {
      const idx = join(target, 'index.html');
      if (existsSync(idx)) { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(readFileSync(idx)); }
    }
    const body = readFileSync(target); // follows the kit symlink transparently
    res.writeHead(200, { 'content-type': MIME[extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`Devsplainers contact sheet → http://localhost:${PORT}`);
});
