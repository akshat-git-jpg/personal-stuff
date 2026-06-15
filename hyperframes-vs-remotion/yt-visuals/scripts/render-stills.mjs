#!/usr/bin/env node
// Render a still PNG per scene for visual review. Uses the same plan.json.
// Outputs to: cutaways/<slug>/stills/

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const planPath = process.argv[2];
if (!planPath) {
  console.error("Usage: node scripts/render-stills.mjs plans/<slug>/plan.json");
  process.exit(1);
}
const plan = JSON.parse(readFileSync(path.resolve(process.cwd(), planPath), "utf-8"));

const TYPE_TO_COMP = {
  title: "Title",
  toc: "Toc",
  section: "Section",
  comparison: "Comparison",
  pricing: "Pricing",
  verdict: "Verdict",
  cta: "Cta",
};

// Frame to capture (settled state, after entrances complete).
const TYPE_TO_FRAME = {
  title: 240,
  toc: 200,
  section: 80,
  comparison: 290,
  pricing: 210,
  verdict: 130,
  cta: 160,
};

const slug = plan.slug;
const outDir = path.join(PROJECT_ROOT, "cutaways", slug, "stills");
mkdirSync(outDir, { recursive: true });
const remotionEntry = path.join(PROJECT_ROOT, "src", "index.ts");
const tmp = [];

for (let i = 0; i < plan.scenes.length; i++) {
  const scene = plan.scenes[i];
  const n = String(i + 1).padStart(2, "0");
  const name = `${n}-${scene.type}`;
  const outFile = path.join(outDir, `${name}.png`);
  const propsFile = path.join(outDir, `.props-${name}.json`);
  writeFileSync(propsFile, JSON.stringify(scene.data));
  tmp.push(propsFile);
  const frame = TYPE_TO_FRAME[scene.type] ?? 100;
  console.log(`→ Still ${name}.png at frame ${frame} ...`);
  const cmd = [
    "npx", "--no-install", "remotion", "still",
    JSON.stringify(remotionEntry),
    TYPE_TO_COMP[scene.type],
    JSON.stringify(outFile),
    `--frame=${frame}`,
    "--scale=0.5",
    `--props=${JSON.stringify(propsFile)}`,
    "--quiet",
  ].join(" ");
  execSync(cmd, { stdio: "inherit", cwd: PROJECT_ROOT });
}

for (const f of tmp) { try { rmSync(f); } catch { /* */ } }
console.log(`\n✓ Stills in ${outDir}`);
