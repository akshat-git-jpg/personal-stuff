# heygen-web render log

Manifest of avatars created and videos generated with this CLI. All videos =
unlimited Avatar III (heygen3), 1080p, landscape 16:9 unless noted.
**Media files live outside the repo** in `~/kb-scratch/heygen-web-renders/`
(media policy); this tracked manifest is the record. Rows in "Videos
generated" are auto-appended on submit by `src/cli/render-log.mjs`
(output column starts as `(pending download)` — update it after downloading).

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
`photar_not_found`. To drive a public avatar with audio, a different
(non-photar) endpoint would be needed — not currently wired in this CLI.
Failed attempts kept for the record: avatar `f64bdab33dcf4136b32d66da2a74ed28`
(video `72395a3ee4c744c1973e2b544e4f2244`) and public avatar
`Hada_LivelyGestures_Side_public` (video `29c168a74df44866bab0b34abe2776a6`),
both `photar_not_found` on girl-1 intro audio.

## Avatars created (photo → Avatar III)

| Name | Source image (~/Downloads) | look_id (avatar_id) |
|---|---|---|
| Bearded Man 1 | `Bearded Man 2K Jul 9.jpeg` | `14eea609c76343399b1f74508b0f28a9` |
| Man with Specs Black Shirt | `Man with Specs Black Shirt Jul 09 2023.jpeg` | `6bdc449aaabf4f998c34ac7490260285` |
| Woman with Laptop | `Woman with Laptop 2K Jul 9.jpeg` | `3949a56f150941bd860d68c64e6f8f0b` |
| Harry (pre-existing) | — | `cb3a91d35fde44c8a32c04e0abb22710` |

## Videos generated

Filename convention: `<description>__<avatar-or-template-id>.mp4`. Paths are
relative to `~/kb-scratch/heygen-web-renders/`.

| Output file | Avatar / template | Audio | video_id |
|---|---|---|---|
| `bearded-man-1-tutorial__14eea609c76343399b1f74508b0f28a9.mp4` (~/Downloads) | Bearded Man 1 | TTS (tutorial script, Patrick voice) | `bfaef33977dd4778bb84a8e2d6b77e02` |
| `test-man/beardedman-intro__14eea609c76343399b1f74508b0f28a9.mp4` | Bearded Man 1 | test-man intro | `c232ac8259654e39ac06d4c793c02b72` |
| `test-man/harry-intro__cb3a91d35fde44c8a32c04e0abb22710.mp4` | Harry | test-man intro | `514febe2ef2f4c16a03068aaf04c1852` |
| `test-man/specsman-intro__6bdc449aaabf4f998c34ac7490260285.mp4` | Man with Specs Black Shirt | test-man intro | `ad4bcc76dd114cc485f85a1b8c040b35` |
| `girl-1/girl1-intro__7629dffbebe141eb8f701630948bd707.mp4` | template girl-1 | girl-1 intro | `dc52ec0d33cb4f62aa492c8d5698437c` |
| `girl-2/girl2-intro__887ad69c743d4740a0174eecb3198ef4.mp4` | template girl-2 | girl-2 intro | `3a9cf68b1cb0425790c98c6c393b16f7` |
| `girl-1/womanlaptop-intro__3949a56f150941bd860d68c64e6f8f0b.mp4` | Woman with Laptop | girl-1 intro | `7d4f89e1d5d3447eaadedd31be10ad5c` |
