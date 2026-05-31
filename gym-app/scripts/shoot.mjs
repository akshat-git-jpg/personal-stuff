// scripts/shoot.mjs — "The Screenshot Loop"
//
// Capture a screenshot of the running app so the agent can SEE its work and
// self-correct iteratively. Uses puppeteer-core driving the system Chrome
// (no bundled Chromium download).
//
// Usage:
//   node scripts/shoot.mjs [url] [out] [--width=N] [--height=N] [--full] [--wait=ms] [--selector=".sel"]
//
// Defaults target a local dev server at a mobile viewport (this is a PWA).
//   node scripts/shoot.mjs                      -> http://localhost:5173 -> .shots/shot.png
//   node scripts/shoot.mjs http://localhost:8787/dashboard
//   node scripts/shoot.mjs http://localhost:5173 .shots/login.png --width=1280 --height=800
//
// The script ALSO prints any page console messages and errors, and exits
// non-zero if the page reported an uncaught error — so the loop can detect a
// broken render without a human looking at the image.

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// macOS system Chrome. Override with CHROME_PATH if needed.
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// --- arg parsing -----------------------------------------------------------
const argv = process.argv.slice(2);
const flags = Object.fromEntries(
  argv
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    }),
);
const positional = argv.filter((a) => !a.startsWith("--"));

const url = positional[0] || "http://localhost:5173";
const out = resolve(positional[1] || ".shots/shot.png");
const width = Number(flags.width ?? 390); // iPhone-ish default
const height = Number(flags.height ?? 844);
const fullPage = Boolean(flags.full);
const extraWait = Number(flags.wait ?? 0);
const selector = typeof flags.selector === "string" ? flags.selector : null;

mkdirSync(dirname(out), { recursive: true });

// --- capture ---------------------------------------------------------------
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 2 });

const consoleLines = [];
const pageErrors = [];
page.on("console", (msg) =>
  consoleLines.push(`[${msg.type()}] ${msg.text()}`),
);
page.on("pageerror", (err) => pageErrors.push(String(err)));
page.on("requestfailed", (req) =>
  pageErrors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText})`),
);

let navOk = true;
try {
  const resp = await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  if (resp && !resp.ok())
    pageErrors.push(`HTTP ${resp.status()} for ${url}`);
} catch (e) {
  navOk = false;
  pageErrors.push(`navigation failed: ${String(e)}`);
}

if (selector) {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });
  } catch {
    pageErrors.push(`selector not found: ${selector}`);
  }
}
if (extraWait > 0) await new Promise((r) => setTimeout(r, extraWait));

await page.screenshot({ path: out, fullPage });
await browser.close();

// --- report (machine-readable enough for the loop to act on) ---------------
console.log(`\n📸 ${url} -> ${out} (${width}x${height}${fullPage ? " full" : ""})`);
if (consoleLines.length) {
  console.log("\n--- page console ---");
  for (const l of consoleLines) console.log(l);
}
if (pageErrors.length) {
  console.log("\n--- ERRORS ---");
  for (const e of pageErrors) console.log(e);
}

const broken = !navOk || pageErrors.some((e) => !e.startsWith("[warn]"));
console.log(`\n${broken ? "❌ page reported errors" : "✅ clean render"}`);
process.exit(broken ? 1 : 0);
