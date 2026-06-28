#!/usr/bin/env node
// heygen-web — drive HeyGen's *web-session* API (api2.heygen.com) for UNLIMITED Avatar III.
//
// The web app authenticates with session COOKIES (not an API key) and sends
//   avatar_settings: { use_avatar_iv_model: false, use_unlimited_mode: true }
// to POST /v2/avatar/shortcut/submit — which bills as UNLIMITED Avatar III instead of
// metered API usage. This CLI replays that exact request.
//
// ⚠️ Account-bound + ToS-grey. Use only on your own paid (legacy-unlimited) account.
//
// AUTH: parsed straight from a captured cURL file so the giant cookie is never re-typed.
//   default: infra/secrets/heygen-web-curls.txt   (override with HEYGEN_WEB_CURLS=/path)
//   The file's first `-b '...'` cookie block + `x-zid:` header are the credentials.
//   Cloudflare cookies (cf_clearance/__cf_bm) EXPIRE — when calls start 403'ing, recapture
//   a fresh `submit` cURL and overwrite that file.
//
// Commands:
//   heygen-web auth-check
//   heygen-web list-avatars [--limit 20]
//   heygen-web list-looks --group <group_id>
//   heygen-web generate --avatar <look_id> --voice <voice_id> --text "..." \
//                       [--title T] [--orientation portrait|landscape] [--res 720p|1080p]
//                       [--iv]   (opt into metered Avatar IV; default is unlimited Avatar III)
//   heygen-web status <video_id>      (stub — needs poll endpoint capture)
//   heygen-web raw <path> [--json '<body>']   (GET, or POST when --json given)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURLS = process.env.HEYGEN_WEB_CURLS ||
  resolve(__dirname, "../../../infra/secrets/heygen-web-curls.txt");
const BASE = "https://api2.heygen.com";

// ─── auth: parse cookie + x-zid out of the captured cURL file ─────────────────
function loadAuth() {
  if (!existsSync(CURLS)) die(`No capture file at ${CURLS} (set HEYGEN_WEB_CURLS).`);
  const txt = readFileSync(CURLS, "utf8");
  const cookie = (txt.match(/-b '([^']+)'/) || [])[1];
  const zid = (txt.match(/x-zid:\s*([^\s'\\]+)/) || [])[1];
  if (!cookie) die(`Could not find a -b '<cookie>' block in ${CURLS}.`);
  return { cookie, zid };
}

function headers(auth, extra = {}) {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: "https://app.heygen.com",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "x-ver": "4.1.0",
    "x-path": "/avatar",
    "x-language-override": "en-US",
    ...(auth.zid ? { "x-zid": auth.zid } : {}),
    cookie: auth.cookie,
    ...extra,
  };
}

async function api(auth, path, { method = "GET", body } = {}) {
  const res = await fetch(path.startsWith("http") ? path : BASE + path, {
    method,
    headers: headers(auth),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status === 403 || /cloudflare|just a moment/i.test(text))
    die(`403 / Cloudflare — session cookie likely expired. Recapture a fresh\n` +
        `   'submit' cURL into ${CURLS}. (cf_clearance/__cf_bm rotate fast.)`);
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) die(`HTTP ${res.status} ${method} ${path}\n${text.slice(0, 500)}`);
  return json;
}

// ─── commands ─────────────────────────────────────────────────────────────────
async function authCheck(auth) {
  const r = await api(auth, "/v2/avatar_group.private.list?limit=1&page=1");
  console.log("✓ auth OK — session is live.");
  console.log(JSON.stringify(r, null, 2).slice(0, 800));
}

async function listAvatars(auth, args) {
  const limit = arg(args, "--limit") || "20";
  console.log(JSON.stringify(
    await api(auth, `/v2/avatar_group.private.list?limit=${limit}&page=1`), null, 2));
}

async function listLooks(auth, args) {
  const g = arg(args, "--group"); if (!g) die("list-looks needs --group <group_id>");
  console.log(JSON.stringify(
    await api(auth, `/v2/avatar_group/look.list?group_id=${g}&type=all&page=1&limit=20`), null, 2));
}

// Create an Avatar III photo avatar from a local image. Chain mined from HAR4:
//   GET  /v1/avatar_group/photo/temp.create?num_photos=1   → temp id + presigned S3 PUT url
//   PUT  <s3 url>  (raw bytes, image/jpeg)                  → upload
//   POST /v1/media_evaluation/image_attributes.submit       → image eval (NON-blocking)
//   GET  /v1/avatar_group/photo/temp.convert?...&skip_validation=true  → group_id
//   GET  /v2/avatar_group/look.list?group_id=…              → look_id (== avatar_id for generate/studio)
async function createPhotoAvatar(auth, args) {
  const img = args.find((a) => !a.startsWith("--"));
  if (!img) die("create-photo-avatar needs <image-path> [--name N]");
  if (!existsSync(img)) die(`no such image: ${img}`);
  const name = arg(args, "--name") || `avatar ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

  const tc = await api(auth, "/v1/avatar_group/photo/temp.create?num_photos=1");
  const tid = tc?.data?.temporary_user_photar_ids?.[0];
  const key = tc?.data?.keys?.[0];
  const url = tc?.data?.upload_urls?.[0];
  if (!tid || !url) die("temp.create failed: " + JSON.stringify(tc));

  const bytes = readFileSync(img);
  const ct = img.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  // presigned URL signs host;x-amz-server-side-encryption — that header MUST be sent (AES256).
  const put = await fetch(url, {
    method: "PUT",
    headers: { "content-type": ct, "x-amz-server-side-encryption": "AES256" },
    body: bytes,
  });
  if (!put.ok) die(`S3 upload failed: HTTP ${put.status}\n${(await put.text()).slice(0, 300)}`);
  console.error(`✓ uploaded ${(bytes.length / 1e6).toFixed(1)}MB image`);

  // fire the eval (convert doesn't wait on it; skip_validation=true)
  try {
    await api(auth, "/v1/media_evaluation/image_attributes.submit",
      { method: "POST", body: { image_url: `s3://heygen-product/${key}`, workflow_id: randomUUID() } });
  } catch {}
  await new Promise((r) => setTimeout(r, 2500));

  const cv = await api(auth, `/v1/avatar_group/photo/temp.convert?parent_temporary_user_photar_id=${tid}` +
    `&name=${encodeURIComponent(name)}&skip_validation=true`);
  const gid = cv?.data?.group_id;
  if (!gid) die("temp.convert failed: " + JSON.stringify(cv));

  const ll = await api(auth, `/v2/avatar_group/look.list?group_id=${gid}&type=all&page=1&limit=20`);
  const look = ll?.data?.avatar_looks?.[0]?.look || {};
  const lookId = look.look_id || gid;
  console.log(JSON.stringify({ name, group_id: gid, look_id: lookId, is_valid: look.is_valid }, null, 2));
  console.error(`\n✓ Avatar III photo avatar created.\n  look_id (avatar_id) = ${lookId}\n  → use: generate/studio-render --avatar ${lookId}`);
}

// studio-render — replicate the AI Studio "render" flow with a given Avatar III avatar over
// the FIXED 1-min audio baked into studio-templates/. Chain mined from HAR4:
//   POST /v1/text_draft.create                  → new video_id (the draft)
//   POST /v1/text_draft.save                     (18KB scene doc; avatar swapped in)
//   POST /v1/text_draft.scene_avatar_preview     → job_id (kicks the Avatar III inference)
//   GET  /v1/text_draft.scene_avatar_preview.check?job_id&video_id → poll until video_url
// Templates carry engine:"avatar_iii" + use_unlimited_mode:true. Audio is constant.
async function studioRender(auth, args) {
  const avatar = arg(args, "--avatar");
  if (!avatar) die("studio-render needs --avatar <look_id>");
  const title = arg(args, "--title") || `studio ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const tdir = resolve(__dirname, "studio-templates");
  const fill = (f, vid) => JSON.parse(readFileSync(resolve(tdir, f), "utf8")
    .replaceAll("__VIDEO_ID__", vid).replaceAll("__AVATAR_ID__", avatar));

  const cr = await api(auth, "/v1/text_draft.create", {
    method: "POST",
    body: { video_output: { resolution: { width: 1080, height: 1920 }, fps: 25 }, source_type: "ai_studio" },
  });
  const vid = cr?.data?.video_id;
  if (!vid) die("text_draft.create failed: " + JSON.stringify(cr));
  console.error(`✓ draft created: ${vid}`);

  const saveBody = fill("save.json", vid);
  saveBody.video_id = vid; saveBody.title = title;
  await api(auth, "/v1/text_draft.save", { method: "POST", body: saveBody });
  console.error(`✓ draft saved with avatar ${avatar}, title "${title}"`);

  const prevBody = fill("preview.json", vid);
  prevBody.video_id = vid;
  const pv = await api(auth, "/v1/text_draft.scene_avatar_preview", { method: "POST", body: prevBody });
  const job = pv?.data?.job_id;
  if (!job) die("scene_avatar_preview failed: " + JSON.stringify(pv));

  // Fire-and-report: no polling (repeated polls look bot-like / ban-risky). Check the UI.
  // `studio-render-status <video_id> <job_id>` does ONE status check if you want it later.
  console.log(JSON.stringify({ video_id: vid, job_id: job, title,
    open: "https://app.heygen.com/projects" }, null, 2));
  console.error(`✓ render kicked off (job ${job}). It's processing server-side now —\n` +
    `  check the web app: Projects → "${title}". No polling.`);
}

// One-shot status check (no loop) — only when you explicitly ask.
async function studioRenderStatus(auth, vid, job) {
  if (!vid || !job) die("studio-render-status needs <video_id> <job_id>");
  const s = await api(auth, `/v1/text_draft.scene_avatar_preview.check` +
    `?job_id=${encodeURIComponent(job)}&video_id=${vid}`);
  console.log(JSON.stringify(s?.data || s, null, 2));
  const url = s?.data?.video_url;
  console.error(url ? `✓ done → ${url}` : `…still rendering (no video_url yet).`);
}

// Voices — GET /v1/voice.list?page&limit → data.list[]. --search filters client-side by name.
async function listVoices(auth, args) {
  const limit = arg(args, "--limit") || "30", page = arg(args, "--page") || "1";
  const term = (arg(args, "--search") || "").toLowerCase();
  const r = await api(auth, `/v1/voice.list?page=${page}&limit=${limit}`);
  let list = r?.data?.list || [];
  if (term) list = list.filter((v) => (v.display_name || "").toLowerCase().includes(term)
    || (v.labels || []).join(" ").toLowerCase().includes(term));
  if (args.includes("--json")) return console.log(JSON.stringify(list, null, 2));
  for (const v of list)
    console.log(`${v.voice_id}  ${(v.display_name || "").trim().replace(/\s+/g, " ")}` +
      `  (${v.gender || "?"}, ${v.accent || v.language || "?"})  [${(v.labels || []).join(", ").trim()}]`);
  console.error(`\n→ ${list.length} voices (page ${page}). --search <term> to filter, --json for full.`);
}

// Videos in the account — GET /v1/project/items. Source of video_ids for download/delete.
async function listVideos(auth, args) {
  const limit = arg(args, "--limit") || "30";
  const type = arg(args, "--type") || "heygen_video";
  const r = await api(auth, `/v1/project/items?limit=${limit}&item_types=${type}` +
    `&sort_key=created_ts&sort_order=desc&include_children=true&is_trash=false`);
  const items = r?.data?.items || [];
  if (args.includes("--json")) return console.log(JSON.stringify(items, null, 2));
  for (const it of items) {
    const dt = it.created_ts ? new Date(it.created_ts * 1000).toISOString().slice(0, 16).replace("T", " ") : "?";
    console.log(`${it.video_id}  ${dt}  ${String(it.status).padEnd(9)} ${String((it.duration || 0).toFixed(1) + "s").padStart(7)}  ${it.name || ""}`);
  }
  console.error(`\n→ ${items.length} videos (type=${type}). delete-video <id...> to trash.`);
}

// Trash one or more videos — DELETE /v1/project/item.trash {items:[{id,item_type}]}.
// DESTRUCTIVE: only call when the user has named/approved the ids.
async function deleteVideos(auth, ids, args) {
  if (!ids.length) die("delete-video needs <video_id> [<video_id> ...]");
  const type = arg(args, "--type") || "heygen_video";
  const body = { items: ids.map((id) => ({ id, item_type: type })) };
  const r = await api(auth, "/v1/project/item.trash", { method: "DELETE", body });
  console.log(JSON.stringify(r, null, 2));
  if (r?.code === 100) console.error(`✓ trashed ${ids.length} item(s): ${ids.join(", ")}`);
}

// Core submit — used by both `generate` and `batch`. Returns { video_id, raw }.
async function submitGenerate(auth, { avatar, voice, text, title, orientation, res, iv }) {
  const body = {
    video_title: title || "heygen-web video",
    video_orientation: orientation || "portrait",
    resolution: res || "720p",
    avatar_id: avatar,
    source_type: "avatar_video_shortcut_modal",
    fit: "cover",
    audio_data: { audio_type: "tts_pending", text, voice_id: voice },
    avatar_settings: { use_avatar_iv_model: iv, use_unlimited_mode: !iv },
    enable_caption: false,
    create_new_avatar: false,
  };
  const out = await api(auth, "/v2/avatar/shortcut/submit", { method: "POST", body });
  return { video_id: out?.data?.video_id, raw: out };
}

async function generate(auth, args) {
  const avatar = arg(args, "--avatar"), voice = arg(args, "--voice"), text = arg(args, "--text");
  if (!avatar || !voice || !text) die('generate needs --avatar <look_id> --voice <voice_id> --text "..."');
  const iv = args.includes("--iv"); // default = unlimited Avatar III
  console.error(`→ submitting ${iv ? "Avatar IV (METERED)" : "Avatar III (unlimited-mode)"} …`);
  const { video_id, raw } = await submitGenerate(auth, {
    avatar, voice, text, iv,
    title: arg(args, "--title"),
    orientation: arg(args, "--orientation"),
    res: arg(args, "--res"),
  });
  if (video_id) console.error(`✓ video_id: ${video_id}\n  → view: https://app.heygen.com/projects`);
  console.log(JSON.stringify(raw, null, 2));
}

// Batch generate many clips from a file. Each clip = one unlimited Avatar III submit.
//   --file *.txt   → one script per line (uses shared --avatar/--voice/--orientation/--res)
//   --file *.json  → [{ "text": "...", "avatar"?, "voice"?, "title"?, "orientation"?, "res"? }, ...]
// Writes a manifest (line ↔ video_id) so `download` can be run later per id.
async function batch(auth, args) {
  const file = arg(args, "--file"); if (!file) die("batch needs --file <items.txt|items.json>");
  if (!existsSync(file)) die(`no such file: ${file}`);
  const iv = args.includes("--iv");
  const shared = {
    avatar: arg(args, "--avatar"), voice: arg(args, "--voice"),
    orientation: arg(args, "--orientation"), res: arg(args, "--res"), iv,
  };
  const outDir = arg(args, "--out-dir") || ".";
  const delay = Number(arg(args, "--delay") || 1500); // ms between submits, be polite
  const doDl = args.includes("--download");

  // parse items
  const txt = readFileSync(file, "utf8");
  let items;
  if (file.endsWith(".json")) {
    items = JSON.parse(txt);
    if (!Array.isArray(items)) die("JSON batch file must be an array of objects");
  } else {
    items = txt.split("\n").map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")).map((text) => ({ text }));
  }
  if (!items.length) die("no items found in batch file");

  // validate every item resolves an avatar+voice before spending anything
  const resolved = items.map((it, i) => {
    const m = {
      text: it.text, avatar: it.avatar || shared.avatar, voice: it.voice || shared.voice,
      title: it.title || `batch ${i + 1}`,
      orientation: it.orientation || shared.orientation,
      res: it.res || shared.res, iv: shared.iv,
    };
    if (!m.text || !m.avatar || !m.voice)
      die(`item ${i + 1} missing text/avatar/voice (set per-item or via --avatar/--voice). Got: ${JSON.stringify(it)}`);
    return m;
  });

  console.error(`→ batch: ${resolved.length} clips, ${iv ? "Avatar IV (METERED)" : "Avatar III (unlimited)"} …`);
  const results = [];
  for (let i = 0; i < resolved.length; i++) {
    const it = resolved[i];
    try {
      const { video_id, raw } = await submitGenerate(auth, it);
      results.push({ index: i + 1, title: it.title, text: it.text, video_id: video_id || null,
        ok: !!video_id, code: raw?.code });
      console.error(`  [${i + 1}/${resolved.length}] ${video_id ? "✓ " + video_id : "✖ no video_id: " + JSON.stringify(raw)}`);
    } catch (e) {
      results.push({ index: i + 1, title: it.title, text: it.text, video_id: null, ok: false, error: String(e) });
      console.error(`  [${i + 1}/${resolved.length}] ✖ ${e}`);
    }
    if (i < resolved.length - 1) await new Promise((r) => setTimeout(r, delay));
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const manifest = resolve(outDir, `batch-${stamp}.json`);
  writeFileSync(manifest, JSON.stringify({ created: stamp, count: results.length, results }, null, 2));
  const ok = results.filter((r) => r.ok).length;
  console.error(`\n→ ${ok}/${results.length} submitted. manifest: ${manifest}`);

  if (doDl) {
    console.error(`→ downloading (give renders ~time; will retry) …`);
    for (const r of results.filter((x) => x.ok)) {
      const out = resolve(outDir, `${r.video_id}_${shared.res || "720p"}.mp4`);
      const url = await downloadCore(auth, r.video_id, shared.res || "720p", false, 12, 15000);
      if (!url) { console.error(`  ✖ ${r.video_id}: not ready after retries (download later)`); continue; }
      writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
      console.error(`  ✓ ${out}`);
    }
  }
  console.log(JSON.stringify({ manifest, ok, total: results.length }, null, 2));
}

async function limits(auth) {
  const r = await api(auth, "/v1/avatar/video_generate/limits");
  const d = r.data || {};
  console.log(JSON.stringify(d, null, 2));
  if (d.unit === "second")
    console.error(`\n→ used ${d.total_consumed}s of ${d.total_limit}s this month — ` +
      `${d.remain}s (~${(d.remain/60).toFixed(1)} min) left. hit_limit=${d.is_hit_monthly_limit}`);
}

// usage — snapshot every meter that could move when we create avatar/video/audio.
// The point: on the unlimited Avatar III path these should NOT change (credits flat,
// only priority_count ticks). --save writes a baseline; --diff compares to it.
const USAGE_SNAP = resolve(__dirname, "../../../infra/secrets/heygen-usage-last.json");
async function usageSnapshot(auth) {
  const lim = (await api(auth, "/v1/avatar/video_generate/limits"))?.data || {};
  const pri = (await api(auth, "/v1/video_history/monthly_priority_video_count"))?.data || {};
  const ai = (await api(auth, "/v1/file.ai_generate_element.limits"))?.data || {};
  let credits = null;
  try { credits = (await api(auth, "/v1/payment/migrate_to_credit_first.check",
    { method: "POST", body: {} }))?.data?.current_credits; } catch {}
  return {
    ts: new Date().toISOString(),
    credits,                                   // paid credit balance — MUST stay flat for unlimited
    seconds_consumed: lim.total_consumed,      // free avatar-video second pool used
    seconds_limit: lim.total_limit,
    seconds_remain: lim.remain,
    free_credit_remain: lim.remain_from_free_credit,
    priority_count: pri.count,                 // priority render slots used (per video)
    priority_limit: pri.limit,
    ai_image_credits: ai.available_image_credits,    // AI-generated element pools — only move if
    ai_video_credits: ai.available_video_credits,    // you generate AI images/video in the editor
    ai_concept_credits: ai.available_concept_engine_credits,
  };
}
function printUsage(s) {
  console.error(`credits=${s.credits}  seconds=${s.seconds_consumed}/${s.seconds_limit}` +
    `  priority=${s.priority_count}/${s.priority_limit}` +
    `  ai(img/vid/concept)=${s.ai_image_credits}/${s.ai_video_credits}/${s.ai_concept_credits}`);
}
function diffUsage(prev, cur) {
  // every meter that could indicate consumption; flat across ALL = truly unlimited
  const keys = ["credits", "seconds_consumed", "priority_count",
    "ai_image_credits", "ai_video_credits", "ai_concept_credits"];
  const d = Object.fromEntries(keys.map((k) => [k, (cur[k] ?? 0) - (prev[k] ?? 0)]));
  const sign = (n) => (n >= 0 ? "+" : "") + n;
  // credits/seconds going UP = spend; ai_* credits going DOWN = spend
  const spent = d.credits !== 0 || d.seconds_consumed !== 0 ||
    d.ai_image_credits < 0 || d.ai_video_credits < 0 || d.ai_concept_credits < 0;
  console.error(`Δ since ${prev.ts}:`);
  console.error(`  credits ${sign(d.credits)}  seconds ${sign(d.seconds_consumed)}` +
    `  priority ${sign(d.priority_count)}` +
    `  ai img ${sign(d.ai_image_credits)}/vid ${sign(d.ai_video_credits)}/concept ${sign(d.ai_concept_credits)}`);
  console.error(spent
    ? "⚠️  NOT free — a credit/second meter moved. This op is metered."
    : "✓ UNLIMITED confirmed — no credits, seconds, or AI-element credits consumed." +
      (d.priority_count > 0 ? ` (priority slot used: +${d.priority_count}/100 — free, queue only)` : ""));
}
async function usage(auth, args) {
  const cur = await usageSnapshot(auth);
  console.log(JSON.stringify(cur, null, 2));
  printUsage(cur);
  if (args.includes("--diff") && existsSync(USAGE_SNAP))
    diffUsage(JSON.parse(readFileSync(USAGE_SNAP, "utf8")), cur);
  if (args.includes("--save")) {
    writeFileSync(USAGE_SNAP, JSON.stringify(cur, null, 2));
    console.error(`→ baseline saved to ${USAGE_SNAP}`);
  }
}

// Core transcode→URL. Returns a download_url, or null if the video isn't ready yet.
//   POST /v1/pacific/collaboration/video.download           → workflow_id (SCHEDULED) | download_url (cached)
//   GET  /v1/pacific/collaboration/video.download/status     → poll until COMPLETED → download_url
// kickRetries/kickGap let `batch --download` wait out a still-rendering video (re-kicks).
async function downloadCore(auth, id, res, caps, kickRetries = 0, kickGap = 15000) {
  for (let attempt = 0; ; attempt++) {
    const kick = await api(auth, "/v1/pacific/collaboration/video.download", {
      method: "POST",
      body: { video_id: id, resolution: res, resource_type: "heygen_video", with_captions: caps },
    });
    let url = kick?.data?.download_url; // cached transcode → URL returned immediately
    const wf = kick?.data?.workflow_id;
    if (url) return url;
    if (wf) {
      for (let i = 0; i < 200; i++) {
        const s = await api(auth,
          `/v1/pacific/collaboration/video.download/status?workflow_id=${encodeURIComponent(wf)}`);
        const st = (s?.data?.status || "").toUpperCase();
        process.stderr.write(".");
        if (st === "COMPLETED") return s.data.download_url;
        if (st === "FAILED" || st === "ERROR") die(`\ntranscode ${st}: ${JSON.stringify(s)}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
      return null; // status poll timed out
    }
    // no url + no workflow → video not rendered yet
    if (attempt >= kickRetries) return null;
    await new Promise((r) => setTimeout(r, kickGap));
  }
}

async function download(auth, id, args) {
  if (!id) die('download needs <video_id>');
  const res = arg(args, "--res") || "1080p";
  const caps = args.includes("--captions");
  const url = await downloadCore(auth, id, res, caps);
  if (!url) die("no download_url (is the video done rendering?). Wait ~1 min and retry.");
  process.stderr.write(" done\n");
  const out = arg(args, "--out") || `${id}_${res}.mp4`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(out, buf);
  console.log(`saved ${out} (${(buf.length / 1e6).toFixed(1)} MB)`);
}

async function raw(auth, path, args) {
  const j = arg(args, "--json");
  console.log(JSON.stringify(
    await api(auth, path, j ? { method: "POST", body: JSON.parse(j) } : {}), null, 2));
}

// ─── helpers / dispatch ─────────────────────────────────────────────────────────
function arg(a, f) { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; }
function die(m) { console.error("✖ " + m); process.exit(1); }

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === "help") {
  console.log(`heygen-web — UNLIMITED Avatar III via the web session (api2.heygen.com)\n
  auth-check
  limits                      monthly seconds used / remaining
  usage [--save] [--diff]     credits + seconds + priority snapshot (prove unlimited = no delta)
  list-avatars [--limit 20]
  list-looks --group <group_id>
  generate --avatar <look_id> --voice <voice_id> --text "..." [--title T]
           [--orientation portrait|landscape] [--res 720p|1080p] [--iv]
  batch --file <items.txt|items.json> [--avatar id] [--voice id]
           [--orientation portrait|landscape] [--res 720p|1080p]
           [--out-dir DIR] [--delay 1500] [--download] [--iv]
           .txt = one script per line; .json = [{text,avatar?,voice?,title?,...}]
  download <video_id> [--res 1080p|720p] [--captions] [--out file.mp4]
  create-photo-avatar <image-path> [--name N]   Avatar III photo avatar → look_id
  studio-render --avatar <look_id> [--title T]  AI Studio render over the fixed 1-min audio
  list-voices [--limit 30] [--page 1] [--search term] [--json]
  list-videos [--limit 30] [--type heygen_video] [--json]
  delete-video <video_id> [<video_id> ...] [--type heygen_video]
  raw <path> [--json '<body>']\n
Auth file: ${CURLS}\n⚠️  ToS-grey, account-bound. Default mode = unlimited Avatar III.`);
  process.exit(0);
}
const auth = loadAuth();
switch (cmd) {
  case "auth-check":   await authCheck(auth); break;
  case "list-avatars": await listAvatars(auth, rest); break;
  case "list-looks":   await listLooks(auth, rest); break;
  case "limits":       await limits(auth); break;
  case "usage":        await usage(auth, rest); break;
  case "generate":     await generate(auth, rest); break;
  case "batch":        await batch(auth, rest); break;
  case "create-photo-avatar": await createPhotoAvatar(auth, rest); break;
  case "studio-render": await studioRender(auth, rest); break;
  case "studio-render-status": await studioRenderStatus(auth, rest[0], rest[1]); break;
  case "list-voices":  await listVoices(auth, rest); break;
  case "list-videos":  await listVideos(auth, rest); break;
  case "delete-video": await deleteVideos(auth, rest.filter((x) => !x.startsWith("--")), rest); break;
  case "download":     await download(auth, rest[0], rest.slice(1)); break;
  case "raw":          await raw(auth, rest[0], rest.slice(1)); break;
  default: die(`unknown command: ${cmd} (try: help)`);
}
