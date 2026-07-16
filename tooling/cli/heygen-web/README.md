# heygen-web

Drive HeyGen's **web-session** API from the CLI to get **unlimited free Avatar III**
videos — the thing the official developer API meters and the official MCP can't do.

## Why this exists

| Path | Auth | Avatar III | Avatar IV |
|------|------|-----------|-----------|
| Official API / MCP | API key | ~3 credits/min (metered) | ~20 credits/min |
| **Web app (this CLI)** | **session token** | **∞ unlimited / free** | n/a |

HeyGen ties "unlimited Avatar III" to the **subscription web session**, not the API key.
This CLI replays the web app's *own internal request* using that session token, so
generations bill as unlimited subscription usage instead of metered API usage.

## ⚠️ Read before using

- This **circumvents HeyGen's API monetization** and is very likely against their **Terms
  of Service**. Risk lands on the **paid account** (possible suspension/ban).
- It is **account-bound** (uses one logged-in user's session) and **brittle** (internal
  endpoints/UI can change without notice).
- Use only on **your own paid account**, for your own content. You have the unlimited
  Avatar III entitlement; this just accesses it programmatically.

## Setup

1. Create `infra/secrets/heygen-web.env` (gitignored):
   ```
   HEYGEN_WEB_TOKEN=<session token from the logged-in web app>
   HEYGEN_WEB_COOKIE=<optional raw Cookie header, only if the endpoint needs it>
   HEYGEN_WEB_BASE=<optional override of the internal API host>
   ```
2. `node heygen-web.mjs whoami` to sanity-check the token.

## Capturing the request (REQUIRED to finish the build)

The endpoints + payload in `heygen-web.mjs` are **placeholders** marked `TODO(curl)`.
They must be filled from a real web-app generation request:

1. Chrome → open the HeyGen editor → **DevTools → Network** tab.
2. Generate one **Avatar III** video the normal (free) way.
3. Find the **generate** request (filter `video` / `generate`), right-click →
   **Copy → Copy as cURL**.
4. From that cURL we read: the **host**, the **path**, the **auth header**
   (Bearer? cookie? `x-api-key`?), and the **JSON body shape** — and wire them in.

Also capture the **status/poll** request (the one DevTools fires while the video renders)
and the **list-avatars / voices** requests the editor uses, so every command points at the
real internal endpoints.

> The captured cURL contains your **session token** — sensitive. Don't paste it anywhere
> public; consider logging out / rotating after the token is wired in.

## Commands

```bash
node heygen-web.mjs auth-check
node heygen-web.mjs limits
node heygen-web.mjs list-avatars [--limit 20]
node heygen-web.mjs list-looks --group <group_id>
node heygen-web.mjs list-voices [--limit 30] [--page 1] [--search term] [--json]
node heygen-web.mjs generate --avatar <look_id> --voice <id> --text "..." [--title T] [--orientation portrait|landscape] [--res 720p|1080p] [--iv]
node heygen-web.mjs generate-from-audio --avatar <avatar_id> --audio <file> [--engine heygen3|heygen4] [--title T]
node heygen-web.mjs batch --file <items.txt|items.json> [--avatar id] [--voice id] [--res 720p] [--out-dir DIR] [--download]
node heygen-web.mjs list-videos [--limit 30] [--type heygen_video] [--json]
node heygen-web.mjs delete-video <video_id> [<video_id> ...]
node heygen-web.mjs download <video_id> [--res 1080p|720p] [--captions] [--out file.mp4]
node heygen-web.mjs raw <path> [--json '<body>']
```

### batch

`batch` loops the unlimited-Avatar-III submit over many clips. Two input forms:

- **`.txt`** — one script per line (blank lines and `#` comments skipped); pair with
  shared `--avatar` / `--voice`.
- **`.json`** — `[{ "text": "...", "avatar"?, "voice"?, "title"?, "orientation"?, "res"? }]`;
  per-clip fields override the shared flags.

Every item is validated (text+avatar+voice resolvable) **before** anything is submitted.
Writes a `batch-<timestamp>.json` manifest mapping each clip → `video_id`. With
`--download` it retries each render until the MP4 is ready, then saves it to `--out-dir`.

## How it works (captured 2026-06-26)

- Host: **`api2.heygen.com`** (the web app's internal API, not public `api.heygen.com`).
- Auth: **session cookies** + `x-zid` header — parsed automatically from
  `infra/secrets/heygen-web-curls.txt` (no re-typing the cookie).
- The unlimited switch is in the generate body:
  `avatar_settings: { use_avatar_iv_model: false, use_unlimited_mode: true }`.
- Endpoints: `POST /v2/avatar/shortcut/submit` (generate),
  `GET /v2/avatar_group.private.list` (avatars),
  `GET /v2/avatar_group/look.list?group_id=…` (looks).

## Full flow (all verified working)

```bash
node heygen-web.mjs limits                       # generative/free-credit pool (NOT the Avatar III cap — III is unlimited)
node heygen-web.mjs list-avatars                 # find a group_id
node heygen-web.mjs list-looks --group <gid>     # find a look_id (avatar_id)
node heygen-web.mjs generate --avatar <look_id> --voice <voice_id> \
     --text "..." --orientation portrait         # → returns data.video_id (unlimited Avatar III)
# wait ~1 min for it to render, then:
node heygen-web.mjs download <video_id> --res 1080p --out clip.mp4
```

Endpoints (api2.heygen.com):
- generate `POST /v2/avatar/shortcut/submit` → `data.video_id`
- download `POST /v1/pacific/collaboration/video.download` `{video_id,resolution,resource_type:"heygen_video",with_captions}` → `data.workflow_id` (or `download_url` if cached)
- poll `GET /v1/pacific/collaboration/video.download/status?workflow_id=…` → `COMPLETED` + `download_url` (resource2.heygen.ai MP4)

## Status

✅ **Working end-to-end:** `auth-check`, `limits`, `list-avatars`, `list-looks`,
`list-voices`, `generate` (unlimited Avatar III; `--iv` = metered IV), `batch`,
`list-videos`, `delete-video`, `download` (transcode → MP4).
Verified live (2026-06-28): voices list, video list, batch parse+validation, MP4 download.
ℹ️ No render-status endpoint — `download` works once the video has rendered (generate,
wait ~1 min, then download). `batch --download` re-tries to ride that out.
ℹ️ `list-voices --search` filters the **current page** only; raise `--limit` to widen.

## ⚠️ Two caveats

- **Avatar III IS unlimited — the `limits` 1200s pool is a different meter.** The
  `/v1/avatar/video_generate/limits` endpoint's `total_limit: 1200` seconds is the
  **generative / free-credit** pool (Avatar IV + AI generative features), *not* an
  Avatar III cap. Unlimited-mode Avatar III submits do **not** consume it — proven
  2026-07-16 with `usage --save`/`--diff` around a real render on look
  `6c5ff54cb83e4284b0119598c058d3b2`: `credits +0 seconds +0` (only a free priority
  slot moved). So ignore the "min left" line for Avatar III; use `usage --diff` to
  confirm any op is free.
- **Cookie expiry.** Cloudflare cookies (`cf_clearance`/`__cf_bm`) rotate in minutes–hours.
  On a 403/Cloudflare response, recapture one fresh `submit` cURL into
  `infra/secrets/heygen-web-curls.txt` (only the `-b` cookie + `x-zid` matter). The CLI detects this.

## Repository Layout

- `heygen-web.mjs`: Thin CLI entrypoint.
- `src/client/endpoints.mjs`: Endpoint registry.
- `src/client/payloads/`: Payload JSON files.
- `src/operations/`: Atomic operations mapped from endpoints.
- `src/workflows/`: Composite end-to-end commands.
