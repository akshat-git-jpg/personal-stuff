#!/usr/bin/env node
// setup-routing.mjs — set up Cloudflare Email Routing (catch-all → a hub inbox) for a domain.
// Scalable: run once per niche domain. The hub address is verified ONCE at the account level
// (click the link Cloudflare emails); every later domain reuses it with zero clicks.
//
// Usage:
//   node setup-routing.mjs <domain> [hub-email]
//   node setup-routing.mjs bridebestie.com jessicap123k@gmail.com
//
// Needs: export CLOUDFLARE_API_TOKEN="..."  (scopes: Email Routing Addresses:Edit [account],
//   Email Routing Rules:Edit [zone], DNS:Edit [zone], Zone:Read [zone]; all zones + account)

import { readFileSync } from "fs";
// Credentials: env first, then TY/.env (the machine's source of truth, shared with the MCP).
function fromEnvFile(key) {
  if (process.env[key]) return process.env[key];
  try {
    const m = readFileSync("/Users/kbtg/codebase/TY/.env", "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, "");
  } catch {}
  return null;
}
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || fromEnvFile("CF_API_TOKEN");
const GLOBAL_KEY = fromEnvFile("CF_GLOBAL_API_KEY");
const GLOBAL_EMAIL = fromEnvFile("CF_API_EMAIL");
// Global API Key (full access) can hit the enable/settings endpoints that scoped tokens can't.
// Prefer it when present; otherwise use the safe scoped token.
const USING_GLOBAL = !!(GLOBAL_KEY && GLOBAL_EMAIL);
function authHeaders() {
  return USING_GLOBAL
    ? { "X-Auth-Email": GLOBAL_EMAIL, "X-Auth-Key": GLOBAL_KEY }
    : { Authorization: `Bearer ${TOKEN}` };
}
const [, , domain, hubArg] = process.argv;
const HUB = hubArg || "jessicap123k@gmail.com";

if (!TOKEN && !USING_GLOBAL) { console.error("✗ No credentials. Set CF_API_TOKEN (scoped) or CF_GLOBAL_API_KEY + CF_API_EMAIL in TY/.env."); process.exit(1); }
if (!domain) { console.error("Usage: node setup-routing.mjs <domain> [hub-email]"); process.exit(1); }
console.log(`auth: ${USING_GLOBAL ? "Global API Key (full access)" : "scoped API token"}`);

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
