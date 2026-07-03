// Build a single HTML gallery to preview every cutaway + overlay side-by-side.
// Run: node scripts/build-gallery.mjs
// Then: open youtube/yt-visuals/cutaways/preview.html
//
// - Cutaways (.mp4) are shown on a black background — they're full-frame slides.
// - Overlays (.webm with alpha) are shown on a dark UI-mockup background so the
//   transparency is visible (you see how it'll look on a screen recording).

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CUTAWAYS = join(ROOT, "cutaways");
const OVERLAYS = join(CUTAWAYS, "overlays");
const OUT = join(CUTAWAYS, "preview.html");

function walk(dir, exts, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(p);
  }
  return out;
}

// Collect cutaways (.mp4 anywhere under cutaways/ EXCEPT inside overlays/)
const cutawayFiles = walk(CUTAWAYS, [".mp4"]).filter((f) => !f.startsWith(OVERLAYS)).sort();
const cutawayGroups = new Map();
for (const file of cutawayFiles) {
  const rel = relative(CUTAWAYS, file);
  const group = dirname(rel);
  if (!cutawayGroups.has(group)) cutawayGroups.set(group, []);
  cutawayGroups.get(group).push({ rel, name: basename(file, ".mp4") });
}
const sortedCutawayGroups = [...cutawayGroups.entries()].sort(([a], [b]) => {
  const aIsVariant = a.includes("-variants");
  const bIsVariant = b.includes("-variants");
  if (aIsVariant !== bIsVariant) return aIsVariant ? 1 : -1;
  return a.localeCompare(b);
});

// Collect overlays (.webm with alpha inside overlays/)
const overlayFiles = walk(OVERLAYS, [".webm"]).sort();
const overlayGroups = new Map();
for (const file of overlayFiles) {
  const rel = relative(CUTAWAYS, file);
  const group = dirname(rel);
  if (!overlayGroups.has(group)) overlayGroups.set(group, []);
  overlayGroups.get(group).push({ rel, name: basename(file).replace(/\.webm$/, "") });
}
const sortedOverlayGroups = [...overlayGroups.entries()].sort(([a], [b]) => a.localeCompare(b));

const cutawayCard = ({ rel, name }) => `
      <figure class="card cutaway-card">
        <video src="${rel}" preload="metadata" muted playsinline controls loop></video>
        <figcaption>${name}</figcaption>
      </figure>`;

const overlayCard = ({ rel, name }) => `
      <figure class="card overlay-card">
        <div class="overlay-stage">
          <div class="fake-screen" aria-hidden="true">
            <div class="fake-titlebar">
              <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
              <span class="fake-tab">tutorial.mov</span>
            </div>
            <div class="fake-content">
              <div class="fake-row" style="width: 64%"></div>
              <div class="fake-row" style="width: 82%"></div>
              <div class="fake-row" style="width: 48%"></div>
              <div class="fake-row" style="width: 92%"></div>
              <div class="fake-row" style="width: 36%"></div>
              <div class="fake-block"></div>
              <div class="fake-row" style="width: 70%"></div>
              <div class="fake-row" style="width: 55%"></div>
            </div>
          </div>
          <video src="${rel}" preload="metadata" muted playsinline controls loop></video>
        </div>
        <figcaption><span class="badge">OVERLAY</span> ${name}</figcaption>
      </figure>`;

const cutawaySectionsHtml = sortedCutawayGroups
  .map(([group, items]) => `
    <section>
      <h2>cutaways · ${group}</h2>
      <div class="grid">${items.map(cutawayCard).join("")}</div>
    </section>`).join("");

const overlaySectionsHtml = sortedOverlayGroups
  .map(([group, items]) => `
    <section>
      <h2>overlays · ${group.replace(/^overlays\/?/, "") || "general"}</h2>
      <div class="grid">${items.map(overlayCard).join("")}</div>
    </section>`).join("");

const totalCount = cutawayFiles.length + overlayFiles.length;
const totalGroups = sortedCutawayGroups.length + sortedOverlayGroups.length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>yt-visuals · gallery</title>
<style>
  :root {
    --bg: #0a0805;
    --bg-card: #14110d;
    --text: #f8f3ea;
    --text-dim: rgba(248,243,234,0.55);
    --accent: #fb923c;
    --border: rgba(255,200,100,0.10);
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: radial-gradient(ellipse at 30% 20%, #3a1f08 0%, var(--bg) 60%);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Display", system-ui, sans-serif;
    min-height: 100vh;
  }
  header {
    padding: 48px 56px 24px;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0;
    background: linear-gradient(to bottom, var(--bg) 0%, rgba(10,8,5,0.92) 100%);
    backdrop-filter: blur(16px);
    z-index: 10;
  }
  header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
  header p { margin: 6px 0 0; color: var(--text-dim); font-size: 14px; }
  header .tools {
    margin-top: 14px;
    display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
  }
  header label {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--text-dim); cursor: pointer;
  }
  header input[type="checkbox"] { accent-color: var(--accent); }
  header button {
    background: var(--accent); color: #1a0f04;
    border: 0; padding: 6px 14px; border-radius: 999px;
    font-size: 13px; font-weight: 600; cursor: pointer;
  }
  header button:hover { filter: brightness(1.1); }

  main { padding: 32px 56px 80px; }
  section { margin-bottom: 56px; }
  section h2 {
    font-size: 18px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 2px;
    color: var(--accent);
    margin: 0 0 20px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
    gap: 20px;
  }
  .card {
    margin: 0;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.18s ease, border-color 0.18s ease;
  }
  .card:hover { transform: translateY(-2px); border-color: var(--accent); }

  /* Cutaway cards: video fills, black backdrop. */
  .cutaway-card video {
    width: 100%; aspect-ratio: 16 / 9; background: #000; display: block;
  }

  /* Overlay cards: video sits ON TOP of a fake screen recording. */
  .overlay-stage {
    position: relative; width: 100%; aspect-ratio: 16 / 9; background: #1e1e1e;
  }
  .overlay-stage video {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    background: transparent;
    display: block;
  }
  .fake-screen {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    background: linear-gradient(180deg, #1f1f24 0%, #18181c 100%);
    color: rgba(255,255,255,0.18);
    overflow: hidden;
  }
  .fake-titlebar {
    height: 24px;
    background: #2a2a30;
    display: flex; align-items: center; gap: 6px;
    padding: 0 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 10px;
  }
  .fake-titlebar .dot {
    width: 10px; height: 10px; border-radius: 50%;
  }
  .fake-titlebar .red    { background: #ff5f56; }
  .fake-titlebar .yellow { background: #ffbd2e; }
  .fake-titlebar .green  { background: #27c93f; }
  .fake-titlebar .fake-tab {
    margin-left: 14px;
    background: rgba(255,255,255,0.05);
    padding: 2px 10px;
    border-radius: 4px;
    color: rgba(255,255,255,0.4);
    font-family: ui-monospace, Menlo, monospace;
    font-size: 9px;
  }
  .fake-content {
    flex: 1;
    padding: 20px 28px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .fake-row {
    height: 12px;
    background: rgba(255,255,255,0.07);
    border-radius: 3px;
  }
  .fake-block {
    height: 80px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 6px;
    margin: 6px 0;
  }

  figcaption {
    padding: 10px 14px;
    font-size: 13px;
    color: var(--text-dim);
    font-family: "SF Mono", ui-monospace, Menlo, monospace;
    border-top: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }
  .badge {
    background: var(--accent);
    color: #1a0f04;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: inherit;
  }
</style>
</head>
<body>

<header>
  <h1>yt-visuals · gallery</h1>
  <p>${totalCount} clip${totalCount === 1 ? "" : "s"} across ${totalGroups} group${totalGroups === 1 ? "" : "s"} — cutaways are full-frame slides; overlays sit on top of screen recordings.</p>
  <div class="tools">
    <label><input type="checkbox" id="autoplay" /> autoplay on hover</label>
    <label><input type="checkbox" id="loopAll" checked /> loop</label>
    <button id="playAll">▶ play all</button>
    <button id="pauseAll">⏸ pause all</button>
  </div>
</header>

<main>
  ${overlaySectionsHtml}
  ${cutawaySectionsHtml}
</main>

<script>
  const videos = () => Array.from(document.querySelectorAll("video"));
  document.getElementById("playAll").onclick = () => videos().forEach((v) => v.play().catch(() => {}));
  document.getElementById("pauseAll").onclick = () => videos().forEach((v) => v.pause());
  document.getElementById("loopAll").onchange = (e) => videos().forEach((v) => (v.loop = e.target.checked));

  const autoplayBox = document.getElementById("autoplay");
  videos().forEach((v) => {
    v.addEventListener("mouseenter", () => { if (autoplayBox.checked) v.play().catch(() => {}); });
    v.addEventListener("mouseleave", () => { if (autoplayBox.checked) v.pause(); });
  });
</script>

</body>
</html>`;

writeFileSync(OUT, html);
console.log(`Wrote ${OUT}`);
console.log(`Cutaways: ${cutawayFiles.length} in ${sortedCutawayGroups.length} group(s)`);
console.log(`Overlays: ${overlayFiles.length} in ${sortedOverlayGroups.length} group(s)`);
console.log(`Open with:  open "${OUT}"`);
