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
//   heygen-web generate-from-audio --avatar <avatar_id> --audio <file> \
//                       [--engine heygen3|heygen4] [--orientation landscape|portrait] [--title T]
//                       (default landscape — matches this pipeline's source recordings)
//   heygen-web generate-from-template --template <template_id> --audio <file> [--title T]
//                       renders a pre-composed TEMPLATE (background + avatar bubble) over your
//                       audio — this is what "Girl 1"/"girl 2"/etc ids actually are, NOT avatars
//   heygen-web status <video_id>      one-shot ETA/progress, no polling loop
//   heygen-web raw <path> [--json '<body>']   (GET, or POST when --json given)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { BASE, CURLS, USAGE_SNAP, loadAuth, api, die } from "./src/client/http.mjs";
import { fillTemplate } from "./src/client/payloads/fill.mjs";


import { authCheck } from "./src/operations/auth.mjs";
import { listAvatars, listLooks, createPhotoAvatar } from "./src/operations/avatars.mjs";
import { listVoices } from "./src/operations/voices.mjs";
import { listVideos, status, deleteVideos, downloadCore, download } from "./src/operations/videos.mjs";
import { submitGenerate, submitAudioGenerate, submitFromTemplate, studioRender, studioRenderStatus } from "./src/operations/render.mjs";
import { limits, usage } from "./src/operations/account.mjs";
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

async function generateFromAudio(auth, args) {
  const avatar = arg(args, "--avatar"), audioPath = arg(args, "--audio");
  const engine = arg(args, "--engine") || "heygen3", title = arg(args, "--title");
  const orientation = arg(args, "--orientation") || "landscape";
  if (!avatar || !audioPath)
    die('generate-from-audio needs --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4] ' +
        '[--orientation landscape|portrait] [--title T]');
  if (!RESOLUTIONS[orientation]) die(`--orientation must be landscape|portrait, got '${orientation}'`);
  if (!existsSync(audioPath)) die(`no such audio file: ${audioPath}`);
  try {
    const { video_id } = await submitAudioGenerate(auth, { avatar, audioPath, engine, title, orientation });
    console.log(JSON.stringify({ video_id }, null, 2));
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}

async function generateFromTemplate(auth, args) {
  const templateId = arg(args, "--template"), audioPath = arg(args, "--audio");
  const title = arg(args, "--title");
  if (!templateId || !audioPath)
    die('generate-from-template needs --template <template_id> --audio <file> [--title T]');
  if (!existsSync(audioPath)) die(`no such audio file: ${audioPath}`);
  try {
    const { video_id } = await submitFromTemplate(auth, { templateId, audioPath, title });
    console.log(JSON.stringify({ video_id }, null, 2));
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
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

async function raw(auth, path, args) {
  const j = arg(args, "--json");
  console.log(JSON.stringify(
    await api(auth, path, j ? { method: "POST", body: JSON.parse(j) } : {}), null, 2));
}

// ─── helpers / dispatch ─────────────────────────────────────────────────────────
function arg(a, f) { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; }

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
  generate-from-audio --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4]
           [--orientation landscape|portrait] [--title T]
           heygen3 (Avatar III) is real (HAR-verified 2026-07-07); heygen4 (Avatar IV) is [TODO][HNS].
           orientation defaults to landscape (1920x1080) — matches this pipeline's source recordings.
  generate-from-template --template <template_id> --audio <file> [--title T]
           renders a TEMPLATE (pre-composed background + avatar bubble, e.g. "Girl 1"/"girl 2")
           over your audio; visual composition untouched, only the audio swaps in.
           HAR-verified 2026-07-09 — see API-REFERENCE.md "Create from template".
  batch --file <items.txt|items.json> [--avatar id] [--voice id]
           [--orientation portrait|landscape] [--res 720p|1080p]
           [--out-dir DIR] [--delay 1500] [--download] [--iv]
           .txt = one script per line; .json = [{text,avatar?,voice?,title?,...}]
  download <video_id> [--res 1080p|720p] [--captions] [--out file.mp4]
  create-photo-avatar <image-path> [--name N]   Avatar III photo avatar → look_id
  studio-render --avatar <look_id> [--title T]  AI Studio render over the fixed 1-min audio
  list-voices [--limit 30] [--page 1] [--search term] [--json]
  list-videos [--limit 30] [--type heygen_video] [--json]
  status <video_id>           one-shot status + ETA/progress (no polling loop)
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
  case "generate-from-audio": await generateFromAudio(auth, rest); break;
  case "generate-from-template": await generateFromTemplate(auth, rest); break;
  case "batch":        await batch(auth, rest); break;
  case "create-photo-avatar": await createPhotoAvatar(auth, rest); break;
  case "studio-render": await studioRender(auth, rest); break;
  case "studio-render-status": await studioRenderStatus(auth, rest[0], rest[1]); break;
  case "list-voices":  await listVoices(auth, rest); break;
  case "list-videos":  await listVideos(auth, rest); break;
  case "status":       await status(auth, rest[0]); break;
  case "delete-video": await deleteVideos(auth, rest.filter((x) => !x.startsWith("--")), rest); break;
  case "raw":          await raw(auth, rest[0], rest.slice(1)); break;
  default: die(`unknown command: ${cmd} (try: help)`);
}