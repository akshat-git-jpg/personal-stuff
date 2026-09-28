import fs from "node:fs";
import path from "node:path";
import url from "node:url";

// Shared map every voiceover gets; a video's own respell.json wins on a clash.
export const GLOBAL_RESPELL_PATH = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
  "respell.json"
);

function readMap(file) {
  if (!file || !fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadRespell(videoRespellPath, globalPath = GLOBAL_RESPELL_PATH) {
  return { ...readMap(globalPath), ...readMap(videoRespellPath) };
}
