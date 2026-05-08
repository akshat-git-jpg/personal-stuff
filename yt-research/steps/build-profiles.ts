import * as fs from "fs";
import * as path from "path";
import { getProvider } from "../providers/registry";
import { tasks } from "../config";
import { appendLog, readPrompt } from "./utils";

export async function buildProfiles(
  nicheDir: string,
  softwares: string[]
): Promise<void> {
  const logPath = path.join(nicheDir, "output", "run-log.md");
  appendLog(logPath, "\n## [Step 3B-Track1: Profile Building]\n");

  const extractionsDir = path.join(nicheDir, "output", "extractions");
  const pricingTextDir = path.join(nicheDir, "output", "pricing-text");
  const profilesDir = path.join(nicheDir, "output", "profiles");
  fs.mkdirSync(profilesDir, { recursive: true });

  const nicheMd = fs.readFileSync(path.join(nicheDir, "niche.md"), "utf-8");
  const geminiResearch = fs.readFileSync(
    path.join(nicheDir, "gemini-research.md"),
    "utf-8"
  );
  const prompt = readPrompt("profile-building");
  const ai = getProvider(tasks.profileBuilding);

  // Load all extractions
  const extractionFiles = fs.existsSync(extractionsDir)
    ? fs.readdirSync(extractionsDir).filter((f) => f.endsWith(".md"))
    : [];
  const allExtractions = extractionFiles.map((f) =>
    fs.readFileSync(path.join(extractionsDir, f), "utf-8")
  );

  const details: string[] = [];

  for (const software of softwares) {
    const outputPath = path.join(profilesDir, `${software}.md`);

    console.log(`Building profile: ${software}...`);

    // Gather per-software facts from all extractions
    const relevantFacts: string[] = [];
    for (const extraction of allExtractions) {
      // Check if this extraction mentions the software
      if (extraction.toLowerCase().includes(software.toLowerCase())) {
        relevantFacts.push(extraction);
      }
    }

    // Gather pricing text
    const pricingPath = path.join(pricingTextDir, `${software}.md`);
    const pricingText = fs.existsSync(pricingPath)
      ? fs.readFileSync(pricingPath, "utf-8")
      : "No pricing data available (no screenshots provided).";

    const userPrompt = `## Software: ${software}

## Niche Context
${nicheMd}

## Pricing Data (from screenshots — authoritative source)
${pricingText}

## Extracted Facts from ${relevantFacts.length} Transcripts
${relevantFacts.length > 0 ? relevantFacts.join("\n\n---\n\n") : "No transcript data available for this software."}

## Gemini Research (supplementary — lowest priority)
${geminiResearch}`;

    try {
      const result = await ai.complete(prompt, userPrompt);
      fs.writeFileSync(outputPath, result + "\n");
      details.push(
        `${software}: ${relevantFacts.length} transcript mentions + ${fs.existsSync(pricingPath) ? "pricing ✓" : "no pricing"}`
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      details.push(`${software}: FAILED (${reason})`);
      console.warn(`  Failed: ${software} (${reason})`);
    }
  }

  const summary = [
    `Profiles built: ${details.length}`,
    ...details.map((d) => `  ${d}`),
  ].join("\n");

  appendLog(logPath, summary + "\n");
  console.log(`\n${summary}`);
}
