#!/usr/bin/env node
// render.mjs — fill an HTML pin template with a JSON spec and export a 1000x1500 PNG.
// Usage: node render.mjs spec.json
//
// spec.json shape:
// {
//   "template": "listicle" | "photo-bar" | "free-guide" | "recipe-card",
//   "out": "/abs/path/image.png",
//   "data": {
//     "title": "7 High-Protein Keto Breakfasts",
//     "subtitle": "Under 10g carbs",            // optional eyebrow/sub
//     "items": ["Egg muffins", "..."],          // listicle only
//     "badge": "FREE GUIDE",                     // optional
//     "cta": "Grab the plan",                    // free-guide / recipe-card
//     "meta": ["12g protein", "5 min"],          // recipe-card chips (optional)
//     "handle": "@yourketohandle",
//     "palette": ["#1B4332", "#FFB703", "#FFFFFF"],
//     "headlineFont": "Poppins",
//     "bodyFont": "Inter",
//     "background": { "type": "css" }
//        | { "type": "image", "url": "https://..." }
//        | { "type": "stock", "query": "keto breakfast eggs avocado" }
//        | { "type": "ai", "prompt": "overhead keto breakfast plate, natural light" }
//   }
// }

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { pexelsSearch } from "./lib/stock.mjs";
import { pollinationsUrl } from "./lib/ai-image.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
function darken(hex, f = 0.45) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * (1 - f)));
  return `rgb(${r}, ${g}, ${b})`;
}

async function resolveBackground(bg) {
  if (!bg || bg.type === "css") return { kind: "css" };
  if (bg.type === "image" && bg.url) return { kind: "image", url: bg.url };
  if (bg.type === "ai") {
    return { kind: "image", url: pollinationsUrl(bg.prompt, { width: 1000, height: 1500 }) };
  }
  if (bg.type === "stock") {
    const urls = await pexelsSearch(bg.query);
    if (urls && urls.length) return { kind: "image", url: urls[0] };
    process.stderr.write("[render] stock lookup returned nothing (no PEXELS_API_KEY?), falling back to CSS\n");
    return { kind: "css" };
  }
  return { kind: "css" };
}

// Download each grid cell's AI image to <outDir>/cells/ sequentially (with retries) and
// rewrite cell.img to a local file:// path. Avoids the many-concurrent-request problem.
async function prefetchCells(spec, outDir) {
  const d = spec.data || {};
  if (spec.template !== "weekly-grid" || !Array.isArray(d.days)) return;
  const style =
    d.imgStyle ||
    "professional food photography, top-down, single dish on a plate, soft natural light, appetizing";
  const cellsDir = path.join(outDir, "cells");
  fs.mkdirSync(cellsDir, { recursive: true });
  // Flatten cells into a task list, then fetch in small concurrent batches (Pollinations
  // tolerates a few parallel requests; 28 sequential is too slow, 28 at once gets dropped).
  const tasks = [];
  d.days.forEach((day, di) =>
    (day.cells || []).forEach((cell, ci) => {
      if (!cell.img) tasks.push({ cell, dest: path.join(cellsDir, `${di}_${ci}.png`), seed: di * 4 + ci });
    })
  );
  // Cell image source: "stock" (Pexels — fast & reliable for many cells) or "ai"
  // (Pollinations). Default to stock when a PEXELS_API_KEY exists, else AI. Stock falls
  // back to AI per-cell if a dish has no good stock match.
  const source = d.cellSource || (process.env.PEXELS_API_KEY ? "stock" : "ai");
  // file:// images are blocked when the page is loaded via setContent (about:blank origin),
  // so embed cell images as base64 data URIs — they load regardless of origin.
  const toDataUri = (buf) => "data:image/png;base64," + buf.toString("base64");
  const grab = async (url, ms = 25000) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  };
  const fetchOne = async (t) => {
    if (fs.existsSync(t.dest) && fs.statSync(t.dest).size > 1000) {
      t.cell.img = toDataUri(fs.readFileSync(t.dest)); // reuse already-downloaded cell
      return true;
    }
    let buf = null;
    if (source === "stock") {
      try {
        const urls = await pexelsSearch(`${t.cell.name || "food"} food dish`);
        if (urls && urls.length) buf = await grab(urls[t.seed % urls.length]);
      } catch {}
    }
    // AI path (default, or fallback when stock found nothing)
    for (let attempt = 0; attempt < 2 && !buf; attempt++) {
      try {
        buf = await grab(pollinationsUrl(`${t.cell.name || "food"}, ${style}`, { width: 400, height: 320, seed: t.seed }));
      } catch {}
      if (!buf && attempt === 0) await new Promise((res) => setTimeout(res, 800));
    }
    if (buf) {
      fs.writeFileSync(t.dest, buf);
      t.cell.img = toDataUri(buf);
      return true;
    }
    return false;
  };
  const BATCH = 4;
  let done = 0;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const slice = tasks.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(fetchOne));
    done += slice.length;
    process.stderr.write(`[prefetch] ${done}/${tasks.length} (${results.filter(Boolean).length}/${slice.length} ok this batch)\n`);
  }
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error("Usage: node render.mjs spec.json");
    process.exit(1);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const data = spec.data || {};
  const tplFile = path.join(__dirname, "templates", `${spec.template}.html`);
  if (!fs.existsSync(tplFile)) {
    console.error(`Unknown template: ${spec.template} (looked in ${tplFile})`);
    process.exit(1);
  }

  // Resolve backdrop into either an image URL or a palette gradient.
  const pal = data.palette && data.palette.length ? data.palette : ["#1B4332", "#FFB703", "#FFFFFF"];
  const bg = await resolveBackground(data.background);
  data.bgImage = bg.kind === "image" ? bg.url : null;
  data.bgCss = `linear-gradient(150deg, ${pal[0]} 0%, ${darken(pal[0], 0.35)} 100%)`;
  data.palette = pal;

  const out = path.resolve(spec.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });

  // Grid templates have many cells; pre-fetch each cell image to disk sequentially (with
  // retries) so the browser loads instant local files instead of 28 slow/rate-limited
  // on-demand AI requests that would leave cells blank.
  await prefetchCells(spec, path.dirname(out));

  let html = fs.readFileSync(tplFile, "utf8");
  html = html.replace("__PIN_DATA__", JSON.stringify(data).replace(/</g, "\\u003c"));

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1500 },
    deviceScaleFactor: 2,
  });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  // Grow the viewport to the full pin height so NO cell is off-screen — Chromium defers
  // loading background images for off-screen elements, which would leave grid cells blank.
  const pinH = await page.evaluate(() => {
    const el = document.getElementById("pin");
    return el ? Math.ceil(el.getBoundingClientRect().height) : 1500;
  });
  await page.setViewportSize({ width: 1000, height: Math.min(Math.max(pinH, 1500), 6000) });
  // Wait for network to settle (fonts + backdrops). Resilient: grid pins can have many
  // slow AI images — if networkidle doesn't trigger in time, proceed and screenshot anyway.
  try {
    await page.waitForLoadState("networkidle", { timeout: spec.timeoutMs || 45000 });
  } catch {
    process.stderr.write("[render] networkidle not reached, proceeding to screenshot\n");
  }
  await page.waitForTimeout(spec.settleMs || 600);
  try {
    await page.evaluate(() => document.fonts && document.fonts.ready);
  } catch {}
  const pin = page.locator("#pin");
  await pin.screenshot({ path: out });
  await browser.close();

  console.log(`✓ rendered ${spec.template} -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
