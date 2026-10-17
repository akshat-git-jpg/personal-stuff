// Opens a running studio at several window sizes and fails if a pane is off screen or squeezed.
// Usage: node scripts/layout-check.mjs [base-url] [recipe/slug] [screenshot-dir]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const require = createRequire(path.join(REPO, 'pipelines/video/card-library/package.json'));
const puppeteer = require('puppeteer-core');
const { launchOptions } = await import(path.join(REPO, 'scripts/lib/chrome.mjs'));

const [base = 'http://localhost:4340', video = 'visuals-flow/test-01', shots] = process.argv.slice(2);
const SIZES = [[1000, 700], [1280, 800], [1440, 900], [1728, 1000], [2200, 1200], [390, 844]];
if (shots) fs.mkdirSync(shots, { recursive: true });

const browser = await puppeteer.launch(launchOptions());
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const failures = [];

for (const [w, h] of SIZES) {
  await page.setViewport({ width: w, height: h });
  await page.goto(`${base}/#/v/${video}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const r = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height, shown: getComputedStyle(el).display !== 'none' };
    };
    return {
      overflowX: document.documentElement.scrollWidth - innerWidth,
      vh: innerHeight, vw: innerWidth,
      player: box('.player'), stage: box('.stage'), script: box('.script'), comments: box('.comments'),
      parts: box('.parts'), timeline: box('.tl'), voice: box('canvas.wave'),
    };
  });
  const bad = (msg) => failures.push(`${w}x${h}: ${msg}`);
  if (r.overflowX > 0) bad(`page is ${r.overflowX}px wider than the window`);
  const desktop = w > 760;
  for (const name of ['player', 'script', 'comments', 'timeline']) {
    const b = r[name];
    if (!b) { bad(`${name} missing`); continue; }
    if (b.width < 200) bad(`${name} only ${Math.round(b.width)}px wide`);
    if (desktop && b.bottom > r.vh + 1) bad(`${name} ends at ${Math.round(b.bottom)}px, below the ${r.vh}px window`);
    if (desktop && b.right > r.vw + 1) bad(`${name} runs off the right edge`);
  }
  if (desktop && r.stage && r.stage.height < 150) bad(`player area only ${Math.round(r.stage.height)}px tall`);
  if (desktop && r.script && r.script.height < 120) bad(`script only ${Math.round(r.script.height)}px tall`);
  if (desktop && r.comments && r.comments.height < 150) bad(`comments only ${Math.round(r.comments.height)}px tall`);
  if (w >= 1100 && !r.parts?.shown) bad('parts list hidden on a wide window');
  if (shots) await page.screenshot({ path: path.join(shots, `layout-${w}x${h}.png`), fullPage: !desktop });
  console.log(`${w}x${h}`, desktop ? `stage ${Math.round(r.stage?.height)}px, timeline ends ${Math.round(r.timeline?.bottom)}/${r.vh}` : 'phone');
}
await browser.close();
if (errors.length) failures.push(`page errors: ${errors.join(' | ')}`);
if (failures.length) { console.error(`FAIL\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('layout ok at', SIZES.map((s) => s.join('x')).join(', '));
