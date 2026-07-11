// Avatar/template registry — the single source of truth for friendly slugs → HeyGen ids.
// The map lives in pipelines/video/heygen/registry.json (the heygen asset hub); both this
// CLI and the youtube pipelines read that same file, so an id is defined once.
//
// Each entry: "<slug>": { avatar_id?: "...", template_id?: "...", description: "..." }
// A slug carries an avatar id OR a template id (or both) plus a human note.
//
// Workflows call resolveAvatar()/resolveTemplate() on any --avatar/--template value:
//   - a known slug resolves to its mapped id
//   - anything else is passed through unchanged (raw ids keep working — backward-compatible)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// The registry lives in the heygen asset hub (src/client/ -> repo root -> pipelines/video/heygen/).
// Override with HEYGEN_AVATARS.
export const REGISTRY_PATH =
  process.env.HEYGEN_AVATARS || resolve(__dirname, "../../../../../pipelines/video/heygen/registry.json");

export function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  } catch (e) {
    console.error(`⚠ could not parse avatar registry at ${REGISTRY_PATH}: ${e.message}`);
    return {};
  }
}

// Resolve a slug-or-id to an avatar id. Unknown value → returned as-is (treated as a raw id).
export function resolveAvatar(value) {
  if (!value) return value;
  const e = loadRegistry()[value];
  if (!e) return value;
  if (e.avatar_id) return e.avatar_id;
  console.error(`⚠ slug '${value}' has no avatar_id (it has a template_id) — did you mean --template?`);
  return value;
}

// Resolve a slug-or-id to a template id. Unknown value → returned as-is (treated as a raw id).
export function resolveTemplate(value) {
  if (!value) return value;
  const e = loadRegistry()[value];
  if (!e) return value;
  if (e.template_id) return e.template_id;
  console.error(`⚠ slug '${value}' has no template_id (it has an avatar_id) — did you mean --avatar?`);
  return value;
}
