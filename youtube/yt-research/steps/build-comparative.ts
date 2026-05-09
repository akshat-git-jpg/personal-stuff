import * as fs from "fs";
import * as path from "path";
import { getProvider } from "../providers/registry";
import { tasks } from "../config";
import { appendLog, readPrompt } from "./utils";

export async function buildComparative(
  nicheDir: string,
  softwares: string[]
): Promise<void> {
  const logPath = path.join(nicheDir, "output", "run-log.md");
  appendLog(logPath, "\n## [Step 3B-Track2: Comparative Insights]\n");

  const extractionsDir = path.join(nicheDir, "output", "extractions");
  const outputPath = path.join(nicheDir, "output", "comparative-insights.md");

  const nicheMd = fs.readFileSync(path.join(nicheDir, "niche.md"), "utf-8");
  const prompt = readPrompt("comparative-insights");
  const ai = getProvider(tasks.comparativeInsights);

  // Gather all comparative observation sections from extractions
  const extractionFiles = fs.existsSync(extractionsDir)
    ? fs.readdirSync(extractionsDir).filter((f) => f.endsWith(".md"))
    : [];

  const allComparativeData: string[] = [];
  for (const file of extractionFiles) {
    const content = fs.readFileSync(
      path.join(extractionsDir, file),
      "utf-8"
    );
    allComparativeData.push(content);
  }

  if (allComparativeData.length === 0) {
    const msg = "No extraction data found. Run Step 3A first.";
    appendLog(logPath, msg + "\n");
    console.error(msg);
    return;
  }

  console.log(
    `Building comparative insights from ${allComparativeData.length} extraction files...`
  );

  const userPrompt = `## Software List
${softwares.join("\n")}

## Niche Context
${nicheMd}

## Extracted Comparative Data from ${allComparativeData.length} Transcripts
${allComparativeData.join("\n\n---\n\n")}`;

  try {
    const result = await ai.complete(prompt, userPrompt);
    fs.writeFileSync(outputPath, result + "\n");

    const wordCount = result.split(/\s+/).length;
    const summary = `Comparative insights: generated from ${allComparativeData.length} transcripts (${wordCount} words)`;
    appendLog(logPath, summary + "\n");
    console.log(`\n${summary}`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    const msg = `Comparative insights FAILED: ${reason}`;
    appendLog(logPath, msg + "\n");
    console.error(msg);
  }
}
