import * as fs from "fs";
import * as path from "path";
import { getProvider } from "../providers/registry";
import { tasks } from "../config";
import { appendLog, readPrompt } from "./utils";

export async function extractPricing(
  nicheDir: string,
  softwares: string[]
): Promise<void> {
  const logPath = path.join(nicheDir, "output", "run-log.md");
  appendLog(logPath, "\n## [Step 2: Pricing Extraction]\n");

  const pricingDir = path.join(nicheDir, "pricing");
  const outputDir = path.join(nicheDir, "output", "pricing-text");
  fs.mkdirSync(outputDir, { recursive: true });

  const prompt = readPrompt("pricing-extraction");
  const ai = getProvider(tasks.pricingExtraction);

  let processed = 0;
  let skipped = 0;
  const noFolder: string[] = [];
  const details: string[] = [];

  for (const software of softwares) {
    const softwareDir = path.join(pricingDir, software);
    const outputPath = path.join(outputDir, `${software}.md`);

    // Check if pricing folder exists
    if (!fs.existsSync(softwareDir) || !fs.statSync(softwareDir).isDirectory()) {
      noFolder.push(software);
      continue;
    }

    // Incremental: skip if already extracted
    if (fs.existsSync(outputPath)) {
      skipped++;
      details.push(`${software}: skipped (already exists)`);
      continue;
    }

    // Find all images in the folder
    const files = fs.readdirSync(softwareDir);
    const images = files
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map((f) => path.join(softwareDir, f));

    if (images.length === 0) {
      noFolder.push(software);
      continue;
    }

    console.log(`Extracting pricing: ${software} (${images.length} screenshots)...`);

    try {
      const result = await ai.vision(
        `${prompt}\n\nSoftware: ${software}\nNumber of screenshots: ${images.length}`,
        images
      );

      fs.writeFileSync(outputPath, `# ${software} — Pricing\n\n${result}\n`);
      details.push(`${software}: ${images.length} screenshots → ${outputPath}`);
      processed++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      details.push(`${software}: FAILED (${reason})`);
      console.warn(`  Failed: ${software} (${reason})`);
    }
  }

  const summary = [
    `Processed: ${processed} softwares`,
    skipped > 0 ? `Skipped: ${skipped}` : null,
    noFolder.length > 0 ? `No pricing folder: ${noFolder.join(", ")}` : null,
    `Details:\n${details.map((d) => `  ${d}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  appendLog(logPath, summary + "\n");
  console.log(`\n${summary}`);
}
