# 02 — HyperFrames as the foundation for the editor

Researched 2026-10-17. Source: shallow clone of `heygen-com/hyperframes` at `b18b3e9` (2026-10-17), in
`/Users/kbtg/.claude-work/jobs/2b878578/tmp/research/repos/hyperframes` (paths below are relative to that folder unless absolute).
Nothing was installed, built or run. Facts come from code, docs, npm and the GitHub API.
**[V]** = verified in code, docs or registry. **[I]** = inference.

## Verdict

**Workable. Strong for graphics, preview runtime and export; weak as the project format and on Windows.**
Use HyperFrames as the **render and graphics engine, pinned and wrapped**, not as the editor's source of truth or its UI.

- Strong: it renders the owner's HTML/GSAP cards today. It ships an embeddable, seek-driven live player that syncs `<video>`/`<audio>` to a GSAP clock. Its export path (Chrome capture plus ffmpeg) has been made to handle long renders (24 h cap, a 40-min soak fixture, segmented capture, resume).
- Weak: its document is HTML with `data-*` attributes. Track index is display-only, there are two in-point attributes that disagree, and nothing is stable at 0.8.x with ~20 releases a week.
- Gaps: Windows render is the less-tested path. The desktop Studio app (agent chat, comments) is closed source and has no Windows build.

**Recommended shape [I]:**
- Own a JSON NLE project model.
- Compile it to a HyperFrames composition for preview and export.
- Keep cards as HyperFrames sub-compositions.
- Vendor or pin exact `@hyperframes/*` versions.
- Borrow Studio pieces as references, not as a forked app.

## 1. Composition and timeline format

**[V] The format is HTML only.** `docs/reference/html-schema.mdx` is the contract.

- **Root:** needs `data-composition-id`, `data-start="0"`, `data-width`, `data-height`, and usually `data-duration`. Quote: "An explicit root `data-duration` is the render length."
- **Clips:** each has `id`, `data-start`, `data-duration`. Duration is optional for images ("3 s default") and for video/audio (source length). `data-start` can be relative: "`clip-id`, `clip-id + seconds`".
- **Tracks:** `data-track-index` is a "Studio timeline lane, display only. The render never reads it and it does not prevent overlap". Paint order is CSS `z-index`. The parser maps edits onto zIndex (`packages/parsers/src/htmlParser.ts:573`, `trackIndex: updates.zIndex`).
- **In-points (trims):** two attribute names, and the docs call it a trap. `data-media-start` and `data-playback-start` are both "Offset into the source file, used by trim and split. Two groups of readers disagree."
  - The compiler and the ffmpeg audio mixer read only `data-media-start`. The runtime and Studio read `data-playback-start` first.
  - Result: "a `<video>` authored with just `data-playback-start` renders a trimmed picture over untrimmed audio."
- **Media attributes:**
  - `data-playback-rate` (0.1 to 10)
  - `data-volume` (up to 3.98, which is +12 dB)
  - `data-fade-in` / `data-fade-out`
  - `data-has-audio`, or `muted` (enforced by lint)
  - Rule: "Do not imperatively call `play()`, `pause()`, or set `currentTime`."
- **Audio** (`docs/reference/audio-effects.mdx`):
  - `data-fx-chain`
  - `data-automation`, JSON lanes on volume, effect parameters and rate; "Maximum 512 points per lane"
  - `<hf-audio-group>` buses; "Groups do not nest"
- **Nesting:** `data-composition-src="./compositions/x.html"`, with markup in a `<template>` and local timing. Media and clips must be **direct children of the root**: a nested `<video>` renders black. The owner's own plan 182 records this as a black-frame trap (`/Users/kbtg/codebase/personal-stuff/plans/182-intro-studio-compose-render-critique.md`).
- **Data model:** `packages/parsers/src/types.ts` (`TimelineMediaElement {src, mediaStartTime?, volume?…}`) is a **lossy** view of the HTML. Quote: "parse/generate is not a lossless replacement for editing the source HTML" (`docs/packages/core.mdx`).
- **Editing API:** `@hyperframes/sdk` is the headless editing engine. It applies `EditOp`s such as `setTiming`, `addElement` and `removeElement` to the HTML. Its `formatVersion: 1` is the only versioned contract on the document (`docs/sdk/reference/edit-operations.mdx`).
- **Known limits** (`skills/hyperframes-core/references/creator-editing-recipes.md`):
  - "no waveform auto-sync or drift correction"
  - a split section "has no `data-playback-rate` of its own"
  - after a split you shift later `data-start` values by hand
- I found no documented limit on clip count.

**Is it suitable as a long-form NLE project format? Partly [I].**

It can express everything a 10-15 min edit needs: many clips, in-points, volume, fades, audio tracks and buses, automation, and nested cards. But it is a poor master file:

- tracks have no semantics
- two in-point attributes disagree
- media must sit flat at the root
- an HTML diff is hard for Claude and for humans to reason about compared with JSON
- the HTML schema changes at the release pace below

Better: own a JSON project (tracks, clips, in/out, gain, comments) and generate the HTML deterministically.

## 2. Player (live preview)

**[V] Seek model.**
- Each composition registers one paused root `gsap.timeline` on `window.__timelines[id]`. Stable globals are `__player`, `__playerReady`, `__renderReady`, `__clipManifest` (`packages/core/src/runtime/README.md`).
- Frame adapters cover GSAP, CSS, Anime.js, Lottie, Three.js, WAAPI and TypeGPU. That adapter API is "experimental v0" (`docs/concepts/frame-adapters.mdx`).
- Seeks snap to frames via `quantizeTimeToFrame` (`init.ts` ~4067), and fps is held as an exact fraction (e.g. 30000/1001).

**[V] Clock and media sync.**
- `TransportClock` (`runtime/clock.ts`) is audio-master when an audio element is attached ("drift is impossible because audio IS the clock"). Otherwise it runs on `performance.now()` with stall correction, ticked by rAF.
- Video drift correction (`runtime/media.ts:538-610`) has three tiers:
  - hard seek at 0.5 s
  - strict 40 ms over 2 samples
  - force 20 ms at transitions
- A playing video is "steered back by rate, not seeked (a seek resets its decoder)", with ±3% (`VIDEO_STEER`).
- `requestVideoFrameCallback` is used only for colour grading, not for sync.
- Preview audio runs through WebAudio, `createMediaElementSource` streaming (`webAudioTransport.ts`), with a `decodeAudioData` whole-file fallback.

**[V] Embedding.**
- `<hyperframes-player>` is a web component with a sandboxed iframe in Shadow DOM (`packages/player/README.md`).
- API: `play()`, `pause()`, `seek(s)`, `currentTime`, `duration`, `playbackRate`, `range-start` / `range-end`, `setRuntimeData`.
- Events: `timeupdate` (~10 Hz), `ready`, `ended`, `error`, `painted`, `assetsready`.
- Control goes through a versioned postMessage protocol (`RUNTIME_PROTOCOL_VERSION = 1`).
- Same-origin by default, which the docs call "a trusted-content mode, not an isolation boundary".

**[V] Long-video and performance evidence.**
- Preview lazy-loads media: 2 s lookahead, 4 s release, off-window media set to `preload="none"` (`init.ts:2787-2886`). This only switches on when the Studio preview marker `<meta name="hyperframes-studio-preview">` is present.
- Studio server makes proxies for codecs the browser can't play, on a size ladder from 256 to 8192 px (`mediaProxy.ts`).
- Studio timeline budgets: `concurrentVideoDecodes: 2`, `maxMountedClipRoots: 512`, `thumbnailCacheBytes: 64 MiB` (`timelineViewportBudgets.ts`).
- I found **no preview benchmark for 10-15 min, many-clip timelines.**

**[V] Owner's own evidence on long-video preview in Chromium.**
- `pipelines/video/visuals-flow/decisions.md` (~lines 340-360): Chrome's **hardware video decoder dies deterministically** on seeks near t≈2111.8 s of a long review mp4. The fix was a reload-and-restore recovery loop.
- Lesson recorded there: "A repro harness that disables the subsystem under suspicion cannot exonerate it."
- That fault is in Chromium itself, so any HTML-based player (HyperFrames or not) inherits it.

**Does preview equal render? Close, not identical [V].**
- The claim: "both run the same `hyperframe.runtime`, the producer's seek behavior is the single source of truth" (`docs/concepts/determinism.mdx`).
- But the mechanisms differ:
  - Render does not decode video with `<video>`. It "replaces native <video> elements with pre-extracted frame images" from ffmpeg (`packages/engine/src/services/videoFrameInjector.ts`).
  - Render audio goes through OfflineAudioContext plus ffmpeg `amix`. Preview uses a live AudioContext.
  - Effect-chain failure behaves differently: "Plays dry [preview] / Fails the whole mix [render]".
  - The two in-point attributes are read by different code.
  - Fonts and Chrome version can differ: "Render in Docker when you need exact reproducibility."
- **Owner-verified mismatch:** plan 175 (`/Users/kbtg/codebase/personal-stuff/plans/175-vf2-per-cue-frame-gate.md`) says the c20 accent colour bug "does NOT reproduce in a browser page — puppeteer shows orange; only `hyperframes render --variables` output is white." So WYSIWYG has already failed once in practice.
- **[I]** Playing preview is ~40 ms accurate. Paused seeks are frame-exact. That is fine for editing, but not a proof of parity: export QC still needs rendered-frame checks (the owner's house rule since 2026-07-19).

## 3. Studio (open-source web editor)

**[V] What the timeline does today** (`docs/studio/timeline.mdx`, `docs/studio/shortcuts.mdx`, `packages/studio/src/...`):
- **Edit tools:**
  - move and trim by dragging edges
  - razor/split (B, S, Shift for all tracks)
  - **ripple delete** on the main track, as one undo step (`useTimelineDeleteOps.ts`; toolbar: "Ripple on: keeps the main track gapless")
  - close gap
  - magnet snapping (N), to playhead, clip edges and beats
  - multi-select and marquee
  - copy/paste, group
- **Tracks:** reorder and hide.
- **Nested compositions:** with a breadcrumb.
- **Playback:** J/K/L, I/O work area.
- **Audio:**
  - waveforms
  - gain and fades
  - audio buses
  - FX rack
  - loudness normalize
  - **automation lanes** (Ableton-style; `plans/audio-automation-lanes/SPEC.md`)
- **Undo/redo:** server-side, per project, in `.hyperframes/` (`packages/studio-server/src/history/projectHistory.ts`).
- **Missing [I, from absence]:**
  - ripple trim and ripple move (ripple is delete-only)
  - roll, slip and slide tools
  - rate stretch
  - track lock
  - timeline markers and comments in the open-source Studio

**[V] How edits persist.**
- Studio writes straight back into the HTML: `file-mutations/patch-element`, `split-element`, `gsap-mutations`, and so on.
- External edits are watched (`packages/cli/src/server/fileWatcher.ts`) and pushed to Studio over SSE (`/api/events`, `file-change`).
- Studio's own writes carry a token, so they don't reload themselves. Collisions show `ExternalFileConflictBanner`. Writes are etag-guarded.
- So "Claude edits the file and the owner sees it live" already works in the web Studio.

**[V] Agent features.**
- **Open source:**
  - **WebMCP**, 12 in-browser tools (`packages/studio/src/webmcp/`). `studio_look` returns "the playhead, selection, undo state, and a bounded source-backed scene", and `studio_frame` returns a PNG at any time. They need Chrome/Edge with an Origin Trial, or a polyfill plus a bridge extension, so they are not a stdio MCP for Claude Code.
  - `PUT /projects/:id/selection`, read by `hyperframes preview --selection --json`. This is the canvas selection only, and its time is a snapshot taken at selection.
  - "Copy to agent" buttons, which copy to the clipboard only.
  - A hosted MCP through a HeyGen account.
  - 21 skills.
  - No terminal (no xterm or node-pty anywhere).
- **Closed desktop app only** (`docs/studio-app/edit-with-the-agent.mdx`, `connect-your-agent.mdx`):
  - Comment tool (C) "Pin a comment to a spot and moment".
  - Draw across the timeline.
  - "Pending video edits, up to 10… Send 3 edits to Claude Code".
  - Runs your local Claude Code or Codex. Quote: "Runs bill to the plan of the account your agent is signed in with" — this is subscription billing, the same model the owner wants.
- **[I]** HeyGen's closed app is the closest existing product to the requirements: agent chat on the user's own Claude subscription, comments at moments, a live timeline. It is a strong design reference and proof that the concept works. It is not usable as our base (closed, no Windows, HeyGen sign-in).

**[V] Architecture.**
- Stack: React 19, Zustand, CodeMirror 6, Tailwind, Vite, dockview-react, @tanstack/react-virtual (`packages/studio/README.md`).
- `hyperframes preview` (port 3002) starts a Hono server (`packages/cli/src/server/studioServer.ts`) that mounts `createStudioApi(adapter)` from `@hyperframes/studio-server`. The route surface (projects, files, file-mutations, gsap-mutations, preview, render jobs, waveform/peaks, thumbnails, selection, history) is listed in the studio sub-report.
- `@hyperframes/studio` and `@hyperframes/studio-server` are public on npm (0.8.168) with host hooks (`EditorShellProps`, `gestureOverlay`, `CanEditTimelineElement`). But the docs say: "building blocks, not a drop-in embedded editor."

**[V] Desktop app.**
- "for Mac and Linux" (`docs/studio-app/index.mdx`): a Mac dmg and a Linux AppImage, with auto-update and HeyGen sign-in required.
- Source is in the private `hyperframes-internal` repo (`packages/cli/src/utils/appHistory.ts`, `desktopApp.ts`).
- Windows is planned but absent: "null where there is none yet (Windows)".
- **[I, high confidence]** It is Electron (changelog: "Built-in transcription runs inside Electron").

## 4. Producer and export

**[V] How rendering works.**
- Puppeteer drives headless Chrome, seeks each frame, captures it and pipes it to ffmpeg (`packages/engine/src/services/frameCapture.ts`, `streamingEncoder.ts` `-f image2pipe`).
- **Deterministic BeginFrame capture is Linux-only:** `headlessShell && process.platform === "linux" && …` (`browserManager.ts:818-825`).
- **macOS and Windows use screenshot capture**, plus an opportunistic "drawElement" fast path. It is on by default for macOS with a hardware GPU (`releases/v0.7.38.md`, "roughly 2× faster capture") and covers "about 78% of Windows renders" (`releases/v0.7.78.md`).
- Parallel workers are separate Chrome processes, `MEMORY_PER_WORKER_MB = 1536` (`parallelCoordinator.ts`).
- Encoding is libx264 by default (high quality = `slow` CRF 15). An opt-in `--gpu` flag uses nvenc, videotoolbox, qsv or amf.
- Source video is pre-extracted by ffmpeg to JPG frames and injected. Audio is mixed with ffmpeg `amix`; FX run in an OfflineAudioContext.
- **Long-form support:**
  - 24 h cap (`planValidation.ts:76`)
  - opt-in segmented capture with Chrome restarts and `--resume`
  - "very long mixes render in 5 minute windows"
  - a manual long-form test suite including a 40-min soak (`packages/producer/tests/long-form/README.md`)
  - Raw frames written to disk cost "about 25 GB per minute at 1080p30" unless streaming is used.

**Speed for a 10-min 1080p video.**
- **[V] Measured numbers that exist:**
  - 300 frames at 1080p in 9.8–25 s (`docs/guides/performance.mdx`)
  - ~45–67 ms/frame capture per worker (`packages/producer/tests/perf/README.md`)
  - 300 s at 1080p30 draft: "5 m 16 s segmented vs 2 m 43 s streaming" (long-form README)
- **[I] Estimate:**
  - A 10-min 1080p30 export (18,000 frames) is likely **10–25 min on an M-series Mac**, depending on layer count and workers. Draft could be near realtime.
  - 4K screen-recording sources add heavy extraction and disk cost.
  - Windows is likely slower (screenshot path, software-GPU fallbacks).
  - `hyperframes benchmark` exists to measure this per machine.

**[V] Windows support.**
- Real render CI on `windows-latest` (`.github/workflows/windows-render.yml`). There is **no macOS render CI**.
- Chrome is downloaded and pinned (`CHROME_VERSION = "152.0.7977.30"`, `packages/cli/src/browser/manager.ts`).
- **FFmpeg is not bundled.** Users "Download a 64-bit Windows build" by hand (`docs/guides/troubleshooting.mdx`).
- 46 of 328 release notes mention Windows, e.g. symlink EPERM, path-length limits, "Auto-disable streaming-encode on Windows software-GPU compound", stray ffmpeg console windows.
- The owner's own code already works around the npx.cmd shell and lavfi drive-letter quirks (`pipelines/video/visuals-flow/lib/kit/hyperframes.mjs`).

## 5. API stability, release cadence, governance

**[V] Releases** (npm `time`, computed 2026-10-17):
- **522 versions of `hyperframes` since 0.1.0 on 2026-03-23.**
- Per month: Apr 74, May 92, Jun 82, Jul 66, Aug 44, Sep 79, Oct 69 in 17 days.
- Per week (changelog): W38 20, W39 23, **W40 45**, W41 23.
- Minor bumps: 0.7.0 on 2026-06-22, 0.8.0 on 2026-08-18. Also a `0.8.53-desktop.0` tag.
- All 14 public `@hyperframes/*` packages are in lockstep at 0.8.168 ("fixed versioning", CONTRIBUTING).

**[V] Breaking changes ship in patch releases.** Examples:
- v0.8.12 "Remove `window.__hf.setAudioSolo`"
- v0.8.156 "Inspector: Stop shipping agent tools"

Deprecation is informal: "The old name stays for one release as a deprecated alias". There is no semver or 1.0 policy. The only things labelled stable are the runtime README's "Runtime Contract (Stable Surface)" (the globals and postMessage protocol v1) and the SDK `formatVersion: 1`. Frame adapters are "experimental v0".

**[V] Adoption:** 811,570 weekly downloads of `hyperframes` (Oct 6–12) and 67,069 of `@hyperframes/player`. 65.6k stars, 5.9k forks, 368 open issues. Repo created 2026-03-10.

**[V] Governance.**
- "Hyperframes uses a **BDFL** governance model. The core maintainers at HeyGen have final say" (CONTRIBUTING.md:259).
- CODEOWNERS: `@miguel-heygen`, who has 2,707 contributions (the next two have 1,141 and 949). 44 of the last 50 commits are his.
- Apache-2.0, no CLA. The player README says MIT, which conflicts with the repo licence.
- **Telemetry is on by default.**
- Commercial surfaces: HeyGen-billed `cloud render`, the closed desktop app, a hosted MCP. ADOPTERS lists HeyGen's own product plus PandaStudio, a "desktop video editor".

**[V] `plans/` and roadmap signals:** almost all audio.
- FX presets ("Nothing here is built")
- Ableton-style automation time selection, "approved, awaiting implementation plan", "Explicitly not a DAW"
- a 47-PR WebAudio FX stack
- a preview load-time proposal

There is nothing on long-form editing. Studio already has `components/nle/`.

**[I] Direction risk:** the direction is agent-first, HeyGen-account-linked, with cloud upsell. Apache-2.0 means we can always fork, but the bus factor is effectively one person, and churn makes "track upstream" expensive. The real risk is not abandonment (HeyGen's product depends on it). It is **churn plus decisions made for HeyGen's hosted product**, e.g. agent tools pulled from the inspector, sign-in gates moved into the app.

## 6. Can our Electron app depend on @hyperframes packages as libraries?

**[V] Yes, technically.** All are public npm packages under Apache-2.0.

| Package | Fit | Most stable surface |
|---|---|---|
| `@hyperframes/core` | ~100 subpath exports. `import` resolves to `./src/*.ts`; only `node` gets `dist` | `./runtime` iife plus the runtime globals contract; the HTML attribute contract |
| `@hyperframes/player` | Web component in an iframe; good fit in an Electron renderer | postMessage protocol v1; documented attributes and events |
| `@hyperframes/producer` / `engine` | Node render pipeline; runs in Electron main or a child process; needs Chrome (downloaded) plus ffmpeg (bundle it ourselves) | CLI `render` flags (what the owner uses today); `distributed.ts` plan/chunk/assemble |
| `@hyperframes/sdk` | Headless HTML editing ops | `EditOp`s, `formatVersion: 1` |
| `@hyperframes/studio` / `studio-server` | React 19 / Hono building blocks with host hooks | None declared; treat as reference code to copy |

**[I]** The safest boundary is the **CLI (`hyperframes render`) or `producer` as a child process** for export, plus the **player web component** (or the core runtime iife in our own iframe) for preview. Both are behind contracts the project itself calls stable. Avoid deep imports into core subpaths and studio internals.

## 7. Owner's current usage

- **[V] Two renderer pins** in `/Users/kbtg/codebase/personal-stuff/pipelines/video/visuals-flow/lib/renderer-constants.mjs`:
  - `CARD_RENDERER_VERSION = '0.7.62'` for all 42 catalogue cards
  - `FILM_RENDERER_VERSION = '0.7.88'` for the intro film render and review
  - Kept split on purpose: "unifying changes rendered output", so a bump needs a frame-verification pass (decisions.md 2026-08-06).
- **[V]** The VPS render app `apps/hyperframes-render/Dockerfile` pins a third version, `HF_VERSION=0.6.97`.
- **[V]** `lib/kit/hyperframes.mjs` only shells out to `npx -y hyperframes@<pin>` for `lint`, `check --json`, `snapshot` and `render`. There is no library import. It handles Windows `npx.cmd`/shell quoting and lavfi drive-letter escaping.
- **[V]** `card-library/CLAUDE.md` lints new cards against `@latest`, and expects the warnings "Studio can't drag-edit" (`gsap_studio_edit_blocked`) and Google Fonts. **[I]** So the owner's cards are already not Studio-editable as authored.
- **[V] Known pain:**
  - Version drift across three pins.
  - Silent black-frame traps (nested media, missing `class="clip"`; plan 182).
  - Preview vs render mismatch on variables (plan 175).
  - `check` misses capacity and clearance defect classes (plans 168, 212).
  - Chromium hardware decode crashes on long-video seeks in the review board (decisions.md).
- **[I]** The owner is 80+ patch releases behind latest (0.7.62 vs 0.8.168). Upgrades are already a managed, costly event, and an editor built on HyperFrames makes that permanent.

## 8. Top 5 risks and how to de-risk each

1. **Preview performance on a real 10-15 min, many-layer timeline is unproven** (no benchmark; lazy-load only under the Studio marker; Chromium decoder faults on long seeks already seen).
   *Spike (2-3 days of agent time):* compile one real past video (screen recordings including 4K, avatar clips, VO, music, SFX, ~40 cards) into a single composition. Play it in `<hyperframes-player>` inside Electron on the owner's Mac and a mid-range Windows laptop. Measure dropped frames, seek latency, memory and A/V drift over 15 min, with the hardware decoder on. Test with and without proxies. Decide pass/fail before anything else.
2. **Preview is not equal to export** (different video and audio paths, two in-point attributes, plan-175 variable bug).
   *De-risk:* our compiler emits only one in-point form (`data-media-start` on media). Build a parity harness that renders N timestamps via `producer` and compares them with player screenshots at the same times (pixel diff plus audio cross-correlation). Run it in CI on every pin bump.
3. **API churn and breaking patches** (~20 releases a week, no semver, BDFL).
   *De-risk:*
   - Pin one exact version across preview and export (fixes today's three-pin problem).
   - Depend only on the stable surfaces: HTML contract, runtime globals and postMessage v1, CLI/producer render.
   - Put everything behind our own `renderer` adapter interface.
   - Bump quarterly, gated by the parity harness and the owner's frame-verification rule.
   - Be ready to vendor or fork (Apache-2.0).
4. **HTML as the project format is a poor NLE master** (display-only tracks, lossy parser, root-only media, schema churn).
   *De-risk:* our own versioned JSON project file (tracks, clips, in/out, gain, automation, comments, markers) is the source of truth that Claude and humans edit. Compile it to HyperFrames HTML deterministically; cards stay sub-compositions. This also cuts our exposure to risk 3.
5. **Windows export and preview are the weaker path** (BeginFrame Linux-only, screenshot capture, ffmpeg not bundled, many Windows-specific fixes; the closed app skips Windows).
   *De-risk:*
   - Bundle a pinned ffmpeg and pre-fetch the pinned Chrome in our installer.
   - Run the risk-1 spike plus a full 10-min export on the sister's class of Windows machine.
   - Add Windows to our CI.
   - Keep a fallback export path: a Linux/Docker render (BeginFrame, deterministic). The owner already runs one at `render2.agrolloo.com`.

Also noted, lower priority:
- Telemetry is on by default; turn it off in our build.
- Export speed: estimated 10–25 min for 10 min of 1080p. Measure with `hyperframes benchmark`; `--gpu` encoders are opt-in.
- Only the closed app has comments and an agent bridge, so we build the MCP server, comments and terminal ourselves. WebMCP's `studio_look`/`studio_frame` shapes are good templates.

## Verified vs inferred, in one place

- **Verified:**
  - format attributes and their quirks
  - player sync constants and API
  - render pipeline and Linux-only BeginFrame
  - Windows CI, ffmpeg not bundled
  - desktop app Mac/Linux only and closed source
  - Studio feature list (ripple delete, razor, automation, undo, file-watch SSE, WebMCP)
  - npm cadence (522 versions in ~7 months) and download counts
  - BDFL governance
  - owner's pins and pain points
- **Inferred:**
  - Electron as the desktop stack
  - 10–25 min export estimate
  - preview behaviour on 15-min many-clip timelines
  - that a JSON master compiled to HTML is the better design
  - the direction risk being churn rather than abandonment
