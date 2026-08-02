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
| [heygen link](https://app.heygen.com/videos/look-d993f02290684062aee26517e14d5f7e--412fa338215946b0ac96e0d6042e3378) | d993f02290684062aee26517e14d5f7e | intro.mp3 | `412fa338215946b0ac96e0d6042e3378` |
| [heygen link](https://app.heygen.com/videos/look-e15dd7a8ed3f45d1929f87847db59d76--813e66b3ab244135b2213d0cbaec3f39) | e15dd7a8ed3f45d1929f87847db59d76 | intro.mp3 | `813e66b3ab244135b2213d0cbaec3f39` |
| [heygen link](https://app.heygen.com/videos/look-ae822c76977d48679a3d4ad3efefc798--a90a8176f6ed46b6bd1e65f1f471ed99) | ae822c76977d48679a3d4ad3efefc798 | intro.mp3 | `a90a8176f6ed46b6bd1e65f1f471ed99` |
| [heygen link](https://app.heygen.com/videos/look-1b3a4c4ea87c4d81a43f11552e06abcf--9188b0c8d44045d8ab2274844b92d6c3) | 1b3a4c4ea87c4d81a43f11552e06abcf | intro.mp3 | `9188b0c8d44045d8ab2274844b92d6c3` |
| [heygen link](https://app.heygen.com/videos/look-167a2a23120945278b55a29e5eb3bf77--84c9ba34d1e644aa83dbf4c951d749eb) | 167a2a23120945278b55a29e5eb3bf77 | intro.mp3 | `84c9ba34d1e644aa83dbf4c951d749eb` |
| [heygen link](https://app.heygen.com/videos/look-381bff7c83f14ec29255d41e1d23ec19--08ae1a9fd94f487abc2bac9db56223c0) | 381bff7c83f14ec29255d41e1d23ec19 | intro.mp3 | `08ae1a9fd94f487abc2bac9db56223c0` |
| [heygen link](https://app.heygen.com/videos/test-01-s01--10d518a536ab45eb8f6eebde948ff06a) | 7629dffbebe141eb8f701630948bd707 | s01.mp3 | `10d518a536ab45eb8f6eebde948ff06a` |
| [heygen link](https://app.heygen.com/videos/test-01-s02--da07901a72fd49d3a8a70cfe7be47ebd) | 7629dffbebe141eb8f701630948bd707 | s02.mp3 | `da07901a72fd49d3a8a70cfe7be47ebd` |
| [heygen link](https://app.heygen.com/videos/test-01-s04--f805f5ee3b8249cc9d5a2280618c3a20) | 7629dffbebe141eb8f701630948bd707 | s04.mp3 | `f805f5ee3b8249cc9d5a2280618c3a20` |
| [heygen link](https://app.heygen.com/videos/test-01-s05--84de977213f646cab7e30607d0644a4d) | 7629dffbebe141eb8f701630948bd707 | s05.mp3 | `84de977213f646cab7e30607d0644a4d` |
| [heygen link](https://app.heygen.com/videos/test-01-s06--e07d23e337344a0ab9835cf2743876f0) | 7629dffbebe141eb8f701630948bd707 | s06.mp3 | `e07d23e337344a0ab9835cf2743876f0` |
| [heygen link](https://app.heygen.com/videos/test-01-s07--b5a92b3c31ae4c2e86236f00db832aba) | 7629dffbebe141eb8f701630948bd707 | s07.mp3 | `b5a92b3c31ae4c2e86236f00db832aba` |
| [heygen link](https://app.heygen.com/videos/test-01-s08--8c71063ede6841b5bd99de2ad5f2653f) | 7629dffbebe141eb8f701630948bd707 | s08.mp3 | `8c71063ede6841b5bd99de2ad5f2653f` |
| [heygen link](https://app.heygen.com/videos/test-01-s09--d585d2812fe94f9e8bd247930979e49f) | 7629dffbebe141eb8f701630948bd707 | s09.mp3 | `d585d2812fe94f9e8bd247930979e49f` |
| [heygen link](https://app.heygen.com/videos/test-01-s03--65473bfa4a7c41a5a92e71fd0f6f5311) | 7629dffbebe141eb8f701630948bd707 | s03.mp3 | `65473bfa4a7c41a5a92e71fd0f6f5311` |
| [heygen link](https://app.heygen.com/videos/test-02-corner-01--97bd848fa13e4d628315500ca14243ef) | ac366a12ded942989d22735c23f3794d | corner-01.mp3 | `97bd848fa13e4d628315500ca14243ef` |
| [heygen link](https://app.heygen.com/videos/test-03-s01--ccfe1a5ca6134957b826f540126847dc) | ac366a12ded942989d22735c23f3794d | s01.mp3 | `ccfe1a5ca6134957b826f540126847dc` |
| [heygen link](https://app.heygen.com/videos/test-03-s02--698ea4f94f4c43edbcbb52535d84b078) | ac366a12ded942989d22735c23f3794d | s02.mp3 | `698ea4f94f4c43edbcbb52535d84b078` |
| [heygen link](https://app.heygen.com/videos/test-03-s03--d98f083d6bd74b4f85d0f03a14dbcfed) | ac366a12ded942989d22735c23f3794d | s03.mp3 | `d98f083d6bd74b4f85d0f03a14dbcfed` |
| [heygen link](https://app.heygen.com/videos/test-03-corner-01--a2a4cbd922714bbea158c9e3aefb48a1) | ac366a12ded942989d22735c23f3794d | corner-01.mp3 | `a2a4cbd922714bbea158c9e3aefb48a1` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s08--548130e392724e779910ebc2cbe138a9) | 403f1f8c49d64c58bd3168f99a58bb0a | s08.mp3 | `548130e392724e779910ebc2cbe138a9` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s01--d49aae2b81104b9cb65bf9755ec67b82) | 403f1f8c49d64c58bd3168f99a58bb0a | s01.mp3 | `d49aae2b81104b9cb65bf9755ec67b82` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s09--e9376881d375468a80e88c2626219611) | 403f1f8c49d64c58bd3168f99a58bb0a | s09.mp3 | `e9376881d375468a80e88c2626219611` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s02--857c525c729f48eab0e20ad0834f59c1) | 403f1f8c49d64c58bd3168f99a58bb0a | s02.mp3 | `857c525c729f48eab0e20ad0834f59c1` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s10--58c347604e444bbda0f8ecd02306b98b) | 403f1f8c49d64c58bd3168f99a58bb0a | s10.mp3 | `58c347604e444bbda0f8ecd02306b98b` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s03--f81306a729f84f0a877c27dbab284583) | 403f1f8c49d64c58bd3168f99a58bb0a | s03.mp3 | `f81306a729f84f0a877c27dbab284583` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s05--e99b97ffe5464e30986fdd0a07bbacb7) | 403f1f8c49d64c58bd3168f99a58bb0a | s05.mp3 | `e99b97ffe5464e30986fdd0a07bbacb7` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-01--c227ca38aa2e443faf3450b8a2a7eddb) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-01.mp3 | `c227ca38aa2e443faf3450b8a2a7eddb` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-03--bab639600f754275bb86c0eefc2ff5be) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-03.mp3 | `bab639600f754275bb86c0eefc2ff5be` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s06--1a1a18ca3f20479e9d0e4946a38c41f9) | 403f1f8c49d64c58bd3168f99a58bb0a | s06.mp3 | `1a1a18ca3f20479e9d0e4946a38c41f9` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-04--f561a7287ab6485493796080533bbbf6) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-04.mp3 | `f561a7287ab6485493796080533bbbf6` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s07--2f196924335d4d3481e6d9953be0ddbb) | 403f1f8c49d64c58bd3168f99a58bb0a | s07.mp3 | `2f196924335d4d3481e6d9953be0ddbb` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s08--96612b7891034830a593cb80f7c372f8) | 403f1f8c49d64c58bd3168f99a58bb0a | s08.mp3 | `96612b7891034830a593cb80f7c372f8` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s04--24e5de9b4e1b4e7a91e677368ee1d856) | 403f1f8c49d64c58bd3168f99a58bb0a | s04.mp3 | `24e5de9b4e1b4e7a91e677368ee1d856` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s09--1fdc64c1866a45a6a9638c34bbc310ff) | 403f1f8c49d64c58bd3168f99a58bb0a | s09.mp3 | `1fdc64c1866a45a6a9638c34bbc310ff` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s10--3bb39114f8fe48888080274e12956dd5) | 403f1f8c49d64c58bd3168f99a58bb0a | s10.mp3 | `3bb39114f8fe48888080274e12956dd5` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-02--98b33718686247abb8ef30b074f184ed) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-02.mp3 | `98b33718686247abb8ef30b074f184ed` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-01--61062935a0d54f7a8f62016035f2cab3) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-01.mp3 | `61062935a0d54f7a8f62016035f2cab3` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-02--af3823d3b7a94683927c8304fa4a636c) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-02.mp3 | `af3823d3b7a94683927c8304fa4a636c` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-03--84df072449b74b97a1d1e59b514e2bf7) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-03.mp3 | `84df072449b74b97a1d1e59b514e2bf7` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-corner-04--a71cb58a6abb43bf9c0068ca0631acab) | 403f1f8c49d64c58bd3168f99a58bb0a | corner-04.mp3 | `a71cb58a6abb43bf9c0068ca0631acab` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s03--14ce0822ac1648bd890104e286ee6f21) | 403f1f8c49d64c58bd3168f99a58bb0a | s03.mp3 | `14ce0822ac1648bd890104e286ee6f21` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s10--3a67a4d7d4d24a2fb20f6a96df2a17ec) | 403f1f8c49d64c58bd3168f99a58bb0a | s10.mp3 | `3a67a4d7d4d24a2fb20f6a96df2a17ec` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s00--eafdf53dea4e40509378075594c23fb1) | 403f1f8c49d64c58bd3168f99a58bb0a | s00.mp3 | `eafdf53dea4e40509378075594c23fb1` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s07-iv--884523cc4ec84eb5a2f0260a25d50aa5) | 403f1f8c49d64c58bd3168f99a58bb0a | s07.mp3 | `884523cc4ec84eb5a2f0260a25d50aa5` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s01--d88064fb291f4c3eb817c05038b2e292) | 403f1f8c49d64c58bd3168f99a58bb0a | s01.mp3 | `d88064fb291f4c3eb817c05038b2e292` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s02--e74a1a27a41b4d44901aa780c7f8a0c6) | 403f1f8c49d64c58bd3168f99a58bb0a | s02.mp3 | `e74a1a27a41b4d44901aa780c7f8a0c6` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s03--e126c823c0cd407ab3cda4007ab33078) | 403f1f8c49d64c58bd3168f99a58bb0a | s03.mp3 | `e126c823c0cd407ab3cda4007ab33078` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s04--81ff6e258c354a71b445a20844c9ad5b) | 403f1f8c49d64c58bd3168f99a58bb0a | s04.mp3 | `81ff6e258c354a71b445a20844c9ad5b` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s03--9e71e8f8524f48bbb1680534d307c3b2) | 403f1f8c49d64c58bd3168f99a58bb0a | s03.mp3 | `9e71e8f8524f48bbb1680534d307c3b2` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s05--791b9a33821541668291f7b4a7e83e84) | 403f1f8c49d64c58bd3168f99a58bb0a | s05.mp3 | `791b9a33821541668291f7b4a7e83e84` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s04--60d666e684cb4a7aa3ce5f1981e37ba7) | 403f1f8c49d64c58bd3168f99a58bb0a | s04.mp3 | `60d666e684cb4a7aa3ce5f1981e37ba7` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s05--22a131559174419daac0b75cb5825ccb) | 403f1f8c49d64c58bd3168f99a58bb0a | s05.mp3 | `22a131559174419daac0b75cb5825ccb` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s06--89edeb84a82d497db6cd91311dccebef) | 403f1f8c49d64c58bd3168f99a58bb0a | s06.mp3 | `89edeb84a82d497db6cd91311dccebef` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s07--b4d50bb609144cc095d1abbc0ae4758d) | 403f1f8c49d64c58bd3168f99a58bb0a | s07.mp3 | `b4d50bb609144cc095d1abbc0ae4758d` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s08--0a938e67254d46a697903fde57eea8c0) | 403f1f8c49d64c58bd3168f99a58bb0a | s08.mp3 | `0a938e67254d46a697903fde57eea8c0` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s09--d51b1d422fe54c329a4e865dddb4426b) | 403f1f8c49d64c58bd3168f99a58bb0a | s09.mp3 | `d51b1d422fe54c329a4e865dddb4426b` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s10--f4c84c9a07b64c59a838b3c9642828fb) | 403f1f8c49d64c58bd3168f99a58bb0a | s10.mp3 | `f4c84c9a07b64c59a838b3c9642828fb` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s01-iv--d88064fb291f4c3eb817c05038b2e292) | 403f1f8c49d64c58bd3168f99a58bb0a | s01.mp3 | `d88064fb291f4c3eb817c05038b2e292` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s02-iv--e74a1a27a41b4d44901aa780c7f8a0c6) | 403f1f8c49d64c58bd3168f99a58bb0a | s02.mp3 | `e74a1a27a41b4d44901aa780c7f8a0c6` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s03-iv--e126c823c0cd407ab3cda4007ab33078) | 403f1f8c49d64c58bd3168f99a58bb0a | s03.mp3 | `e126c823c0cd407ab3cda4007ab33078` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s04-iv--81ff6e258c354a71b445a20844c9ad5b) | 403f1f8c49d64c58bd3168f99a58bb0a | s04.mp3 | `81ff6e258c354a71b445a20844c9ad5b` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s05-iv--791b9a33821541668291f7b4a7e83e84) | 403f1f8c49d64c58bd3168f99a58bb0a | s05.mp3 | `791b9a33821541668291f7b4a7e83e84` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s06-iv--89edeb84a82d497db6cd91311dccebef) | 403f1f8c49d64c58bd3168f99a58bb0a | s06.mp3 | `89edeb84a82d497db6cd91311dccebef` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s07-iv--b4d50bb609144cc095d1abbc0ae4758d) | 403f1f8c49d64c58bd3168f99a58bb0a | s07.mp3 | `b4d50bb609144cc095d1abbc0ae4758d` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s08-iv--0a938e67254d46a697903fde57eea8c0) | 403f1f8c49d64c58bd3168f99a58bb0a | s08.mp3 | `0a938e67254d46a697903fde57eea8c0` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s09-iv--d51b1d422fe54c329a4e865dddb4426b) | 403f1f8c49d64c58bd3168f99a58bb0a | s09.mp3 | `d51b1d422fe54c329a4e865dddb4426b` |
| [heygen link](https://app.heygen.com/videos/opusclip-vs-submagic-s10-iv--f4c84c9a07b64c59a838b3c9642828fb) | 403f1f8c49d64c58bd3168f99a58bb0a | s10.mp3 | `f4c84c9a07b64c59a838b3c9642828fb` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s01--504dadaa98004fbaa5a6ceab7e9f2dcf) | 403f1f8c49d64c58bd3168f99a58bb0a | s01.mp3 | `504dadaa98004fbaa5a6ceab7e9f2dcf` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s02--01a2f6625f59489f85370b99b57c8dcb) | 403f1f8c49d64c58bd3168f99a58bb0a | s02.mp3 | `01a2f6625f59489f85370b99b57c8dcb` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s03--e7dfb0770358442199235094dfb07224) | 403f1f8c49d64c58bd3168f99a58bb0a | s03.mp3 | `e7dfb0770358442199235094dfb07224` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s04--9ecb7c4677fa41388ad7efefdd47c9e8) | 403f1f8c49d64c58bd3168f99a58bb0a | s04.mp3 | `9ecb7c4677fa41388ad7efefdd47c9e8` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s05--fac6e97f0c4d4d379b4220cbf5f679ff) | 403f1f8c49d64c58bd3168f99a58bb0a | s05.mp3 | `fac6e97f0c4d4d379b4220cbf5f679ff` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s06--d0c0930377c242d884baaf881e9369e8) | 403f1f8c49d64c58bd3168f99a58bb0a | s06.mp3 | `d0c0930377c242d884baaf881e9369e8` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s07--e546d172eb0a49a4b1a7af294c89d811) | 403f1f8c49d64c58bd3168f99a58bb0a | s07.mp3 | `e546d172eb0a49a4b1a7af294c89d811` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s06--1f316c079cb74e11a9a8b3f01ef55765) | 403f1f8c49d64c58bd3168f99a58bb0a | s06.mp3 | `1f316c079cb74e11a9a8b3f01ef55765` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s07--31787394f0d94071ad5148d5ca149737) | 403f1f8c49d64c58bd3168f99a58bb0a | s07.mp3 | `31787394f0d94071ad5148d5ca149737` |
| [heygen link](https://app.heygen.com/videos/best-ai-video-generator-s00--c6c3b578937945c99aa62ea9f59f7652) | 403f1f8c49d64c58bd3168f99a58bb0a | s00.mp3 | `c6c3b578937945c99aa62ea9f59f7652` |
