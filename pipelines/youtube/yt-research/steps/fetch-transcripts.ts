import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";
import { appendLog, parseVideoIds } from "./utils";

interface Json3Caption {
  events?: Array<{
    segs?: Array<{ utf8?: string }>;
  }>;
}

// Ensure pip3 --user install location is on PATH for spawned yt-dlp
const USER_PY_BIN = path.join(os.homedir(), "Library/Python/3.11/bin");
const YTDLP_ENV = {
  ...process.env,
  PATH: `${USER_PY_BIN}:${process.env.PATH || ""}`,
};

function runYtDlp(args: string[]): { status: number; stdout: string; stderr: string } {
  const res = spawnSync("yt-dlp", args, { encoding: "utf-8", env: YTDLP_ENV });
  return {
    status: res.status ?? -1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

interface VideoMetadata {
  title: string;
  uploadDate: string;
}

function fetchMetadata(videoId: string): VideoMetadata {
  const res = runYtDlp([
    "--skip-download",
    "--print",
    "%(title)s|%(upload_date)s",
    `https://www.youtube.com/watch?v=${videoId}`,
  ]);
  if (res.status !== 0) {
    throw new Error(`yt-dlp metadata failed: ${res.stderr.split("\n").slice(-3).join(" ").trim()}`);
  }
  const [title, uploadDate] = res.stdout.trim().split("|");
  const formatted =
    uploadDate && /^\d{8}$/.test(uploadDate)
      ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`
      : "Unknown Date";
  return { title: title || "Unknown Title", uploadDate: formatted };
}

const YTDLP_BASE_ARGS = [
  "--write-auto-subs",
  "--write-subs",
  "--skip-download",
  "--sub-lang",
  "en",
  "--sub-format",
  "json3",
  "--impersonate",
  "chrome-136:macos-15",
  "--cookies-from-browser",
  "chrome",
  "--retries",
  "5",
  "--retry-sleep",
  "linear=1:10",
  "--sleep-requests",
  "1",
  "--sleep-subtitles",
  "1",
];

const MAX_OUTER_ATTEMPTS = 3;

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchTranscript(videoId: string): Promise<string> {
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= MAX_OUTER_ATTEMPTS; attempt++) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yt-"));
    try {
      const res = runYtDlp([
        ...YTDLP_BASE_ARGS,
        "-o",
        path.join(tmpDir, "%(id)s.%(ext)s"),
        `https://www.youtube.com/watch?v=${videoId}`,
      ]);

      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json3"));
      if (files.length === 0) {
        const tail = res.stderr.split("\n").slice(-3).join(" ").trim();
        const is429 = /HTTP Error 429/i.test(tail);
        lastErr = new Error(
          `no subtitle file produced (exit ${res.status}): ${tail}`
        );
        if (is429 && attempt < MAX_OUTER_ATTEMPTS) {
          const backoffSec = 30 * attempt; // 30s, 60s
          console.warn(
            `    429 from YouTube, sleeping ${backoffSec}s (attempt ${attempt}/${MAX_OUTER_ATTEMPTS - 1})...`
          );
          await sleepMs(backoffSec * 1000);
          continue;
        }
        throw lastErr;
      }

    // Prefer manual en over en-* auto; fallback to the first file
    const manual = files.find((f) => /\.en\.json3$/.test(f));
    const chosen = manual || files[0];
    const raw = fs.readFileSync(path.join(tmpDir, chosen), "utf-8");
    const data = JSON.parse(raw) as Json3Caption;
    const text = (data.events || [])
      .map((e) => (e.segs || []).map((s) => s.utf8 || "").join(""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

      if (!text) throw new Error("parsed subtitle file was empty");
      return text;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  throw lastErr || new Error("fetchTranscript: exhausted retries");
}

export async function fetchTranscripts(nicheDir: string): Promise<void> {
  const logPath = path.join(nicheDir, "output", "run-log.md");
  appendLog(logPath, "\n## [Step 1: Fetch Transcripts]\n");

  // Sanity check yt-dlp is on PATH
  const check = spawnSync("yt-dlp", ["--version"], { encoding: "utf-8" });
  if (check.status !== 0) {
    const msg = "yt-dlp is not installed or not on PATH. Install via `brew install yt-dlp`.";
    appendLog(logPath, msg + "\n");
    console.error(msg);
    return;
  }

  const idsPath = path.join(nicheDir, "video-ids.md");
  const content = fs.readFileSync(idsPath, "utf-8");
  const videoIds = parseVideoIds(content);

  if (videoIds.length === 0) {
    const msg =
      "No valid video IDs found in video-ids.md. Expected a JSON array of 11-char IDs, or one ID per line.";
    appendLog(logPath, msg + "\n");
    console.error(msg);
    return;
  }

  const outputDir = path.join(nicheDir, "output", "transcripts");
  fs.mkdirSync(outputDir, { recursive: true });

  let fetched = 0;
  let skipped = 0;
  const failed: { id: string; reason: string }[] = [];

  for (const videoId of videoIds) {
    const outputPath = path.join(outputDir, `${videoId}.md`);

    // Incremental: skip if already fetched AND has non-empty body
    if (fs.existsSync(outputPath)) {
      const existing = fs.readFileSync(outputPath, "utf-8");
      const body = existing.split("---\n")[1]?.trim() || "";
      if (body.length > 0) {
        skipped++;
        continue;
      }
      // Empty body — re-fetch
    }

    try {
      console.log(`Fetching transcript: ${videoId}...`);
      const metadata = fetchMetadata(videoId);
      const transcriptText = await fetchTranscript(videoId);
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const fileContent = `Title: ${metadata.title}\nPublished: ${metadata.uploadDate}\nURL: ${url}\n---\n${transcriptText}\n`;
      fs.writeFileSync(outputPath, fileContent);
      fetched++;
      // Politeness delay between videos to avoid 429s
      await sleepMs(2000);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      failed.push({ id: videoId, reason });
      console.warn(`  Failed: ${videoId} (${reason})`);
    }
  }

  const summary = [
    `Fetched: ${fetched}/${videoIds.length}`,
    skipped > 0 ? `Skipped (already exists): ${skipped}` : null,
    failed.length > 0
      ? `Failed:\n${failed.map((f) => `  - ${f.id} (${f.reason})`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  appendLog(logPath, summary + "\n");
  console.log(`\n${summary}`);
}
