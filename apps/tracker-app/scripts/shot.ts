/**
 * Ad-hoc screenshot of any board state — for quick design review.
 *
 *   npm run shot                         # Sean (admin), default output
 *   npm run shot -- sam                  # persona key or full email
 *   npm run shot -- riya docs/shots/review.png
 *   BASE=http://localhost:8787 npm run shot -- sam   # against wrangler instead of Vite
 *
 * Requires the dev server running (`npm run dev:local`) and a seeded local DB
 * (`npm run seed:local`).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PERSONAS: Record<string, string> = {
  sean: "seankerman25@gmail.com",
  sam: "kushalbakliwal25@gmail.com",
  anusha: "khushibakliwal125@gmail.com",
  john: "akshatpatidar17@gmail.com",
  tara: "tara@dev.local",
  uma: "uma@dev.local",
  riya: "riya@dev.local",
};

async function main() {
  const who = process.argv[2] ?? "sean";
  const email = PERSONAS[who] ?? who;
  const out = process.argv[3] ?? `docs/shots/board-${who}-${Date.now()}.png`;
  const BASE = process.env.BASE ?? "http://localhost:5173";

  mkdirSync(dirname(out), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  try {
    await page.goto(`${BASE}/dev-login?email=${encodeURIComponent(email)}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: out, fullPage: true });
    process.stdout.write(`${out}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
