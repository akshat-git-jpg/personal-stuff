# Pipeline — exact commands

Higgsfield MCP: your own connected server — tool names look like `mcp__<your-server-id>__generate_image`.
Connect it once at higgsfield.ai (MCP settings) before using Vox Mode; the tools used are
`generate_image`, `generate_video`, `media_upload`, `media_confirm`, `job_display`.
Engine: `~/.claude/skills/loop-studio/core/engine/remotion/`
Staging: `<engine>/public/vox/`

---

## 1. Waypoint stills

```
generate_image { model: "nano_banana_pro", aspect_ratio: "16:9", resolution: "2k", prompt: <STYLE DNA + shot> }
```
- Resolves to `nano_banana_2`. `2k` → 2752×1536; `4k` → 5504×3072. `2k` is plenty for 720p/1080p.
- ~30–60s each. These can run in PARALLEL (only the clips are sequential).
- Check every still before using it. Common misses: wrong green (emerald/matrix instead of
  chartreuse), brown/cardboard creeping in, an object rendered as a sculpture-in-a-pot.

## 2. Chain the clips — SEQUENTIAL, forward only

### 2a. First clip
```
generate_video {
  model: "seedance_2_0", duration: 6, resolution: "720p", mode: "std",
  generate_audio: false, aspect_ratio: "16:9",
  medias: [{ role: "start_image", value: "<image job_id>" }],   // NO end_image, ever
  prompt: <MOTION PROMPT + RIGID-BODY BLOCK>
}
```
If it returns a `preset_recommendation` notice, decline it and retry with
`declined_preset_id: "<id>"` — presets override the literal camera move.

~7–13 min per clip. Poll with `job_display`.

### 2b. Extract the REAL last frame
```bash
cd <engine>/public/vox
ffmpeg -v error -sseof -0.05 -i v6a.mp4 -update 1 -frames:v 1 /tmp/v6a_last.png -y
```
`-sseof -0.05` seeks from the end; `-update 1` is required or ffmpeg errors on a single output.

### 2c. Upload it (3 steps)
```
media_upload { filename: "v6a_last.png", content_type: "image/png" }
```
→ returns `upload_url` + `media_id`. Then:
```bash
curl -s -X PUT -H "Content-Type: image/png" --data-binary @/tmp/v6a_last.png "<upload_url>" -w "HTTP %{http_code}\n"
```
Expect `HTTP 200`. Then:
```
media_confirm { type: "image", media_id: "<media_id>" }
```
→ `status: "uploaded"`. The `media_id` is now usable as a generation input.

### 2d. Next clip
Same as 2a but `start_image` = the uploaded `media_id`. Repeat to the end of the chain.

**Presigned URLs expire in 900s** — upload promptly after requesting.

## 3. Stage + render

```bash
cd ~/.claude/skills/loop-studio/core/engine/remotion
ENTRY=src/index-vox.tsx COMP=VoxV6 OUT=out/vox_v6.mp4 SCALE=1 GL=swangle CONC=12 node render-film.mjs
```
- `GL=swangle` is required for headless WebGL.
- `CONC=12` on a 14-core machine (default 6). ~4 min at 720p, ~13 min at 1080p.
- `ENTRY` must be a MINIMAL entry registering only the target comps, or Google Fonts loading for
  every comp blows the 5s `delayRender` timeout.
- Progress is written with `\r`; when redirected to a file it looks stuck at `frame 0`. Use
  `tr '\r' '\n' < log | grep -E "DONE|ERROR"`.

## 4. Publish to the reviewer

```bash
python3 ~/.claude/skills/video-feedback/scripts/make_review.py out/vox_v6.mp4 \
  --project "VoxTechniqueTest" --label "v6-chained"
```
`make_review.py` regenerates `review.html` — re-apply any local patches after adding a version.
Order `versions.json` ascending so the reviewer opens on v1:
```bash
cd ~/Downloads/<Project>-Review && python3 -c "
import json
order=['v1','v2','v3']
v=json.load(open('versions.json')); d={x['label']:x for x in v}
json.dump([d[l] for l in order if l in d], open('versions.json','w'), indent=1)"
```
Serve: `nohup python3 serve.py &` (range-capable; port printed by make_review).

---

## Cost / time

| Step | Time | Notes |
|---|---|---|
| Still (2k) | ~30–60s | parallel |
| Seedance clip 720p 5–6s | ~7–13 min | **sequential when chaining** |
| Render 720p 15s | ~4 min | CONC=12 |
| Render 1080p 15s | ~13 min | |

3 stills + 3 clips ≈ 150 credits at 1080p; less at 720p. Iterate at 720p.
