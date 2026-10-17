# 05 - Live preview + export engine, and the project data model

Research date: 2026-10-17. Scope: the playback/preview engine, the export path, and the project
data model for an Electron (Chromium) NLE that must play 5-15 min timelines live (screen
recordings up to 4K, HeyGen avatar clips, HTML/CSS/GSAP graphics, VO, music, SFX), never
re-render while editing, and export a final file that matches the preview. It also covers how
Claude and a human edit the same project at the same time.

Labels used throughout:
- **[F]** fact, with a source (URL, or a repo path plus commit for code I read).
- **[I]** my inference or recommendation. It is not in a source.

Primary code read for this report (shallow clones, 2026-10-17):

| Repo | Commit / date | What it showed |
|---|---|---|
| heygen-com/hyperframes (provided in `repos/hyperframes`) | `b18b3e95`, 2026-10-17 | Preview runtime, drift correction, render engine, proxies, history, file watcher |
| OpenCut-app/OpenCut (rewrite) | `e668010`, 2026-09-24 | Rust/gpui desktop rewrite, web app being redone |
| opencut-app/opencut-classic | `cf5e79e`, 2026-05-17 | Mediabunny decode, canvas/WASM-GPU compositor, Mediabunny export |
| omni-media/omniclip | `cbe581a`, 2025-08-07 | PIXI preview on `<video>` textures, WebCodecs export workers |
| ncounterspecialist/twick | `3044c23`, 2026-05-07 | Canvas scene-graph player, Mediabunny/WebCodecs browser render, headless render server |
| diffusionstudio/core | `4e784a7`, 2025-11-18 | Public repo now holds only docs and playground. Engine source is not at HEAD |
| VelornLabs/velorn (provided) | empty clone, no commits | Nothing to read |

---

## 1. Playback approaches

### 1.1 The three options

| | A. Many `HTMLVideoElement`s slaved to a master clock | B. WebCodecs decode, then composite on canvas/WebGL/WebGPU | C. Hybrid |
|---|---|---|---|
| How it works | One `<video>` per active clip. A clock (rAF or the audio clock) drives them. Each tick nudges `currentTime`/`playbackRate` when a clip drifts | Demux in JS or WASM (e.g. Mediabunny), `VideoDecoder` in a worker, `VideoFrame` in a ring buffer, draw at clock time `t` | `<video>` for smooth realtime playback, WebCodecs for paused/scrub frames and for export |
| Frame accuracy | **No.** web.dev: the video element does not guarantee frame-accurate seeking [F] ([web.dev rVFC](https://web.dev/articles/requestvideoframecallback-rvfc)). WebKit bug: a seek to 6.009 reported `mediaTime` 5.976, the frame before [F] ([WebKit 283448](https://bugs.webkit.org/show_bug.cgi?id=283448)) | **Yes**, if you pick the frame by timestamp yourself. Remotion rates its WebCodecs `<Video>` "frame-accurate" and `<Html5Video>` "not guaranteed" [F] ([Remotion video tags](https://www.remotion.dev/docs/video-tags)) | Accurate when paused or exporting. Approximate (tens of ms) while playing |
| Cost to build | Low | High: demux, decoder lifecycle, GOP-aware seeking, frame cache, backpressure, `VideoFrame.close()` discipline | Highest: two paths to keep consistent |
| Codec coverage | Whatever the Chromium build plays | Whatever `VideoDecoder` supports, plus WASM fallbacks | Union |

### 1.2 What `<video>`-slaving actually costs (from HyperFrames' code)

HyperFrames is a production engine that runs approach A in preview. Its runtime shows the
problems you hit, and the fixes [F] (`packages/core/src/runtime/media.ts`, `clock.ts`, commit `b18b3e95`):

- **Three-tier drift correction.** A hard seek when drift exceeds `MEDIA_HARD_SYNC_SECONDS`
  (0.5 s) on the first tick, a scrub, or a "catastrophic" drift above 3 s. A strict sync at
  40 ms (`MEDIA_SYNC_TOLERANCE_SECONDS = 0.04`), only after two stable samples. A force sync
  at 20 ms on play/pause/seek/rate transitions.
- **Playing videos are never seeked for small drift.** Their comment: "Seeking one resets the
  decoder: a ~150ms freeze while it re-buffers ... which loops into a
  seek→freeze→drift→seek stutter." Instead they **steer `playbackRate` by ±3%**
  (`VIDEO_STEER = 0.03`) until the video is back within 10 ms. They write the rate only on
  start and stop, because "every write costs a frame".
- **The audio element is the master clock** where one exists: "Audio-master: drift is
  impossible because audio IS the clock." A monotonic clock is the fallback, with GSAP-style
  stall smoothing (500 ms threshold, 33 ms adjusted lag).
- Chromium refuses a `playbackRate` below 1/16 (`NotSupportedError`). Slower clips are kept
  paused and stepped with seeks.

Remotion's Player is coarser. It re-seeks a video when it drifts more than **0.45 s** from the
internal clock (`acceptableTimeShiftInSeconds`). It mounts upcoming clips early with
`premountFor` at opacity 0, and can pause the whole player until media is buffered
(`pauseWhenBuffering`) [F] ([html5-video](https://www.remotion.dev/docs/html5-video),
[premounting](https://www.remotion.dev/docs/player/premounting),
[buffer state](https://remotion.dev/docs/buffer-state)). Remotion's docs also say frames can show
empty in the Player while video loads, but never in the final render [F]
([player flicker](https://v3.remotion.dev/docs/troubleshooting/player-flicker)).

**[I]** Takeaway: approach A works for a viewer. It does not meet "preview == export" at the
frame level. A cut at frame 4,512 shows ±1-2 frames off while playing, and paused frames depend
on how the browser snaps the seek.

### 1.3 What real projects chose

| Project | Preview | Export | Source |
|---|---|---|---|
| **Remotion** | `<Html5Video>` historically. Recommends `@remotion/media` `<Video>` (Mediabunny + WebCodecs) for new code, and it now *previews* with WebCodecs. Media Parser and `@remotion/webcodecs` are deprecated in favour of Mediabunny (Feb 2026) | Headless Chrome screenshots. Client-side WebCodecs render (`@remotion/web-renderer`), stable from 4.0.491 | [F] [video tags](https://www.remotion.dev/docs/video-tags), [mediabunny](https://remotion.dev/docs/mediabunny/), [client-side rendering](https://remotion.dev/docs/client-side-rendering/) |
| **HyperFrames** | One HTML page. `<video>`/`<audio>` slaved to a transport clock (above). GSAP timelines paused and seeked. Browser-hostile codecs (HEVC, ProRes) swapped for an H.264 proxy, or VP8 when there is alpha | Headless Chrome, seek-per-frame. **Source video frames are pre-extracted with FFmpeg** (`videoFrameExtractor`), not taken from `<video>`. FFmpeg encode and audio mix | [F] `packages/core/src/runtime/*`, `packages/engine/README.md`, `packages/studio-server/src/helpers/proxyTranscoder.ts` |
| **OpenCut classic** | Mediabunny `CanvasSink` per media, frame-by-timestamp with prefetch of the next frame, iterate forward if within 2 s, else seek. Canvas compositor plus WASM GPU effect passes | Same scene graph through Mediabunny `CanvasSource` and `AudioBufferSource`, i.e. **one renderer for preview and export** | [F] `apps/web/src/services/video-cache/service.ts`, `services/renderer/scene-exporter.ts`, `gpu-renderer.ts` |
| **OpenCut rewrite** | Ground-up rewrite on a Rust core, with a desktop app on `gpui`. Plugin-first, Editor API, MCP server, headless mode | Headless mode planned | [F] README + `Cargo.toml` at `e668010` |
| **Omniclip** | PIXI.js, with `HTMLVideoElement`s as textures. `currentTime` set on seek | Separate WebCodecs decode and encode workers, i.e. **two decode paths** | [F] `s/context/controllers/compositor/parts/video-manager.ts`, `video-export/parts/decode_worker.ts`. Last commit Aug 2025, "2.0 in development" |
| **Twick** | `@twick/live-player` on `@twick/2d` (a canvas scene graph, which looks like a Revideo/Motion Canvas lineage) | `@twick/browser-render` (Mediabunny, mp4-wasm, ffmpeg-wasm) in-browser, plus a headless `@twick/render-server` | [F] package.json files at `3044c23`. **[I]** the Revideo lineage is inferred from package names |
| **Diffusion Studio** | Canvas 2D + WebCodecs, "interactive playback for editing and a high fidelity rendering mode for final output". The Pro NLE uses WebCodecs + WebGPU | Same engine, fidelity mode | [F] README at `4e784a7`, [docs](https://docs.diffusion.studio). The engine source is no longer in the public repo |
| **CapCut web** | C++ engine ported with Emscripten. WASM SIMD gave "nearly 300%". WebCodecs for hardware decode and encode | Same engine | [F] [web.dev case study](https://web.dev/case-studies/capcut) |
| **Clipchamp** | Not public | FFmpeg-WASM (demux, mux, fallbacks, filters) driving WebCodecs encoders through codec stubs. They needed a dry-run encode to get H.264 SPS/PPS (2021) | [F] [W3C slides, Balko](https://www.w3.org/2021/03/media-production-workshop/talks/slides/soeren-balko-clipchamp-webcodecs.pdf) |
| **Grass Valley web editor** (the W3C talk my search surfaced for "Descript") | WebCodecs decode in a worker, buffer centred on the playhead and biased by play direction. A seek invalidates the buffer. Low-res proxies for preview | **The same WebGL shaders** render the full-res output | [F] [W3C talk, Pearce](https://w3.org/2021/03/media-production-workshop/talks/james-pearce-browser-hosted-video-editing.html) |
| **Descript, Canva** | No public engine write-up found. Canva job ads list WebGL, WebGPU, WASM and workers for "Timeline 2.0" | n/a | [F] [Canva listing](https://jobs.blackbird.vc/companies/canva/jobs/53621701-senior-frontend-engineer-video-editor-remote-across-anz). Descript: not found |

**[I] Pattern:** every serious engine that promises WYSIWYG either uses (a) one decode +
composite path for both preview and export (OpenCut classic, Diffusion, CapCut, Grass Valley's
shared shaders), or (b) one page/runtime with a seek contract, accepting that realtime preview
is best-effort (HyperFrames, Remotion). Engines that use `<video>` for preview and WebCodecs for
export (Omniclip) carry a parity gap by construction.

### 1.4 Frame-accurate seeking with WebCodecs

- `VideoDecoder` only decodes forward from a keyframe. A seek means: find the keyframe at or
  before `t`, `reset()`, feed packets, and drop output frames until the one whose
  `[timestamp, timestamp+duration)` holds `t` [F] (general WebCodecs behaviour, and the
  `isFrameValid` / `iterateToTime` / `seekToTime` logic in OpenCut classic's `VideoCache`).
- Mediabunny's `CanvasSink.getCanvas(t)` returns "the last frame whose start time is at or
  before" `t`. `canvasesAtTimestamps()` decodes each packet at most once for sorted timestamp
  lists. `poolSize` keeps a fixed ring of canvases so GPU memory stays constant [F]
  ([CanvasSink API](https://mediabunny.dev/api/CanvasSink)).
- Scrub cost is set by GOP length. Screen recorders and phones produce long GOPs, often 2-10 s.
  A user reported H.264 proxies at keyint 72 stuttered when scrubbed, while keyint 1 matched
  ProRes Proxy at ~1/10 the size [F] ([Adobe community](https://community.adobe.com/questions-729/are-h-264-proxy-files-really-that-bad-anymore-1397483)).
  Blender measured GOP 10 vs GOP 2: 2-3x smaller files, ~8% slower scrubbing [F]
  ([Blender commit](https://lists.blender.org/pipermail/bf-blender-cvs/2021-April/156449.html)).
- **[I] VFR trap.** Screen recordings (QuickTime, OBS, Loom) are often variable frame rate. A
  "frame number" means nothing on a VFR source. The model must store **time**, and map to the
  source frame by PTS. Proxies should be transcoded to CFR at the project rate, so preview and
  export pick the same source frame. The export decoder must use the **same PTS→frame rule** on
  the original file. This is a top risk (§9).

### 1.5 Audio mixing with Web Audio

- The `AudioContext` clock is the right master clock. Use `outputLatency` and
  `getOutputTimestamp()` to learn when a sample is actually *heard*, and paint video frames to
  match. Support: Chrome/Edge 102, Firefox 70, Safari 18.4 [F]
  ([web.dev audio-output-latency](https://web.dev/articles/audio-output-latency)).
- Grass Valley: Web Audio is mostly tied to the main thread, so UI load disrupts playback. They
  buffer aggressively and stop audio at high shuttle speeds [F] (talk above).
- OpenCut classic: Mediabunny `AudioBufferSink` feeds scheduled `AudioBufferSourceNode`s [F]
  (`core/managers/audio-manager.ts`). HyperFrames has a dedicated Web Audio transport and route
  (`webAudioTransport.ts`, 37 KB) plus an offline FFmpeg audio mixer for export [F].
- **[I] Memory.** Decoding a 15-min stereo 48 kHz track to float32 takes 15·60·48000·2·4 ≈
  **346 MB**. VO + music + a dozen SFX would blow past 1 GB. So stream long tracks (decode
  windows around the playhead into an `AudioWorklet` ring buffer, or schedule chunked
  `AudioBuffer`s). Fully decode only short SFX.
- **[I] Parity.** Build the mix graph (gain automation, fades, ducking, EQ) from the model with
  one function. Run it live on an `AudioContext` and, for export, on an `OfflineAudioContext`.
  The export audio then comes from the same graph. A separate FFmpeg `amix` filtergraph would
  diverge in fade curves, pan law and resampling.

---

## 2. HTML/GSAP graphics over video

### 2.1 Two ways to show them live

| | DOM layering (iframe or Shadow DOM over the video canvas) | HTML rendered into the canvas |
|---|---|---|
| Fidelity | Full CSS: filters, backdrop-filter, blend modes, 3D, fonts | Depends on the method (below) |
| Sync | Each tick: `timeline.seek(t)` on a **paused** GSAP timeline | Same, then rasterize |
| Compositing order | Graphics can only sit *above* (or below) the canvas as whole layers. Interleaving video/graphics/video needs several canvases stacked in DOM | Arbitrary interleave, shader transitions across layers |
| Cost | Cheap, since Chromium composites on the GPU | Rasterize per frame |

Ways to get HTML into a canvas:
- **HTML-in-Canvas** (`drawElementImage`, and for WebGL/WebGPU `texElementSubImage2D` /
  `drawElementImageToTexture`). Still an **origin trial**, extended "through Chrome 160". The
  API was renamed in Chrome 150 and 155, and is "still experimental". Not in stable [F]
  ([Chrome blog, updated 2026-09-29](https://developer.chrome.com/blog/html-in-canvas-ot-changes)).
  HyperFrames uses it under a flag, and falls back to normal capture because "the browser's
  paint-record path does not reproduce every compositor effect. Filters, backdrop filters, some
  3D transforms, masks, blend modes ... can force HyperFrames back" [F]
  (`docs/guides/html-in-canvas.mdx`).
- **Custom DOM painter.** Remotion's client renderer walks the DOM with `createTreeWalker`, uses
  `getBoundingClientRect`, and redraws styles with Canvas 2D. It does **not** support
  `backdrop-filter`, `mix-blend-mode`, `z-index`, `perspective`, SVG masks/filters, or
  non-gradient background images [F]
  ([limitations](https://www.remotion.dev/docs/client-side-rendering/limitations),
  [how it works](https://www.remotion.dev/docs/client-side-rendering/how-it-works)).
  **[I]** That is too restrictive for HyperFrames-style cards.
- **Screenshot of the real page** (CDP `beginFrame` or `capturePage`) is full fidelity, but only
  offline (export), not at 30-60 fps live.

### 2.2 Keeping graphics in sync while scrubbing

- GSAP `seek()` moves the playhead without changing paused state. `suppressEvents` defaults to
  true, so callbacks between positions are skipped [F] ([GSAP seek](https://gsap.com/docs/v3/GSAP/Timeline/seek%28%29/)).
- HyperFrames' determinism contract (it already powers the owner's cards): no wall clock, no
  `Date.now`, no rAF-driven animation, no unseeded random, no mid-render fetch. Time is
  `floor(frame)/fps`. Every timeline is paused and seeked, never played [F]
  (`docs/concepts/determinism.mdx`). Its runtime exposes `window.__hf.seek(t)`, `__renderReady`,
  and a postMessage control bridge (`play/pause/seek/set-playback-rate`) [F]
  (`packages/core/src/runtime/README.md`).
- **[I] Recommendation.** Treat each graphic clip as a HyperFrames composition in a sandboxed
  iframe, layered in DOM over the video canvas. On every engine tick, post `seek(t - clipStart)`
  (same-process, synchronous where possible). While playing, let it seek per rAF from the master
  clock rather than self-play, so it cannot drift. Scrubbing is then trivially in sync, because
  there is no state, only `f(t)`.
- **[I] Layer interleave.** Tutorial edits are mostly "screen rec → avatar PiP → cards on top".
  Support N stacked "planes" (canvas, iframe, canvas, iframe) in DOM order. Treat
  graphics-*under*-video as a rare case, rendered into the canvas via HTML-in-Canvas where the
  flag is present.

---

## 3. Performance

### 3.1 Proxies / optimized media

- **Resolve** has two systems [F]: *Optimized Media* (full-res ProRes/DNxHR, managed internally,
  not portable) and *Proxy Media* (lower res, portable files). Typical codecs: ProRes 422
  Proxy/LT on Mac, DNxHR LB on Windows. Proxies are for editing only; switch back to originals
  before grading ([frame.io guide](https://workflow.frame.io/guide/resolve-proxies),
  [cutback](https://cutback.video/blog/proxy-workflow-premiere-vs-davinci-vs-final-cut)).
  **Premiere** ingest can copy, transcode, or create proxies, with a "Toggle Proxies" button [F]
  (same cutback source).
- **HyperFrames** already does this for the web. It transcodes "browser-hostile" sources (HEVC,
  ProRes, HDR) into a cached proxy with `libx264 -profile high -crf 18 -preset veryfast`,
  BT.709 tagged, `+faststart`. Alpha sources get `libvpx` VP8 `yuva420p`. HDR is tone-mapped. At
  most ~2 concurrent encodes. Cache key is versioned (`PROXY_PARAMS_VERSION = "v5"`). It is
  "never used on the render path (render always sees the original file)" [F]
  (`packages/studio-server/src/helpers/proxyTranscoder.ts`).
- **[I] Proxy profile for this editor.** Two tiers, generated by a bundled ffmpeg in a
  background utility process at import:
  1. **Edit proxy** at the preview canvas size (1080p max, 720p optional):
     `-c:v libx264 -preset veryfast -tune fastdecode -bf 0 -g 6 -keyint_min 6 -sc_threshold 0
     -r <project fps> -fps_mode cfr -pix_fmt yuv420p -colorspace bt709 ...`. A short GOP keeps
     scrubbing fast. CFR fixes the VFR trap. H.264 is the most reliably hardware-decoded codec
     in Chromium on both OSs.
  2. **Alpha proxy** for avatar clips with transparency: VP9 or VP8 `yuva420p` WebM, since
     Chromium decodes WebM alpha.
  Export always reads originals.
- **Thumbnails / waveforms [I]**: ffmpeg `fps=1/2,scale=-1:90,tile=...` sprite sheets per asset,
  plus BBC `audiowaveform` (or an ffmpeg `astats`/PCM pass) for multi-resolution peak JSON
  (e.g. `--pixels-per-second 20 --bits 8`) [F for the tool]
  ([BBC waveform-data](https://github.com/bbc/waveform-data.js),
  [audiowaveform example](https://publit.io/community/blog/visualizing-sound-creating-audio-waveforms-with-audiowaveform-and-ffmpeg)).
  Store under a regenerable `.cache/` that Drive sync skips (§5).

### 3.2 Hardware decode limits in Chromium

- I found no documented general cap on Windows or macOS. Chromium's VA-API (Linux/ChromeOS) caps
  concurrent hardware decoders at 16, reduced to 10 on some Chromebooks. Over the cap, creation
  fails [F] ([chromium c74bb01](https://chromium.googlesource.com/chromium/src/+/c74bb01a2889afdfdd1e06f0144fb7b02e2e00a2)).
  Some devices allow only one decode pipeline [F]
  ([Bitmovin](https://developer.bitmovin.com/playback/docs/understanding-single-decoder-device-limitations)).
- **HEVC** hardware decode varies by GPU, chroma and bit depth. Apple Silicon handles 8-10 bit Rext
  in hardware. NVIDIA Rext support arrived around Chrome 137, and sources conflict. On Windows,
  Edge uses Media Foundation and may need the HEVC Video Extensions [F]
  ([enable-chromium-hevc guide](https://fr.github.com/StaZhu/enable-chromium-hevc-hardware-decoding)).
  Headless Chrome does not decode HEVC [F] (Remotion mediabunny formats page).
  **[I]** That is why proxies to H.264 are not optional for a Mac + Windows + hired-editor app.
  iPhone/Mac screen recordings are often HEVC.
- `VideoFrame`s are not garbage-collected promptly. You must `close()` them, or decode stalls.
  Copying a 4K 4:2:0 frame GPU→CPU costs ~6.6-17 ms, so keep frames on the GPU (draw
  `VideoFrame` straight into WebGL/WebGPU) [F]
  ([Adenot, W3C](https://www.w3.org/2021/03/media-production-workshop/talks/slides/paul-adenot-webcodecs-performance/)).
- **[I] Budget.** A tutorial timeline rarely has more than 2-3 *simultaneous* video layers
  (screen rec + avatar PiP + occasional b-roll), plus 1-2 "premounted" decoders warming at the
  next cut, so 4-5 live decoders. Keep that well under any cap: open decoders in a window
  around the playhead (Remotion's `premountFor` idea) and close them after.

### 3.3 Memory for long timelines

**[I]** Timeline *length* barely matters if decoding streams. What matters is:
- Frame buffers: 1080p RGBA ≈ 8.3 MB, 4K RGBA ≈ 33 MB, 4K NV12 ≈ 12.4 MB. A 1 s lookahead of a
  4K source at 30 fps in RGBA is ~1 GB. Preview therefore reads 1080p proxies and keeps only a
  few decoded frames per layer (a 1080p frame is ~8 MB).
- Audio: stream it (§1.5).
- Graphics iframes: mount only clips within ±N s of the playhead. HyperFrames notes interactive
  preview leaves images in hidden future clips unloaded [F] (runtime README).
- UI: virtualize the timeline. Load thumbnails and waveform tiles lazily per zoom level.

---

## 4. Export

### 4.1 Options

| | (a) Headless Chromium frame capture (Remotion / HyperFrames) | (b) In-app WebCodecs encode | (c) FFmpeg filtergraph from the model |
|---|---|---|---|
| How | Load the *same* page offscreen. For each frame: `seek(t)`, wait for ready, capture, pipe to ffmpeg | Run the compositor offline, frame by frame, from originals. `VideoEncoder` + Mediabunny mux | Translate tracks/clips/fades into `overlay`/`xfade`/`amix` |
| HTML/GSAP fidelity | Full, the real compositor | Only via HTML-in-Canvas (origin trial) or a custom painter (limited CSS) | None. Cards must be pre-rendered |
| Parity with preview | Highest: same runtime. HyperFrames: "Every frame looks the same in both, because both run the same `hyperframe.runtime`" [F] | High *if* the same compositor code runs | Lowest: different scaler, blending, colour path, fade curves |
| Speed, 10-min 1080p30 (18,000 frames) | HyperFrames' own demo: 300 frames of 1080p in **9.8-25 s** on one machine [F] (`docs/guides/performance.mdx`), so ~12-30 fps, i.e. **~10-25 min** **[I]** for light pages. Parallel workers (1-24, ~256 MB each) help [F] | **[I]** likely 2-6 min. Hardware H.264 encoders run well above realtime, but I found **no published WebCodecs 1080p benchmark** (gap, spike) | **[I]** ~realtime or faster |
| Platform caveats | `beginFrame` (atomic, deterministic capture) needs `--run-all-compositor-stages-before-draw` [F] ([Chromium headless_handler](https://chromium.googlesource.com/chromium/src.git/+/57504b7decf3eeae3a508ad83c28ddb7ffdc68a8/headless/lib/browser/protocol/headless_handler.cc)). HyperFrames uses BeginFrame streaming only on Linux `chrome-headless-shell`. **On macOS and Windows it falls back to screenshot capture** [F] (`docs/packages/cli.mdx` ~l.1303) | Electron offscreen rendering gives frames as bitmaps or shared GPU textures. **It generates no frame when nothing changes**, and the shared-texture mode needs a native module [F] ([Electron OSR](https://electronjs.org/docs/latest/tutorial/offscreen-rendering)) | ffmpeg build licensing and size |

Video inside (a): HyperFrames does **not** trust `<video>` during render. It pre-extracts source
frames with FFmpeg and injects them [F] (`packages/engine/src/services/videoFrameExtractor.ts`:
"Pre-extracts video frames using FFmpeg for frame-accurate rendering"). Remotion likewise uses
exact frame selection when rendering ("during rendering, video frames are selected exactly") [F]
([jumpcuts](https://www.remotion.dev/docs/miscellaneous/snippets/jumpcuts)).
**[I]** So in both engines, preview video and export video come from *different decoders*. Only
the composition logic is shared.

### 4.2 How to guarantee preview == export

**[I]** Define "match" precisely, then make each part true by construction:
1. **One timing function.** `resolve(model, frameIndex) → {layers, sourceTimes, graphicTimes,
   audioGraph}`. It is pure and shared by preview and export, with integer time in ticks (§5).
2. **One frame-picking rule.** Source frame = the frame whose `[pts, pts+dur)` holds the source
   time, applied to the *proxy* in preview and the *original* in export. Proxies are CFR at
   project rate and frame-aligned to the original's PTS, so the same rule picks the same
   picture.
3. **One compositor.** The same WebGL2 (later WebGPU) shader code draws video layers in both
   modes. Grass Valley does exactly this: "same shader code ... produces the same result at high
   resolution as the proxy preview" [F].
4. **One graphics runtime.** The same HyperFrames composition, seeked to the same `t`. The only
   difference is that export captures pixels.
5. **One audio graph.** `AudioContext` live, `OfflineAudioContext` for export (§1.5).
6. **Colour.** Tag everything BT.709 limited. Do the YUV→RGB conversion in *your* shader for
   both modes, not in the browser's video path for one and FFmpeg for the other. HyperFrames
   explicitly names the BT.601 vs BT.709 matrix trap in its proxy code [F]
   (`proxyTranscoder.ts` comment).
7. **Pin the environment.** HyperFrames: fonts and Chrome versions differ between machines and
   can shift pixels, so they use Docker to pin [F] (`determinism.mdx`). In Electron the Chromium
   is already pinned. Bundle the fonts in the project folder.
8. **Prove it.** A golden-frame test: render N random frames via the preview path (paused) and
   the export path, and compare with SSIM/PSNR per release.

**[I] Recommended export design:** a **dedicated offscreen Electron renderer** (or a bundled
`chrome-headless-shell` via `@hyperframes/producer`) runs the same engine page in
`mode=export`. For each frame it decodes **originals** through WebCodecs/Mediabunny
(frame-exact), seeks the graphic iframes, and captures. Output goes to a bundled ffmpeg (or
WebCodecs `VideoEncoder` where hardware H.264/HEVC is available), with audio from the
`OfflineAudioContext`. Speed upgrade, v2: pre-capture each graphic clip once (keyed by a hash of
its HTML + params) into an alpha intermediate (ProRes 4444 / PNG sequence) using HyperFrames'
deterministic seek capture, in the background, as a *cache* the user never waits on. The final
pass is then a pure GPU composite + hardware encode. The FFmpeg-filtergraph path is kept only as
the **Resolve/FCPXML escape hatch**, never as the primary export.

---

## 5. Project data model

### 5.1 Candidates

| | OTIO as canonical | Custom JSON (schema'd) | HyperFrames HTML as the whole timeline |
|---|---|---|---|
| What it is | ASWF interchange model: C++ core, official **Python** binding only, native `.otio/.otioz/.otiod`. Since Beta 17 (Jun 2024) every other adapter (FCP XML, AAF, EDL...) lives in the separate `OpenTimelineIO-Plugins` package. Latest: Beta 18 (Nov 2025) added an `Effect.enabled` flag and clip/track colour [F] ([repo](https://github.com/AcademySoftwareFoundation/OpenTimelineIO), [releases](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/releases)) | Your own versioned schema (zod / JSON Schema) | One `index.html`: `data-start`/`data-duration`/`data-track-index` on `class="clip"` elements, GSAP in `<script>` [F] (`docs/concepts/compositions.mdx`) |
| JS/TS support | **No official JS/WASM binding found** [F, search negative]. You would read and write OTIO JSON yourself | Native | Native (parse HTML) |
| Expresses | Tracks, clips, gaps, transitions, `RationalTime` ranges, markers, metadata | Anything: graphics clip params, audio automation, comments, proxies, plugin data | Graphics excellently. NLE ops (ripple, roll, slip) awkwardly |
| Interchange | Resolve imports/exports OTIO natively from 18.5. Premiere 25.6+ imports `.otio` [F] ([Remotion export-opentimeline](https://www.remotion.dev/docs/export-opentimeline), [Resolve manual](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1410.htm)) | Via exporters | Via a translator. Remotion's own docs say a programmatic composition "is not possible to deterministically export ... to OpenTimelineIO". Text, animation and effects must be **baked to video** [F] (same Remotion page) |
| Agent friendliness | Verbose (`OTIO_SCHEMA: "Clip.2"`, nested `RationalTime{value,rate}`). Diffs are noisy | Designed for it | Very good for graphics, but one big file for a 15-min edit diffs badly |

HyperFrames' own runtime README states its product model: "Primary mode: prompt + element
picking ... Avoid timeline-first manual workflows as default product path" [F]. **[I]** It was
not designed to be an NLE's timeline container.

### 5.2 Recommendation **[I]**

**Custom JSON as canonical, OTIO and FCPXML as adapters, HyperFrames compositions as a clip type.**

```
MyVideo.vproj/                    <- the folder passed via Google Drive
  project.json                    schemaVersion, fps (rational), size, sample rate, settings
  timeline.json                   tracks[] -> clips[] (stable ids), markers
  assets.json                     assetId -> relative path, sha256, probe (codec, VFR?, colour), proxy key
  comments.json                   {id, t, range?, author, text, resolved}
  graphics/<clipId>/index.html    HyperFrames composition (+ assets), seek-only contract
  plugins/                        project-local plugin manifests (optional)
  history/ops.jsonl               append-only operation log (see §6)
  .cache/                         proxies, thumbs, peaks, graphic captures. Regenerable, not synced
```

Rules:
- **Time is integers.** Use ticks at a fixed high rate (e.g. 1/705,600,000 s, the "flicks"
  idea), or frames at project fps plus samples for audio. OpenCut classic uses a
  `TICKS_PER_SECOND` media-time unit from its WASM core [F] (`scene-exporter.ts` imports). Never
  store float seconds: rounding drift breaks ripple edits and frame-exact export.
- **Stable IDs** on every clip, track, comment and keyframe. Ops reference IDs, not array
  indexes, so diffs stay small and concurrent edits don't collide (§6).
- **One clip per line-ish.** Pretty-print with sorted keys and clips sorted by (track, start),
  so `git diff` / Claude diffs are readable.
- **Schema + validator** shared by the UI, the MCP server and the file watcher. Unknown fields
  are kept (for plugins). `schemaVersion` with migrations.
- **Graphics clip** = `{type:"graphic", src:"graphics/<id>/index.html", start, duration,
  inPoint, params:{...}}`. Claude edits the HTML with normal file tools. The editor reloads that
  one iframe.
- **Escape hatch.** Export `.otio` (hand-written TS serializer for OTIO JSON. **[I]** this is
  simple because OTIO JSON is plain JSON, but validate against Python `opentimelineio` in CI) and
  keep the existing FCPXML exporter. Graphics, text and non-unity audio are baked to ProRes 4444 /
  WAV stems first, exactly as Remotion's OTIO skill does [F]. Import from OTIO later, if ever.

---

## 6. Agent + human editing the same project at the same time

### 6.1 Constraints that shape the design
- Both actors are on **one machine, one process tree**. Live multi-user is out of scope (req 7).
- Claude edits through an MCP server the editor exposes (req 3). Claude Code can also edit files
  directly (e.g. `graphics/*.html`, or even `timeline.json`).
- The human needs instant UI response and undo.

### 6.2 Recommended model **[I]**
1. **Single authority.** The editor main process owns the in-memory document. Every change,
   from the UI, the MCP, a plugin, or a file watcher, is a typed **operation**
   (`moveClip{id, toTrack, toStart}`, `trim{id, edge, delta}`, `blade{trackIds, t}`,
   `rippleDelete{ids}`, `setGain{id, db}`, `addComment{...}`). The op is validated against the
   schema, applied, given a monotonically increasing `rev`, appended to `history/ops.jsonl` with
   `{actor: human|claude|plugin:<name>, ts, rev, op, inverse}`, then broadcast to all views.
2. **Optimistic concurrency for the agent.** MCP read tools return `rev` and per-entity
   versions. Write tools accept `ifRev` or per-clip `ifVersion`. If the human changed that clip
   since Claude read it, the op is **rejected with the current state**, and Claude re-plans. This
   avoids the classic lost update between humans and agents [F: the problem is described in
   [Monperrus, "lost update problem: humans and AI agents"](https://www.monperrus.net/martin/lost-update-problem-humans-ai-agents)].
   Ops on *different* clips never conflict, because they reference stable IDs.
3. **Human UI** applies locally first (same process, so no latency) through the same op
   pipeline. Drags send one op on drop, with preview ghosts during the drag.
4. **Undo per actor.** Cmd-Z undoes the human's last op. "Undo Claude's last change" (a
   button, plus an MCP tool) inverts Claude's op group. Group an agent's multi-op change under one
   `txn` id so it undoes as a unit. HyperFrames recently built the same thing: "Every write to a
   project is now kept in a history you can undo or restore", and "Studio can tell its own edits
   apart from an agent's" [F] (`docs/weekly-updates.mdx`, Sep 21-28 2026; `packages/studio-server/src/history/projectHistory.ts`).
5. **File watching.** Watch `timeline.json`, `graphics/**`, `comments.json`. An external write is
   parsed, validated, **diffed by ID into ops**, and applied as `actor: external`. Writes the app
   makes itself carry a receipt, so the watcher can tell its own echo from an outside edit.
   HyperFrames hit this exact bug: without a receipt "the client treats its own edit as an
   external change and does a full preview reload, which blanks the stage" [F]
   (`packages/studio-server/src/routes/files.ts`, `writeFileWithReceipt`). Writes are atomic
   (temp + rename). HyperFrames ships `atomicFile.ts` [F].
6. **How Claude's edits show up live.** The op broadcast drives the timeline UI. Changed clips
   flash or get a "Claude" badge for a few seconds. The preview re-resolves only frames touched
   by the op's time range, and a paused playhead re-renders its current frame within one tick.
   The MCP `get_state` returns playhead, selection, visible range, and the last N ops with
   actors, so Claude can see what the human just did.
7. **CRDT?** Yjs/Automerge "agent as a CRDT peer" is an active 2026 pattern for text documents
   [F] ([Electric, Apr 2026](https://electric.ax/blog/2026/04/08/ai-agents-as-crdt-peers-with-yjs),
   [Sim.ai](https://www.sim.ai/blog/agent-as-yjs-peer)). **[I]** It is unnecessary here: one
   authority on one machine, plus pass-the-folder collaboration, makes a server-style op log
   simpler, easier to audit, and easier for Claude to reason about. Keep the op format
   CRDT-compatible (IDs, no indexes) in case live collaboration is ever wanted.
8. **Pass-the-folder merges.** When the folder comes back from a hired editor, show "their ops
   since rev X" from `ops.jsonl`. Note that Drive can create `timeline (1).json` conflict copies.
   Detect and offer an op-level merge.

---

## 7. Recommended architecture

**[I]** Build an **Electron** app (one pinned Chromium on macOS and Windows, so codecs, WebCodecs
and experimental flags like HTML-in-Canvas behave the same on every machine). Its canonical
project is a **folder of schema'd JSON** with integer time and stable IDs. Graphics are
**HyperFrames compositions referenced as clips**, and **OTIO/FCPXML are export adapters** to
Resolve and Premiere. One **pure timeline resolver** feeds both paths. In the **preview engine**,
the `AudioContext` is the master clock, video layers are **WebCodecs/Mediabunny-decoded 1080p
CFR short-GOP H.264 proxies** composited in **WebGL2** inside a worker (OffscreenCanvas), and
graphics are **sandboxed iframes layered in DOM**, seeked to the same `t` every tick. In the
**export engine**, an offscreen renderer runs the same page in export mode against **originals**,
frame by frame with no clock, and sends the frames to bundled ffmpeg or a hardware encoder, with
audio from an `OfflineAudioContext` of the same graph. A golden-frame parity test runs on every
release. Every edit, from the human, from Claude through MCP, from plugins, or from file
writes, goes through **one validated operation pipeline** with an append-only log, per-actor
undo, and optimistic version checks for the agent.

Components:
1. **Electron shell.** Main process holds the document authority, op pipeline, MCP server,
   file watcher and job queue. Renderer windows: Editor UI, Preview, Export (offscreen).
2. **Schema package** (TS + zod/JSON Schema). Model types, migrations, validator, and the
   ID-based differ that turns file writes into ops.
3. **Timeline resolver.** Pure `resolve(model, tick)`, plus range queries for "what is active in
   [t0, t1]".
4. **Media service** (utility process + bundled ffmpeg/ffprobe). Probe (codec, VFR, colour,
   alpha), proxies (edit + alpha), thumbnail sprites, waveform peaks, content-hash cache in
   `.cache/`.
5. **Decode service** (worker). Mediabunny demux, a `VideoDecoder` pool with a playhead window,
   GOP-aware seek, frame ring buffers, strict `close()`.
6. **Compositor** (worker, WebGL2 → WebGPU later). Shared shaders for transforms, crops, opacity,
   transitions and YUV→RGB. Used by preview and export.
7. **Graphics host.** HyperFrames runtime in sandboxed iframes, a seek bridge, mount/unmount
   window, and an HTML-in-Canvas path behind feature detection.
8. **Audio engine.** Graph builder from the model, streaming `AudioWorklet` sources, a live
   `AudioContext` with latency compensation, and `OfflineAudioContext` for export.
9. **Transport/clock.** Audio-master clock, play/pause/scrub/J-K-L, rate. It drives the
   compositor and the graphics seek.
10. **Export pipeline.** Offscreen renderer in export mode, originals decode, per-frame capture,
    encoder (ffmpeg or WebCodecs), mux, progress, cancel. Graphic-capture cache (v2). OTIO/FCPXML
    writers with baked stems.
11. **Op log + history.** `ops.jsonl`, txn groups, per-actor undo, receipts.
12. **MCP server.** `get_state` (playhead, selection, comments, recent ops), read tools with
    revs, edit tools with `ifVersion`, `seek`, `render_still(t)` (lets Claude *see* a frame),
    `export`.
13. **Timeline UI.** Virtualized tracks, lazy thumbnail and waveform tiles, comment lane,
    actor badges.
14. **Plugin host.** Manifest + sandboxed JS that can register ops, importers (e.g. Drive link →
    clips), panels and MCP tools. It can only change the document *through ops*.

---

## 8. Open gaps in the evidence

- No published WebCodecs hardware-encode throughput numbers at 1080p (searched, none found).
- No documented concurrent hardware-decoder cap for Chromium on macOS (VideoToolbox) or Windows
  (D3D11/MF) (searched, found Linux/ChromeOS only).
- Descript and Canva publish no engine architecture. Diffusion Studio's engine source is no longer
  in its public repo.
- HTML-in-Canvas: no stable-ship date. Electron's Chromium lags Chrome stable (Electron 40 shipped
  Jan 2026 on M144 [F] ([Electron timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines))),
  so the API shape in Electron will trail the Chrome 150/155 renames.

---

## 9. The 5 biggest technical risks, each with a de-risking spike

| # | Risk | Why it bites | Spike (time-boxed, pass/fail) |
|---|---|---|---|
| 1 | **Smooth realtime playback of a dense 15-min timeline** (2-3 concurrent video layers incl. 4K-sourced screen rec + avatar, 3-5 live HyperFrames iframes, 6+ audio tracks) on a mid-range Windows laptop | WebCodecs pipeline, WebGL compositor, DOM iframes and Web Audio all compete for the main thread and GPU. Grass Valley reported main-thread audio glitches [F] | Build a throwaway engine: Mediabunny + VideoDecoder worker + OffscreenCanvas WebGL2 + 2 HyperFrames iframes + streaming audio. Play a synthetic 15-min project on the owner's Mac **and** a ~₹50k Windows laptop with Intel iGPU. Pass: ≥ 29 fps sustained, < 1 dropped frame/min, A/V offset < 20 ms (clap test), scrub-to-frame < 150 ms on proxies |
| 2 | **Preview ≠ export at the frame level** (VFR screen recordings, PTS rounding, colour matrix, graphics timing) | Two decoders (proxy vs original) plus a VFR source can pick different frames. Colour conversions differ between the browser path and ffmpeg | Take 5 real owner recordings (QuickTime HEVC VFR, OBS, HeyGen MP4, a 4K one). Proxy them CFR. Render 200 random frames paused-preview vs export-path. Pass: identical source-frame index for 100%, SSIM ≥ 0.99, ΔE small on a colour chart clip |
| 3 | **Export speed and reliability on macOS/Windows** without Linux `beginFrame` | HyperFrames falls back to screenshot capture on Mac/Win [F]. Electron OSR emits no frame when nothing changes [F]. Capture of 18,000 frames must not stall | Export a 10-min 1080p30 project 3 ways: (a) HyperFrames producer screenshot path, (b) Electron offscreen + `capturePage` + ffmpeg pipe, (c) GPU composite + WebCodecs `VideoEncoder` with cached graphic captures. Pass: ≤ 15 min on the owner's Mac, ≤ 30 min on the Windows laptop, zero dropped/duplicated frames (frame-counter overlay check) |
| 4 | **Codec/hardware variance across user machines** (HEVC, 10-bit, alpha WebM, decoder caps, missing HEVC extension on Windows) | The sister's and hired editors' machines are unknown. Headless Chrome has no HEVC [F]. Decoder creation can fail over a cap [F] | Write a "media doctor" probe that runs at install and import: `VideoDecoder.isConfigSupported` matrix, opening N concurrent decoders until failure, proxy fallback when unsupported. Run it on 3 Windows machines (Intel/AMD/NVIDIA) and 2 Macs. Pass: every source plays via proxy, and the max concurrent decoder count is ≥ 6 everywhere |
| 5 | **Agent + human concurrent edits corrupting or confusing the project** (stale reads, file-write echoes, Drive conflict copies, undo crossing actors) | Claude writes via MCP *and* raw files. HyperFrames had to add write receipts and actor-aware history [F] | Build the op pipeline + MCP server only (no video), with a scripted fuzz: a Claude-like client issues random ops with stale `ifVersion` while a bot drags clips at 10 ops/s, plus raw `timeline.json` writes. Pass: 10k ops, zero schema violations, every conflict surfaced (none silently lost), per-actor undo restores the exact prior state (hash-equal), and a full replay of `ops.jsonl` reproduces the final document |

---

## Sources (consolidated)

Web:
- Remotion: [video tags](https://www.remotion.dev/docs/video-tags), [html5-video](https://www.remotion.dev/docs/html5-video), [premounting](https://www.remotion.dev/docs/player/premounting), [buffer state](https://remotion.dev/docs/buffer-state), [jumpcuts](https://www.remotion.dev/docs/miscellaneous/snippets/jumpcuts), [player flicker](https://v3.remotion.dev/docs/troubleshooting/player-flicker), [mediabunny](https://remotion.dev/docs/mediabunny/), [client-side rendering](https://remotion.dev/docs/client-side-rendering/), [CSR limitations](https://www.remotion.dev/docs/client-side-rendering/limitations), [CSR how it works](https://www.remotion.dev/docs/client-side-rendering/how-it-works), [export-opentimeline](https://www.remotion.dev/docs/export-opentimeline), [performance](https://www.remotion.dev/docs/performance)
- [Mediabunny intro](https://mediabunny.dev/guide/introduction), [CanvasSink](https://mediabunny.dev/api/CanvasSink)
- [Chrome HTML-in-Canvas OT changes (updated 2026-09-29)](https://developer.chrome.com/blog/html-in-canvas-ot-changes)
- [web.dev requestVideoFrameCallback](https://web.dev/articles/requestvideoframecallback-rvfc), [WebKit bug 283448](https://bugs.webkit.org/show_bug.cgi?id=283448), [web.dev audio output latency](https://web.dev/articles/audio-output-latency)
- [CapCut case study](https://web.dev/case-studies/capcut), [Clipchamp W3C slides](https://www.w3.org/2021/03/media-production-workshop/talks/slides/soeren-balko-clipchamp-webcodecs.pdf), [Grass Valley W3C talk](https://w3.org/2021/03/media-production-workshop/talks/james-pearce-browser-hosted-video-editing.html), [Adenot WebCodecs memory](https://www.w3.org/2021/03/media-production-workshop/talks/slides/paul-adenot-webcodecs-performance/)
- [Chromium VA-API decoder cap](https://chromium.googlesource.com/chromium/src/+/c74bb01a2889afdfdd1e06f0144fb7b02e2e00a2), [Chromium headless beginFrame handler](https://chromium.googlesource.com/chromium/src.git/+/57504b7decf3eeae3a508ad83c28ddb7ffdc68a8/headless/lib/browser/protocol/headless_handler.cc), [Bitmovin single-decoder](https://developer.bitmovin.com/playback/docs/understanding-single-decoder-device-limitations), [HEVC in Chromium guide](https://fr.github.com/StaZhu/enable-chromium-hevc-hardware-decoding), [W3C HEVC WebCodecs registration](https://www.w3.org/TR/webcodecs-hevc-codec-registration/)
- [Electron offscreen rendering](https://electronjs.org/docs/latest/tutorial/offscreen-rendering), [Electron timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)
- [OTIO repo](https://github.com/AcademySoftwareFoundation/OpenTimelineIO), [OTIO releases](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/releases), [Resolve 18.6 manual OTIO](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part1410.htm)
- Proxies: [frame.io Resolve proxies](https://workflow.frame.io/guide/resolve-proxies), [cutback comparison](https://cutback.video/blog/proxy-workflow-premiere-vs-davinci-vs-final-cut), [Adobe community keyint](https://community.adobe.com/questions-729/are-h-264-proxy-files-really-that-bad-anymore-1397483), [Blender proxy defaults](https://lists.blender.org/pipermail/bf-blender-cvs/2021-April/156449.html)
- [GSAP seek()](https://gsap.com/docs/v3/GSAP/Timeline/seek%28%29/), [BBC waveform-data](https://github.com/bbc/waveform-data.js), [audiowaveform + ffmpeg](https://publit.io/community/blog/visualizing-sound-creating-audio-waveforms-with-audiowaveform-and-ffmpeg)
- Agents + CRDT: [Monperrus lost update](https://www.monperrus.net/martin/lost-update-problem-humans-ai-agents), [Electric](https://electric.ax/blog/2026/04/08/ai-agents-as-crdt-peers-with-yjs), [Sim.ai](https://www.sim.ai/blog/agent-as-yjs-peer)
- [Diffusion Studio docs](https://docs.diffusion.studio), [Canva job listing](https://jobs.blackbird.vc/companies/canva/jobs/53621701-senior-frontend-engineer-video-editor-remote-across-anz)

Code (local clones under `/Users/kbtg/.claude-work/jobs/2b878578/tmp/research/repos/` and `.../repos05/`):
- hyperframes `b18b3e95`: `packages/core/src/runtime/{media.ts,clock.ts,README.md,mediaProxy.ts}`, `packages/engine/README.md`, `packages/engine/src/services/videoFrameExtractor.ts`, `packages/studio-server/src/helpers/proxyTranscoder.ts`, `packages/studio-server/src/routes/files.ts`, `packages/studio-server/src/history/projectHistory.ts`, `docs/concepts/determinism.mdx`, `docs/guides/{performance,html-in-canvas,rendering}.mdx`, `docs/packages/cli.mdx`, `docs/weekly-updates.mdx`
- opencut-classic `cf5e79e`: `apps/web/src/services/video-cache/service.ts`, `services/renderer/{scene-exporter,gpu-renderer}.ts`, `core/managers/audio-manager.ts`
- OpenCut `e668010`: `README.md`, `Cargo.toml`
- omniclip `cbe581a`: `s/context/controllers/compositor/parts/video-manager.ts`, `controller.ts`, `video-export/parts/decode_worker.ts`
- twick `3044c23`: `packages/{browser-render,visualizer,render-server}/package.json`, `render-server/src/renderer.ts`
- diffusionstudio/core `4e784a7`: `README.md`, `LICENSE` (MPL-2.0)
