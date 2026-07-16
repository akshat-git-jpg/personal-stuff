# Avatar render manifest

Manifest of avatars created and videos generated (moved from
`tooling/cli/heygen-web/renders-log.md` 2026-07-12; historical rows below = unlimited
Avatar III (heygen3), 1080p, landscape 16:9 unless noted).
**The record is now the HeyGen link, not a downloaded file.** Since Avatar III is unlimited
and the videos live on HeyGen, the default is to store the shareable project URL
(`https://app.heygen.com/videos/<title-slug>--<video_id>`) rather than download the MP4. Rows in
"Videos generated" are auto-appended on submit by heygen-web's `src/cli/render-log.mjs` with the
link already built from the render title. Only download (to `~/kb-scratch/video/heygen/<pipeline>/`,
media policy) when a pipeline actually needs the file locally.

Audio sources (Google Drive, account kushalbakliwal25@gmail.com):
- **test-man audio** — folder `1x-uUSd-c5tZe3UoyD284tuTt5w2q2rsv` (male voiceover; intro/body/conclusion)
- **girl-1 audio** — folder `1H2Ffkqw_xWMUR20EWLWQ7ydTGAQ-rZoL` (intro/BODY/conclusion at root)
- **girl-2 audio** — folder `1KveaLcUr2j3KwudLK1XrxFWQYWKfbUvh` → `input/` subfolder (intro/body/conclusion)

HeyGen templates:
- `girl-1` = `7629dffbebe141eb8f701630948bd707` (Girl 1, 16:9)
- `girl-2` = `887ad69c743d4740a0174eecb3198ef4` (girl 2, 16:9)
- (also exist: Girl 3 `7ff3a8672bc24be8817be39139f2e044`, boy 1 `5692cc6b192e4a5db08ce967a377428f`)

**Note:** `generate-from-audio` only accepts Talking Photos (owned photo
avatars). Public/stock avatars and non-account avatar ids fail with
`photar_not_found`. **The failure can surface at RENDER time, not submit** — the
submit returns a `video_id` and looks fine, but the video ends up `status:failed`
with `error_type: photar_not_found` ("Talking Photo not found or has been
deleted"), shown in-app as "That avatar is no longer available". So submit
success does NOT prove an avatar is usable — verify with `list-videos` status.
Failed attempts kept for the record (all `photar_not_found` on girl-1 intro):
- public avatar `Hada_LivelyGestures_Side_public` (video `29c168a74df44866bab0b34abe2776a6`)
- avatar `f64bdab33dcf4136b32d66da2a74ed28` — fails via this CLI because it is an
  **`instant_avatar`** (avatar group `80a93446fd274f83b6ac72e5fcc6b10c`), NOT a
  Talking Photo. `generate-from-audio`'s payload hardcodes `avatar_type:
  "photo_avatar"` + `photar_version: "V3"`, so HeyGen looks it up in the
  Talking-Photo table and returns `photar_not_found`. The web UI renders it fine
  by sending `avatar_type: "instant_avatar"` with `avatar_id` = `avatar_state_id`
  = the look id (HAR-confirmed 2026-07-16). Failed here at submit 2026-07-11
  (`72395a3ee4c744c1973e2b544e4f2244`) and at render 2026-07-16
  (`a3767785d26c4400905f4fb8225ede5d`, deleted). See decisions.md.

## Avatars created (photo → Avatar III)

| Name | Source image (~/Downloads) | look_id (avatar_id) |
|---|---|---|
| Bearded Man 1 | `Bearded Man 2K Jul 9.jpeg` | `14eea609c76343399b1f74508b0f28a9` |
| Man with Specs Black Shirt | `Man with Specs Black Shirt Jul 09 2023.jpeg` | `6bdc449aaabf4f998c34ac7490260285` |
| Woman with Laptop | `Woman with Laptop 2K Jul 9.jpeg` | `3949a56f150941bd860d68c64e6f8f0b` |
| Harry (pre-existing) | — | `cb3a91d35fde44c8a32c04e0abb22710` |

## Videos generated

Each row stores the HeyGen shareable link (`/videos/<title-slug>--<video_id>`, double dash) — auto-built
from the render title on submit. Open the link to view/download on HeyGen; no local copy is kept.

| HeyGen link | Avatar / template | Audio | video_id |
|---|---|---|---|
| [heygen link](https://app.heygen.com/videos/bearded-man-1-tutorial--bfaef33977dd4778bb84a8e2d6b77e02) | Bearded Man 1 | TTS (tutorial script, Patrick voice) | `bfaef33977dd4778bb84a8e2d6b77e02` |
| [heygen link](https://app.heygen.com/videos/bearded-man-1-intro--c232ac8259654e39ac06d4c793c02b72) | Bearded Man 1 | test-man intro | `c232ac8259654e39ac06d4c793c02b72` |
| [heygen link](https://app.heygen.com/videos/harry-intro--514febe2ef2f4c16a03068aaf04c1852) | Harry | test-man intro | `514febe2ef2f4c16a03068aaf04c1852` |
| [heygen link](https://app.heygen.com/videos/man-with-specs-intro--ad4bcc76dd114cc485f85a1b8c040b35) | Man with Specs Black Shirt | test-man intro | `ad4bcc76dd114cc485f85a1b8c040b35` |
| [heygen link](https://app.heygen.com/videos/girl-1-intro--dc52ec0d33cb4f62aa492c8d5698437c) | template girl-1 | girl-1 intro | `dc52ec0d33cb4f62aa492c8d5698437c` |
| [heygen link](https://app.heygen.com/videos/girl-2-intro--3a9cf68b1cb0425790c98c6c393b16f7) | template girl-2 | girl-2 intro | `3a9cf68b1cb0425790c98c6c393b16f7` |
| [heygen link](https://app.heygen.com/videos/woman-with-laptop-girl1-intro--7d4f89e1d5d3447eaadedd31be10ad5c) | Woman with Laptop | girl-1 intro | `7d4f89e1d5d3447eaadedd31be10ad5c` |
| [heygen link](https://app.heygen.com/videos/look-6c5ff5-girl1-intro-test--47a001558c114315b980f4c0978b6ad1) | look `6c5ff5…` (owned Talking Photo) | girl-1 intro | `47a001558c114315b980f4c0978b6ad1` |
| [heygen link](https://app.heygen.com/videos/look-28e76f-testman-intro-test--6ea30056fb6a4333bbaed0c1320ca996) | look `28e76f…` (owned Talking Photo) | test-man intro | `6ea30056fb6a4333bbaed0c1320ca996` |
| [heygen link](https://app.heygen.com/videos/rhys-4e1d77ccc101432da998cddf40a97c03--bf2e810863044b04b84eaaff4ef5a9d4) | 4e1d77ccc101432da998cddf40a97c03 | intro.mp3 | `bf2e810863044b04b84eaaff4ef5a9d4` |
| [heygen link](https://app.heygen.com/videos/rhys-1e60f6f2c9ca45c1afff023bac94a8cc--120cb3b42ba84430867b9e2e553d6f36) | 1e60f6f2c9ca45c1afff023bac94a8cc | intro.mp3 | `120cb3b42ba84430867b9e2e553d6f36` |
| [heygen link](https://app.heygen.com/videos/rhys-354ec561f35b43bb8208a95137ce958c--b309b62bfc7b4f749d40e1830d7d7a3b) | 354ec561f35b43bb8208a95137ce958c | intro.mp3 | `b309b62bfc7b4f749d40e1830d7d7a3b` |
| [heygen link](https://app.heygen.com/videos/dustin-d166ced8b1cb467188bb8e59836c4423--78db1955453f49fcaccdb946d6d4484e) | d166ced8b1cb467188bb8e59836c4423 | intro.mp3 | `78db1955453f49fcaccdb946d6d4484e` |
| [heygen link](https://app.heygen.com/videos/dustin-6ab533f941fe457db0e267d8c79136f0--7ebaefef2c5a42478745d4f25c71933d) | 6ab533f941fe457db0e267d8c79136f0 | intro.mp3 | `7ebaefef2c5a42478745d4f25c71933d` |
| [heygen link](https://app.heygen.com/videos/dustin-11e82ae7df844be8a5695ee864e44f49--e9c7314895eb4b31a591596b6efb33f7) | 11e82ae7df844be8a5695ee864e44f49 | intro.mp3 | `e9c7314895eb4b31a591596b6efb33f7` |
