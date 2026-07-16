// serve.mjs — a tiny zero-dependency viewer for the HeyGen render manifest.
//
//   node serve.mjs [--port 4361]
//   → open the printed http://localhost:4361
//
// Reads ../RENDERS.md LIVE on every page load and parses the "Videos generated"
// table into rows. Per render you can:
//   • open the HeyGen link (the "open ↗" link, new tab),
//   • set a Yes/No flag,
//   • rename the local display label (click the name and type).
//
// Yes/No and the custom name persist to selections.json (keyed by video_id), a
// git-tracked file next to this server — so choices survive restarts and are
// visible in the repo. We keep this in a sidecar file rather than rewriting
// RENDERS.md, because RENDERS.md is auto-appended by the render logger and two
// writers on one file would race. Renaming here is display-only — it does NOT
// change the video or its link on HeyGen.

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MANIFEST = process.env.HEYGEN_RENDERS_LOG || join(ROOT, "..", "RENDERS.md");
const SELECTIONS = join(ROOT, "selections.json");
const portFlag = process.argv.indexOf("--port");
const PORT = process.env.PORT || (portFlag > -1 && process.argv[portFlag + 1]) || 4361;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// selections.json is { "<video_id>": { choice?: "yes"|"no", name?: "custom label" } }.
async function readState() {
  try {
    const j = JSON.parse(await readFile(SELECTIONS, "utf8"));
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

// Set one field (choice|name) for a video_id, pruning empty entries so the file
// stays tidy. Returns the entry's current value for that field (or null).
async function setField(video_id, field, value) {
  const state = await readState();
  const entry = state[video_id] || {};
  const clean = typeof value === "string" ? value.trim() : "";
  if (field === "choice") {
    if (clean === "yes" || clean === "no") entry.choice = clean;
    else delete entry.choice;
  } else if (field === "name") {
    if (clean) entry.name = clean;
    else delete entry.name;
  }
  if (entry.choice || entry.name) state[video_id] = entry;
  else delete state[video_id];
  await writeFile(SELECTIONS, JSON.stringify(state, null, 2) + "\n");
  return entry[field] ?? null;
}

// Parse the markdown table under "## Videos generated". Each row is
//   | [heygen link](URL) | Avatar / template | Audio | `video_id` |
// Rows without a link (older filename-style rows) render as plain entries.
async function parseRenders() {
  let md;
  try {
    md = await readFile(MANIFEST, "utf8");
  } catch {
    return { rows: [], error: `Could not read ${MANIFEST}` };
  }
  const state = await readState();
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^##\s+Videos generated/i.test(l));
  const rows = [];
  if (start === -1) return { rows, error: null };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break; // next section ends the table
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    if (/^-+$/.test(cells[0].replace(/[:\s]/g, ""))) continue; // header separator
    if (/^(Output file|HeyGen link)$/i.test(cells[0])) continue; // header row
    const [outputCell, avatar, audio, idCell] = cells;
    const linkMatch = outputCell.match(/\]\((https?:\/\/[^)]+)\)/);
    const url = linkMatch ? linkMatch[1] : null;
    const video_id = (idCell.match(/`([^`]+)`/) || [, idCell])[1];
    const unbacktick = (s) => s.replace(/`/g, "");
    const entry = state[video_id] || {};
    rows.push({
      url,
      avatar: unbacktick(avatar), // the manifest's original label (the rename fallback)
      name: entry.name || unbacktick(avatar), // what we display
      renamed: !!entry.name,
      audio: unbacktick(audio),
      video_id,
      choice: entry.choice ?? null,
    });
  }
  return { rows, error: null };
}

const toggle = (video_id, choice) =>
  `<div class="toggle" data-vid="${esc(video_id)}">
     <button class="yn yes${choice === "yes" ? " on" : ""}" data-v="yes">Yes</button>
     <button class="yn no${choice === "no" ? " on" : ""}" data-v="no">No</button>
   </div>`;

const page = ({ rows, error }) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HeyGen renders</title>
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
  .err { background: #3d1d1d; border: 1px solid #6e2b2b; color: #ffb4b4; padding: 12px 14px; border-radius: 8px; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  li.row {
    display: flex; align-items: center; gap: 16px;
    background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px 16px;
  }
  li.row.yes { border-color: #2ea04366; }
  li.row.no { border-color: #6e768155; opacity: .6; }
  .info { flex: 1; min-width: 0; }
  .name {
    font-weight: 600; font-size: 15px; display: inline-block; max-width: 100%;
    padding: 1px 6px; margin: -1px -6px 2px; border-radius: 5px;
    border: 1px solid transparent; cursor: text; outline: none; word-break: break-word;
  }
  .name:hover { border-color: #30363d; }
  .name:focus { border-color: #4c8bf5; background: #0d1117; cursor: text; }
  .name.renamed { color: #d2a8ff; }
  .body {
    display: grid; grid-template-columns: 1fr auto; gap: 2px 16px; align-items: center;
    text-decoration: none; color: inherit; border-radius: 6px; padding: 4px 6px; margin: 0 -6px;
    transition: background .12s;
  }
  a.body:hover { background: #1c2230; }
  .body.dead { cursor: default; }
  .meta { color: #8b949e; font-size: 12.5px; grid-column: 1; }
  .vid { color: #6e7681; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; grid-column: 1; }
  .open { color: #4c8bf5; font-size: 13px; font-weight: 600; grid-row: 1 / span 2; white-space: nowrap; }
  .open.none { color: #6e7681; font-weight: 400; }
  .toggle { display: flex; gap: 6px; flex-shrink: 0; }
  .yn {
    font: 600 13px inherit; padding: 6px 14px; border-radius: 999px; cursor: pointer;
    background: transparent; color: #8b949e; border: 1px solid #30363d; transition: all .12s;
  }
  .yn:hover { border-color: #6e7681; color: #e6edf3; }
  .yn.yes.on { background: #2ea043; border-color: #2ea043; color: #fff; }
  .yn.no.on  { background: #b62324; border-color: #b62324; color: #fff; }
  footer { color: #6e7681; font-size: 12px; margin-top: 28px; }
</style></head>
<body><div class="wrap">
  <h1>HeyGen renders</h1>
  <p class="sub">${rows.length} render${rows.length === 1 ? "" : "s"} · click the name to rename · open ↗ opens it on HeyGen · Yes/No + names save to selections.json · reads RENDERS.md live</p>
  ${error ? `<p class="err">${esc(error)}</p>` : ""}
  <ul>
    ${rows
      .map((r) => {
        const body =
          `<span class="meta">${esc(r.audio)}</span>` +
          `<span class="vid">${esc(r.video_id)}</span>` +
          (r.url ? `<span class="open">open ↗</span>` : `<span class="open none">no link</span>`);
        const bodyEl = r.url
          ? `<a class="body" href="${esc(r.url)}" target="_blank" rel="noopener">${body}</a>`
          : `<div class="body dead">${body}</div>`;
        const nameEl =
          `<div class="name${r.renamed ? " renamed" : ""}" contenteditable="true" spellcheck="false" ` +
          `data-vid="${esc(r.video_id)}" data-orig="${esc(r.avatar)}">${esc(r.name)}</div>`;
        return (
          `<li class="row${r.choice ? " " + r.choice : ""}" data-row="${esc(r.video_id)}">` +
          `<div class="info">${nameEl}${bodyEl}</div>${toggle(r.video_id, r.choice)}</li>`
        );
      })
      .join("\n    ")}
  </ul>
  <footer>Source: ${esc(MANIFEST)} · choices+names: ${esc(SELECTIONS)}</footer>
</div>
<script>
async function post(url, payload) {
  var res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok ? res.json() : null;
}

// Yes/No toggle
document.querySelectorAll(".toggle").forEach(function (t) {
  t.querySelectorAll(".yn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var vid = t.dataset.vid;
      var value = btn.classList.contains("on") ? "" : btn.dataset.v; // click active = clear
      var data = await post("/set", { video_id: vid, value: value });
      if (!data) return;
      t.querySelector(".yes").classList.toggle("on", data.choice === "yes");
      t.querySelector(".no").classList.toggle("on", data.choice === "no");
      var row = document.querySelector('li[data-row="' + vid + '"]');
      row.classList.remove("yes", "no");
      if (data.choice) row.classList.add(data.choice);
    });
  });
});

// Inline rename: click the name, edit, Enter or blur to save. Empty reverts to
// the manifest's original label.
document.querySelectorAll(".name").forEach(function (el) {
  el.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") { el.textContent = el.dataset.current || el.textContent; el.blur(); }
  });
  el.addEventListener("focus", function () { el.dataset.current = el.textContent; });
  el.addEventListener("blur", async function () {
    var name = el.textContent.trim();
    var orig = el.dataset.orig;
    if (name === (el.dataset.current || "").trim()) return; // unchanged
    var data = await post("/set-name", { video_id: el.dataset.vid, name: name });
    if (!data) { el.textContent = el.dataset.current; return; }
    var effective = data.name || orig;
    el.textContent = effective;
    el.classList.toggle("renamed", !!data.name);
  });
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

createServer(async (req, res) => {
  if (req.url === "/favicon.ico") {
    res.writeHead(204).end();
    return;
  }
  if (req.method === "POST" && (req.url === "/set" || req.url === "/set-name")) {
    try {
      const payload = JSON.parse(await readBody(req));
      const { video_id } = payload;
      if (!video_id) throw new Error("missing video_id");
      if (req.url === "/set") {
        const choice = await setField(video_id, "choice", payload.value);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, video_id, choice }));
      } else {
        const name = await setField(video_id, "name", payload.name);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, video_id, name }));
      }
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }
  const data = await parseRenders();
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page(data));
}).listen(PORT, () => {
  console.log(`HeyGen renders viewer → http://localhost:${PORT}`);
});
