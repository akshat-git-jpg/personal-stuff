#!/usr/bin/env node
// serve.mjs — local "posting cockpit" for Pinterest pins. Zero dependencies (Node built-ins).
//
// Scans <root>/<niche>/posts/<slug>/ for image.png + post.json (or post.md) and serves an
// intuitive board at http://localhost:<port>. Per-field copy buttons + "mark posted"
// toggles that write status straight to <root>/<niche>/posts.json.
//
// Usage:
//   node serve.mjs                         # root defaults to ~/codebase/personal-stuff/pipelines/pinterest
//   node serve.mjs --root /path --port 4000
//   PINTEREST_ROOT=/path PORT=4000 node serve.mjs

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const ROOT = path.resolve(
  arg("root", process.env.PINTEREST_ROOT || path.join(os.homedir(), "codebase/personal-stuff/pipelines/pinterest"))
);
const PORT = parseInt(arg("port", process.env.PORT || "4000"), 10);

function listNiches() {
  if (!fs.existsSync(ROOT)) return [];
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, "config.json")))
    .map((d) => d.name)
    .sort();
}

function readStatus(niche) {
  const f = path.join(ROOT, niche, "posts.json");
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return {}; }
}
function writeStatus(niche, status) {
  fs.writeFileSync(path.join(ROOT, niche, "posts.json"), JSON.stringify(status, null, 2));
}

// Fallback parser for posts that only have post.md (no post.json yet).
function parsePostMd(md) {
  const sec = (h) => {
    const re = new RegExp(`^##\\s+${h}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, "im");
    const m = md.match(re);
    return m ? m[1].trim() : "";
  };
  const bullet = (label) => {
    const m = md.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i"));
    return m ? m[1].trim() : "";
  };
  return {
    title: sec("Title") || (md.match(/^#\s+(.+)/m)?.[1] ?? ""),
    description: sec("Description"),
    altText: sec("Alt text"),
    hashtags: sec("Hashtags"),
    board: bullet("Board"),
    link: bullet("Link"),
    bestTime: bullet("Best time to post"),
  };
}

function readPosts(niche) {
  const postsDir = path.join(ROOT, niche, "posts");
  if (!fs.existsSync(postsDir)) return [];
  const status = readStatus(niche);
  return fs
    .readdirSync(postsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => {
      const slug = d.name;
      const dir = path.join(postsDir, slug);
      const jsonF = path.join(dir, "post.json");
      const mdF = path.join(dir, "post.md");
      let fields = {};
      if (fs.existsSync(jsonF)) {
        try { fields = JSON.parse(fs.readFileSync(jsonF, "utf8")); } catch {}
      } else if (fs.existsSync(mdF)) {
        fields = parsePostMd(fs.readFileSync(mdF, "utf8"));
      }
      const st = status[slug] || {};
      return {
        slug,
        ...fields,
        hasImage: fs.existsSync(path.join(dir, "image.png")),
        posted: !!st.posted,
        pinUrl: st.pinUrl || "",
        postedDate: st.postedDate || "",
      };
    })
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

function send(res, code, type, body) {
  res.writeHead(code, { "Content-Type": type });
  res.end(body);
}
function json(res, code, obj) { send(res, code, "application/json", JSON.stringify(obj)); }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === "/") return send(res, 200, "text/html; charset=utf-8", PAGE);
  if (p === "/api/niches") return json(res, 200, { root: ROOT, niches: listNiches() });
  if (p === "/api/posts") {
    const niche = url.searchParams.get("niche");
    if (!niche) return json(res, 400, { error: "niche required" });
    return json(res, 200, { niche, posts: readPosts(niche) });
  }
  if (p === "/img") {
    const niche = url.searchParams.get("niche");
    const slug = url.searchParams.get("slug");
    const f = path.join(ROOT, niche || "", "posts", slug || "", "image.png");
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return send(res, 404, "text/plain", "not found");
    res.writeHead(200, { "Content-Type": "image/png" });
    return fs.createReadStream(f).pipe(res);
  }
  if (p === "/api/status" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { niche, slug, posted, pinUrl } = JSON.parse(body);
        const status = readStatus(niche);
        const prev = status[slug] || {};
        status[slug] = {
          posted: posted !== undefined ? !!posted : prev.posted || false,
          pinUrl: pinUrl !== undefined ? pinUrl : prev.pinUrl || "",
          postedDate:
            posted && !prev.posted ? new Date().toISOString().slice(0, 10) : prev.postedDate || "",
        };
        if (!status[slug].posted) status[slug].postedDate = "";
        writeStatus(niche, status);
        return json(res, 200, { ok: true, status: status[slug] });
      } catch (e) {
        return json(res, 400, { error: String(e) });
      }
    });
    return;
  }
  send(res, 404, "text/plain", "not found");
});

server.listen(PORT, () => {
  console.log(`Pinterest board → http://localhost:${PORT}   (root: ${ROOT})`);
  if (!listNiches().length) console.log(`(no niches found under ${ROOT} — generate a pin first)`);
});

const PAGE = /* html */ `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pinterest Board</title>
<style>
  :root{--bg:#0f1511;--card:#18211b;--line:#27332b;--ink:#eaf1ec;--mut:#9fb3a6;--accent:#FFB703;--green:#2fae66;}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,Inter,Segoe UI,sans-serif;padding:0 0 80px}
  header{position:sticky;top:0;z-index:5;background:rgba(15,21,17,.92);backdrop-filter:blur(8px);
    border-bottom:1px solid var(--line);padding:18px 28px;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  h1{font-size:20px;font-weight:800;letter-spacing:.3px}
  select{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 14px;font-size:15px}
  .tabs{display:flex;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px}
  .tab{padding:7px 16px;border-radius:9px;cursor:pointer;color:var(--mut);font-weight:600}
  .tab.on{background:var(--accent);color:#1a1a1a}
  .prog{margin-left:auto;color:var(--mut);font-weight:600}
  .wrap{max-width:1080px;margin:24px auto;padding:0 24px;display:flex;flex-direction:column;gap:18px}
  .card{display:flex;gap:22px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;transition:.2s}
  .card.posted{opacity:.5}
  .thumb{flex:none;width:180px;height:270px;border-radius:12px;overflow:hidden;background:#0a0d0b;cursor:pointer;border:1px solid var(--line)}
  .thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .imgcol{flex:none;display:flex;flex-direction:column;gap:8px;width:180px}
  .imgbtns{display:flex;gap:6px}
  .ibtn{flex:1;text-align:center;text-decoration:none;background:#243029;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 0;cursor:pointer;font-weight:600;font-size:12px}
  .ibtn:hover{border-color:var(--accent)}
  .ibtn.done{background:var(--green);color:#fff;border-color:var(--green)}
  .body{flex:1;min-width:0;display:flex;flex-direction:column;gap:9px}
  .title{font-size:19px;font-weight:800;margin-bottom:4px}
  .row{display:flex;gap:12px;align-items:flex-start}
  .lbl{flex:none;width:96px;color:var(--mut);font-size:13px;font-weight:600;padding-top:7px;text-transform:uppercase;letter-spacing:.04em}
  .val{flex:1;min-width:0;background:#0f1612;border:1px solid var(--line);border-radius:9px;padding:8px 11px;font-size:14px;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:auto}
  .copy{flex:none;align-self:flex-start;background:#243029;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:8px 14px;cursor:pointer;font-weight:600;font-size:13px}
  .copy:hover{border-color:var(--accent)}
  .copy.done{background:var(--green);color:#fff;border-color:var(--green)}
  .foot{display:flex;align-items:center;gap:16px;margin-top:6px;flex-wrap:wrap}
  .mark{display:flex;align-items:center;gap:9px;cursor:pointer;font-weight:700;user-select:none}
  .mark input{width:20px;height:20px;accent-color:var(--green)}
  .pin{flex:1;min-width:200px;background:#0f1612;border:1px solid var(--line);border-radius:9px;padding:8px 11px;color:var(--ink);font-size:13px}
  .meta{color:var(--mut);font-size:13px}
  .empty{color:var(--mut);text-align:center;padding:60px;font-size:16px}
</style></head><body>
<header>
  <h1>📌 Pinterest Board</h1>
  <select id="niche"></select>
  <div class="tabs">
    <div class="tab on" data-f="todo">To post</div>
    <div class="tab" data-f="all">All</div>
    <div class="tab" data-f="posted">Posted</div>
  </div>
  <div class="prog" id="prog"></div>
</header>
<div class="wrap" id="wrap"></div>
<script>
let NICHE=null, FILTER="todo", POSTS=[];
const $=(s,e=document)=>e.querySelector(s);

async function loadNiches(){
  const {niches}=await (await fetch("/api/niches")).json();
  const sel=$("#niche"); sel.innerHTML="";
  niches.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;sel.appendChild(o);});
  NICHE=niches[0]||null;
  sel.onchange=()=>{NICHE=sel.value;loadPosts();};
  loadPosts();
}
async function loadPosts(){
  if(!NICHE){$("#wrap").innerHTML='<div class="empty">No niches found. Generate a pin first.</div>';$("#prog").textContent="";return;}
  const {posts}=await (await fetch("/api/posts?niche="+encodeURIComponent(NICHE))).json();
  POSTS=posts; render();
}
function render(){
  const wrap=$("#wrap"); wrap.innerHTML="";
  const total=POSTS.length, done=POSTS.filter(p=>p.posted).length;
  $("#prog").textContent=done+" / "+total+" posted";
  const list=POSTS.filter(p=>FILTER==="all"?true:FILTER==="posted"?p.posted:!p.posted);
  if(!list.length){wrap.innerHTML='<div class="empty">Nothing here. Switch filter or generate more pins.</div>';return;}
  for(const p of list) wrap.appendChild(card(p));
}
function field(label,value){
  if(!value) return null;
  const row=document.createElement("div");row.className="row";
  row.innerHTML='<div class="lbl"></div><div class="val"></div><button class="copy">Copy</button>';
  row.querySelector(".lbl").textContent=label;
  row.querySelector(".val").textContent=value;
  const btn=row.querySelector(".copy");
  btn.onclick=async()=>{await navigator.clipboard.writeText(value);btn.textContent="Copied!";btn.classList.add("done");setTimeout(()=>{btn.textContent="Copy";btn.classList.remove("done");},1100);};
  return row;
}
function card(p){
  const el=document.createElement("div");el.className="card"+(p.posted?" posted":"");
  const imgcol=document.createElement("div");imgcol.className="imgcol";
  const thumb=document.createElement("div");thumb.className="thumb";
  const imgUrl="/img?niche="+encodeURIComponent(NICHE)+"&slug="+encodeURIComponent(p.slug);
  if(p.hasImage){const img=new Image();img.src=imgUrl;img.loading="lazy";thumb.appendChild(img);thumb.onclick=()=>window.open(imgUrl,"_blank");}
  imgcol.appendChild(thumb);
  if(p.hasImage){
    const btns=document.createElement("div");btns.className="imgbtns";
    const cpy=document.createElement("button");cpy.className="ibtn";cpy.textContent="Copy image";
    cpy.onclick=()=>{
      const reset=(t,ok)=>{cpy.textContent=t;cpy.classList.toggle("done",!!ok);setTimeout(()=>{cpy.textContent="Copy image";cpy.classList.remove("done");},ok?1400:2600);};
      try{
        // ClipboardItem must get a Promise<Blob> and write() must run synchronously in the
        // click gesture — awaiting fetch first breaks the user-activation requirement.
        const item=new ClipboardItem({"image/png":fetch(imgUrl).then(r=>r.blob())});
        navigator.clipboard.write([item]).then(()=>reset("Copied!",true)).catch(err=>{console.error("clipboard write failed:",err);reset("Failed — use Download");});
      }catch(err){console.error("clipboard unsupported:",err);reset("Use Download");}
    };
    const dl=document.createElement("a");dl.className="ibtn";dl.textContent="Download";dl.href=imgUrl;dl.download=p.slug+".png";
    btns.append(cpy,dl);imgcol.appendChild(btns);
  }
  const body=document.createElement("div");body.className="body";
  const t=document.createElement("div");t.className="title";t.textContent=p.title||p.slug;body.appendChild(t);
  [["Title",p.title],["Description",p.description],["Hashtags",p.hashtags],["Board",p.board],["Link",p.link]]
    .forEach(([l,v])=>{const r=field(l,v);if(r)body.appendChild(r);});
  const foot=document.createElement("div");foot.className="foot";
  const mark=document.createElement("label");mark.className="mark";
  mark.innerHTML='<input type="checkbox"> Posted';
  const cb=mark.querySelector("input");cb.checked=p.posted;
  const pin=document.createElement("input");pin.className="pin";pin.placeholder="paste live pin URL (optional)";pin.value=p.pinUrl||"";pin.style.display=p.posted?"block":"none";
  const meta=document.createElement("span");meta.className="meta";meta.textContent=[p.bestTime?("⏰ "+p.bestTime):"",p.postedDate?("✓ "+p.postedDate):""].filter(Boolean).join("   ");
  cb.onchange=async()=>{await save(p.slug,{posted:cb.checked,pinUrl:pin.value});p.posted=cb.checked;el.classList.toggle("posted",cb.checked);pin.style.display=cb.checked?"block":"none";const done=POSTS.filter(x=>x.posted).length;$("#prog").textContent=done+" / "+POSTS.length+" posted";if((FILTER==="todo"&&cb.checked)||(FILTER==="posted"&&!cb.checked))setTimeout(render,400);};
  pin.onblur=()=>save(p.slug,{posted:cb.checked,pinUrl:pin.value});
  foot.append(mark,pin,meta);
  body.appendChild(foot);
  el.append(imgcol,body);
  return el;
}
async function save(slug,data){
  const r=await fetch("/api/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({niche:NICHE,slug,...data})});
  return (await r.json());
}
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));t.classList.add("on");FILTER=t.dataset.f;render();});
loadNiches();
</script>
</body></html>`;
