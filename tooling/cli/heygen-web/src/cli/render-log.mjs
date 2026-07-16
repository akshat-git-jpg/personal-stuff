import { appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// HeyGen's shareable project URL is /videos/<title-slug>--<video_id> — the slug is the title
// lowercased with each run of non-alphanumerics collapsed to a dash, then a DOUBLE dash before
// the video_id. The double dash is load-bearing: a single dash 404s (verified 2026-07-16 against
// a real render: dustin-11e82ae7df844be8a5695ee864e44f49--e9c7314895eb4b31a591596b6efb33f7).
export function heygenLink(title, video_id) {
  const slug = String(title || "untitled-video").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `https://app.heygen.com/videos/${slug ? slug + "--" : ""}${video_id}`;
}

// Append one manifest row to the hub manifest (pipelines/video/heygen/RENDERS.md) after a
// successful submit. We store the HeyGen link (no download needed) as the record — the video
// lives on HeyGen, not in the repo or ~/kb-scratch. Logging must never break a render.
export function appendRenderLog({ output, avatar, audio = "-", video_id, title }) {
  try {
    const log =
      process.env.HEYGEN_RENDERS_LOG ||
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "pipelines", "video", "heygen", "RENDERS.md");
    if (!video_id || !existsSync(log)) return;
    const cell = output || `[heygen link](${heygenLink(title, video_id)})`;
    appendFileSync(log, `| ${cell} | ${avatar} | ${audio} | \`${video_id}\` |\n`);
  } catch {
    /* never throw from logging */
  }
}
