import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { getProvider } from "../providers/registry";
import { tasks } from "../config";
import { appendLog, parseVideoIds } from "./utils";

export async function validate(nicheDir: string): Promise<string[]> {
  const logPath = path.join(nicheDir, "output", "run-log.md");
  const timestamp = new Date().toISOString();
  appendLog(logPath, `\n# Run: ${timestamp}\n\n## [Step 0: Validation]\n`);

  // --- Hard checks ---
  const nicheMdPath = path.join(nicheDir, "niche.md");
  const videoIdsPath = path.join(nicheDir, "video-ids.md");
  const geminiResearchPath = path.join(nicheDir, "gemini-research.md");
  const pricingDir = path.join(nicheDir, "pricing");

  const errors: string[] = [];

  if (!fs.existsSync(nicheMdPath) || fs.readFileSync(nicheMdPath, "utf-8").trim() === "") {
    errors.push("niche.md is missing or empty");
  }
  if (!fs.existsSync(videoIdsPath) || fs.readFileSync(videoIdsPath, "utf-8").trim() === "") {
    errors.push("video-ids.md is missing or empty");
  }
  if (!fs.existsSync(geminiResearchPath) || fs.readFileSync(geminiResearchPath, "utf-8").trim() === "") {
    errors.push("gemini-research.md is missing or empty");
  }

  const pricingFolders: string[] = [];
  if (!fs.existsSync(pricingDir)) {
    errors.push("pricing/ folder is missing");
  } else {
    const entries = fs.readdirSync(pricingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const files = fs.readdirSync(path.join(pricingDir, entry.name));
        const images = files.filter((f) =>
          /\.(png|jpg|jpeg|webp)$/i.test(f)
        );
        if (images.length > 0) {
          pricingFolders.push(entry.name);
        }
      }
    }
    if (pricingFolders.length === 0) {
      errors.push("pricing/ has no subfolders with images");
    }
  }

  if (errors.length > 0) {
    const msg = `Validation FAILED:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    appendLog(logPath, msg + "\n");
    console.error(`\n${msg}\n\nFix the above issues and re-run.`);
    process.exit(1);
  }

  // --- AI evaluation ---
  const nicheMd = fs.readFileSync(nicheMdPath, "utf-8");
  const videoIdsContent = fs.readFileSync(videoIdsPath, "utf-8");
  const videoIdCount = parseVideoIds(videoIdsContent).length;
  const geminiResearch = fs.readFileSync(geminiResearchPath, "utf-8");
  const geminiWordCount = geminiResearch.split(/\s+/).length;

  const promptPath = path.join(__dirname, "..", "..", "..", "common", "prompts", "yt-research", "validation.md");
  const systemPrompt = fs.readFileSync(promptPath, "utf-8");

  const userPrompt = `## Niche Brief (niche.md)
${nicheMd}

## Input Summary
- YouTube video IDs count: ${videoIdCount}
- Gemini research word count: ${geminiWordCount}
- Pricing screenshot folders found: ${pricingFolders.join(", ") || "none"}

Please extract the software list and evaluate the inputs.`;

  const ai = getProvider(tasks.validation);
  console.log("Running validation...");
  const response = await ai.complete(systemPrompt, userPrompt);

  // Parse software list from response
  const softwaresMatch = response.match(
    /SOFTWARES:\n([\s\S]*?)(?=\nWARNINGS:)/
  );
  const warningsMatch = response.match(/WARNINGS:\n([\s\S]*?)$/);

  const softwares: string[] = [];
  if (softwaresMatch) {
    const lines = softwaresMatch[1].split("\n").map((l) => l.trim()).filter(Boolean);
    softwares.push(...lines);
  }

  if (softwares.length === 0) {
    const msg = "Could not extract software list from niche.md. Please ensure your niche.md lists the softwares clearly.";
    appendLog(logPath, msg + "\n");
    console.error(msg);
    process.exit(1);
  }

  // Save softwares.txt
  const outputDir = path.join(nicheDir, "output");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "softwares.txt"),
    softwares.join("\n") + "\n"
  );

  // Cross-check pricing folders
  const missingPricing = softwares.filter(
    (s) => !pricingFolders.includes(s)
  );

  // Parse warnings
  let warnings = "";
  if (warningsMatch) {
    warnings = warningsMatch[1].trim();
  }

  // Log and display
  const summary = [
    `Extracted ${softwares.length} softwares: ${softwares.join(", ")}`,
    `Pricing folders found for: ${pricingFolders.length}/${softwares.length}${missingPricing.length > 0 ? ` (missing: ${missingPricing.join(", ")})` : ""}`,
    `YouTube video IDs: ${videoIdCount}`,
    `Gemini research: ${geminiWordCount} words`,
  ];

  if (warnings && warnings !== "- None") {
    summary.push(`\nWarnings:\n${warnings}`);
  }

  const logMsg = summary.join("\n");
  appendLog(logPath, logMsg + "\n");
  console.log(`\n${logMsg}`);

  // Prompt user to continue
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question("\nPress enter to continue, or Ctrl+C to fix inputs... ", () => {
      rl.close();
      resolve();
    });
  });

  return softwares;
}
