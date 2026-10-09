import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import url from "node:url";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import { loadQueue, loadApproved, approveWord, wordCheckDir } from "../lib/word-check.mjs";

// Word pronunciation check: play every spoken option, approve one per word.
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const UI_DIST = path.join(HERE, "ui", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".wav": "audio/wav", ".json": "application/json" };

// The page's view of the queue: one entry per job, words pending first.
export function queueView({ dir = wordCheckDir(), respellPath } = {}) {
  const queue = loadQueue(dir);
  const approved = loadApproved(respellPath ? { dir, respellPath } : { dir });
  const jobs = Object.entries(queue.jobs).map(([job, { words }]) => ({
    job,
    words: words
      .map((w) => ({
        word: w.word,
        approved: w.approved ?? (w.reopened ? null : approved[w.word] ?? null),
        options: w.options.map((o) => ({ ...o, ready: fs.existsSync(path.join(dir, o.audio)) })),
      }))
      .sort((a, b) => Number(Boolean(a.approved)) - Number(Boolean(b.approved))),
  }));
  const pending = jobs.reduce((n, j) => n + j.words.filter((w) => !w.approved).length, 0);
  return { jobs, pending };
}

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

// Serves a file only if it resolves inside root.
function sendFile(res, root, rel) {
  const file = path.resolve(root, "." + path.posix.normalize("/" + rel));
  if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, { error: "not found" });
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}

export function createApp(opts = {}) {
  const dir = opts.dir || wordCheckDir();
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url, "http://x");
    if (req.method === "GET" && pathname === "/api/queue") return send(res, 200, queueView({ ...opts, dir }));
    if (req.method === "POST" && pathname === "/api/approve") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { word, spelling } = JSON.parse(body || "{}");
          const known = loadQueue(dir);
          const option = Object.values(known.jobs).flatMap((j) => j.words).find((w) => w.word === word)?.options.find((o) => o.spelling === spelling);
          if (!option) return send(res, 400, { error: "unknown word or option" });
          approveWord(word, spelling, { dir });
          send(res, 200, queueView({ ...opts, dir }));
        } catch (err) {
          send(res, 400, { error: err.message });
        }
      });
      return;
    }
    if (req.method === "GET" && pathname.startsWith("/audio/")) return sendFile(res, dir, pathname.slice(1));
    if (req.method === "GET") {
      if (!fs.existsSync(path.join(UI_DIST, "index.html"))) {
        return send(res, 503, "UI not built. Run: node serve.mjs --build", "text/plain");
      }
      return sendFile(res, UI_DIST, pathname === "/" ? "index.html" : pathname.slice(1));
    }
    send(res, 405, { error: "method not allowed" });
  });
}

const isMain = import.meta.url.startsWith("file:") && url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { port: { type: "string", default: process.env.PORT || "4371" }, build: { type: "boolean", default: false } },
  });
  if (values.build) {
    const ui = path.join(HERE, "ui");
    // Reinstall whenever the lock file changed, so a stale install never survives an update.
    const lock = fs.readFileSync(path.join(ui, "package-lock.json"));
    const hash = crypto.createHash("sha1").update(lock).digest("hex");
    const stamp = path.join(ui, "node_modules", ".word-check-lock");
    if (!fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== hash) {
      // shell: true so npm resolves to npm.cmd on Windows
      execSync("npm ci --no-audit --no-fund", { cwd: ui, stdio: "inherit", shell: true });
      fs.writeFileSync(stamp, hash);
    }
    execSync("npm run build", { cwd: ui, stdio: "inherit", shell: true });
  }
  createApp().listen(Number(values.port), "127.0.0.1", () => {
    console.log(`word pronunciation check: http://localhost:${values.port}`);
  });
}
