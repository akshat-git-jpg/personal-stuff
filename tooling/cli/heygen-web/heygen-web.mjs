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

import { run } from "./src/cli/dispatch.mjs";
run(process.argv.slice(2));
