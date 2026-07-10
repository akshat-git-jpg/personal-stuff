import { appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Append one manifest row to renders-log.md after a successful submit.
// The media itself lives outside the repo (~/kb-scratch/heygen-web-renders/);
// this log is the record. Logging must never break a render.
export function appendRenderLog({ output = "(pending download)", avatar, audio = "-", video_id }) {
  try {
    const log =
      process.env.HEYGEN_RENDERS_LOG ||
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "renders-log.md");
    if (!video_id || !existsSync(log)) return;
    appendFileSync(log, `| \`${output}\` | ${avatar} | ${audio} | \`${video_id}\` |\n`);
  } catch {
    /* never throw from logging */
  }
}
