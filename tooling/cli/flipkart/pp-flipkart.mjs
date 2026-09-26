#!/usr/bin/env node
// pp-flipkart: read your own Flipkart order history, read-only, through a saved login.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { nextParams, parseOrders } from "./parse.mjs";

const PROFILE = process.env.PP_FLIPKART_PROFILE ?? path.join(os.homedir(), ".pp-flipkart", "chromium");
const ORDERS_PAGE = "https://www.flipkart.com/account/orders";
const API = "https://2.rome.api.flipkart.com/api/5/self-serve/orders/";
// Session cookies die when the browser closes, so the login is also kept here.
const STATE = path.join(path.dirname(PROFILE), "login.json");

const USAGE = `pp-flipkart <command>

  login                       open a browser window; log in with your phone and OTP once
  orders [--since YYYY-MM-DD] [--out FILE] [--table]
                              list orders newest first (JSON unless --table)
  status                      say whether the saved login still works`;

/** Playwright's own Chromium. Managed Chrome on a work Mac refuses custom profiles. */
function browserPath() {
  if (process.env.PP_FLIPKART_CHROME) return process.env.PP_FLIPKART_CHROME;
  const own = chromium.executablePath();
  if (fs.existsSync(own)) return own;
  const cache = process.platform === "darwin" ? path.join(os.homedir(), "Library/Caches/ms-playwright")
    : process.platform === "win32" ? path.join(os.homedir(), "AppData/Local/ms-playwright")
    : path.join(os.homedir(), ".cache/ms-playwright");
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    for (const rel of [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
      "chrome-win/chrome.exe", "chrome-win64/chrome.exe", "chrome-linux/chrome",
    ]) {
      const p = path.join(cache, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error("No Chromium found. Run: npx playwright install chromium");
}

async function open(headless) {
  fs.mkdirSync(PROFILE, { recursive: true });
  const exe = browserPath();
  // Headless Chrome says "HeadlessChrome" in its user agent; Flipkart's bot check drops that session.
  const ua = headless ? (await probeUA(exe)).replace("HeadlessChrome", "Chrome") : undefined;
  const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: exe, headless, viewport: null, userAgent: ua });
  if (fs.existsSync(STATE)) {
    const year = Date.now() / 1000 + 365 * 86400;
    const { cookies } = JSON.parse(fs.readFileSync(STATE, "utf8"));
    await ctx.addCookies(cookies.map((c) => (c.expires < 0 ? { ...c, expires: year } : c)));
  }
  return ctx;
}

async function probeUA(exe) {
  const b = await chromium.launch({ executablePath: exe, headless: true });
  try { return await (await b.newPage()).evaluate(() => navigator.userAgent); } finally { await b.close(); }
}

/** Load the orders page and return the first API response and the headers the site sent with it. */
async function firstPage(ctx, waitMs) {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const got = page.waitForResponse((r) => r.url().startsWith(API) && r.status() === 200, { timeout: waitMs });
  await page.goto(ORDERS_PAGE);
  const res = await got;
  const headers = await res.request().allHeaders();
  return { page, body: await res.json(), headers };
}

async function login() {
  const ctx = await open(false);
  console.error("A browser window is open. Log in with your phone number and OTP. It closes by itself once your orders load.");
  try {
    const { body } = await firstPage(ctx, 15 * 60e3);
    await ctx.storageState({ path: STATE });
    fs.chmodSync(STATE, 0o600);
    console.error(`Logged in. ${parseOrders(body).length} orders on the first page.`);
  } finally {
    await ctx.close();
  }
}

async function fetchOrders(since) {
  const ctx = await open(true);
  try {
    let first;
    try {
      first = await firstPage(ctx, 45e3);
    } catch {
      throw new Error("Not logged in, or Flipkart did not load. Run: pp-flipkart login");
    }
    const { page, headers } = first;
    const keep = Object.fromEntries(Object.entries(headers).filter(([k]) => /^x-|^accept$|^content-type$/i.test(k)));
    const out = [];
    let body = first.body;
    for (let n = 1; n <= 200; n++) {
      const orders = parseOrders(body);
      out.push(...orders);
      const next = nextParams(body);
      if (!next || !orders.length || (since && orders[orders.length - 1].time.slice(0, 10) < since)) break;
      const q = new URLSearchParams({ page: String(n + 1), order_before_time_stamp: next.ot, filterType: "PREORDER_UNITS", ...next });
      body = await page.evaluate(async ([url, h]) => {
        const r = await fetch(url, { credentials: "include", headers: h });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }, [`${API}?${q}`, keep]);
    }
    const seen = new Set();
    return out.filter((o) => !seen.has(o.id) && seen.add(o.id) && (!since || o.time.slice(0, 10) >= since));
  } finally {
    await ctx.close();
  }
}

function table(orders) {
  for (const o of orders) {
    console.log(`${o.time}  ₹${o.amount}  ${o.kind}  ${o.pay.join(" + ")}  ${o.id}`);
    for (const i of o.items) console.log(`    ${i.qty} × ${i.title}${i.size ? ` (${i.size})` : ""}  ₹${i.price}${i.status && i.status !== "Delivered" ? `  [${i.status}]` : ""}`);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === "login") return login();
  if (cmd === "status") {
    try {
      const ctx = await open(true);
      try { await firstPage(ctx, 45e3); console.log("logged in"); } finally { await ctx.close(); }
    } catch { console.log("not logged in: run pp-flipkart login"); process.exitCode = 1; }
    return;
  }
  if (cmd === "orders") {
    const since = flag("--since");
    if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error("--since takes YYYY-MM-DD");
    const orders = await fetchOrders(since);
    const outFile = flag("--out");
    if (outFile) {
      fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
      fs.writeFileSync(outFile, JSON.stringify({ fetched_at: new Date().toISOString(), orders }, null, 1));
      console.error(`${orders.length} orders written to ${outFile}`);
    }
    if (rest.includes("--table")) table(orders);
    else if (!outFile) console.log(JSON.stringify(orders, null, 1));
    return;
  }
  console.log(USAGE);
  if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 2;
}

main().catch((e) => { console.error(`pp-flipkart: ${e.message}`); process.exit(1); });
