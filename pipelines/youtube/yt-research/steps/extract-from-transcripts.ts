import * as fs from "fs";
import * as path from "path";
import { getProvider } from "../providers/registry";
import { tasks } from "../config";
import { appendLog, readPrompt } from "./utils";

export async function extractFromTranscripts(
  nicheDir: string,
  softwares: string[]
): Promise<void> {
  const logPath = path.join(nicheDir, "output", "run-log.md");
  appendLog(logPath, "\n## [Step 3A: Transcript Extraction]\n");

  const transcriptsDir = path.join(nicheDir, "output", "transcripts");
  const extractionsDir = path.join(nicheDir, "output", "extractions");
  fs.mkdirSync(extractionsDir, { recursive: true });

  if (!fs.existsSync(transcriptsDir)) {
    const msg = "No transcripts found. Run Step 1 first.";
    appendLog(logPath, msg + "\n");
    console.error(msg);
    return;
  }

  const nicheMd = fs.readFileSync(path.join(nicheDir, "niche.md"), "utf-8");
  const promptTemplate = readPrompt("transcript-extraction");
  const ai = getProvider(tasks.transcriptExtraction);

  const transcriptFiles = fs
    .readdirSync(transcriptsDir)
    .filter((f) => f.endsWith(".md"));

  let processed = 0;
  let skipped = 0;
  const softwareMentions: Record<string, number> = {};
  softwares.forEach((s) => (softwareMentions[s] = 0));

  for (const file of transcriptFiles) {
    const videoId = path.basename(file, ".md");
    const outputPath = path.join(extractionsDir, `${videoId}.md`);

    // Incremental: skip if already extracted
    if (fs.existsSync(outputPath)) {
      skipped++;
      // Still count mentions from existing extractions
      const existing = fs.readFileSync(outputPath, "utf-8");
      for (const s of softwares) {
        if (existing.toLowerCase().includes(s.toLowerCase())) {
          softwareMentions[s]++;
        }
      }
      continue;
    }

    const transcriptContent = fs.readFileSync(
      path.join(transcriptsDir, file),
      "utf-8"
    );

    // Parse metadata from transcript header
    const lines = transcriptContent.split("\n");
    const publishDate =
      lines
        .find((l) => l.startsWith("Published:"))
        ?.replace("Published:", "")
        .trim() || "Unknown Date";

    const prompt = promptTemplate.replace("{{PUBLISH_DATE}}", publishDate);

    const userPrompt = `## Software List
${softwares.join("\n")}

## Niche Context
${nicheMd}

## Transcript
${transcriptContent}`;

    console.log(`Extracting from transcript: ${videoId}...`);

    try {
      const result = await ai.complete(prompt, userPrompt);

      fs.writeFileSync(
        outputPath,
        `Source Video: ${videoId}\n\n${result}\n`
      );
      processed++;

      // Count mentions
      for (const s of softwares) {
        if (result.toLowerCase().includes(s.toLowerCase())) {
          softwareMentions[s]++;
        }
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      console.warn(`  Failed: ${videoId} (${reason})`);
      appendLog(logPath, `Failed extraction for ${videoId}: ${reason}\n`);
    }
  }

  // Build mention summary
  const totalTranscripts = transcriptFiles.length;
  const mentionSummary = softwares
    .sort((a, b) => (softwareMentions[b] || 0) - (softwareMentions[a] || 0))
    .map((s) => `  ${s}: ${softwareMentions[s]}/${totalTranscripts}`);

  const lowData = softwares.filter((s) => (softwareMentions[s] || 0) <= 1);

  const summary = [
    `Processed: ${processed}/${transcriptFiles.length}`,
    skipped > 0 ? `Skipped (already exists): ${skipped}` : null,
    `\nSoftware mention frequency:`,
    ...mentionSummary,
    lowData.length > 0
      ? `\nWarning: Low data for: ${lowData.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  appendLog(logPath, summary + "\n");
  console.log(`\n${summary}`);
}
