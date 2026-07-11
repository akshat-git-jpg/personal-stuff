# heygen-web — full endpoint catalog

Everything seen across HAR captures (`app.heygen.com{,2..13,15}.har` in Downloads, mined
2026-06-26 through 2026-07-09), whether or not it's wired into `heygen-web.mjs` today.
Purpose: never re-mine a HAR from scratch for an endpoint already seen here. All are
`api2.heygen.com`, auth via the same cookie+`x-zid` (+`x-space-id`, see below) as everything
else in this CLI.

## Video draft lifecycle (the core flow)

| Endpoint | Purpose | Wired? |
|---|---|---|
| `POST /v1/text_draft.create` | Start a draft. Body: `{video_output:{resolution:{width,height},fps}, source_type:"ai_studio"}` → `data.video_id`. | ✅ `generate-from-audio` |
| `POST /v1/text_draft.save` | Persist the full scene doc (script/captions/visual/alignments). Real UI fires this repeatedly as you edit. | ✅ |
| `POST /v1/text_draft.generate` | The actual render kickoff. Body wraps the same text_draft under `draft_details.text_draft_with_metadata`, plus `video_id`, `enable_watermark`, `generate_type`, `version_id`. → `data.video_id` (render job id). | ✅ |
| `POST /v1/text_draft.scene_avatar_preview` | Kicks an in-editor preview render (the "Rendering..." spinner next to Motion Engine) → `job_id`. NOT required for a working final render — a full working capture (`app.heygen.com13.har`) never called this at all. | ❌ not needed |
| `GET /v1/text_draft.scene_avatar_preview.check?job_id=&video_id=` | Poll the preview job above. | ❌ (unused, preview step skippable) |
| `GET /v1/text_draft.scene_avatar_preview.get_from_cache?video_id=` | Check for a cached preview render for this video_id. Returned "no result" even in a working capture — not the cause of correct framing. | ❌ dead end, don't chase |
| `GET /v1/project/items/status?item_ids=<id>` | **One-shot** status+ETA+progress for a render — `{status, progress 0-100, eta (seconds), thumbnail_url, error_code/type/message}`. Far better than polling `list-videos`. | ✅ `status <video_id>` |
| `POST /v1/pacific/collaboration/video.download` + `GET .../video.download/status` | Transcode-and-download chain. | ✅ `download` |
| `DELETE /v1/project/item.trash` | Trash a video. | ✅ `delete-video` |

**Resolved (2026-07-09):** the landscape pillarboxing on `generate-from-audio` was never
fixable by adjusting canvas/scale/headers because we were rendering the wrong asset
entirely — a generic test avatar ("Lilly") with a portrait-native source photo, standing in
for avatars that were never actually meant to go through this raw AI-Studio path. See
"Create from template" below: the original `7629dffb...`/`887ad69c...` ids the user gave
for girl 1/girl 2 turned out to be **template ids**, not avatar ids — they resolve on
`heygen_template.list`, not `avatar_group.*.list`, which is why they never showed up when
searched as avatars. A template already bundles a correctly-composed 16:9 scene (see
below), so this whole investigation (artifact references, priming saves, header fixes) was
solving a problem specific to the stand-in avatar, not a general landscape-canvas issue.

## Create from template (mined from `app.heygen.com15.har`, 2026-07-09)

A **template** bundles a whole pre-composed scene — background image + avatar (often a
circular "webcam bubble" via `matting: true` / `circle_background`, not a full-frame
video) — under a single `template_id`, already laid out for the template's own aspect
ratio. **This is what the user's original `7629dffbebe141eb8f701630948bd707` (girl 1) and
`887ad69c743d4740a0174eecb3198ef4` (girl 2) ids actually are** — confirmed via
`heygen_template.list`, both `ratio: "16:9"`. They are NOT avatar/look ids and never
resolve on any `avatar_group.*` endpoint — that's the whole reason the earlier landscape
investigation went looking in the wrong place.

| Endpoint | Purpose |
|---|---|
| `GET /v1/heygen_template.list?source_to_video=false&limit=20` | List your templates: `{id, name, ratio, thumbnail_image_url, draft_version, ...}`. This is where `7629dffb...`("Girl 1"), `887ad69c...`("girl 2"), `7ff3a867...`("Girl 3"), `5692cc6b...`("boy 1") all live. |
| `GET /v2/heygen_template.get?id=<template_id>` | The template's full pre-authored `data.text_draft.text_draft` (script/captions/visual/alignments) + `data.text_draft.video_output`. For "Girl 1": `video_output` is `1920x1080`; `visual.elements` has one `image` (full-bleed background, scale ~1.54x, `content.src` a static PNG), one `avatar` (`matting: true`, `circle_background: "#f6f6fc"`, position offset `{x:0, y:0.388}`, scale ~1.49x — a bubble, not full-frame), one `scene` wrapping both (`layout: [image_id, avatar_id]`, background image first). The avatar's own `avatar_id`/`avatar_group_id` are DIFFERENT ids again (`d365dda3...`/`3a5e0838...` for this template) — a third layer of indirection: template → (image + avatar_id) . |
| `GET /v1/pacific/template.list2` | Template *tags/categories* (Training, Corporate, Marketing, Sales, Tutorials & Explainers, ...) — for browsing/filtering, not needed to use a known template_id. |
| `GET /v1/templates/weights?variant=personalize` | Per-template ranking weights (recommendation/sort signal) — browsing-only, skip. |

**The create-from-template flow** (confirmed via a real capture, all four `text_draft.save`
calls share the same `visual.elements` verbatim from the fetched template — only `script`
changes):

1. `GET /v2/heygen_template.get?id=<template_id>` → the template's `text_draft` + `video_output`.
2. `POST /v1/text_draft.create` with body `{video_output: <template's video_output>, source_type: "ai_studio_template", template_id: "<template_id>"}` → new `video_id`. **The `source_type`/`template_id` pairing is the key structural difference from the plain AI-Studio path** (`source_type: "ai_studio"`, no `template_id`) — this is what actually links the draft to the template server-side, not just copying its visual elements by hand.
3. Upload your audio exactly like `generate-from-audio` already does (`file/url.get` → S3 PUT → `file.upload` → `fast_asr`), then swap the template's placeholder `script.elements` entry (usually `type: "tts"`, a `<break .../>` stub) for a real `type: "audio"` element pointing at your `transcodeUrl` — same shape `generate-audio-save.json` already builds. **Leave `visual.elements` (image + avatar + scene) completely untouched** — that's the template's composition, already correct for its aspect ratio.
4. `POST /v1/text_draft.save` with the modified text_draft.
5. `POST /v1/text_draft.generate` — same wrapper shape as the plain path (`draft_details.text_draft_with_metadata`), `video_id`, `enable_watermark: false`, `generate_type: "normal"`, `version_id: <random hex>`, `complete_tts_in_backend: true`.
6. `GET /v1/project/items/status?item_ids=<video_id>` to check progress (same as the plain path).

Not yet implemented in `heygen-web.mjs` (no `generate-from-template` command yet) and not
yet verified end-to-end with our own audio (the captured HAR was still `processing` when
saved). If wiring this in, reuse `uploadAudio()` and the S3-upload path from
`submitAudioGenerate` unchanged — only the create body and the script-element swap differ.

### Interesting but unexplored: speech-to-speech / voice conversion

Two endpoints appeared in this HAR that weren't in any earlier capture:

| Endpoint | Notes |
|---|---|
| `POST /v1/speech_to_speech.generate` | Body/response not yet captured in detail — name strongly suggests voice conversion (upload audio in your own voice, get it back in a target voice). Relevant to the RVC-style pitch-conversion work archived at `pipelines/archive/rvc-flow/` if HeyGen's own S2S turns out usable — worth a dedicated look before building anything, not investigated further here. |
| `POST /v2/audio_sbs.prepare` | "sbs" likely "side-by-side" — unclear purpose, not investigated. |

## Avatar & look management

| Endpoint | Purpose | Wired? |
|---|---|---|
| `GET /v2/avatar_group.private.list?limit=&page=` | List your avatar groups. | ✅ `list-avatars` |
| `GET /v3/avatar_group.public.list?limit=&page=&list_filter=ALL&display_type=GRID&recommendation_algorithm=elastic` | Browse HeyGen's public/stock avatar catalog. | ❌ |
| `GET /v2/avatar_group?id=<group_id>` | Single group's full detail. | ❌ |
| `GET /v2/avatar_group/look.list?group_id=&type=all&page=&limit=` | Looks (→ `look_id`, used as `avatar_id` for generate) under a group. | ✅ `list-looks` |
| `GET /v2/avatar.get?look_id=<id>` | Single look's full detail (image_url, is_valid, etc). | ❌ |
| `GET /v1/avatar_look.cross_ref_candidates?avatar_group_id=&include_private_motion_photo=true` | Candidate looks/motion variants for a group. | ❌ |
| `GET /v1/avatar_artifact.list?avatar_id=<id>` | Pre-generated "Autogenerated Footage" motion loop for a photo avatar (`base_artifact.artifact_id`, `video_url`, `motion_type`). For avatar `4553f46f2ceb4779990f0a83f7eab7ae` ("Lilly") this is natively ~1920x1080. Referencing it via `engine_settings.engine_type:"avatar_artifact"` did NOT fix the landscape pillarbox bug (see above) — kept documented since the artifact itself (a real motion video asset) may be useful for other purposes later. | ❌ |
| `GET /v1/avatar_group/voices.get?avatar_group_id=&is_public=false` | The avatar's own recommended/default voice(s) — e.g. Lilly → voice_id `09d88c036bf449fa905900c08b235a37` ("Christy"). | ❌ |
| `GET /v1/avatar_group/slot_info.get` | Avatar creation slots remaining (`{remaining, total}`). | ❌ |
| `GET /v1/avatar_group/redo.get` | Redo credits remaining for avatar regen. | ❌ |
| `GET /v1/avatar_group/reset.get` | Reset credits remaining. | ❌ |

## Voice

| Endpoint | Purpose | Wired? |
|---|---|---|
| `GET /v1/voice.list?page=&limit=` | Browse all voices. | ✅ `list-voices` |
| `GET /v1/voice.get?voice_id=<id>` | Single voice detail. | ❌ |

## Account, billing, limits

| Endpoint | Purpose | Wired? |
|---|---|---|
| `GET /v1/avatar/video_generate/limits` | Free-second pool used/remaining (the "unlimited" meter). | ✅ `limits`/`usage` |
| `GET /v1/video_history/monthly_priority_video_count` | Priority render slots used this month. | ✅ `usage` |
| `GET /v1/account/usage` | Paid videos created (14-day + billing-cycle counts), billing cycle dates. | ❌ |
| `GET /v1/payment/subscription` | Current plan/tier detail. | ❌ |
| `GET /v1/payment/product` | All plan tiers/pricing. | ❌ |
| `POST /v1/payment/migrate_to_credit_first.check` | Credit balance + base/recommended plan (used by `usage` for `credits`). | ✅ `usage` |
| `GET /v1/api_key.get` | The account's developer API key (regular + suffix). Careful — this IS the metered official-API credential; unrelated to this CLI's unlimited web-session path. | ❌ |
| `POST /v1/check_availability` | Entitlement/credit check before an action, e.g. `{entitlement_name:"generate_image_assets", unit_type:"COUNT", number_of_units:1}` → `{available, remaining_units, remaining_credits, credits_to_consume}`. Generic pre-flight check pattern, reusable for other entitlements. | ❌ |
| `GET /v1/file.ai_generate_element.limits` | AI image/video/concept element credit pools. | ✅ `usage` |

## Project / asset listing

| Endpoint | Purpose | Wired? |
|---|---|---|
| `GET /v1/project/items?item_types=&limit=&sort_key=&sort_order=&include_children=&is_trash=` | List videos/assets. `item_types=heygen_video` for renders, `item_types=asset` for uploads. | ✅ `list-videos` (heygen_video only) |
| `GET /v1/projects?limit=&project_types=&is_trash=` | List projects (e.g. `project_types=brand_kit`). | ❌ |
| `GET /v1/asset_folder.list?limit=` | Asset folder tree (e.g. "Brand Kit" folder). | ❌ |
| `POST /v1/pacific/video/thumbnail/upload` | Upload a custom thumbnail for a video. | ❌ |

## Brand kit / design assets

| Endpoint | Purpose | Wired? |
|---|---|---|
| `GET /v1/brand/kit/list?limit=` | List brand kits (colors, logo). | ❌ |
| `GET /v1/brand/kit/<brand_kit_id>` | Single brand kit detail. | ❌ |
| `GET /v1/pacific/video/<video_id>/brand_kit` | Brand kit attached to a specific video/draft. | ❌ |
| `GET /v1/brand/glossary/list?limit=` | Brand-specific term glossary (pronunciation overrides etc). | ❌ |
| `GET /v1/brand/design_elements/public_catalog` | Public design-element catalog (name cards, etc). | ❌ |
| `GET /v1/brand_kit/font`, `GET /v1/pacific/font/list`, `GET /v1/public/font` | Font catalogs (brand-kit-scoped, pacific-editor-scoped, public). | ❌ |
| `GET /v1/pacific/layout.list` | System scene layouts (e.g. `PROFESSIONAL_portrait`, ratio `9:16`). | ❌ |
| `GET /v1/pacific/resource/preset/list` | Preset icon/resource packs (grouped, e.g. "Weather"). | ❌ |
| `GET /v1/stock_resource.search?media_type=image&query=&page_num=&page_size=&use_cache=&project_id=` | Stock image/video search (Pexels-backed). | ❌ |

## Misc / account identity

| Endpoint | Purpose | Wired? |
|---|---|---|
| `GET /v1/user.get` | Logged-in user identity (name, email, third-party links). | ❌ |
| `GET /v1/space.get?space_id=`, `GET /v1/space.list` | Workspace ("space") identity/list. `heygen_space` cookie value = this account's space_id, now parsed into `auth.spaceId` for the `x-space-id` header. | partially (spaceId parsing only) |
| `GET /v1/space/user.list` | Members of the space. | ❌ |
| `GET /v1/space/discoverability/list_join_requests` | Pending join requests. | ❌ |
| `GET /v2/video_translate/support_languages` | Supported dub/translate languages + preview audio URLs. | ❌ |
| `POST /v1/user_cache.create` / `GET /v1/user_cache.get` | UI preference cache (theme, feedback-shown ids, cta counts) — not render-relevant. | ❌ skip |
| `POST /v1/draft/heartbeat` | Keep-alive ping while a draft is open in the editor — not render-relevant. | ❌ skip |
| `POST /v1/movio.batch_track`, `GET /v1/heygen_server/notifications/*`, `GET /v1/heygen_server/noticeable/*`, `POST /v1/appsync/token` | Analytics/notifications/realtime-token noise — not render-relevant, ignore in future HAR mining. | ❌ skip |

## Headers that matter

Beyond the cookie + `x-zid` this CLI already sends, the real editor also sends:

- `x-space-id` — the account's space id (from the `heygen_space` cookie, now auto-parsed by `loadAuth()`).
- `x-path` — the actual editor route, e.g. `/create-v4/draft` (before a video_id exists) or `/create-v4/<video_id>` (once it does). We previously hardcoded a generic `/avatar` for every call; `api()` now accepts an `xPath` override per call.
- `x-last-build` — a client build timestamp. Not reproduced (unclear if it matters; no evidence either way).
- `traceparent`, `x-datadog-*` — Datadog RUM tracing, safe to omit (analytics-only).
