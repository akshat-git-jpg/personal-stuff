#!/usr/bin/env node
// login.mjs — one-time: open a real Chromium, let the user log into Pinterest, then save the
// session (cookies + storage) so the headless scraper can reuse it. Run from the Mac.
//
// Usage:  node login.mjs
// Saves:  ~/codebase/personal-stuff/pipelines/pinterest/.auth/pinterest-state.json   (gitignored — it's a credential)

import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const AUTH = path.join(os.homedir(), "codebase/personal-stuff/pipelines/pinterest/.auth/pinterest-state.json");
fs.mkdirSync(path.dirname(AUTH), { recursive: true });

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("https://www.pinterest.com/login/", { waitUntil: "domcontentloaded" });

console.log("\n>>> A Chromium window opened. Log into your RESEARCH Pinterest account (The Digital Vault).");
console.log(">>> When you reach your home feed, this will auto-save the session and close.\n");

// Poll until logged in: session cookie present AND no longer on the /login page.
const deadline = Date.now() + 5 * 60 * 1000;
let ok = false;
while (Date.now() < deadline) {
  await page.waitForTimeout(2000);
  const cookies = await ctx.cookies();
  const hasSess = cookies.some((c) => c.name === "_pinterest_sess" && c.value && c.value.length > 20);
  const url = page.url();
  if (hasSess && !/\/login/.test(url)) {
    ok = true;
    break;
  }
}

if (!ok) {
  console.error("Timed out waiting for login (5 min). Re-run `node login.mjs` and finish logging in.");
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(1500);
await ctx.storageState({ path: AUTH });
console.log(`✓ Session saved to ${AUTH}`);
await browser.close();
