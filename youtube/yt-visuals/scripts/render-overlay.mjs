// Render an overlay composition to alpha-channel WebM for the gallery preview,
// AND optionally ProRes 4444 .mov for the video editor.
//
// usage:
//   node scripts/render-overlay.mjs <compositionId> <output-slug> [--mov] [props.json]
//
// examples:
//   node scripts/render-overlay.mjs OverlaySectionProgressBar section-progress
//   node scripts/render-overlay.mjs OverlaySectionProgressBar section-progress --mov
//   node scripts/render-overlay.mjs OverlaySpotlight spotlight-center props.json

import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT_DIR = join(ROOT, "cutaways", "overlays");

const args = process.argv.slice(2);
const compId = args[0];
const slug = args[1];
const includeMov = args.includes("--mov");
const propsArg = args.find((a) => a.endsWith(".json"));

if (!compId || !slug) {
  console.error("usage: node scripts/render-overlay.mjs <compositionId> <output-slug> [--mov] [props.json]");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const remotionEntry = join(ROOT, "src", "index.ts");
const env = {
  ...process.env,
  NPM_CONFIG_USERCONFIG: "/dev/null",
  npm_config_registry: "https://registry.npmjs.org/",
};

function render({ ext, codecFlags }) {
  const out = join(OUT_DIR, `${slug}.${ext}`);
  const cmd = [
    "npx", "--no-install", "remotion", "render",
    JSON.stringify(remotionEntry),
    compId,
    JSON.stringify(out),
    ...codecFlags,
    "--image-format=png",
    propsArg ? `--props=${JSON.stringify(propsArg)}` : "",
    "--quiet",
  ].filter(Boolean).join(" ");
  console.log(`→ Rendering ${out.replace(ROOT + "/", "")} ...`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, env });
}

// WebM (VP8) with alpha — small file, browser-previewable, NLE-compatible.
render({
  ext: "webm",
  codecFlags: ["--codec=vp8", "--pixel-format=yuva420p"],
});

// ProRes 4444 .mov — bigger but highest editor compatibility (Premiere/Resolve/FCP).
if (includeMov) {
  render({
    ext: "mov",
    codecFlags: ["--codec=prores", "--prores-profile=4444"],
  });
}

console.log("\nDone. Rebuild gallery:  node scripts/build-gallery.mjs");
