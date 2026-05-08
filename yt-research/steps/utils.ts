import * as fs from "fs";
import * as path from "path";

export function appendLog(logPath: string, content: string): void {
  const dir = path.dirname(logPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(logPath, content);
}

export function readPrompt(promptName: string): string {
  const promptPath = path.join(__dirname, "..", "prompts", `${promptName}.md`);
  return fs.readFileSync(promptPath, "utf-8");
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function parseVideoIds(content: string): string[] {
  const trimmed = content.trim();

  // JSON array format: ["id1", "id2", ...]
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (x): x is string => typeof x === "string" && VIDEO_ID_RE.test(x)
        );
      }
    } catch {
      // fall through to line-based parsing
    }
  }

  // Line-based: one ID per line, `#` starts a comment
  return trimmed
    .split("\n")
    .map((line) => line.split("#")[0].trim())
    .filter((line) => VIDEO_ID_RE.test(line));
}
