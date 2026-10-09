// serve.mjs — local UI for tutorial-pipeline-1

import { createServer } from "node:http";
import { readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import fsSync from "node:fs";

// --- Pure functions from plan ---

// Mirrors FOLDER_ID_RE in steps/010-resolve-drive-input-run/run.py.
export function parseFolderId(link) {
  const m = /\/folders\/([a-zA-Z0-9_-]+)/.exec(String(link || ""));
  return m ? m[1] : null;
}

// Mirrors TYPE_RE + video_title in steps/010-resolve-drive-input-run/run.py.
// "Some Tutorial @ g1" -> { title: "Some Tutorial", type: "g1", avatar: "girl-1" }
// A folder without the suffix is not renderable — 010 would reject it too.
const SLUGS = { g1: "girl-1", g2: "girl-2" };
export function parseTitleType(folderName) {
  const name = String(folderName || "");
  const m = /\s*@\s*(g1|g2)\s*$/i.exec(name);
  if (!m) return null;
  const type = m[1].toLowerCase();
  return { title: name.slice(0, m.index), type, avatar: SLUGS[type] };
}

// Decide how a job for this video should run.
//   "FRESH"  -> wipe every steps/*/output/, then run 010 -> 050.
//   "RESUME" -> run 040 -> 050 only.
//
// Why FRESH must wipe: steps 020/040/050 write files that are NOT namespaced by
// title (020 -> output/<seg>.wav, 040 -> output/videos/<seg>.mp4, 050 ->
// output/spokesperson_<seg>.mp4), and 040 deliberately SKIPS any .mp4 already
// present. Without a wipe, a job for video B reuses video A's renders and
// uploads them into B's Drive folder — silently, looking like success.
//
// Why RESUME exists: if 030 already submitted renders for this exact video, a
// re-run must NOT submit three more. Duplicate renders are the expensive,
// account-bound, ToS-grey action this whole pipeline is shaped to avoid. So a
// job whose 040 timed out is finished by re-running 040/050 only.
//
// The folder_id check closes the "two different videos, same title" hole: same
// title but a different source folder is a different video, so it's FRESH.
export function decideRunMode({ folderId, s010Manifest, s030ManifestExists }) {
  if (!s030ManifestExists) return "FRESH";        // nothing submitted yet
  if (!s010Manifest) return "FRESH";              // half-wiped/unknown state — don't trust it
  if (s010Manifest.folder_id !== folderId) return "FRESH";  // same title, DIFFERENT video
  return "RESUME";
}

// --- Runner Configuration ---

const ROOT = dirname(fileURLToPath(import.meta.url));
const PIPE = join(ROOT, "..");
const STEPS = join(PIPE, "steps");
const REPO = join(PIPE, "..", "..", "..");
const HEYGEN_CLI = join(REPO, "tooling/cli/heygen-web/heygen-web.mjs");
const DRIVE_CLI = join(REPO, "tooling/cli/drive/pp-drive");
const STEP_DIRS = {
  "010": join(STEPS, "010-resolve-drive-input-run"),
  "020": join(STEPS, "020-extract-audio-run"),
  "030": join(STEPS, "030-submit-avatar-renders-run"),
  "040": join(STEPS, "040-download-avatar-renders-run"),
  "050": join(STEPS, "050-package-and-upload-run"),
};
const ACCOUNT = "kushalbakliwal25@gmail.com";

const portFlag = process.argv.indexOf("--port");
const PORT = process.env.PORT || (portFlag > -1 && process.argv[portFlag + 1]) || 4371;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let job = null;  // { title, avatar, folderId, mode, status, lines: [], driveLink, startedAt, error }
let clients = [];

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    c.write(msg);
  }
}

function pushLine(line) {
  if (job) job.lines.push(line);
  broadcast({ type: "line", line });
}

async function startJob(link) {
  if (job && job.status === "running") throw new Error("Job already running");
  
  job = {
    status: "running",
    lines: [],
    driveLink: null,
    startedAt: Date.now()
  };
  broadcast({ type: "start" });
  
  try {
    const authRes = spawnSync("node", [HEYGEN_CLI, "auth-check"]);
    if (authRes.status !== 0) {
      throw new Error("HeyGen login expired — ask Kushal to refresh it");
    }

    const folderId = parseFolderId(link);
    if (!folderId) {
      throw new Error("That doesn't look like a Drive folder link — it should contain /folders/");
    }
    job.folderId = folderId;
    
    const driveRes = spawnSync(DRIVE_CLI, ["stat", folderId, "--account", ACCOUNT], { encoding: "utf8" });
    if (driveRes.status !== 0) {
      throw new Error(`Drive stat failed: ${driveRes.stderr.trim() || driveRes.stdout.trim()}`);
    }
    const [statId, statName, statMime] = driveRes.stdout.trim().split("\t");
    if (!statMime || statMime !== "application/vnd.google-apps.folder") {
      throw new Error("That link is a file, not a folder");
    }

    const parsed = parseTitleType(statName);
    if (!parsed) {
      throw new Error(`The folder must be named "<title> @ g1" or "<title> @ g2" — this one is "${statName}"`);
    }
    job.title = parsed.title;
    job.avatar = parsed.avatar;

    let s010Manifest = null;
    let s030ManifestExists = false;
    try {
      const mPath = join(STEP_DIRS["010"], "output", `${parsed.title}.input-manifest.json`);
      const data = await readFile(mPath, "utf8");
      s010Manifest = JSON.parse(data);
    } catch (e) {}
    try {
      const hPath = join(STEP_DIRS["030"], "output", `${parsed.title}.heygen-manifest.json`);
      s030ManifestExists = fsSync.existsSync(hPath);
    } catch (e) {}
    
    job.mode = decideRunMode({ folderId, s010Manifest, s030ManifestExists });
    
    const runStep = (stepName, args) => new Promise((resolve, reject) => {
      pushLine(`>> Running step ${stepName}...`);
      const child = spawn("python3", ["run.py", ...args], { cwd: STEP_DIRS[stepName] });
      let lastErr = "";
      
      let outBuf = "", errBuf = "";
      const processBuf = (chunk, buf, pushFn) => {
        buf += chunk.toString();
        let idx;
        while ((idx = buf.indexOf('\n')) !== -1) {
          pushFn(buf.slice(0, idx));
          buf = buf.slice(idx + 1);
        }
        return buf;
      };
      
      child.stdout.on("data", (chunk) => {
        outBuf = processBuf(chunk, outBuf, pushLine);
      });
      child.stderr.on("data", (chunk) => {
        errBuf = processBuf(chunk, errBuf, (line) => {
           pushLine(line);
           lastErr = line;
        });
      });
      
      child.on("close", (code) => {
        if (outBuf) pushLine(outBuf);
        if (errBuf) { pushLine(errBuf); lastErr = errBuf; }
        if (code === 0) resolve();
        else reject(new Error(lastErr || `Step ${stepName} exited with code ${code}`));
      });
    });

    if (job.mode === "FRESH") {
      pushLine("Mode: FRESH. Wiping output directories.");
      for (const step of ["010", "020", "030", "040", "050"]) {
        await rm(join(STEP_DIRS[step], "output"), { recursive: true, force: true });
      }
      
      await runStep("010", ["--drive-link", link, "--account", ACCOUNT]);
      
      const mPath = join(STEP_DIRS["010"], "output", `${parsed.title}.input-manifest.json`);
      if (!fsSync.existsSync(mPath)) {
        throw new Error("Internal: title mismatch between the UI and step 010 — tell Kushal");
      }
      
      await runStep("020", [parsed.title]);
      await runStep("030", [parsed.title]);
      await runStep("040", [parsed.title]);
      await runStep("050", [parsed.title, "--account", ACCOUNT]);
    } else {
      pushLine("Renders were already submitted for this video — picking up where it left off (not re-submitting).");
      await runStep("040", [parsed.title]);
      await runStep("050", [parsed.title, "--account", ACCOUNT]);
    }
    
    for (let i = job.lines.length - 1; i >= 0; i--) {
      const line = job.lines[i];
      const match = /(https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+)/.exec(line);
      if (match) {
        job.driveLink = match[1];
        break;
      }
    }
    job.status = "done";
    broadcast({ type: "done", status: "done", driveLink: job.driveLink });
  } catch (err) {
    let msg = String(err.message || err);
    if (msg.includes("missing") && msg.includes("run step 040 first")) {
       msg += " Some renders weren't finished in time. Press Start again in a few minutes — it will pick up the existing renders without re-submitting.";
    }
    pushLine(`ERROR: ${msg}`);
    job.status = "failed";
    job.error = msg;
    broadcast({ type: "done", status: "failed", error: msg });
  }
}

const pageHTML = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Avatar Renderer</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0d1117; color: #e6edf3; padding: 32px 20px 64px;
  }
  .wrap { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: #8b949e; font-size: 13px; margin: 0 0 24px; }
  .err { background: #3d1d1d; border: 1px solid #6e2b2b; color: #ffb4b4; padding: 12px 14px; border-radius: 8px; margin-bottom: 16px; display: none; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
  input[type="text"] { width: 100%; padding: 10px 14px; border: 1px solid #30363d; background: #0d1117; color: #e6edf3; border-radius: 6px; font-size: 15px; margin-bottom: 12px; }
  button { font: 600 14px inherit; padding: 8px 16px; border-radius: 6px; cursor: pointer; background: #238636; color: #fff; border: 1px solid #2ea043; }
  button:hover:not(:disabled) { background: #2ea043; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .info-row { display: flex; gap: 16px; margin-bottom: 16px; }
  .info-col { flex: 1; }
  .info-label { font-size: 12px; color: #8b949e; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
  .info-val { font-size: 15px; }
  #log { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; background: #010409; border: 1px solid #30363d; border-radius: 6px; padding: 12px; height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin-top: 16px; display: none; }
  #done-link { margin-top: 16px; font-size: 16px; display: none; }
  #done-link a { color: #4c8bf5; text-decoration: none; font-weight: 600; }
  #done-link a:hover { text-decoration: underline; }
</style>
</head>
<body><div class="wrap">
  <h1>Avatar Renderer</h1>
  <p class="sub">Paste the Drive folder link. The folder must be named like <code>My Tutorial @ g1</code>.</p>
  
  <div id="auth-err" class="err"></div>
  <div id="general-err" class="err"></div>
  
  <div class="card" id="input-card">
    <input type="text" id="link-input" placeholder="https://drive.google.com/drive/folders/..." />
    <button id="btn-check">Check folder</button>
  </div>
  
  <div class="card" id="run-card" style="display: none;">
    <div class="info-row">
      <div class="info-col">
        <div class="info-label">Title</div>
        <div class="info-val" id="val-title"></div>
      </div>
      <div class="info-col">
        <div class="info-label">Avatar</div>
        <div class="info-val" id="val-avatar"></div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap: 12px;">
      <button id="btn-run">Start render</button>
      <span id="run-status" style="color:#8b949e; font-size:13px; display:none;">Running... This takes 15–20 minutes. You can leave this tab open. <span id="run-time"></span></span>
    </div>
    <div id="done-link"><a href="#" target="_blank" rel="noopener">Open the output folder in Drive ↗</a></div>
  </div>
  
  <div id="log"></div>
</div>
<script>
let lastLink = "";
async function post(url, payload) {
  var res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  return res.json();
}
const el = (id) => document.getElementById(id);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function checkAuth() {
  const res = await fetch("/api/auth").then(r => r.json());
  if (!res.ok) {
    el("auth-err").textContent = "HeyGen login expired — ask Kushal to refresh it";
    el("auth-err").style.display = "block";
    el("btn-check").disabled = true;
    el("btn-run").disabled = true;
  }
}
checkAuth();

el("btn-check").addEventListener("click", async () => {
  el("general-err").style.display = "none";
  el("run-card").style.display = "none";
  const link = el("link-input").value.trim();
  if (!link) return;
  lastLink = link;
  
  el("btn-check").disabled = true;
  el("btn-check").textContent = "Checking...";
  const data = await post("/api/resolve", { link });
  el("btn-check").disabled = false;
  el("btn-check").textContent = "Check folder";
  
  if (data.error) {
    el("general-err").textContent = data.error;
    el("general-err").style.display = "block";
  } else {
    el("val-title").textContent = data.title;
    el("val-avatar").textContent = esc(data.avatar) + ' — from the "@ ' + esc(data.type) + '" in the folder name';
    el("run-card").style.display = "block";
    el("done-link").style.display = "none";
  }
});

let timer;
el("btn-run").addEventListener("click", async () => {
  el("btn-run").disabled = true;
  el("run-status").style.display = "inline-block";
  el("log").style.display = "block";
  el("log").textContent = "";
  el("done-link").style.display = "none";
  el("general-err").style.display = "none";
  
  const startT = Date.now();
  timer = setInterval(() => {
    const s = Math.floor((Date.now() - startT) / 1000);
    const m = Math.floor(s / 60);
    el("run-time").textContent = '(' + m + 'm ' + (s % 60) + 's)';
  }, 1000);
  
  const src = new EventSource("/api/events");
  src.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === "line") {
      el("log").textContent += data.line + "\\n";
      el("log").scrollTop = el("log").scrollHeight;
    } else if (data.type === "done") {
      src.close();
      clearInterval(timer);
      el("btn-run").disabled = false;
      el("run-status").style.display = "none";
      if (data.status === "failed") {
        el("general-err").textContent = data.error;
        el("general-err").style.display = "block";
      } else if (data.driveLink) {
        el("done-link").style.display = "block";
        el("done-link").querySelector("a").href = data.driveLink;
      }
    }
  };
  
  const data = await post("/api/run", { link: lastLink });
  if (data.error) {
    src.close();
    clearInterval(timer);
    el("btn-run").disabled = false;
    el("run-status").style.display = "none";
    el("general-err").textContent = data.error;
    el("general-err").style.display = "block";
  }
});
</script>
</body></html>`;

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
}

function startServer() {
  createServer(async (req, res) => {
    if (req.url === "/favicon.ico") {
    res.writeHead(204).end();
    return;
  }
  
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(pageHTML);
    return;
  }
  
  if (req.method === "GET" && req.url === "/api/auth") {
    const authRes = spawnSync("node", [HEYGEN_CLI, "auth-check"]);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: authRes.status === 0 }));
    return;
  }
  
  if (req.method === "POST" && req.url === "/api/resolve") {
    try {
      const payload = JSON.parse(await readBody(req));
      const folderId = parseFolderId(payload.link);
      if (!folderId) {
        throw new Error("That doesn't look like a Drive folder link — it should contain /folders/");
      }
      const driveRes = spawnSync(DRIVE_CLI, ["stat", folderId, "--account", ACCOUNT], { encoding: "utf8" });
      if (driveRes.status !== 0) {
        throw new Error(`Drive stat failed: ${driveRes.stderr.trim() || driveRes.stdout.trim()}`);
      }
      const [statId, statName, statMime] = driveRes.stdout.trim().split("\t");
      if (!statMime || statMime !== "application/vnd.google-apps.folder") {
        throw new Error("That link is a file, not a folder");
      }
      const parsed = parseTitleType(statName);
      if (!parsed) {
        throw new Error(`The folder must be named "<title> @ g1" or "<title> @ g2" — this one is "${statName}"`);
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ folderId, title: parsed.title, avatar: parsed.avatar, type: parsed.type }));
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  
  if (req.method === "POST" && req.url === "/api/run") {
    try {
      const payload = JSON.parse(await readBody(req));
      if (job && job.status === "running") {
        res.writeHead(409, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "A job is already running" }));
        return;
      }
      startJob(payload.link).catch(err => {
         console.error("Job threw uncaught error:", err);
      });
      res.writeHead(202, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }
  
  if (req.method === "GET" && req.url === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    clients.push(res);
    req.on("close", () => {
      clients = clients.filter((c) => c !== res);
    });
    if (job) {
      for (const line of job.lines) {
        res.write(`data: ${JSON.stringify({ type: "line", line })}\n\n`);
      }
      if (job.status !== "running") {
        res.write(`data: ${JSON.stringify({ type: "done", status: job.status, driveLink: job.driveLink, error: job.error })}\n\n`);
      }
    }
    return;
  }
  
  res.writeHead(404).end();
  }).listen(PORT, () => {
    console.log(`Avatar Renderer UI → http://localhost:${PORT}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
