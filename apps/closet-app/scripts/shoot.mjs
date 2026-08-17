// scripts/shoot.mjs — "The Screenshot Loop"
//
// Capture a screenshot of the running app so the agent can SEE its work and
// self-correct iteratively. Uses puppeteer-core driving the system Chrome
// (no bundled Chromium download).
//
// Usage:
//   node scripts/shoot.mjs [url] [out] [--width=N] [--height=N] [--full] [--wait=ms] [--selector=".sel"] [--click=".sel"]
//
// Defaults target a local dev server at a mobile viewport (this is a PWA).
//   node scripts/shoot.mjs                      -> http://localhost:5173 -> .shots/shot.png
//   node scripts/shoot.mjs http://localhost:8787/dashboard
//   node scripts/shoot.mjs http://localhost:5173 .shots/login.png --width=1280 --height=800
//
// The script ALSO prints any page console messages and errors, and exits
// non-zero if the page reported an uncaught error — so the loop can detect a
// broken render without a human looking at the image.
//
// `--click=".sel"` clicks an element after `--selector` resolves and before
// the shot — e.g. switching tabs in a logged-in SPA without a second script.
//
// `captureScreenshot()` below is also exported so another script (e.g. one
// that logs in and seeds fixture data first) can take several shots against
// the SAME authenticated page/browser instead of relaunching Chrome per shot.

import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// macOS system Chrome. Override with CHROME_PATH if needed.
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * Navigate `page` to `url`, optionally wait for/click a selector, then
 * screenshot to `out`. Returns a report; does not launch or close a browser.
 */
export async function captureScreenshot({
  page,
  url,
  out,
  width = 390,
  height = 844,
  fullPage = false,
  wait = 0,
  selector = null,
  click = null,
}) {
  mkdirSync(dirname(out), { recursive: true });
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  const consoleLines = [];
  const pageErrors = [];
  const onConsole = (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  const onPageError = (err) => pageErrors.push(String(err));
  const onRequestFailed = (req) =>
    pageErrors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText})`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);

  let navOk = true;
  try {
    const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // 304 Not Modified is a valid cache-revalidation response on a repeat
    // navigation, not a failure — only flag real client/server error statuses.
    if (resp && !resp.ok() && resp.status() !== 304) {
      pageErrors.push(`HTTP ${resp.status()} for ${url}`);
    }
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
  if (click) {
    try {
      await page.click(click);
      await new Promise((r) => setTimeout(r, 300));
    } catch {
      pageErrors.push(`click target not found: ${click}`);
    }
  }
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  await page.screenshot({ path: resolve(out), fullPage });

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onRequestFailed);

  const broken = !navOk || pageErrors.some((e) => !e.startsWith("[warn]"));
  return { out, consoleLines, pageErrors, navOk, broken };
}

function report({ url, out, width, height, fullPage, consoleLines, pageErrors, broken }) {
  console.log(`\n📸 ${url} -> ${out} (${width}x${height}${fullPage ? " full" : ""})`);
  if (consoleLines.length) {
    console.log("\n--- page console ---");
    for (const l of consoleLines) console.log(l);
  }
  if (pageErrors.length) {
    console.log("\n--- ERRORS ---");
    for (const e of pageErrors) console.log(e);
  }
  console.log(`\n${broken ? "❌ page reported errors" : "✅ clean render"}`);
}

// --- CLI entry point (only when run directly, not when imported) -----------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
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
  const out = positional[1] || ".shots/shot.png";
  const width = Number(flags.width ?? 390); // iPhone-ish default
  const height = Number(flags.height ?? 844);
  const fullPage = Boolean(flags.full);
  const wait = Number(flags.wait ?? 0);
  const selector = typeof flags.selector === "string" ? flags.selector : null;
  const click = typeof flags.click === "string" ? flags.click : null;

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const result = await captureScreenshot({ page, url, out, width, height, fullPage, wait, selector, click });
  await browser.close();

  report({ url, out, width, height, fullPage, ...result });
  process.exit(result.broken ? 1 : 0);
}
