// Re-encode every MP4 under cutaways/ to Chromium-friendly H.264:
// yuv420p (TV range, not full-range yuvj420p), bt709 color, +faststart moov.
// Fixes "Unable to open ... Argument is `undefined` or `null`" in Cursor/VS Code
// video previews, which choke on yuvj420p.

import { execSync } from "node:child_process";
import { readdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CUTAWAYS = join(ROOT, "cutaways");
const FFMPEG = join(ROOT, "node_modules", "@remotion", "compositor-darwin-arm64", "ffmpeg");
const DYLD = join(ROOT, "node_modules", "@remotion", "compositor-darwin-arm64");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (entry.endsWith(".mp4")) out.push(p);
  }
  return out;
}

const files = walk(CUTAWAYS);
console.log(`Found ${files.length} mp4 file(s) to normalize.\n`);

let done = 0;
for (const file of files) {
  const tmp = file.replace(/\.mp4$/, ".__fix.mp4");
  process.stdout.write(`[${++done}/${files.length}] ${file.replace(CUTAWAYS + "/", "")}  ... `);
  try {
    execSync(
      `DYLD_LIBRARY_PATH="${DYLD}" "${FFMPEG}" -y -hide_banner -loglevel error -i "${file}" ` +
        `-c:v libx264 -preset veryfast -crf 18 ` +
        `-pix_fmt yuv420p -color_range tv ` +
        `-colorspace bt709 -color_primaries bt709 -color_trc bt709 ` +
        `-c:a aac -b:a 192k ` +
        `-movflags +faststart ` +
        `"${tmp}"`,
      { stdio: ["ignore", "ignore", "inherit"], shell: "/bin/zsh" }
    );
    unlinkSync(file);
    renameSync(tmp, file);
    console.log("ok");
  } catch (e) {
    console.log("FAILED");
    try { unlinkSync(tmp); } catch {}
    throw e;
  }
}

console.log(`\nNormalized ${done} file(s). They should now open in Cursor preview.`);
