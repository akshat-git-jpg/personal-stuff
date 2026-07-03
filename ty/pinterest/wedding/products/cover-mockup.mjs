// cover-mockup.mjs — generate a Gumroad cover (1280x720 @2x) showing fanned real pages.
// Replaces the old typography-only cover.png renders: marketplace covers convert better
// when they SHOW the inside of the product.
//
// Usage: node cover-mockup.mjs <product-folder> <pdf> <title> <subtitle> <badge> <page,page,page>
// e.g.:  node cover-mockup.mjs ultimate-wedding-planner out/ultimate-wedding-planner.pdf \
//          "The Ultimate Wedding Planner" "Printable wedding planning workbook" "21 pages" 1,8,14
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

const PW_BASE = "/Users/kbtg/codebase/personal stuff/claude-skills/pinterest-research/package.json";
const require = createRequire(PW_BASE);
const { chromium } = require("playwright");

const [, , folderArg, pdfArg, title, subtitle, badge, pagesArg] = process.argv;
if (!pagesArg) {
  console.error("Usage: node cover-mockup.mjs <product-folder> <pdf> <title> <subtitle> <badge> <p1,p2,p3>");
  process.exit(1);
}
const folder = path.resolve(folderArg);
const defaultPdf = path.resolve(folder, pdfArg);
// Page spec: "8" (page of the default pdf) or "../other/out/x.pdf:3" (page of another pdf).
const pages = pagesArg.split(",").map((spec, i) => {
  const m = spec.match(/^(.*):(\d+)$/);
  return m
    ? { key: `x${i}`, pdf: path.resolve(folder, m[1]), page: Number(m[2]) }
    : { key: `x${i}`, pdf: defaultPdf, page: Number(spec) };
});

// 1. Render the chosen pages to PNGs in a temp dir.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cover-"));
for (const { key, pdf, page } of pages) {
  execFileSync("/opt/homebrew/bin/pdftoppm", [
    "-png", "-r", "120", "-f", String(page), "-l", String(page),
    pdf, path.join(tmp, key),
  ]);
}
const imgFor = ({ key }) => {
  const f = fs.readdirSync(tmp).find((f) => f.startsWith(`${key}-`) || f === `${key}.png`);
  return pathToFileURL(path.join(tmp, f)).href;
};

// 2. Compose the cover HTML (brand: cream/charcoal/blush/gold, Playfair + Lato).
const [pA, pB, pC] = pages;
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,500&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:1280px;height:720px;overflow:hidden;font-family:'Lato',sans-serif;color:#34302B;
       background:
         radial-gradient(circle at 12% 10%, rgba(197,138,134,.14), transparent 40%),
         radial-gradient(circle at 90% 92%, rgba(201,162,75,.16), transparent 44%),
         #FBF5F2;}
  .frame{position:absolute;inset:22px;border:1.5px solid rgba(201,162,75,.55);}
  .left{position:absolute;left:74px;top:0;bottom:0;width:480px;display:flex;flex-direction:column;justify-content:center;z-index:5;}
  .eyebrow{font-size:15px;letter-spacing:.34em;text-transform:uppercase;color:#C58A86;font-weight:700;}
  h1{font-family:'Playfair Display',serif;font-weight:600;font-size:54px;line-height:1.1;margin:18px 0 0;}
  h1 .it{font-style:italic;color:#C58A86;}
  .rule{height:2px;width:64px;background:#C9A24B;margin:24px 0;}
  .sub{font-size:19px;line-height:1.55;color:#6f6a62;max-width:30ch;}
  .badge{display:inline-flex;align-items:center;gap:8px;margin-top:30px;background:#C58A86;color:#fff;
         font-weight:700;font-size:16px;letter-spacing:.06em;padding:12px 26px;border-radius:40px;width:max-content;}
  .site{margin-top:18px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#6f6a62;}
  .fan{position:absolute;right:-30px;top:0;bottom:0;width:720px;}
  .fan img{position:absolute;width:330px;border-radius:6px;border:1px solid rgba(52,48,43,.12);
           box-shadow:0 30px 60px -25px rgba(52,48,43,.45);background:#fff;}
  .fan .p1{left:40px;top:90px;transform:rotate(-7deg);z-index:1;}
  .fan .p2{left:230px;top:140px;transform:rotate(2deg);z-index:2;}
  .fan .p3{left:120px;top:230px;transform:rotate(-2.5deg);z-index:3;box-shadow:0 40px 70px -25px rgba(52,48,43,.55);}
</style></head><body>
  <div class="frame"></div>
  <div class="left">
    <div class="eyebrow">Bride Bestie</div>
    <h1>${title.replace(/ (\w+)$/, ' <span class="it">$1</span>')}</h1>
    <div class="rule"></div>
    <div class="sub">${subtitle}</div>
    <div class="badge">${badge}</div>
    <div class="site">bridebestie.com</div>
  </div>
  <div class="fan">
    <img class="p1" src="${imgFor(pA)}">
    <img class="p2" src="${imgFor(pB)}">
    <img class="p3" src="${imgFor(pC)}">
  </div>
</body></html>`;

const htmlFile = path.join(tmp, "cover.html");
fs.writeFileSync(htmlFile, html);

// 3. Screenshot at 2x.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const out = path.join(folder, "cover.png");
  await page.screenshot({ path: out });
  console.log("Cover written:", out);
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
