#!/usr/bin/env node
// Download official colored brand logos for platforms referenced in a plan.json.
//
// Sources used (in priority order):
//   1. Simple Icons CDN — brand-colored monochrome SVGs (the brand's primary color baked in).
//      Covers ~80% of tech brands. URL: https://cdn.simpleicons.org/<slug>
//   2. Devicon (via jsDelivr) — multi-color SVGs for brands SI dropped due to trademark
//      complaints. URL: https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/<path>
//   3. Fallback to a styled text pill at render time (no file needed).
//
// Usage:
//   node scripts/fetch-logos.mjs --from-plan plans/<slug>/plan.json
//   node scripts/fetch-logos.mjs Hostinger Railway "Amazon AWS"

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOGOS_DIR = path.join(PROJECT_ROOT, "public", "logos");
mkdirSync(LOGOS_DIR, { recursive: true });

// Curated registry — platform display name → fetch instructions + filename slug.
// Keep filenames lowercase-kebab so the public/ path matches schema icons.
const REGISTRY = {
  "Hostinger":     { file: "hostinger.svg",     source: "simpleicons", arg: "hostinger" },
  "Railway":       { file: "railway.svg",       source: "simpleicons", arg: "railway" },
  "Render":        { file: "render.svg",        source: "simpleicons", arg: "render" },
  "DigitalOcean":  { file: "digitalocean.svg",  source: "simpleicons", arg: "digitalocean" },
  "Google Cloud":  { file: "googlecloud.svg",   source: "simpleicons", arg: "googlecloud" },
  "Fly.io":        { file: "flydotio.svg",      source: "simpleicons", arg: "flydotio" },
  "Hetzner":       { file: "hetzner.svg",       source: "simpleicons", arg: "hetzner" },
  "Netcup":        { file: "netcup.svg",        source: "simpleicons", arg: "netcup" },
  "Contabo":       { file: "contabo.svg",       source: "simpleicons", arg: "contabo" },
  "Coolify":       { file: "coolify.svg",       source: "simpleicons", arg: "coolify" },
  "Raspberry Pi":  { file: "raspberrypi.svg",   source: "simpleicons", arg: "raspberrypi" },
  "Synology":      { file: "synology.svg",      source: "simpleicons", arg: "synology" },

  // Simple Icons dropped these brands; use Devicon's colored variants instead.
  "Heroku":        { file: "heroku.svg",        source: "devicon", arg: "heroku/heroku-original.svg" },
  "Oracle Cloud":  { file: "oracle.svg",        source: "devicon", arg: "oracle/oracle-original.svg" },
  "Amazon AWS":    { file: "amazonaws.svg",     source: "devicon", arg: "amazonwebservices/amazonwebservices-line-wordmark.svg" },
};

const URL_BUILDER = {
  simpleicons: (arg) => `https://cdn.simpleicons.org/${arg}`,
  devicon: (arg) => `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${arg}`,
};

const args = process.argv.slice(2);
const planFlag = args.indexOf("--from-plan");
let names = [];
if (planFlag >= 0 && args[planFlag + 1]) {
  const planPath = path.resolve(process.cwd(), args[planFlag + 1]);
  const plan = JSON.parse(readFileSync(planPath, "utf-8"));
  for (const scene of plan.scenes) {
    if (scene.data?.platforms) {
      for (const p of scene.data.platforms) names.push(p.name);
    }
  }
} else {
  names = args.filter((a) => !a.startsWith("--"));
}
names = [...new Set(names)];

if (names.length === 0) {
  console.error(
    "Usage:\n  node scripts/fetch-logos.mjs --from-plan plans/<slug>/plan.json\n  node scripts/fetch-logos.mjs <Name> <Name>...\n\nRegistered names:\n  " +
      Object.keys(REGISTRY).join("\n  "),
  );
  process.exit(1);
}

const r = { ok: [], skip: [], missing: [], fail: [] };

for (const name of names) {
  const entry = REGISTRY[name];
  if (!entry) {
    r.missing.push(name);
    continue;
  }
  const outFile = path.join(LOGOS_DIR, entry.file);
  if (existsSync(outFile)) {
    r.skip.push(name);
    continue;
  }
  const url = URL_BUILDER[entry.source](entry.arg);
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      r.fail.push({ name, status: res.status, url });
      continue;
    }
    const text = await res.text();
    writeFileSync(outFile, text);
    r.ok.push(name);
  } catch (err) {
    r.fail.push({ name, error: String(err), url });
  }
}

if (r.ok.length) console.log(`✓ downloaded: ${r.ok.join(", ")}`);
if (r.skip.length) console.log(`◯ already present: ${r.skip.join(", ")}`);
if (r.missing.length) {
  console.log(`? not in registry: ${r.missing.join(", ")}`);
  console.log(`  -> add to REGISTRY in scripts/fetch-logos.mjs, or remove from plan.`);
}
if (r.fail.length) {
  console.log(`✗ fetch failed: ${r.fail.map((f) => `${f.name} (${f.status || f.error})`).join(", ")}`);
}
