import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { parseArgs } from "node:util";
import { lockSection } from "./state.mjs";

// Locks every section (or just `only`). Throws on the first failed precondition.
export function lockScript(script, { only } = {}) {
  const locked = [];
  const sections = script.sections.map((sec) => {
    if (only && sec.id !== only) return sec;
    if (sec.tts?.locked) return sec;
    const next = lockSection(sec);
    locked.push(sec.id);
    return next;
  });
  return { script: { ...script, sections }, locked };
}

const isMain =
  typeof process !== "undefined" &&
  import.meta.url.startsWith("file:") &&
  url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: "string", default: "." },
      only: { type: "string" },
    },
    allowPositionals: true,
  });

  const slug = positionals[0];
  if (!slug) {
    console.error("Usage: node lib/vo-lock.mjs <slug> [--root d] [--only s02]");
    process.exit(1);
  }

  const scriptPath = path.join(values.root, "videos", slug, "script.json");
  const script = JSON.parse(await fs.readFile(scriptPath, "utf8"));

  try {
    const { script: next, locked } = lockScript(script, { only: values.only });
    await fs.writeFile(scriptPath, JSON.stringify(next, null, 2) + "\n");
    console.log(`locked: ${locked.join(", ") || "(nothing new)"}`);
    const allLocked = next.sections.every((s) => s.tts?.locked);
    if (allLocked) {
      console.log(`all locked — run: node lib/set-stage.mjs ${slug} locked`);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
