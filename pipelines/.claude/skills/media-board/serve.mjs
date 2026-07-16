import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const KB_ROOT = arg("kb-root", process.env.MEDIA_KB_ROOT || path.join(os.homedir(), "kb-scratch/video"));
const REPO_ROOT = arg("repo-root", path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../.."));
const PORT = parseInt(arg("port", process.env.PORT || "4100"), 10);

const EXT = {
  video: [".mp4", ".mov", ".webm"],
  audio: [".mp3", ".wav", ".m4a"],
  image: [".png", ".jpg", ".jpeg", ".webp"],
};

export const sources = () => [
  { id: "heygen-outputs", hub: "heygen", kind: "outputs",    root: path.join(KB_ROOT, "heygen") },
  { id: "tts-outputs",    hub: "tts",    kind: "outputs",    root: path.join(KB_ROOT, "tts") },
  { id: "heygen-characters", hub: "heygen", kind: "references", root: path.join(REPO_ROOT, "pipelines/video/heygen/characters") },
  { id: "heygen-fal",     hub: "heygen", kind: "references", root: path.join(REPO_ROOT, "pipelines/video/heygen/fal-lipsync") },
  { id: "tts-references", hub: "tts",    kind: "references", root: path.join(REPO_ROOT, "pipelines/video/tts/references") },
];

export function scanSource(src) {
  const results = [];
  if (!fs.existsSync(src.root)) return results;

  const exts = Object.values(EXT).flat();
  const getExtType = (ext) => {
    for (const [type, typeExts] of Object.entries(EXT)) {
      if (typeExts.includes(ext.toLowerCase())) return type;
    }
    return null;
  };

  const walk = (dir, depth, group) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules" || entry.name === "venv") continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(src.root, fullPath);
      let nextGroup = group;
      if (depth === 1) {
        nextGroup = entry.isDirectory() ? entry.name : ".";
      }

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1, nextGroup);
      } else {
        const ext = path.extname(entry.name);
        if (exts.includes(ext.toLowerCase())) {
          let stat;
          try {
             stat = fs.statSync(fullPath);
          } catch { continue; }
          results.push({
            relPath,
            absPath: fullPath,
            name: entry.name,
            type: getExtType(ext),
            sizeBytes: stat.size,
            mtimeMs: stat.mtimeMs,
            group: depth === 1 ? "." : nextGroup,
          });
        }
      }
    }
  };
  
  walk(src.root, 1, ".");
  return results;
}

export function parseMdTables(md) {
  const rows = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^\s*\|/.test(lines[i]) || !/^\s*\|[\s|:-]+\|\s*$/.test(lines[i + 1])) continue;
    const cells = (l) => l.replace(/^\s*\||\|\s*$/g, "").split("|").map((c) => c.replace(/\*\*|`/g, "").trim());
    const headers = cells(lines[i]).map((h) => h.toLowerCase());
    for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const vals = cells(lines[j]);
      if (vals.every((v) => v === "")) continue;
      rows.push(Object.fromEntries(headers.map((h, k) => [h, vals[k] ?? ""])));
    }
  }
  return rows;
}

// The manifest join is filename-based; if manifests ever store duplicate basenames the join
// should switch to suffix-path matching (longest match wins).
export function manifestFor(files, manifestRows) {
  let unmatched = [...manifestRows];
  for (const file of files) {
    const rowIdx = unmatched.findIndex(row => {
      const outKey = Object.keys(row).find(k => k.includes("output file"));
      if (!outKey) return false;
      const val = row[outKey];
      return val.endsWith(file.name); // match by basename
    });
    if (rowIdx !== -1) {
      file.manifest = unmatched[rowIdx];
      unmatched.splice(rowIdx, 1);
    }
  }
  return unmatched;
}

export function safeResolve(root, rel) {
  const abs = path.resolve(root, rel);
  const normRoot = path.resolve(root) + path.sep;
  return abs.startsWith(normRoot) ? abs : null; // null → respond 403
}

export function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!m || (m[1] === "" && m[2] === "")) return null;
  const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] !== "" && m[2] !== "" ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : null;
}

function send(res, code, type, body) {
  res.writeHead(code, { "Content-Type": type });
  res.end(body);
}

function json(res, code, obj) {
  send(res, code, "application/json", JSON.stringify(obj));
}

function getMime(p) {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".webm": return "video/webm";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".m4a": return "audio/mp4";
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;

    if (p === "/") return send(res, 200, "text/html; charset=utf-8", PAGE);
    
    if (p === "/api/media") {
      let heygenRows = [];
      let ttsRows = [];
      try {
        const hMd = fs.readFileSync(path.join(REPO_ROOT, "pipelines/video/heygen/RENDERS.md"), "utf8");
        heygenRows = parseMdTables(hMd);
      } catch {}
      try {
        const tMd = fs.readFileSync(path.join(REPO_ROOT, "pipelines/video/tts/OUTPUTS.md"), "utf8");
        ttsRows = parseMdTables(tMd);
      } catch {}

      const srcs = sources();
      const resData = { sources: [], unmatched: [] };

      // The heygen "Videos generated" rows are now link-only (Avatar III is unlimited, so we
      // store the HeyGen link instead of downloading). Surface each as a link-card. Rows from
      // the "Avatars created" table (no link/output column) are skipped, not dumped as unmatched.
      const heygenLinkAssets = heygenRows
        .filter((r) => Object.keys(r).some((k) => /heygen link|output file/.test(k)))
        .map((r) => {
          const lk = Object.keys(r).find((k) => /heygen link|output file/.test(k));
          const cell = r[lk] || "";
          const m = cell.match(/\((https?:\/\/[^)]+)\)/);
          const url = m ? m[1] : (/^https?:\/\//.test(cell) ? cell : null);
          return {
            type: "link",
            name: r["avatar / template"] || r["avatar"] || r["video_id"] || "render",
            audio: r["audio"] || "",
            video_id: r["video_id"] || "",
            url,
            group: "renders · on HeyGen",
          };
        })
        .filter((a) => a.url);

      let pendingTts = ttsRows;
      for (const src of srcs) {
        const files = scanSource(src);
        if (src.hub === "heygen" && src.kind === "outputs") {
          files.push(...heygenLinkAssets); // link-only renders as cards
        } else if (src.hub === "tts" && src.kind === "outputs") {
          pendingTts = manifestFor(files, pendingTts);
        }
        resData.sources.push({ ...src, files });
      }
      resData.unmatched = pendingTts;
      return json(res, 200, resData);
    }

    if (p === "/file") {
      const srcId = url.searchParams.get("src");
      const relPath = url.searchParams.get("p");
      if (!srcId || !relPath) return send(res, 400, "text/plain", "bad request");

      const src = sources().find(s => s.id === srcId);
      if (!src) return send(res, 404, "text/plain", "source not found");

      const abs = safeResolve(src.root, relPath);
      if (!abs) return send(res, 403, "text/plain", "forbidden");
      if (!fs.existsSync(abs)) return send(res, 404, "text/plain", "not found");

      let stat;
      try { stat = fs.statSync(abs); } catch { return send(res, 500, "text/plain", "stat error"); }

      const rangeHeader = req.headers.range;
      const size = stat.size;
      const mime = getMime(abs);

      if (!rangeHeader) {
        res.writeHead(200, {
          "Content-Length": size,
          "Content-Type": mime,
          "Accept-Ranges": "bytes",
        });
        return fs.createReadStream(abs).pipe(res);
      } else {
        const range = parseRange(rangeHeader, size);
        if (!range) return send(res, 416, "text/plain", "invalid range");
        res.writeHead(206, {
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
          "Content-Length": range.end - range.start + 1,
          "Content-Type": mime,
          "Accept-Ranges": "bytes",
        });
        return fs.createReadStream(abs, { start: range.start, end: range.end }).pipe(res);
      }
    }

    if (p === "/api/reveal" && req.method === "POST") {
      let body = "";
      req.on("data", c => (body += c));
      req.on("end", () => {
        try {
          const { src: srcId, p: relPath } = JSON.parse(body);
          const src = sources().find(s => s.id === srcId);
          if (!src) return json(res, 404, { error: "not found" });
          const abs = safeResolve(src.root, relPath);
          if (!abs) return json(res, 403, { error: "forbidden" });
          execFile("open", ["-R", abs], (err) => {
            if (err) return json(res, 500, { error: "open failed" });
            json(res, 200, { ok: true });
          });
        } catch (e) {
          json(res, 400, { error: "bad request" });
        }
      });
      return;
    }

    send(res, 404, "text/plain", "not found");
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Media board → http://localhost:${PORT}`);
  });
}

const PAGE = /* html */ `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🎬 Media Board</title>
<style>
  :root{--bg:#0f1511;--card:#18211b;--line:#27332b;--ink:#eaf1ec;--mut:#9fb3a6;--accent:#FFB703;--green:#2fae66;}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,Inter,Segoe UI,sans-serif;padding:0 0 80px}
  header{position:sticky;top:0;z-index:5;background:rgba(15,21,17,.92);backdrop-filter:blur(8px);
    border-bottom:1px solid var(--line);padding:18px 28px;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  h1{font-size:20px;font-weight:800;letter-spacing:.3px}
  input[type=text]{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 14px;font-size:15px;min-width:200px}
  .tabs{display:flex;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px}
  .tab{padding:7px 16px;border-radius:9px;cursor:pointer;color:var(--mut);font-weight:600}
  .tab.on{background:var(--accent);color:#1a1a1a}
  .count{margin-left:auto;color:var(--mut);font-weight:600}
  .wrap{max-width:1400px;margin:24px auto;padding:0 24px;display:flex;flex-direction:column;gap:32px}
  .section{display:flex;flex-direction:column;gap:16px}
  .sec-title{font-size:22px;font-weight:800;border-bottom:1px solid var(--line);padding-bottom:8px}
  .group{display:flex;flex-direction:column;gap:12px;margin-bottom:16px}
  .group-title{font-size:16px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
  .card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;transition:.2s}
  .media{background:#0a0d0b;height:200px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--line);position:relative}
  .media video, .media img{width:100%;height:100%;object-fit:contain;display:block}
  .media audio{width:100%;padding:10px}
  .body{padding:12px;display:flex;flex-direction:column;gap:8px;flex:1}
  .name{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;word-break:break-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:600}
  .meta{font-size:12px;color:var(--mut)}
  .manifest{display:flex;flex-direction:column;gap:4px;margin-top:4px;padding-top:8px;border-top:1px dashed var(--line);font-size:12px}
  .m-row{display:flex;gap:6px}
  .m-lbl{color:var(--mut);flex:none}
  .m-val{color:var(--ink);flex:1;word-break:break-word}
  .btns{display:flex;gap:6px;margin-top:auto;padding-top:12px}
  .btn{flex:1;text-align:center;text-decoration:none;background:#243029;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px 0;cursor:pointer;font-weight:600;font-size:12px}
  .btn:hover{border-color:var(--accent)}
  .empty{color:var(--mut);padding:20px;font-size:15px;background:var(--card);border:1px dashed var(--line);border-radius:12px;text-align:center}
  .unmatched{margin-top:40px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px}
  .unmatched summary{font-weight:700;cursor:pointer;color:var(--mut)}
  .unmatched pre{margin-top:12px;font-size:12px;color:var(--mut);white-space:pre-wrap;overflow:auto}
</style></head><body>
<header>
  <h1>🎬 Media Board</h1>
  <div class="tabs">
    <div class="tab on" data-f="all">All</div>
    <div class="tab" data-f="heygen">Heygen</div>
    <div class="tab" data-f="tts">TTS</div>
    <div class="tab" data-f="references">References</div>
    <div class="tab" data-f="outputs">Outputs</div>
  </div>
  <input type="text" id="search" placeholder="Search files & manifest...">
  <div class="count" id="count">0 assets</div>
</header>
<div class="wrap" id="wrap"></div>
<script>
let DATA={sources:[],unmatched:[]}, FILTER="all", SEARCH="";
const $=(s,e=document)=>e.querySelector(s);
const bytesToSize=b=>{const s=["B","KB","MB","GB"];let i=0;while(b>=1024){b/=1024;i++}return b.toFixed(1)+" "+s[i];};
const fmtDate=ms=>new Date(ms).toLocaleDateString();

async function load(){
  try {
    const r=await fetch("/api/media");
    DATA=await r.json();
    render();
  } catch(e) { console.error(e); }
}

function card(f, src){
  const el=document.createElement("div");el.className="card";

  // Link-only render (lives on HeyGen, no local file): show an Open/Copy card, no player.
  if(f.type==="link"){
    const media=document.createElement("div");media.className="media";
    media.innerHTML='<div style="text-align:center;color:var(--mut)"><div style="font-size:30px">▶</div><div style="font-size:12px;margin-top:6px">on HeyGen · no local copy</div></div>';
    el.appendChild(media);
    const body=document.createElement("div");body.className="body";
    const name=document.createElement("div");name.className="name";name.title=f.name;name.textContent=f.name;
    const meta=document.createElement("div");meta.className="meta";meta.textContent=[f.audio,f.video_id].filter(Boolean).join(" · ");
    body.append(name,meta);
    const btns=document.createElement("div");btns.className="btns";
    const open=document.createElement("a");open.className="btn";open.textContent="Open on HeyGen ↗";open.href=f.url;open.target="_blank";open.rel="noopener";
    const cpy=document.createElement("button");cpy.className="btn";cpy.textContent="Copy link";
    cpy.onclick=async()=>{await navigator.clipboard.writeText(f.url);cpy.textContent="Copied!";setTimeout(()=>cpy.textContent="Copy link",1000);};
    btns.append(open,cpy);
    body.appendChild(btns);
    el.appendChild(body);
    return el;
  }

  el.draggable=true;

  const fileUrl=location.origin+"/file?src="+encodeURIComponent(src.id)+"&p="+encodeURIComponent(f.relPath);
  let mime="application/octet-stream";
  if(f.type==="video") mime="video/mp4";
  else if(f.type==="audio") mime="audio/wav";
  else if(f.type==="image") mime="image/png";

  el.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("DownloadURL", \`\${mime}:\${f.name}:\${fileUrl}\`);
    e.dataTransfer.effectAllowed = "copy";
  });

  const media=document.createElement("div");media.className="media";
  if(f.type==="video"){
    media.innerHTML=\`<video controls preload="none" src="\${fileUrl}"></video>\`;
  }else if(f.type==="audio"){
    media.innerHTML=\`<audio controls preload="none" src="\${fileUrl}"></audio>\`;
  }else if(f.type==="image"){
    media.innerHTML=\`<img loading="lazy" src="\${fileUrl}">\`;
  }
  el.appendChild(media);

  const body=document.createElement("div");body.className="body";
  const name=document.createElement("div");name.className="name";name.title=f.name;name.textContent=f.name;
  const meta=document.createElement("div");meta.className="meta";meta.textContent=\`\${bytesToSize(f.sizeBytes)} · \${fmtDate(f.mtimeMs)}\`;
  body.append(name,meta);

  if(f.manifest){
    const m=document.createElement("div");m.className="manifest";
    for(const [k,v] of Object.entries(f.manifest)){
      if(!v || k.includes("output file")) continue;
      const r=document.createElement("div");r.className="m-row";
      r.innerHTML=\`<div class="m-lbl">\${k}:</div><div class="m-val">\${v}</div>\`;
      m.appendChild(r);
    }
    body.appendChild(m);
  }

  const btns=document.createElement("div");btns.className="btns";
  const rev=document.createElement("button");rev.className="btn";rev.textContent="Reveal";
  rev.onclick=()=>fetch("/api/reveal",{method:"POST",body:JSON.stringify({src:src.id,p:f.relPath})});
  const dl=document.createElement("a");dl.className="btn";dl.textContent="Download";dl.href=fileUrl;dl.download=f.name;
  const cpy=document.createElement("button");cpy.className="btn";cpy.textContent="Copy path";
  cpy.onclick=async()=>{await navigator.clipboard.writeText(f.absPath);cpy.textContent="Copied!";setTimeout(()=>cpy.textContent="Copy path",1000);};
  btns.append(rev,dl,cpy);
  body.appendChild(btns);
  el.appendChild(body);
  return el;
}

const norm=s=>(s||"").toLowerCase().replace(/[-_\s]+/g,"");
function render(){
  const wrap=$("#wrap"); wrap.innerHTML="";
  const search=norm(SEARCH);
  let count=0;

  for(const src of DATA.sources){
    if(FILTER==="heygen" && src.hub!=="heygen") continue;
    if(FILTER==="tts" && src.hub!=="tts") continue;
    if(FILTER==="references" && src.kind!=="references") continue;
    if(FILTER==="outputs" && src.kind!=="outputs") continue;

    const files=src.files.filter(f=>{
      if(!search) return true;
      // search is separator-insensitive ("girl 1" matches "girl-1") and path-aware
      const hay=norm([f.name,f.relPath,f.audio,f.video_id,f.url].filter(Boolean).join(" "));
      if(hay.includes(search)) return true;
      if(f.manifest){
        for(const v of Object.values(f.manifest)) if(norm(v).includes(search)) return true;
      }
      return false;
    });

    const sec=document.createElement("div");sec.className="section";
    const title=document.createElement("div");title.className="sec-title";
    title.textContent=\`\${src.hub} · \${src.kind}\`;
    sec.appendChild(title);

    if(!files.length){
      const empty=document.createElement("div");empty.className="empty";
      if(search) empty.textContent="no matches in this section";
      else empty.textContent=\`nothing here yet — \${src.kind} land in \${src.root}\`;
      sec.appendChild(empty);
      wrap.appendChild(sec);
      continue;
    }

    const groups={};
    for(const f of files){
      if(!groups[f.group]) groups[f.group]=[];
      groups[f.group].push(f);
      count++;
    }

    for(const g of Object.keys(groups).sort()){
      const grp=document.createElement("div");grp.className="group";
      if(g!=="."){
        const gt=document.createElement("div");gt.className="group-title";gt.textContent=g;
        grp.appendChild(gt);
      }
      const grid=document.createElement("div");grid.className="grid";
      for(const f of groups[g]) grid.appendChild(card(f,src));
      grp.appendChild(grid);
      sec.appendChild(grp);
    }
    wrap.appendChild(sec);
  }

  if(DATA.unmatched && DATA.unmatched.length){
    const unm=document.createElement("details");unm.className="unmatched";
    unm.innerHTML=\`<summary>\${DATA.unmatched.length} unmatched manifest rows (e.g. pending download)</summary><pre>\${JSON.stringify(DATA.unmatched,null,2)}</pre>\`;
    wrap.appendChild(unm);
  }

  $("#count").textContent=count+" assets";
}

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));t.classList.add("on");FILTER=t.dataset.f;render();});
$("#search").oninput=e=>{SEARCH=e.target.value;render();};
load();
</script>
</body></html>`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) startServer();
