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
import { batch } from "./src/workflows/batch.mjs";
import { raw } from "./src/workflows/raw.mjs";
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