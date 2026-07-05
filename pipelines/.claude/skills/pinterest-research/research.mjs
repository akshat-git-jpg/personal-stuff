#!/usr/bin/env node
// research.mjs — log in (via saved session), search Pinterest for keywords, scrape the result
// pins + their hidden engagement (saves, age), rank by velocity (saves/month), print compact JSON.
//
// Usage:
//   node research.mjs "keto dinner" "keto breakfast"          # ad-hoc keywords
//   node research.mjs --niche keto                            # read keywords from niche config
//   flags: --rounds N (scrolls per keyword, default 6) --top N (results printed, default 20)
//          --niche <name> (also sets output folder)
//
// Output: prints JSON to stdout (cheap for Claude to read) AND writes the full ranked list to
//         ~/codebase/personal-stuff/pipelines/pinterest/<niche>/research/<date>-<kw>.json

import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { collectPins, rankRecords } from "./lib/scrape.mjs";

const HOME = os.homedir();
const AUTH = path.join(HOME, "codebase/personal-stuff/pipelines/pinterest/.auth/pinterest-state.json");
const PROJ = path.join(HOME, "codebase/personal-stuff/pipelines/pinterest");

// ---- args ----
const argv = process.argv.slice(2);
let niche = null,
  rounds = 6,
  top = 20;
const keywords = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--niche") niche = argv[++i];
  else if (a === "--rounds") rounds = parseInt(argv[++i], 10) || 6;
  else if (a === "--top") top = parseInt(argv[++i], 10) || 20;
  else keywords.push(a);
}

if (!fs.existsSync(AUTH)) {
  console.error(`No saved session at ${AUTH}\nRun:  node "${path.join(import.meta.dirname, "login.mjs")}"  first.`);
  process.exit(2);
}

// If no keywords given, pull from the niche config's researchKeywords (fallback to the niche name).
if (!keywords.length && niche) {
  const cfgPath = path.join(PROJ, niche, "config.json");
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    if (Array.isArray(cfg.researchKeywords)) keywords.push(...cfg.researchKeywords);
  }
  if (!keywords.length) keywords.push(niche);
}
if (!keywords.length) {
  console.error('Give at least one keyword, e.g.  node research.mjs "keto dinner"');
  process.exit(2);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const date = new Date().toISOString().slice(0, 10);

async function scrapeKeyword(ctx, kw) {
  const page = await ctx.newPage();
  const raw = new Map();
  // Capture every JSON response the real app fetches while we scroll — robust to Pinterest's
  // exact request signing, since we let its own code make the calls and just read the bodies.
  page.on("response", async (resp) => {
    try {
      const ct = resp.headers()["content-type"] || "";
      if (!ct.includes("application/json")) return;
      const url = resp.url();
      if (!/resource\//i.test(url)) return;
      const json = await resp.json();
      collectPins(json, raw);
    } catch {}
  });

  const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(kw)}&rs=typed`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // Also harvest pins embedded in the initial page state (first results often aren't an XHR).
  try {
    const initial = await page.evaluate(() => {
      const grab = (k) => {
        try {
          const el = document.querySelector(`script#${k}`) || document.getElementById(k);
          return el ? JSON.parse(el.textContent) : window[k] || null;
        } catch {
          return null;
        }
      };
      return grab("__PWS_DATA__") || grab("__PWS_INITIAL_PROPS__") || window.__INITIAL_STATE__ || null;
    });
    if (initial) collectPins(initial, raw);
  } catch {}

  // Scroll to trigger pagination; each scroll loads another page of results we capture above.
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(1600);
  }
  await page.close();
  return rankRecords(raw);
}

// Cookies captured over CDP (e.g. from Arc) can carry fields Playwright's loader rejects
// ("Invalid cookie fields" — partitionKey, priority, sourcePort, odd sameSite). Keep only the
// fields newContext accepts.
function sanitizeState(file) {
  const st = JSON.parse(fs.readFileSync(file, "utf8"));
  const okSameSite = new Set(["Strict", "Lax", "None"]);
  st.cookies = (st.cookies || [])
    .map((c) => {
      const o = { name: c.name, value: c.value, domain: c.domain, path: c.path || "/" };
      if (typeof c.expires === "number") o.expires = c.expires;
      if (typeof c.httpOnly === "boolean") o.httpOnly = c.httpOnly;
      if (typeof c.secure === "boolean") o.secure = c.secure;
      if (okSameSite.has(c.sameSite)) o.sameSite = c.sameSite;
      return o;
    })
    .filter((c) => c.name && c.domain);
  return st;
}

const t0 = Date.now();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: sanitizeState(AUTH) });

const out = {};
for (const kw of keywords) {
  process.stderr.write(`[research] scraping "${kw}" (${rounds} scrolls)…\n`);
  const recs = await scrapeKeyword(ctx, kw);
  // Persist the full ranked list to the niche research folder.
  const dir = path.join(PROJ, niche || "_adhoc", "research");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${date}-${slug(kw)}.json`);
  fs.writeFileSync(file, JSON.stringify({ keyword: kw, scrapedAt: date, count: recs.length, pins: recs }, null, 2));
  out[kw] = { scraped: recs.length, file, top: recs.slice(0, top) };
  process.stderr.write(`[research]   ${recs.length} pins, top save-velocity: ${recs[0]?.savesPerMonth ?? 0}/mo\n`);
}

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(1);
process.stderr.write(`[research] done in ${secs}s\n`);

// Compact stdout for the caller to read (tokens-cheap): top N per keyword only.
console.log(JSON.stringify({ tookSeconds: Number(secs), keywords: out }, null, 2));
