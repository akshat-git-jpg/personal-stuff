# heygen-web — handover

Context dump for a fresh session. Read this before touching anything here.

## What this is

A CLI that drives HeyGen's internal web-session API (`api2.heygen.com`) so Claude can
create avatars and render videos programmatically using the account's **unlimited
Avatar III** entitlement — the thing the official developer API meters and the official
MCP can't do at all.

Two surfaces exist for HeyGen work, and they are not interchangeable:

- **This CLI** (`heygen-web.mjs`) — web session cookies, unlimited Avatar III, free.
- **Official MCP** (`mcp__heygen__*`) — API key, only Avatar IV/V, every call costs credits.

The user only wants Avatar III. Never route their work through the MCP, and never pass
`--iv` (that switches this CLI to metered Avatar IV). This is a hard rule, saved in memory.

## The risk, stated plainly

This replays the web app's own requests using a logged-in session cookie. It very likely
violates HeyGen's terms and the risk lands on the user's paid account. The user accepted
that for their own account. Two things follow:

- Never spend credits or generate/render without the user explicitly asking.
- Do not build anything that defeats a quota cap (multi-account, counter spoofing). Using
  the entitlement the account already has is fine; taking more than it grants is not.

## Auth

Parsed from `infra/secrets/heygen-web-curls.txt` (gitignored). The CLI reads the `-b`
cookie block and the `x-zid` header out of a captured cURL. The Cloudflare cookies
(`cf_clearance`, `__cf_bm`) expire in minutes to hours; on a 403 the CLI tells you to
recapture a fresh `submit` cURL into that file. `heygen_token` is the durable login under
those cookies.

## The repeatable flow the user actually runs

They send an image, then want: make an Avatar III photo avatar from it, drop it into AI
Studio over one fixed 1-minute audio clip, and render. They don't download, and they
check the result themselves in the web app. The audio never changes
(`FULLTEST_indextts2_jamila_SYNCED_voiceover_1min.mp3`), baked into the templates.

Two commands:

```
node heygen-web.mjs create-photo-avatar <image> --name "..."     # → look_id
node heygen-web.mjs studio-render --avatar <look_id> --title "..." # builds draft + fires render
```

## How the avatar gets made (mined from HAR)

1. `GET /v1/avatar_group/photo/temp.create?num_photos=1` — presigned S3 PUT slot
2. `PUT` the bytes to S3. The presigned URL signs `host;x-amz-server-side-encryption`, so
   the PUT must send `x-amz-server-side-encryption: AES256` or S3 returns 403.
3. `POST /v1/media_evaluation/image_attributes.submit` — image eval, non-blocking
4. `GET /v1/avatar_group/photo/temp.convert?...&skip_validation=true` — returns `group_id`
5. `GET /v2/avatar_group/look.list?group_id=…` — the `look_id` (which equals the group_id),
   `is_valid: true`. The look is usable immediately; the eval workflow never has to finish.

## The studio render, and the gap

`studio-render` does: `text_draft.create` → `text_draft.save` (an ~18KB scene document) →
`text_draft.scene_avatar_preview` → returns a job_id. The two big bodies live in
`studio-templates/save.json` and `preview.json` with the avatar id and video id tokenized
as `__AVATAR_ID__` / `__VIDEO_ID__`. The avatar element carries `engine: "avatar_iii"`,
`use_unlimited_mode: true`, `use_avatar_iv_model: false`.

The catch: `scene_avatar_preview` is only the **in-editor preview** — the spinner on the
scene thumbnail. The real render is the **Generate** button in AI Studio, a different
endpoint we have never captured. Three HARs went by without it because the user had
"Preserve log" off, so clicking Generate wiped the network log before the save.

So today `studio-render` stops one step short of a finished video. To close it we need a
HAR captured with Preserve log ON while clicking Generate. It's probably a `/v1/pacific/...`
or `video…generate` POST. Do not guess and fire candidate generate URLs — that could spawn
real videos.

By default `studio-render` fires once and reports, no polling. Repeated polling looks
bot-like and the user flagged it as ban risk. There's a one-shot
`studio-render-status <video_id> <job_id>` for a single manual check.

## How we test that things stayed free

Before and after any create/render, snapshot every meter and diff it. The whole point is
that Avatar III should move nothing.

```
node heygen-web.mjs usage --save    # baseline, before the op
node heygen-web.mjs usage --diff     # after the op, prints the delta + a verdict
```

Meters tracked (`usage` snapshot):

- `credits` — paid balance (currently 200). Real money. Must stay flat.
- `seconds_consumed` / 1200 — a free monthly second-pool for avatar video (resets monthly).
- `priority_count` / 100 — priority render slots, one per video. Free; queue position only.
- `ai_image` / `ai_video` / `ai_concept` credits — separate pools for AI-*generated*
  elements (images, B-roll) inside the editor. The photo+audio flow never touches these,
  but a future flow that generates AI imagery would, so they're watched now.

Baseline lives in `infra/secrets/heygen-usage-last.json` (gitignored). Dropped the
`api_usage/quota` meter — that's the developer API key, always $0 here.

## Observations so far

- Every avatar creation and every editor preview this session left all meters flat.
  Avatar creation and preview are free.
- The user's one manual Generate also didn't move any meter, and `priority_count` didn't
  even tick 14 → 15. Read that two ways: either the real render is genuinely free, or the
  consumption only posts when the render finishes. Unresolved.
- Be honest about what's proven: `studio-render` only ever fired the *preview*, so every
  "unlimited confirmed" so far certifies the preview, not the Generate render. They're
  different endpoints. We can't claim the final render is free until we measure one
  start to finish.

## What to do next

1. Get the Generate HAR (Preserve log on), wire it as the final step of `studio-render`,
   and measure one completed render with `usage --diff`. That's the real unlimited proof.
2. If a render path ever moves the free-second pool, flag it: 1200s/month is ~20 minutes,
   so two-minute renders would hit a wall after ~10 a month even with no money spent.

## File map

- `heygen-web.mjs` — the CLI. Commands: auth-check, limits, usage, list-avatars,
  list-looks, list-voices, create-photo-avatar, studio-render, studio-render-status,
  generate, batch, list-videos, delete-video, download, raw.
- `studio-templates/save.json`, `preview.json` — tokenized AI Studio bodies, fixed audio.
- `README.md` — command reference.
- `infra/secrets/heygen-web-curls.txt` — auth source (gitignored).
- `infra/secrets/heygen-usage-last.json` — usage baseline (gitignored).
