#!/usr/bin/env node
// connect-arc.mjs — reuse your EXISTING Arc login (no re-login). Connect to Arc over its
// remote-debugging port, confirm the research account is logged into Pinterest, and save the
// session so the headless scraper can reuse it (Arc not needed after this).
//
// First, in a terminal (fully quit Arc with Cmd+Q first):
//   /Applications/Arc.app/Contents/MacOS/Arc --remote-debugging-port=9222 >/dev/null 2>&1 &
// Then:
//   node connect-arc.mjs
//
// Saves: ~/codebase/personal-stuff/pipelines/pinterest/.auth/pinterest-state.json  (gitignored)

import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const PORT = process.env.CDP_PORT || "9222";
const AUTH = path.join(os.homedir(), "codebase/personal-stuff/pipelines/pinterest/.auth/pinterest-state.json");
fs.mkdirSync(path.dirname(AUTH), { recursive: true });

let browser;
try {
  browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
} catch (e) {
  console.error(
    `Couldn't connect to Arc on port ${PORT}.\n` +
      `Quit Arc fully (Cmd+Q), then run:\n` +
      `  /Applications/Arc.app/Contents/MacOS/Arc --remote-debugging-port=${PORT} >/dev/null 2>&1 &\n` +
      `…and re-run this.`
  );
  process.exit(2);
}

const ctx = browser.contexts()[0];
if (!ctx) {
  console.error("Arc exposed no browser context. Make sure a window/tab is open in Arc.");
  await browser.close();
  process.exit(3);
}

// Make sure a Pinterest page exists so its cookies are live, then check we're logged in.
let page = ctx.pages().find((p) => p.url().includes("pinterest.com"));
if (!page) {
  page = await ctx.newPage();
  await page.goto("https://www.pinterest.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
}

const cookies = await ctx.cookies();
const hasSess = cookies.some((c) => c.name === "_pinterest_sess" && c.value && c.value.length > 20);
if (!hasSess) {
  console.error("Connected to Arc, but no Pinterest login found. Log into the research account in Arc, then re-run.");
  await browser.close(); // disconnects only — does NOT close your Arc
  process.exit(4);
}

await ctx.storageState({ path: AUTH });
console.log(`✓ Reused your Arc session. Saved to ${AUTH}`);
console.log("  You can quit the debug Arc now; future scrapes run headless.");
await browser.close(); // disconnects only — your Arc stays open
