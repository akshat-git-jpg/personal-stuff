import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Reproduces the monolith's two fillers exactly (studioRender's `fill` and `fillAudioTemplate`):
// string-replace every token, then JSON.parse.
export function fillTemplate(name, tokens) {
  let text = readFileSync(resolve(__dirname, name), "utf8");
  for (const [k, v] of Object.entries(tokens)) text = text.replaceAll(k, String(v));
  return JSON.parse(text);
}
