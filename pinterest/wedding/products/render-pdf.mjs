// render-pdf.mjs — turn a product HTML file into a print-ready PDF.
// Reuses the Playwright install from the pinterest-research skill (no separate npm install).
// Usage: node render-pdf.mjs <input.html> <output.pdf>
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";

const PW_BASE = "/Users/kbtg/codebase/personal stuff/claude-skills/pinterest-research/package.json";
const require = createRequire(PW_BASE);
const { chromium } = require("playwright");

const [, , htmlArg, outArg] = process.argv;
if (!htmlArg || !outArg) {
  console.error("Usage: node render-pdf.mjs <input.html> <output.pdf>");
  process.exit(1);
}
const htmlPath = path.resolve(htmlArg);
const outPath = path.resolve(outArg);

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  // Let webfonts settle.
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.pdf({
    path: outPath,
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log("PDF written:", outPath);
} finally {
  await browser.close();
}
