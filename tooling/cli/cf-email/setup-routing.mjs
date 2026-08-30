#!/usr/bin/env node
// setup-routing.mjs — set up Cloudflare Email Routing (catch-all → a hub inbox) for a domain.
// Scalable: run once per niche domain. The hub address is verified ONCE at the account level
// (click the link Cloudflare emails); every later domain reuses it with zero clicks.
//
// Usage:
//   node setup-routing.mjs <domain> [hub-email]
//   node setup-routing.mjs bridebestie.com jessicap123k@gmail.com
//
// Needs: CF_API_TOKEN in pipelines/.env (or export CLOUDFLARE_API_TOKEN).
//   Scopes: Email Routing Addresses Read+Write [account], Email Routing Rules
//   Read+Write [zone], DNS Read+Write [zone], Zone Read + Zone Settings Write
//   [zone]; all zones + account. `personal-cloudflare-tk` already has these.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Credentials: env first, then pipelines/.env (the machine's source of truth).
// This used to also accept CF_GLOBAL_API_KEY + CF_API_EMAIL, because the scoped
// token could not reach /email/routing (settings). That fallback was removed on
// 2026-08-30: the Global API Key cannot be scoped or revoked independently — it
// is account-wide including billing — so keeping a copy of it on disk for one
// script was the single largest blast radius in the repo. The token
// `personal-cloudflare-tk` was widened instead (Zone Read + Zone Settings Write
// + Email Routing Rules/Addresses Read) and now covers every endpoint below.
// See decisions.md 2026-08-30.
const ENV_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../../pipelines/.env");
function fromEnvFile(key) {
  if (process.env[key]) return process.env[key];
  try {
    const m = readFileSync(ENV_FILE, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, "");
  } catch {}
  return null;
}
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || fromEnvFile("CF_API_TOKEN");
function authHeaders() {
  return { Authorization: `Bearer ${TOKEN}` };
}
const [, , domain, hubArg] = process.argv;
const HUB = hubArg || "jessicap123k@gmail.com";

if (!TOKEN) { console.error(`✗ No credentials. Set CF_API_TOKEN in ${ENV_FILE} (or export CLOUDFLARE_API_TOKEN).`); process.exit(1); }
if (!domain) { console.error("Usage: node setup-routing.mjs <domain> [hub-email]"); process.exit(1); }
console.log("auth: API token personal-cloudflare-tk");

const API = "https://api.cloudflare.com/client/v4";
async function cf(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success, status: res.status, json };
}
const errText = (r) => (r.json.errors || []).map((e) => `${e.code} ${e.message}`).join("; ") || `HTTP ${r.status}`;

// 1. Resolve zone + account
const z = await cf("GET", `/zones?name=${encodeURIComponent(domain)}`);
if (!z.ok || !z.json.result?.length) {
  console.error(`✗ Could not find zone "${domain}" on this account. (${errText(z)})`);
  console.error("  Is the token scoped to All Zones + this account? Is the domain on this Cloudflare account?");
  process.exit(1);
}
const zoneId = z.json.result[0].id;
const accountId = z.json.result[0].account.id;
console.log(`✓ Zone: ${domain}  (zone ${zoneId.slice(0, 8)}…, account ${accountId.slice(0, 8)}…)`);

// 2. Enable Email Routing.
// NOTE: Cloudflare's settings/enable/dns endpoints are NOT grantable to a scoped API token —
// they return 10000 even with Email Routing Rules:Edit. So enabling is dashboard-only (one click
// per domain) unless a full-access Global API Key is used. We detect that and instruct.
let needsDashboardEnable = false;
const status = await cf("GET", `/zones/${zoneId}/email/routing`);
if (status.ok && status.json.result?.enabled) {
  console.log("✓ Email Routing already enabled.");
} else {
  const en = await cf("POST", `/zones/${zoneId}/email/routing/enable`, { skip_wizard: true });
  if (en.ok) console.log("✓ Email Routing enabled (MX + SPF records provisioned).");
  else {
    needsDashboardEnable = true;
    console.log("• Can't enable via scoped token (Cloudflare blocks it). One dashboard click needed —");
    console.log(`  dash.cloudflare.com → ${domain} → Email → Email Routing → Enable (auto-adds MX/SPF).`);
  }
}

// 3. Ensure destination (hub) address exists at the account level (triggers verify email if new)
const addrs = await cf("GET", `/accounts/${accountId}/email/routing/addresses?per_page=50`);
const existing = (addrs.json.result || []).find((a) => a.email === HUB);
let verified = !!existing?.verified;
if (!existing) {
  const add = await cf("POST", `/accounts/${accountId}/email/routing/addresses`, { email: HUB });
  if (add.ok) console.log(`✓ Destination added: ${HUB} — Cloudflare just emailed it a verification link.`);
  else console.log(`• Could not add destination ${HUB}: ${errText(add)}`);
} else {
  console.log(`• Destination ${HUB} already on account (verified: ${verified}).`);
}

// 4. Catch-all rule → hub
const rule = await cf("PUT", `/zones/${zoneId}/email/routing/rules/catch_all`, {
  name: "catch-all → hub",
  enabled: true,
  matchers: [{ type: "all" }],
  actions: [{ type: "forward", value: [HUB] }],
});
if (rule.ok) console.log(`✓ Catch-all rule set: *@${domain} → ${HUB}`);
else console.log(`• Catch-all rule: ${errText(rule)}`);

console.log("\n" + "─".repeat(56));
if (needsDashboardEnable) {
  console.log(`⚙️  Enable Email Routing once in the dashboard for ${domain} (link above) — it adds the`);
  console.log(`   MX/SPF records. The destination + catch-all below are already handled by this script.`);
}
if (verified) {
  console.log(`✅ Done. Anything@${domain} now forwards to ${HUB}.`);
  console.log(`   Test: email hello@${domain} from anywhere → should arrive in ${HUB}.`);
} else {
  console.log(`⚠️  ONE manual step: open ${HUB} and click Cloudflare's "Verify" link.`);
  console.log(`   (Only needed once — every future niche reuses this verified hub with zero clicks.)`);
  console.log(`   After verifying, *@${domain} → ${HUB} goes live automatically.`);
}
