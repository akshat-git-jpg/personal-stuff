import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load .env from myproj root
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { validate } from "./steps/validate";
import { fetchTranscripts } from "./steps/fetch-transcripts";
import { extractPricing } from "./steps/extract-pricing";
import { extractFromTranscripts } from "./steps/extract-from-transcripts";
import { buildProfiles } from "./steps/build-profiles";
import { buildComparative } from "./steps/build-comparative";

const ALL_STEPS = [
  "validate",
  "transcripts",
  "pricing",
  "extract",
  "profiles",
  "comparative",
] as const;

type StepName = (typeof ALL_STEPS)[number];

function parseArgs(): { niche: string; steps: StepName[] | null } {
  const args = process.argv.slice(2);
  let niche = "";
  let stepsRaw = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--niche" && args[i + 1]) {
      niche = args[i + 1];
      i++;
    } else if (args[i] === "--steps" && args[i + 1]) {
      stepsRaw = args[i + 1];
      i++;
    }
  }

  if (!niche) {
    console.error("Usage: npx ts-node run.ts --niche <niche-name> [--steps step1,step2,...]");
    console.error(`\nAvailable steps: ${ALL_STEPS.join(", ")}`);
    process.exit(1);
  }

  let steps: StepName[] | null = null;
  if (stepsRaw) {
    steps = stepsRaw.split(",").map((s) => s.trim()) as StepName[];
    for (const step of steps) {
      if (!ALL_STEPS.includes(step)) {
        console.error(`Unknown step: "${step}". Available: ${ALL_STEPS.join(", ")}`);
        process.exit(1);
      }
    }
  }

  return { niche, steps };
}

function loadSoftwares(nicheDir: string): string[] {
  const softwaresPath = path.join(nicheDir, "output", "softwares.txt");
  if (!fs.existsSync(softwaresPath)) {
    console.error("softwares.txt not found. Run validation first (default run or --steps validate).");
    process.exit(1);
  }
  return fs
    .readFileSync(softwaresPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function main() {
  const { niche, steps } = parseArgs();
  const nicheDir = path.join(__dirname, "niches", niche);

  if (!fs.existsSync(nicheDir)) {
    console.error(`Niche folder not found: ${nicheDir}`);
    process.exit(1);
  }

  const shouldRun = (step: StepName): boolean => {
    if (!steps) return true; // no --steps flag = run all
    return steps.includes(step);
  };

  // When running specific steps (except validate), we need the software list from a prior validation
  let softwares: string[] = [];

  if (shouldRun("validate")) {
    softwares = await validate(nicheDir);
  } else {
    softwares = loadSoftwares(nicheDir);
  }

  if (shouldRun("transcripts")) {
    await fetchTranscripts(nicheDir);
  }

  if (shouldRun("pricing")) {
    await extractPricing(nicheDir, softwares);
  }

  if (shouldRun("extract")) {
    await extractFromTranscripts(nicheDir, softwares);
  }

  if (shouldRun("profiles")) {
    await buildProfiles(nicheDir, softwares);
  }

  if (shouldRun("comparative")) {
    await buildComparative(nicheDir, softwares);
  }

  if (!steps) {
    console.log(`
═══════════════════════════════════════════════
Pipeline complete. Review these outputs:

  ${path.join(nicheDir, "output", "pricing-text/")}
  ${path.join(nicheDir, "output", "profiles/")}
  ${path.join(nicheDir, "output", "comparative-insights.md")}
  ${path.join(nicheDir, "output", "run-log.md")}

To generate the knowledge base, open Claude Code in this
directory and ask:

  "Synthesize the KB for niche ${niche}"

Claude Code will read the outputs above, apply
common/prompts/yt-research/kb-synthesis.md, and write:
  output/knowledge-base.md
  output/knowledge-base-compact.md
═══════════════════════════════════════════════`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message || err);
  process.exit(1);
});
