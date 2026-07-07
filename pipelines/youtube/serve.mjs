// serve.mjs — zero-dependency local preview for yt-workflow.html.
//
//   node serve.mjs        (or via the local-apps-dashboard)
//   → open the printed http://localhost:PORT
//
// Reads the file live on every request — edit yt-workflow.html, refresh, see it.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const FILE = join(ROOT, "yt-workflow.html");
const PORT = process.env.PORT || 4341;

createServer(async (req, res) => {
  try {
    const html = await readFile(FILE, "utf8");
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(html);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(PORT, () => console.log(`yt-workflow preview → http://localhost:${PORT}  (Ctrl+C to stop)`));
