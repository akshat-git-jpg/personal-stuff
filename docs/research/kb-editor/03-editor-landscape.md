# 03: Editor foundation landscape (as of 2026-10-17)

Survey of every credible open-source or free-for-individuals base for the owner's
AI-driven editor (see `REQUIREMENTS.md`), with a scored matrix and a top-3 shortlist.

**Legend.** **[V]** = verified this session against GitHub API, repo files, or the
vendor's own page (URL given). **[I]** = my inference from architecture or docs, not
tested. Repo stats come from `gh api` on 2026-10-17. "90d commits" = commits on the
default branch since 2026-07-17, capped at 100.

---

## 0. The big news since mid-2026 (read first)

1. **Agent-native desktop NLEs now exist as open source.** In 2026 a new category
   appeared: editors whose whole tool surface is an MCP server that an outside agent
   (Claude Code, Codex) drives while the human watches the timeline update. Three are
   real and ship Mac + Windows installers: **WeftCut** (MIT), **Diffusion Studio
   editor** (MPL-2.0) and **OpenChatCut** (AGPL plus a Remotion dependency). None of
   them was on the original candidate list. **[V]**
2. **HyperFrames, which the owner already uses, grew a Studio.** It is now a 65.6k-star,
   Apache-2.0 HeyGen project with an open-source React **Studio**: timeline, live
   preview, inspector, and **12 WebMCP agent tools** (`studio_look` returns the
   playhead and selection). The polished **desktop app is a separate HeyGen product**.
   It covers macOS and Linux only ("Windows coming soon"), and nothing shows its source
   is open. **[V]**
3. **OpenCut is not a usable base today.** The 95k-star repo was wiped and is being
   rewritten from scratch in Rust/GPUI. Right now it is a scaffold, and it does not
   take outside contributions. The working web version is archived as
   `opencut-classic`. **[V]**
4. **HTML-in-Canvas** (`drawElementImage`, WICG) is in a Chrome origin trial,
   extended through Chrome 160 with no ship date. Diffusion Studio turns it on inside
   Electron, and Remotion's web renderer supports `<HtmlInCanvas>`. It is the most
   promising route to "live DOM graphics composited on a GPU canvas = the same pixels
   at export". However, the API was renamed as recently as Chrome 155. **[V]**
   https://developer.chrome.com/blog/html-in-canvas-ot-changes

---

## 1. Candidate-by-candidate

### 1.1 Agent-native desktop editors (new in 2026)

#### WeftCut: `WeftCut/WeftCut`, https://github.com/WeftCut/WeftCut
- **License:** MIT **[V]**. Installers bundle FFmpeg (LGPL libs in-process, GPL CLI
  as a separate process) and document it in `docs/licensing.md` **[V]**. You can fork
  it, rebrand it and ship it with no restrictions.
- **Stats:** 233 stars, created 2026-05-22, v0.5.0 released 2026-10-16, 100+ commits
  in 90 days. **Contributors: 2.** UncleChair has 3,634 commits and the other person
  has 1. **[V]** The bus factor is 1.
- **Stack:** Electron 44 + a Rust domain core as a napi-rs addon. The renderer uses
  React 19, PixiJS 8 (WebGPU compositor), WebCodecs and mediabunny, plus
  `@modelcontextprotocol/sdk` **[V]** (package.json, ADR 0024).
- **Live preview:** a PixiJS/WebGPU compositor over WebCodecs decode, with
  hardware-decode routes, preview proxies and short-GOP scrub proxies (ADRs 0006, 0008,
  0009, 0029-0034) **[V]**. This is real NLE engineering for heavy footage.
- **HTML/CSS/JS graphics ("Motifs"):** any web page (HTML/CSS/SVG/canvas/WebGL) as a
  timeline layer. It renders in an offscreen Electron `BrowserWindow`, captured over
  CDP. Determinism comes from a **clock takeover**: rAF, timers and `performance.now`
  are stubbed, and WAAPI is seeked. Output is **byte-identical across Win/Mac/Linux on
  their CI** (ADR 0017) **[V]**. Preview uses an in-RAM lookahead plus an optional
  on-disk "Pre-bake" when raster throughput falls behind (ADR 0016, 0078, 0095-0098)
  **[V]**. So HTML layers are near-live and get cached, rather than composited live
  in the DOM. GSAP should work because it runs off rAF, which the harness controls
  **[I]**. HyperFrames compositions would need a small adapter
  (`window.__hf` seek vs `motif.define`) **[I]**.
- **Export:** a hardware-accelerated encoder, 10-bit float16 composite path, and the
  same Motif frames streamed into export (ADRs 0011, 0022, 0080) **[V]**. Preview and
  export share the compositor, so it is WYSIWYG by design **[V/I]**.
- **Agent/MCP:** a localhost MCP server exposes "all editing tools" (place, trim,
  split, restyle, keyframe, caption, mix, checkpoint). Edits land live while the
  timeline plays. It also has an Agent activity panel, checkpoints, `dry_run`
  rehearsal and a history lock **[V]** (README). "Agent review" **Tacks** are
  time-ranged review marks kept beside the project (ADR 0115-0119) **[V]**. There is
  **no embedded terminal**. You copy a connection prompt into your own agent **[V]**.
- **Mac+Win:** release assets include `mac-arm64.dmg`, `win-x64.exe`, `.deb` and
  `AppImage`, plus electron-updater **[V]**. The macOS installer is not notarized yet
  ("Open Anyway") **[V]**. There is no Intel-Mac build **[V]**.
- **Extensibility:** Motifs are the extension point for graphics. I found **no general
  plugin API** **[V, by tree search]**. The 119 ADRs make the codebase unusually easy
  for an agent to read **[V]**.
- **Ripple, blade, markers:** ripple is an explicit command (ADR 0062), gaps can be
  selected and deleted (ADR 0069), and markers exist **[V]**. Human timestamped
  comment threads, as such, are not present **[I]**. Markers plus Tacks come close.
- **Verdict:** this is the closest existing match to requirements 1, 3, 5 and 6, with
  the best licence. Its biggest risk is that a 5-month-old project depends on one
  person.

#### Diffusion Studio editor: `diffusionstudio/editor`, https://github.com/diffusionstudio/editor
- **License:** MPL-2.0 (file-level copyleft: if you distribute changed MPL files, you
  must publish those files; you can add your own files under any licence). Brand assets
  are excluded **[V]**.
- **Stats:** 3,330 stars, created 2026-07-07, 100+ commits in 90 days. **3
  contributors, one with 809 of 813 commits** **[V]**. A YC F24 startup **[V]**.
  The older `diffusionstudio/core` (1.2k stars) was last pushed 2025-11 and is
  superseded **[V]**.
- **Stack:** an Electron shell, a SolidJS + Vite UI, an ECS runtime (koota), a Solid
  universal-renderer reconciler, and an encoder over mediabunny **[V]**.
- **Composition model:** **a project is a folder of SolidJS JSX.** Canvas and timeline
  edits are written back to the source by element `id`, and code edits redraw the
  canvas **[V]**.
- **HTML graphics:** an `<html>` element draws real DOM into the canvas via
  **HTML-in-Canvas**, which the app ships enabled. They recommend driving it with an
  anime.js timeline seeked from `useTicker` **[V]** (docs/reference/jsx/html.md).
  Preview and export run the same path, so it is WYSIWYG **[I]**. It depends on an
  origin-trial Chromium API **[V]**. GSAP should work the same way as anime.js
  (seek a paused timeline) **[I]**.
- **Agent/MCP:** the app registers its MCP server with Claude Code, Codex and others.
  The `diffusion` CLI mirrors each tool (probe, grab, filmstrip, waveform, transcribe,
  listen, capture, check, context, screenshot) **[V]**.
- **Mac+Win:** downloads for macOS Apple Silicon and Windows x64 **[V]**.
- **Cost:** the editor, MCP, CLI and agentic editing with your own coding-agent
  subscription are free. Unlimited exports up to 4K with no watermark. AI
  generation, transcription and analysis cost credits on Pro **[V]**
  (diffusion.studio/pricing). The web app needs Supabase and `api.diffusion.studio` env
  vars and has login pages **[V]**. A fork would have to strip out the account
  dependency **[I]**.
- **Verdict:** a strong design, but the bus factor is 1, the company has an incentive
  to move features behind its cloud, and graphics must be authored as Solid JSX rather
  than the owner's existing HyperFrames HTML.

#### OpenChatCut: `0xsline/OpenChatCut`, https://github.com/0xsline/OpenChatCut
- **License:** AGPL-3.0 **[V]**, **built on Remotion 4.0.509** (`@remotion/player`,
  `/renderer`, `/web-renderer`, `/media`) **[V]**. So the Remotion License applies on
  top of AGPL. That is an awkward legal stack: a source-available, company-tiered
  dependency inside an AGPL program **[I]**.
- **Stats:** 2,432 stars, created 2026-07-15, 35 contributors, main author has 859
  commits **[V]**. Electron 43, installers for mac arm64/x64, Windows x64 and Linux
  **[V]**.
- **Features:** multitrack timeline, transcript-based cuts, MCP for external agents
  plus a built-in agent, motion templates and WebGL, and **FCPXML export** **[V]**.
- **Verdict:** feature-rich, but the AGPL plus Remotion licence stack is bad for
  "years-long, ship to editors". A built-in agent backed by sponsored APIs (OfoxAI/fal)
  pulls toward recurring costs **[I]**.

#### Others found
- **Pireel** (`pireel/pireel`), AGPL-3.0, 1.3k stars, 3 contributors. The OSS edition
  is "local editing", and Chat and services are hosted **[V]**. Open-core.
- **Palmier Pro**: macOS-only (fails requirement 6). GPLv3 editor/MCP, with closed
  credit-based generation (secondary source, alextech.ai) **[I]**.
- **No-GUI agent pipelines** (useful as references, not as bases): `browser-use/video-use`
  (MIT, 29k stars), `veedstudio/open-edit` (Apache-2.0, 1.7k), `calesthio/OpenMontage`
  (AGPL, 69k), `KyaniteLabs/kinocut` (Apache-2.0 FFmpeg MCP) **[V]**. They contradict
  requirement 5 because they re-render on every change.

### 1.2 HyperFrames (HeyGen): `heygen-com/hyperframes`, https://github.com/heygen-com/hyperframes
- **License:** Apache-2.0 **[V]**. You can fork it and ship it, with a patent grant.
- **Stats:** 65.6k stars, created 2026-03-10, 105 contributors. The core team is about
  four HeyGen engineers (2.7k, 1.1k, 0.9k and 0.26k commits). Releases ship almost
  daily (v0.8.168 on 2026-10-17) **[V]**.
- **Packages:** core, engine (Puppeteer + `HeadlessExperimental.beginFrame` + FFmpeg),
  producer (render pipeline / HTTP render server), player (`<hyperframes-player>` web
  component in a sandboxed iframe), studio (React 19 + Zustand + CodeMirror, with
  visual timeline, inspector, GSAP keyframe editing, audio groups, captions, render
  queue, dock layout), studio-server, lint and sdk **[V]**.
- **Live preview:** the composition is a real HTML document in an iframe. GSAP, Lottie,
  Three, CSS and WAAPI play live, and media playback is framework-owned **[V]**.
- **Export:** headless Chrome seeks each frame and screenshots it, then FFmpeg encodes.
  It supports parallel workers, plus Lambda/GCP/HeyGen cloud **[V]**. The same Chrome
  engine renders preview and export, so HTML graphics are **WYSIWYG by construction**
  **[I, strong]**. Per-frame screenshot export of a 15-min 1080p30 video (27k frames)
  with 4K screen-recording sources is likely slow compared with a GPU compositor
  **[I, untested]**.
- **Agent:** the OSS Studio registers **WebMCP** tools: `studio_look` (project,
  playhead, selection, undo state, scene tree), `studio_inspect`, `studio_frame`
  (PNG at time t), select, seek, set_style, plus content, animation and transform
  tools **[V]** (docs/guides/webmcp.mdx). WebMCP itself is an origin trial in Chrome
  149 / Edge 150 **[V]**. Inside our own Electron shell we would bridge these tools to
  a normal MCP server **[I]**. The CLI already detects `CLAUDE_CODE_SESSION_ID` and
  hands Claude sessions over to the desktop app **[V]** (packages/cli/src/utils/desktopApp.ts).
- **Desktop app:** HeyGen's "HyperFrames Studio" desktop (Framey agent, draw-on-frame
  and comment-on-clip feedback, MP4/WebM/MOV up to 4K) is **macOS + Linux only.
  Windows is "coming soon"** **[V]** (hyperframes.dev/studio, Product Hunt). Nothing
  shows its source is open. The code refers to `hyperframes-internal` **[V]**.
- **Telemetry:** the Studio sends anonymous telemetry, and you opt out with a
  localStorage flag **[V]**.
- **Verdict:** the best fit for the HTML/GSAP graphics layer, and the owner already
  uses it. The model is a composition document, not a footage NLE. The features that
  matter most (comments, Windows desktop) are in the closed app. The OSS Studio works
  as a **component library to borrow from** or as a **graphics engine inside our
  editor**, not as the whole editor.

### 1.3 Web/TS libraries and editors from the original list

| Project | License **[V]** | Stars / last default-branch commit / 90d commits / contributors **[V]** | Notes |
|---|---|---|---|
| **OpenCut** (rewrite) `OpenCut-app/OpenCut` | MIT | 95.0k / 2026-09-24 / 16 / 101 | **Rewriting from scratch**: Rust core, GPUI desktop, WASM web. Planned Editor API, plugin-first design, MCP server and headless mode. "Not set up to take outside contributions." The latest commits are GPUI shell scaffolding **[V]**. A GPUI preview cannot host live DOM/GSAP **[I]**. |
| **OpenCut classic** `OpenCut-app/opencut-classic` | MIT | archived 2026-05 | Next.js web editor with a Rust/WASM GPU compositor, ripple, masks, effects **[V]**. Web-only, archived, no HTML layers **[I]**. |
| **Remotion** `remotion-dev/remotion` | Remotion License (source-available) | 64.7k / 2026-10-17 / 100+ / 459 (JonnyBurger 33k commits) | See 1.4. |
| **Twick** `ncounterspecialist/twick` | "Sustainable Use License" (not OSI): no standalone sale, no SaaS without agreement, **no rebranding** | 541 / 2026-05-07 / 0 / 7 | React timeline and canvas SDK, captions via Vertex AI. Stalled and restrictive. |
| **Revideo** now `midrender/revideo` | MIT | 4.1k / 2026-07-15 / 0 / 93 | Motion-Canvas-derived canvas scene graph in TS generators. Now the engine behind Midrender. No DOM/HTML graphics **[I]**. Stalled. |
| **Motion Canvas** | MIT | 19.4k / 2026-07-02 / 0 / 98 | Last release v3.18.0-alpha (2025-02) **[V]**. Animation tool, not an NLE. |
| **Omniclip** `omni-media/omniclip` | MIT | 1.5k / main 2025-08-07 / 0 / small | WebCodecs browser NLE (trim, split, transitions, 4K render). "2.0 in development" on branches (pushed 2026-10-16) **[V]**. Web-only. |
| **Diffusion Studio core** | MPL-2.0 | 1.2k / 2025-11-18 / 0 / 7 | Superseded by `diffusionstudio/editor` (1.1). |
| **Etro** | GPL-3.0 | 1.2k / 2026-10-12 / 12 / 30 (one author has 787 commits) | Canvas layer and GLSL library. Real-time-only recording ("offline rendering coming soon") **[V]**. |
| **OpenVideo / designcombo react-video-editor** `openvideodev/react-video-editor` | Remotion-style two-tier licence (free for individuals or 3 employees or fewer; no selling derivatives) | 1.8k / 2026-06-30 / 0 / 6 | Remotion-based React editor template. Stalled. |
| **Shotstack Studio SDK** | PolyForm Shield 1.0 (no competing with Shotstack) | 59 / 2026-10-08 / 100+ / 8 | Front end for Shotstack's paid cloud render API. Recurring cost, so it fails requirement 9. |
| **mediabunny** `Vanilagy/mediabunny` | MPL-2.0 | 7.3k / 2026-10-16 / 100+ / 46 (Vanilagy 1,221 commits) | Pure-TS demux/mux/convert over WebCodecs, zero deps. Gold sponsors include **Remotion, Diffusion Studio, Screen Studio, Tella, Gling, Kino**, ElevenLabs bronze **[V]**. A **primitive, not an editor**. Remotion's web renderer, Diffusion and WeftCut all use it **[V]**. Bus factor 1, but sponsors keep it funded. |

### 1.4 Remotion in detail
- **Licence (current LICENSE.md):** free for individuals, for-profit orgs **with up to
  3 employees**, and non-profits. Commercial use is allowed "for the purpose of creating
  videos". **Not allowed:** "copy or modify Remotion code for the purpose of selling,
  renting, licensing… your own derivative" **[V]**. The FAQ puts the line at "headcount
  of 4 or more" **[V]** (remotion.dev/docs/editor-starter/faq).
- **Pending Remotion 5.0 licence (PR #3750, draft, not merged):** "**Contractors also
  count towards team size**", and the company licence becomes bound to new T&Cs **[V]**.
  **This hits the owner directly.** Hired human video editors are contractors. Owner,
  sister and two hired editors already makes four people, which could need a paid
  Company License under 5.0 **[I, from the draft text]**. That is a recurring cost and
  a legal dependency for years.
- **Editor Starter:** $600 one-time. Timeline, canvas, font picker, assets, 80+ feature
  flags. React Router 7, Player, Lambda, Whisper. Export defaults to **Lambda**;
  client-side WebCodecs export exists but is off by default **[V]**. **"The Editor
  Starter source code may not be redistributed"** **[V]**. Shipping a built app to the
  sister and editors is a grey area, and open-sourcing it is ruled out **[I]**.
- **Preview:** `@remotion/player` renders React/DOM live, so HTML/CSS/GSAP (seeked via
  `useCurrentFrame`) plays live **[V/I]**.
- **Export:** (a) Node `@remotion/renderer` drives headless Chrome, giving full DOM
  fidelity and WYSIWYG. (b) `@remotion/web-renderer` `renderMediaOnWeb()` is **stable
  since 4.0.491**, uses mediabunny, but supports **only a CSS subset**: no
  `mix-blend-mode`, `backdrop-filter`, `perspective`, `z-index` (DOM order only) or
  CSS `@font-face` fonts, filters fail on Safari, and it is single-threaded **[V]**
  (docs/client-side-rendering/limitations). Client renders **always send telemetry**,
  and you can't opt out **[V]** (docs/license/telemetry).
- **Verdict:** technically excellent and the most mature. The licence is the problem
  for a multi-person, contractor-including, years-long tool.

### 1.5 Native editors

| Project | License **[V]** | Activity **[V]** | Stack | HTML/GSAP live? | Agent/MCP | Notes |
|---|---|---|---|---|---|---|
| **Kdenlive** + **MLT** | GPL-3.0 (app); MLT LGPL-2.1 | Kdenlive 5.9k stars, 226 contributors (one has 14.5k commits), tag v26.08.2, 100+ commits/90d. MLT 1.9k, active | C++/Qt6/QML over MLT; proxies; render via `melt`, the same engine as preview, so WYSIWYG | No. MLT's old WebVfx module is effectively gone **[I]** | Community MCP servers only (D-Bus `mcp-kdenlive`, file-based servers) **[V]** (glama.ai) | Mature, KDE-backed, Mac/Win builds. Embedding a Claude terminal or a comment UI means patching C++/Qt **[I]**. |
| **Shotcut** | GPL-3.0 | 15.4k stars, v26.9.27 (2026-09-28), 83 contributors (ddennedy 6.2k) | C++/Qt over MLT | No **[I]** | None official **[I]** | One principal developer, no plugin API **[I]**. |
| **Olive** | GPL-3.0 | **Last commit 2024-12-05**, 0 since **[V]** | C++/Qt/OCIO | No | None | Dead. |
| **OpenShot** / libopenshot | GPL-3.0 (app) / LGPL-3.0 (lib) | openshot-qt v4.0.1 (2026-09-27), 65 contributors, active | Python/Qt + C++ lib + FFmpeg | No **[I]** | None official **[I]** | Python makes agent scripting possible. Historically weak preview performance on heavy timelines **[I]**. |
| **Blender VSE** | GPL (Blender) | Very active | C/C++/Python | No | Full Python API. Community `blender-mcp` exists **[I]** | Far too heavy for a non-technical user and hired NLE editors **[I]**. |
| **LosslessCut** | GPL-2.0 | 44.6k stars, v3.69.0 (2026-06), active | Electron + FFmpeg | n/a | None | Single-track lossless trimmer. Not a multilayer NLE. |
| **Natron** | GPL-2.0 | Last release v2.5.1-pre2 (2024-09), 18 commits in 6 months **[V]** | C++ node compositor | No | None | A compositor, not an NLE. Barely maintained. |

GPL apps can be forked and shipped to others for free, as long as the source is
offered. The real blockers are architectural: no DOM graphics layer, and a C++/Qt
codebase that is hard to fit with an embedded terminal and a web-native comment UI.

---

## 2. "Build our own on primitives"

A reference architecture assembled from verified parts **[I, design]**:
- **Shell:** Electron, with one pinned Chromium on Mac and Windows. WeftCut ADR 0024
  explains why it moved away from Tauri/system webviews: codec and capture behaviour
  differed per OS **[V]**. electron-builder gives one-click `.dmg`/`.exe` installs
  with auto-update.
- **Embedded Claude Code:** xterm.js + node-pty running the user's own `claude` CLI,
  which uses their Pro/Max login. Any Electron-based option above can add this
  **[I]**. Verify against the separate subscription research.
- **Media:** mediabunny (MPL-2.0) + WebCodecs for decode and encode. Proxies for 4K
  screen recordings. A PixiJS/WebGPU or raw WebGPU compositor.
- **HTML/GSAP graphics:** run HyperFrames compositions (Apache-2.0) as layers. Path A:
  an offscreen BrowserWindow + CDP capture with clock takeover (WeftCut's proven,
  byte-identical method). Path B: HTML-in-Canvas once it ships. Path C for final
  export: the HyperFrames producer itself.
- **Timeline/state:** a JSON project file in a folder (requirement 7). A command bus
  that serves both the UI and an MCP server (requirement 3). Comments as first-class
  timeline objects (requirement 4). A plugin host that loads Claude-written JS modules
  with access to the command bus (requirement 8).
- **Borrow, don't depend:** HyperFrames Studio components (Apache-2.0) and WeftCut
  modules (MIT) can be copied in with attribution.
- **Cost:** the most work (not a constraint, requirement 10). The most long-term
  control. No licence exposure.

---

## 3. Scored matrix (0 = none or blocked, 1 = weak or needs major work, 2 = partial or straightforward to add, 3 = there today and solid)

R1 Claude-driven + quick hand edits (trim, blade, delete, ripple) ·
R2 a real Claude Code terminal pane can live inside ·
R3 agent sees playhead, selection and comments and edits programmatically ·
R4 timestamped comments ·
R5 live multi-layer preview incl. HTML/GSAP, WYSIWYG export, at 5-15 min with 4K sources ·
R6 Mac + Windows, one-click install ·
R7 project-folder portability ·
R8 plugin extensibility ·
R9 durable for years: licence, bus factor, no recurring cost ·
R10 architectural headroom: right design without fighting the base

| Base | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | **Total /30** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Fork WeftCut** (MIT) | 3 | 2 | 3 | 2 | 3 | 3 | 2 | 1 | 1 | 3 | **23** |
| **Build own on primitives** (+ borrow HF/WeftCut) | 3* | 3* | 3* | 3* | 3* | 3* | 3* | 3* | 3 | 3 | **30*** |
| **HyperFrames OSS Studio in our Electron shell** | 2 | 2 | 3 | 1 | 2 | 1 | 3 | 2 | 2 | 2 | **20** |
| **Diffusion Studio editor fork** (MPL) | 3 | 2 | 3 | 1 | 2 | 3 | 3 | 2 | 1 | 2 | **22** |
| OpenChatCut fork (AGPL + Remotion) | 3 | 2 | 3 | 1 | 2 | 3 | 2 | 1 | 0 | 1 | 18 |
| Remotion Player + own editor | 1 | 2 | 1 | 0 | 3 | 2 | 2 | 2 | 1 | 2 | 16 |
| Remotion Editor Starter ($600) | 2 | 2 | 1 | 0 | 3 | 2 | 2 | 2 | 1 | 1 | 16 |
| Kdenlive / MLT fork | 3 | 1 | 1 | 1 | 1 | 3 | 2 | 1 | 3 | 1 | 17 |
| Shotcut fork | 3 | 1 | 0 | 1 | 1 | 3 | 2 | 0 | 2 | 1 | 14 |
| OpenShot fork | 2 | 1 | 1 | 1 | 1 | 3 | 2 | 1 | 2 | 1 | 15 |
| Blender VSE | 2 | 1 | 2 | 1 | 1 | 3 | 2 | 2 | 3 | 0 | 17 |
| OpenCut rewrite (wait for it) | 0 | 1 | 1 | 0 | 0 | 2 | 1 | 2 | 2 | 1 | 10 |
| OpenCut classic fork (archived) | 2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 10 |
| Omniclip | 2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 10 |
| Twick | 2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 0 | 1 | 9 |
| Revideo / Motion Canvas | 0 | 1 | 1 | 0 | 1 | 1 | 2 | 1 | 1 | 1 | 9 |
| Etro | 1 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 9 |
| OpenVideo react-video-editor | 2 | 1 | 1 | 0 | 2 | 1 | 1 | 1 | 1 | 1 | 11 |
| Shotstack Studio SDK | 2 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 0 | 0 | 8 |
| Olive / Natron / LosslessCut | 0-1 | 0 | 0 | 0 | 0-1 | 1-2 | 1 | 0 | 0-1 | 0 | ≤6 |

\* Build-own scores are **design targets, not facts**. Its real risk is execution and
time to first usable version, which the matrix does not measure. Read it as "nothing
in the base blocks the requirement".

Scoring notes:
- **R2:** no base ships an embedded Claude Code terminal. Electron bases score 2
  because xterm.js + node-pty is routine there **[I]**. Qt bases score 1 because it
  means native widget work.
- **R5 for WeftCut:** 3 because it is the only one with proxies, hardware decode and
  byte-identical HTML capture shared by preview and export **[V]**. HTML layers are
  pre-rasterized or looked ahead, not DOM-live **[V]**.
- **R5 for HyperFrames:** 2. Graphics fidelity is perfect, but long 4K footage
  playback in an iframe and screenshot export speed are untested **[I]**.
- **R6 for HyperFrames:** 1 because the OSS needs Node 22 + FFmpeg and the desktop app
  has no Windows build **[V]**.
- **R9:** WeftCut and Diffusion score 1 for a bus factor of 1. Remotion-based options
  score 0-1 for the contractor clause in the 5.0 draft. Kdenlive scores 3 (KDE, 20+
  years).

---

## 4. Shortlist: top 3 foundations

### #1: Fork WeftCut, and make HyperFrames compositions first-class Motifs
**Why:** it already does the hard, slow-to-get-right parts:
- a cross-OS Electron + Rust NLE engine with proxies, hardware decode and a WebGPU
  compositor
- an MCP tool surface where agent edits show up live on the playing timeline, with
  checkpoints, a dry run and an activity log
- HTML layers that are deterministic and byte-identical between preview and export,
  across Mac, Windows and Linux
- Mac, Windows and Linux installers with auto-update (the Mac one is not notarized yet)
- MIT licence

The 119 ADRs make it very easy for agents to read and change.

**What we add:**
1. An xterm.js + node-pty Claude Code pane.
2. A human comment layer, extending Tacks and markers into threads.
3. A plugin host.
4. A HyperFrames-to-Motif adapter (`__hf` seek protocol).
5. FCPXML/Resolve export if still wanted.
6. Mac notarization and an Intel build.

**Risks:** one maintainer, five months old, v0.5. The schema will change (it already
has an upgrade chain, ADR 0047). Mitigate by forking early, tracking upstream while it
lives, and assuming we will own it outright. That is acceptable under MIT and with
agent-written code. Before committing, spike-test a 15-min project with a 4K screen
recording and around 20 HyperFrames cards, on the sister's Windows machine **[I]**.

### #2: Build our own on primitives (Electron + mediabunny/WebCodecs + WebGPU compositor + HyperFrames runtime)
**Why:** the only option with full control over all ten requirements, and the
cleanest licence (MIT/Apache/MPL dependencies only). It never inherits another
project's data model, and requirement 10 says development cost is not a constraint.
Take WeftCut's proven decisions (Electron over Tauri, CDP clock-takeover capture,
proxy ladder, mediabunny demux) and HyperFrames Studio's GSAP timeline and inspector
components as copy-ins, not dependencies.

**Risks:** the longest path to a usable editor. Decode, sync and colour edge cases are
the real cost: WeftCut spent roughly 60 ADRs on them. This is #2 rather than #1 only
because #1 is a working head start on the same architecture. If the WeftCut spike
fails, or its code turns out hard to own, #2 is the fallback, and it is nearly the
same design.

### #3: HyperFrames OSS Studio embedded in our own Electron shell
**Why:** the owner's graphics are already HyperFrames, so this is the tightest
WYSIWYG for HTML/GSAP: preview and export run in the same Chrome. It is Apache-2.0,
with a well-funded, very active HeyGen team. WebMCP tools already expose playhead,
selection, inspect and frame capture. The project is a plain folder.

**Gaps:**
- It is a composition editor, not a footage NLE. Ripple and blade on long recordings
  are unverified.
- Comments and the Windows desktop exist only in HeyGen's closed app, which shows open
  vs closed drift.
- Screenshot-per-frame export of 15-min 4K-sourced videos is likely slow **[I]**.

**Best role:** if not chosen as the base, use it as the graphics engine inside #1 or #2.

**Honourable mention: Diffusion Studio editor** (MPL-2.0, Electron, Mac+Win, MCP+CLI,
HTML-in-Canvas). It is architecturally excellent and scores 22, just behind HyperFrames
Studio. It is not shortlisted because:
- the bus factor is 1
- startup cloud and login hooks would need stripping
- graphics must be authored in SolidJS JSX rather than HyperFrames HTML
- it depends on an origin-trial Chromium API

**Ruled out:**
- **Remotion family:** the licence becomes a cost once contractors count. Editor
  Starter source cannot be redistributed. Client renders send telemetry you can't turn
  off.
- **OpenCut:** a rewrite in progress, GPUI, closed to contributions.
- **Qt natives** (Kdenlive, Shotcut, OpenShot): no DOM graphics layer, and the
  terminal and comment UI would mean native rewrites.
- **Stalled or restrictive web libraries:** Twick, Revideo, Motion Canvas, Omniclip,
  Etro, OpenVideo, Shotstack.

---

## 5. Sources
- Requirements: `/Users/kbtg/.claude-work/jobs/2b878578/tmp/research/REQUIREMENTS.md`
- WeftCut: https://github.com/WeftCut/WeftCut (README, package.json, docs/adr/0016, 0017, 0024, 0062, 0115; releases v0.5.0)
- Diffusion Studio: https://github.com/diffusionstudio/editor (README, docs/reference/jsx/html.md, apps/web/.env.example), https://www.diffusion.studio/pricing
- OpenChatCut: https://github.com/0xsline/OpenChatCut (package.json, releases)
- Pireel: https://github.com/pireel/pireel · Palmier Pro write-up: https://www.alextech.ai/en/blog/palmier-pro-the-open-source-video-editor-where-ai-agents-control-the-timeline/
- HyperFrames: https://github.com/heygen-com/hyperframes (README, packages/*/README.md, docs/guides/webmcp.mdx, docs/guides/mcp.mdx, packages/cli/src/utils/desktopApp.ts, packages/studio/src/telemetry/config.ts), https://www.hyperframes.dev/studio, https://www.producthunt.com/p/heygen/hyperframes-studio-desktop
- HTML-in-Canvas: https://developer.chrome.com/blog/html-in-canvas-ot-changes
- OpenCut: https://github.com/OpenCut-app/OpenCut, https://github.com/OpenCut-app/opencut-classic
- Remotion: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md, https://github.com/remotion-dev/remotion/pull/3750, https://www.remotion.dev/docs/editor-starter/faq, https://www.remotion.pro/editor-starter, https://www.remotion.dev/docs/client-side-rendering/, https://www.remotion.dev/docs/client-side-rendering/limitations, https://www.remotion.dev/docs/license/telemetry
- mediabunny: https://github.com/Vanilagy/mediabunny
- Twick: https://github.com/ncounterspecialist/twick (LICENSE) · Revideo: https://github.com/midrender/revideo · Motion Canvas: https://github.com/motion-canvas/motion-canvas · Omniclip: https://github.com/omni-media/omniclip · Diffusion core: https://github.com/diffusionstudio/core · Etro: https://github.com/etro-js/etro · OpenVideo: https://github.com/openvideodev/react-video-editor (LICENSE) · Shotstack: https://github.com/shotstack/shotstack-studio-sdk (LICENSE)
- Native: https://github.com/KDE/kdenlive, https://github.com/mltframework/mlt, https://github.com/mltframework/shotcut, https://github.com/olive-editor/olive, https://github.com/OpenShot/openshot-qt, https://github.com/OpenShot/libopenshot, https://github.com/mifi/lossless-cut, https://github.com/NatronGitHub/Natron, Kdenlive MCP listings: https://glama.ai/mcp/servers/D-Ogi/mcp-kdenlive
- Agent pipelines: https://github.com/browser-use/video-use, https://github.com/veedstudio/open-edit, https://github.com/calesthio/OpenMontage, https://github.com/KyaniteLabs/kinocut
