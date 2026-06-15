// hyperframes-render — a small web tool that turns a pasted Hyperframes
// composition (HTML + GSAP) into an MP4, server-side, so the video editor
// never opens a terminal.
//
// How it renders:
//   • takes the pasted HTML and writes it as index.html in a temp project dir
//   • drops a hyperframes.json + meta.json beside it (makes it a HF project)
//   • runs `hyperframes render . -o output.mp4` (headless Chrome -> ffmpeg)
//   • parses "Capturing frame X/Y" from the CLI output to drive a progress bar
//
// This is the same idea as the older html-to-video tool, but the render engine
// is Hyperframes instead of the hand-rolled seekToFrame screenshot loop.
//
// Auth: a single shared password (APP_PASSWORD). Everything is gated behind it.

const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 8080;
const APP_PASSWORD = process.env.APP_PASSWORD || "changeme";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(16).toString("hex");
const HF_VERSION = process.env.HF_VERSION || "0.6.97";
const DEFAULT_FPS = parseInt(process.env.FPS || "30", 10);
const QUALITY = process.env.QUALITY || "high"; // draft | standard | high
const MAX_HTML_BYTES = 12 * 1024 * 1024;
// Folder of template cards for the Templates tab (auto-synced from the TY repo on
// the VPS). Each card is <type>/<card>/index.html. If it doesn't exist, the
// Templates tab just shows empty.
const CARDS_DIR = process.env.CARDS_DIR || "/cards";

const WORK_DIR = path.join(os.tmpdir(), "hyperframes-render");
fs.mkdirSync(WORK_DIR, { recursive: true });

// ---- template cards (Templates tab) ----
const CARD_IGNORE = new Set(["node_modules", "assets", "compositions", ".git"]);
function listCards() {
  const out = [];
  let types;
  try { types = fs.readdirSync(CARDS_DIR); } catch { return out; }
  for (const type of types) {
    const typeDir = path.join(CARDS_DIR, type);
    if (CARD_IGNORE.has(type) || !safeDir(typeDir)) continue;
    for (const card of fs.readdirSync(typeDir)) {
      const file = path.join(typeDir, card, "index.html");
      if (!safeFile(file)) continue;
      const html = fs.readFileSync(file, "utf8");
      const m = html.match(/<title>([^<]*)<\/title>/i);
      const pretty = card.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      out.push({ type, card, rel: `${type}/${card}/index.html`, title: (m && m[1].trim()) || pretty });
    }
  }
  return out.sort((a, b) => (a.type + a.card).localeCompare(b.type + b.card));
}
const safeDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const safeFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
// resolve a requested card rel to an absolute path inside CARDS_DIR (no traversal)
function cardPath(rel) {
  const abs = path.normalize(path.join(CARDS_DIR, rel || ""));
  if (!abs.startsWith(path.normalize(CARDS_DIR))) return null;
  return abs;
}
// preview-only script: loop the paused timeline so motion shows (never touches the file used to render)
const PLAY_SCRIPT =
  "<scr" + "ipt>(function(){function play(){var t=window.__timelines||{};" +
  "Object.keys(t).forEach(function(k){var tl=t[k];if(tl&&tl.play){tl.repeat(-1);tl.repeatDelay(0.8);tl.play();}});}" +
  "play();[100,400,900].forEach(function(d){setTimeout(play,d);});})();</scr" + "ipt>";

// ---- tiny auth (signed cookie) ----
const authToken = crypto.createHmac("sha256", SESSION_SECRET).update("ok").digest("hex");
function isAuthed(req) {
  return req.cookies && req.cookies.auth === authToken;
}
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "unauthorized" });
  return res.redirect("/login");
}

// ---- in-memory jobs ----
const jobs = new Map(); // id -> { status, frame, total, error, mp4, name }

// minimal Hyperframes project config written next to every render
const HYPERFRAMES_JSON = JSON.stringify({
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
});

async function runRender(job, html) {
  const dir = path.join(WORK_DIR, job.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(dir, "hyperframes.json"), HYPERFRAMES_JSON);
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ id: job.name || "video", name: job.name || "video" }),
  );

  // mov = transparent ProRes 4444 overlay (for compositing over footage in an editor);
  // mp4 = opaque full-screen card.
  const isMov = job.format === "mov";
  const out = path.join(dir, isMov ? "output.mov" : "output.mp4");
  job.out = out;
  job.ext = isMov ? "mov" : "mp4";
  job.status = "rendering";

  await new Promise((resolve) => {
    // `npx --yes` so the pinned Hyperframes is fetched/cached without a global install.
    const args = ["--yes", `hyperframes@${HF_VERSION}`, "render", ".", "-o", out, "--fps", String(DEFAULT_FPS)];
    // Transparent ProRes 4444 MOV (alpha) for overlays. Hyperframes renders alpha at
    // composition resolution (1920x1080) and rejects --quality/--resolution on the
    // alpha path, so only pass --quality for the opaque MP4 path.
    if (isMov) args.push("--format", "mov");
    else args.push("--quality", QUALITY);
    // Force the public npm registry so `npx hyperframes` resolves even when the
    // host npm is pointed at a private registry (e.g. a work CodeArtifact).
    const hf = spawn("npx", args, {
      cwd: dir,
      env: { ...process.env, npm_config_registry: "https://registry.npmjs.org/" },
    });

    let tail = "";
    const onChunk = (buf) => {
      const s = buf.toString();
      tail = (tail + s).slice(-2000);
      // CLI prints e.g. "Capturing frame 60/150 (5 workers)"
      const m = [...s.matchAll(/Capturing frame (\d+)\/(\d+)/g)].pop();
      if (m) {
        job.frame = parseInt(m[1], 10);
        job.total = parseInt(m[2], 10);
      }
      if (/Encoding video/i.test(s)) job.status = "encoding";
      if (/Assembling final video/i.test(s)) job.status = "encoding";
    };
    hf.stdout.on("data", onChunk);
    hf.stderr.on("data", onChunk);

    hf.on("error", (err) => {
      job.status = "error";
      job.error = "Could not start the renderer: " + err.message;
      resolve();
    });
    hf.on("close", (code) => {
      if (job.status === "error") return resolve();
      if (code === 0 && fs.existsSync(out)) {
        job.status = "done";
      } else {
        job.status = "error";
        // surface the most useful lint/render error lines back to the editor
        const lines = tail
          .split("\n")
          .filter((l) => /error|✗|invalid|not a|cannot|fail/i.test(l))
          .slice(-6)
          .join("\n")
          .trim();
        job.error = lines || `Render failed (exit ${code}). Check the HTML is a valid Hyperframes composition.`;
      }
      resolve();
    });
  });
}

// ---- app ----
const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));

app.get("/login", (req, res) => {
  if (isAuthed(req)) return res.redirect("/");
  res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});

app.post("/api/login", (req, res) => {
  if ((req.body.password || "") === APP_PASSWORD) {
    res.cookie("auth", authToken, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 3600 * 1000 });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Wrong password" });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("auth");
  res.json({ ok: true });
});

// start a render job
app.post("/api/render", requireAuth, (req, res) => {
  const html = req.body.html;
  const name = (req.body.name || "video").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.html?$/i, "");
  if (!html || typeof html !== "string") return res.status(400).json({ error: "No HTML provided" });
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) return res.status(400).json({ error: "HTML too large" });

  const format = req.body.format === "mov" ? "mov" : "mp4";
  const id = crypto.randomBytes(8).toString("hex");
  const job = { id, status: "queued", frame: 0, total: 0, name, format };
  jobs.set(id, job);
  runRender(job, html); // fire and forget
  res.json({ jobId: id });
});

// progress via Server-Sent Events
app.get("/api/progress/:id", requireAuth, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();

  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();

  const tick = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({
        status: job.status,
        frame: job.frame,
        total: job.total,
        error: job.error,
        downloadUrl: job.status === "done" ? `/api/download/${job.id}` : null,
      })}\n\n`,
    );
    if (job.status === "done" || job.status === "error") {
      clearInterval(tick);
      res.end();
    }
  }, 250);

  req.on("close", () => clearInterval(tick));
});

// download the finished file (mp4 or transparent mov)
app.get("/api/download/:id", requireAuth, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "done" || !job.out || !fs.existsSync(job.out)) return res.status(404).end();
  res.download(job.out, `${job.name}.${job.ext}`);
});

// ---- Templates tab: list cards + serve one card (raw for Copy, ?play for preview) ----
app.get("/api/cards", requireAuth, (req, res) => res.json(listCards()));

app.get("/api/card", requireAuth, (req, res) => {
  const abs = cardPath(req.query.rel);
  if (!abs || !safeFile(abs)) return res.status(404).end();
  let html = fs.readFileSync(abs, "utf8");
  if (req.query.play !== undefined) {
    html = html.includes("</body>") ? html.replace("</body>", PLAY_SCRIPT + "</body>") : html + PLAY_SCRIPT;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.end(html);
});

app.use(requireAuth, express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, () => console.log(`hyperframes-render listening on :${PORT}`));
