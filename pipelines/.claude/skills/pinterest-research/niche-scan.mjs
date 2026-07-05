#!/usr/bin/env node
// niche-scan.mjs — compare many candidate niches at once to find where to sell digital products.
// For each {niche, q}: search Pinterest, scrape result pins, then compute a SCORECARD:
//   demand (top save-velocity), monetization (% winners linking to product/shop pages),
//   enterability (% fresh <45d pins in the top + distinct-domain fragmentation).
// One browser, looped — efficient. Prints a JSON comparison sorted by a rough opportunity score.
//
// Usage:  node niche-scan.mjs [--rounds 3] [--top 25]

import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { collectPins, rankRecords } from "./lib/scrape.mjs";

const AUTH = path.join(os.homedir(), "codebase/personal-stuff/pipelines/pinterest/.auth/pinterest-state.json");
const OUTDIR = path.join(os.homedir(), "codebase/personal-stuff/pipelines/pinterest/_niche-scan");

// Candidate niches — one product-intent seed keyword + relevance tokens each.
const CANDIDATES = [
  { niche: "budget/finance", q: "budget planner printable", tokens: ["budget", "finance", "money", "saving", "debt"] },
  { niche: "wedding", q: "wedding planner printable", tokens: ["wedding", "bride", "bridal", "engaged"] },
  { niche: "resume/CV", q: "resume template", tokens: ["resume", "cv", "cover letter", "job"] },
  { niche: "teacher/homeschool", q: "homeschool printables", tokens: ["homeschool", "teacher", "worksheet", "classroom", "kids learning"] },
  { niche: "ADHD/productivity", q: "adhd planner printable", tokens: ["adhd", "productivity", "focus", "planner", "routine"] },
  { niche: "printable wall art", q: "printable wall art", tokens: ["wall art", "print", "poster", "decor", "gallery"] },
  { niche: "meal planning", q: "meal planner printable", tokens: ["meal", "menu", "grocery", "recipe", "food"] },
  { niche: "fitness planner", q: "workout planner printable", tokens: ["workout", "fitness", "gym", "exercise", "weight"] },
  { niche: "small biz templates", q: "small business planner", tokens: ["business", "etsy", "boutique", "entrepreneur", "shop"] },
  { niche: "self-care journal", q: "self care journal printable", tokens: ["self care", "journal", "wellness", "mental", "mood"] },
  { niche: "manifestation", q: "manifestation journal printable", tokens: ["manifest", "law of attraction", "affirmation", "abundance", "journal"] },
  { niche: "home/cleaning", q: "cleaning schedule printable", tokens: ["cleaning", "chore", "home", "organize", "household"] },
];

const argv = process.argv.slice(2);
let rounds = 3, top = 25;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--rounds") rounds = parseInt(argv[++i], 10) || 3;
  else if (argv[i] === "--top") top = parseInt(argv[++i], 10) || 25;
}

if (!fs.existsSync(AUTH)) {
  console.error(`No saved session at ${AUTH} — run connect-arc.mjs or login.mjs first.`);
  process.exit(2);
}
fs.mkdirSync(OUTDIR, { recursive: true });

function sanitizeState(file) {
  const st = JSON.parse(fs.readFileSync(file, "utf8"));
  const ok = new Set(["Strict", "Lax", "None"]);
  st.cookies = (st.cookies || [])
    .map((c) => {
      const o = { name: c.name, value: c.value, domain: c.domain, path: c.path || "/" };
      if (typeof c.expires === "number") o.expires = c.expires;
      if (typeof c.httpOnly === "boolean") o.httpOnly = c.httpOnly;
      if (typeof c.secure === "boolean") o.secure = c.secure;
      if (ok.has(c.sameSite)) o.sameSite = c.sameSite;
      return o;
    })
    .filter((c) => c.name && c.domain);
  return st;
}

const PRODUCT_HOST = /etsy\.com|gumroad|myshopify|shopify|stan\.store|payhip|creativemarket|teacherspayteachers|sellfy|ko-fi|beacons|\/shop|\/product|printabl/i;
const host = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const relevant = (r, tokens) => {
  const hay = (r.title + " " + r.description).toLowerCase();
  return tokens.some((t) => hay.includes(t));
};

async function scrape(ctx, q) {
  const page = await ctx.newPage();
  const raw = new Map();
  page.on("response", async (resp) => {
    try {
      if (!(resp.headers()["content-type"] || "").includes("application/json")) return;
      if (!/resource\//i.test(resp.url())) return;
      collectPins(await resp.json(), raw);
    } catch {}
  });
  await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  try {
    const initial = await page.evaluate(() => {
      const el = document.getElementById("__PWS_DATA__");
      return el ? JSON.parse(el.textContent) : null;
    });
    if (initial) collectPins(initial, raw);
  } catch {}
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
  }
  await page.close();
  return rankRecords(raw);
}

function scorecard(recs, tokens) {
  const rel = recs.filter((r) => relevant(r, tokens)).slice(0, top);
  const n = rel.length || 1;
  const withLink = rel.filter((r) => r.link);
  const productPins = rel.filter((r) => PRODUCT_HOST.test(r.link || ""));
  const fresh = rel.filter((r) => r.ageDays != null && r.ageDays <= 45);
  const vels = rel.map((r) => r.savesPerMonth).sort((a, b) => b - a);
  const median = vels.length ? vels[Math.floor(vels.length / 2)] : 0;
  const domains = new Set(withLink.map((r) => host(r.link)).filter(Boolean));
  return {
    relevantPins: rel.length,
    topVelocity: vels[0] || 0,
    medianVelocity: median,
    linkOutPct: Math.round((withLink.length / n) * 100),
    productLinkPct: Math.round((productPins.length / n) * 100),
    freshTopPct: Math.round((fresh.length / n) * 100),
    distinctDomains: domains.size,
    sampleProductLinks: productPins.slice(0, 3).map((r) => ({ title: r.title.slice(0, 60), link: r.link, savesPerMonth: r.savesPerMonth })),
    topPins: rel.slice(0, 5).map((r) => ({ title: r.title.slice(0, 70), savesPerMonth: r.savesPerMonth, ageDays: r.ageDays, link: r.link })),
  };
}

const t0 = Date.now();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: sanitizeState(AUTH) });

const results = [];
for (const c of CANDIDATES) {
  process.stderr.write(`[niche-scan] "${c.niche}" via "${c.q}"…\n`);
  let sc;
  try {
    const recs = await scrape(ctx, c.q);
    sc = scorecard(recs, c.tokens);
  } catch (e) {
    sc = { error: String(e).slice(0, 120) };
  }
  results.push({ niche: c.niche, keyword: c.q, ...sc });
  process.stderr.write(`[niche-scan]   topVel=${sc.topVelocity ?? "-"} productLink%=${sc.productLinkPct ?? "-"} fresh%=${sc.freshTopPct ?? "-"} domains=${sc.distinctDomains ?? "-"}\n`);
}
await browser.close();

// Rough opportunity score: demand (log velocity) + monetization + enterability (fresh + fragmentation).
const norm = (v, max) => Math.max(0, Math.min(1, v / max));
for (const r of results) {
  if (r.error) { r.score = 0; continue; }
  const demand = norm(Math.log10((r.medianVelocity || 0) + 1), Math.log10(50000));
  const money = norm(r.productLinkPct, 60);
  const enter = 0.5 * norm(r.freshTopPct, 50) + 0.5 * norm(r.distinctDomains, top);
  r.score = Math.round((0.4 * demand + 0.35 * money + 0.25 * enter) * 100);
}
results.sort((a, b) => b.score - a.score);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
const out = { tookSeconds: Number(secs), rounds, scannedAt: new Date().toISOString().slice(0, 10), ranked: results };
fs.writeFileSync(path.join(OUTDIR, `scan-${out.scannedAt}.json`), JSON.stringify(out, null, 2));
process.stderr.write(`[niche-scan] done in ${secs}s\n`);
console.log(JSON.stringify(out, null, 2));
