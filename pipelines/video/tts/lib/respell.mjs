import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

// Shared map every voiceover gets; a video's own respell.json wins on a clash.
export const GLOBAL_RESPELL_PATH = path.join(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
  "respell.json"
);

// Where the word pronunciation check keeps its queue, audio and fresh approvals (outside git).
export function wordCheckDir() {
  return process.env.WORD_CHECK_DIR || path.join(os.homedir(), "kb-scratch", "video", "tts", "word-check");
}

// Approvals not yet promoted into GLOBAL_RESPELL_PATH. Used at once, committed later.
export function localApprovedPath(dir = wordCheckDir()) {
  return path.join(dir, "approved.json");
}

function readMap(file) {
  if (!file || !fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadRespell(videoRespellPath, globalPath = GLOBAL_RESPELL_PATH, localPath = localApprovedPath()) {
  return { ...readMap(globalPath), ...readMap(localPath), ...readMap(videoRespellPath) };
}
