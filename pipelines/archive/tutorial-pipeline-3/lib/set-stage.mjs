import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { checkStageMove } from "./state.mjs";
import { validateScript } from "./schema.mjs";

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: "string" },
    },
    allowPositionals: true,
  });

  const slug = positionals[0];
  const toStage = positionals[1];

  if (!slug || !toStage) {
    console.error("Usage: node lib/set-stage.mjs <slug> <toStage> [--root <dir>]");
    process.exit(1);
  }

  const root = values.root || process.cwd();
  const jsonPath = path.join(root, "videos", slug, "script.json");

  let script;
  try {
    script = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (err) {
    console.error(`Failed to read ${jsonPath}: ${err.message}`);
    process.exit(1);
  }

  const moveResult = checkStageMove(script, toStage);
  if (!moveResult.ok) {
    console.error("Stage move failed:");
    for (const err of moveResult.errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  if (toStage === "tts") {
    const valResult = validateScript(script, { stage: "polished" });
    if (!valResult.ok) {
      console.error("Stage 'tts' requires lint --stage polished to pass:");
      for (const err of valResult.errors) {
        console.error(`- ${err}`);
      }
      process.exit(1);
    }
  }

  script.stage = toStage;
  fs.writeFileSync(jsonPath, JSON.stringify(script, null, 2) + "\n", "utf8");
}
