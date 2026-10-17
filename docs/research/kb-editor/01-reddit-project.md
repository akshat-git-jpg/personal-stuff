# 01: The Reddit project (Velorn) as a foundation for the owner's AI video editor

Researched 2026-10-17. Sources: the Reddit thread (read through its RSS feed and a Redlib mirror, because reddit.com blocks direct fetches), the GitHub API, and a shallow clone at
`/Users/kbtg/.claude-work/jobs/2b878578/tmp/research/repos/velorn` (commit `b3c02adb`, 2026-10-12, v0.3.37). The clone was only read. Nothing in it was installed or run.

Labels: **[V]** means verified from code, API or thread text. **[I]** means my inference.

## 1. What the post is

- Post: "I built a free, open-source video editor that Claude can fully operate through MCP — editing, generating, motion graphics, even mixing audio." By u/VisualFXMan (a VFX artist with 25 years in the trade), r/ClaudeAI, 2026-07-10. 63 upvotes, 90% upvoted, 27 comments. [V]
- Project: **Velorn**, https://github.com/VelornLabs/velorn, site velorn.ai. Until 2026-06 it was called **ComfyStudio**. The code still uses `project.comfystudio` files, the appId `com.comfystudio.app` and `comfystudio-*` localStorage keys. [V]
- Pitch: an "AI-native video editor" that is mainly a production layer around **ComfyUI** generation (music videos, UGC ads, business ads, short films), with a timeline editor and a local MCP server of 100+ tools. [V]

## 2. Facts

| Area | Finding | Evidence |
|---|---|---|
| License | **GPL-3.0-only**. Was MIT and relicensed in PR #80 (2026-06-29); older releases stay MIT. A **CLA** gives the maintainer the right to "relicense ... including source-available, dual-license, or commercial license models". | `LICENSE`, `package.json`, PR #80, `CONTRIBUTOR_LICENSE_AGREEMENT.md` §3 [V] |
| Stack | **Electron 28** (end of life; issue #110 asks for an upgrade) + **React 18** + Vite 5 + Tailwind + Zustand. **Plain JavaScript, zero TypeScript files.** Bundles ffmpeg-static/ffprobe-static and uses mp4box. | `package.json`, `find` gave 0 .ts/.tsx [V] |
| Preview engine | `<video>` elements, with frames pulled through `requestVideoFrameCallback` and composited on **Canvas 2D** (`CanvasPreviewRenderer.jsx`, `VideoLayerRenderer.jsx`). The WebGL2 compositor (`gpuCompositor.js`) says it is for **export first**: "CanvasPreviewRenderer ... adopts this in a later phase". | file headers [V] |
| Preview with many layers | When live compositing can't keep up, Velorn **pre-renders**. `previewCache.js` "renders the current timeline to a single H.264 file for smooth playback when many layers are active". `renderCache.js` bakes masked clips through MediaRecorder. `commitRender.js` does a Flame-style "hard commit" of adjustment stacks into an MP4. | file headers [V] |
| Export path | A hidden Electron export-worker window decodes with **WebCodecs VideoDecoder + mp4box** (falling back to `<video>` seeks), composites with WebGL2 (falling back to Canvas 2D), reads back RGBA and **pipes raw frames to ffmpeg** (falling back to a PNG sequence). Has NVENC/hardware encode, ProRes 4444/WebM alpha, and PNG sequences. | `exportFrameSource.js`, `exporter.js`, `gpuCompositor.js`, `alphaMedia.mjs` [V] |
| WYSIWYG | Preview and export run **different compositors** (Canvas 2D for preview, WebGL2 for export, with "the same projectClipPoint math" shared). | gpuCompositor header [V]; the mismatch risk is [I] |
| Timeline model | A Zustand store (`timelineStore.js`, 7k lines). Track types are video/audio. Clip types are video/audio/image/text/shape/adjustment/captions. Saved as a JSON `project.comfystudio` in a project folder. FCPXML import/export and Premiere XML export exist. | `fileSystem.js`, `fcpxml*.js`, `premiereXmlExporter.js` [V] |
| Motion graphics | Native text, shapes, solids, keyframes, GLSL effects (the "MOG" workspace). **No HTML/CSS/GSAP layer type. No HyperFrames, Remotion or Lottie.** | grep found nothing [V] |
| AI integration | A **local HTTP MCP server** at `127.0.0.1:19790/mcp`, set up by pasting `claude mcp add --transport http velorn ...`. It is client-agnostic (Claude Code, Codex, Cursor). Claude Code runs **in your own terminal** under your own login, so **subscription works**: Velorn never touches Claude billing. There is also an optional local LLM assistant through LM Studio. | `docs/MCP.md`, `.mcp.json` [V] |
| MCP surface | About 130 tools in `electron/mcpServer.js` (14.8k lines). Reads include `get_project`/`get_timeline` (snapshot includes `playheadPosition` and `selectedClipIds`), `inspect_timeline_frame`/`inspect_timeline_range` (frame images and contact sheets), and `analyze_timeline`. Writes include move/trim/split/delete with ripple, extract_range, speed, audio gain/fades, markers, transitions, text/shapes, export, export_fcpxml, undo/redo and checkpoints. Most writes default to `previewOnly`. | MCP.md tool tables, `mcpSnapshot.js` [V] |
| Embedded terminal | **None.** No xterm or node-pty anywhere. | grep [V] |
| Comments / review | **None.** Only timeline markers. Issue #87 "Review and comment workspace" (a frame.io-style workflow for Claude to act on) is **open**. | issue #87 [V] |
| Mac + Windows | Releases ship Windows installer + portable x64, Mac arm64 + x64 dmg, and Linux AppImage/deb. Mac builds are signed and notarized. Windows is now signed through Azure (`release.yml`). At launch it was unsigned, and the thread shows a Symantec warning. **No auto-updater** (no electron-updater). Installers are about 468 MB. | releases API, release.yml, thread [V] |
| Plugins | **No plugin system.** The only extension points are ComfyUI workflows (custom JSON graphs with `VELORN_*` endpoint nodes) and the MCP server. | grep [V] |
| Maturity | Created 2026-03-08 (about 7 months old). **424 commits.** 503 stars, 72 forks, 25 open issues/PRs. Contributors: **JaimeIsMe 408**, joaofernandes 15, ufotone 1. Latest release v0.3.37 on 2026-10-12. Commits per month among the last 100: Aug 87, Sep 10, Oct 3. | GitHub API [V]. **Bus factor = 1** [V]. The slowdown is [I], because the sample only covers 100 commits |
| Code size / quality | About 220k lines of non-test JS/JSX across src+electron. God files: `GenerateWorkspace.jsx` 20.3k, `mcpServer.js` 14.8k, `Timeline.jsx` 9.1k, `mcpActions.js` 9k, `main.js` 7.9k, `timelineStore.js` 7.1k. About 100 `node --test` files. Repo docs read as AI-agent handoffs (`AI_CURRENT_HANDOFF.md`, `EDITING_POLISH_CHECKPOINTS.md` 163 KB). | wc / ls [V]. Mostly written with AI agents and hard to maintain [I] |
| Long-video performance | No published benchmarks. WebCodecs export has a 20-minute source / 5-minute in-point limit before it "prepares" (transcodes) the source. Issue #130 (open): **Windows export runs at about 4 fps** because of rAF throttling in the hidden worker; a user's 26-minute 1080p export took 3 h 20 m, and their one-line patch cut it to 13 m. Issue #131: Windows import was CPU-only. | exportFrameSource.js, issues #130/#131 [V] |
| Product focus | Built mainly around ComfyUI generation (music video, UGC, ads) with a separate "Velorn Cloud (Lite)" SKU parked. Tutorial/screen-recording editing is not the core audience. | README, `docs/CLOUD_LITE_VERSION.md` [V] |

## 3. What Reddit commenters said [V]

- **Praise:** u/JulianParody gave Claude Opus 5 a storyline and about 80 assets; Claude placed the transitions, cuts and title overlays and "I am a fan". He suggested shipping a Claude skill and had Claude read `docs/MCP.md` in place of one. Others: "you just stopped me from buying DaVinci Resolve just to have access to the MCP server", "Bro, this is incredible!", and a non-technical user who called it their "moon shot".
- **Criticism:** u/crispyfrybits said "100 tools in a single MCP is a tonne of context up front ... why not skills with scripts/tools instead?" u/ru5ter flagged "supply chain attack surface ... JavaScript is not known good at video editing". u/JoePatowski hit a **malware warning** (Symantec, unsigned Windows exe). The dev answered with VirusTotal 0/52 and promised signing, which has since shipped. u/Z3wpk worried about lock-in, and the dev pointed to XML export for Premiere. Two follow-ups asking a VP's editor for feedback got no answer. One comment is a QA-tool spam reply about comfy.org.
- In the post itself, the author admits the agent's fade clipped the first word of the narration and he fixed it by hand.

## 4. Score against the owner's 10 requirements

| # | Requirement | Score | Evidence |
|---|---|---|---|
| 1 | Claude does ~95% of the edit; hand trim/blade/delete/ripple | **Meets** | A full NLE: ripple, roll, slip, slide and blade tools with tests, plus about 130 MCP edit tools. [V] |
| 2 | A real Claude Code terminal inside the editor, on the subscription | **Partial** | Subscription is fine because Claude Code runs outside and connects over HTTP MCP. **No embedded terminal**, so one would have to be added (xterm + node-pty in Electron). [V] |
| 3 | Claude sees playhead, selection and comments, and edits programmatically | **Partial** | Playhead, selection, frames and contact sheets: yes. Comments don't exist. [V] |
| 4 | Timestamped comments UI on the timeline | **No** | Markers only. Issue #87 is open. [V] |
| 5 | No re-rendering while editing; all layers live incl. HTML/GSAP; preview = export | **No** | No HTML/GSAP layers at all. With many layers it falls back to baking a flattened H.264 preview cache. Preview (Canvas 2D) and export (WebGL2) are separate compositors. [V] HyperFrames cards would have to be pre-rendered to alpha video and re-rendered after every change. [I] |
| 6 | macOS + Windows, one-click install for non-technical users | **Partial / meets** | Signed installers for both. But a 468 MB download, no auto-update, the UI is dominated by ComfyUI generation, and there are Windows performance bugs (#130, #131). [V] |
| 7 | Collaboration = pass the project folder | **Partial** | The project is a folder with a JSON file plus assets, and relink exists. Whether the file stores absolute paths across machines is unverified, and the asset-relink fallback suggests path breakage happens. [I] |
| 8 | Super customizable through plugins Claude writes | **No (only by forking)** | No plugin API. Customising means forking a 220k-line JS codebase and keeping up with upstream, or adding MCP tools inside `mcpServer.js`. [V] |
| 9 | Decisions that hold up for years; no recurring costs | **Partial / weak** | Free, but GPL plus a CLA that permits commercial relicensing. Bus factor 1. Electron 28 is EOL. 7 months old, and commit pace has dropped. [V] Long-term risk of abandonment or a pivot to paid. [I] |
| 10 | Dev cost is no constraint; pick the right design | **N/A, but it argues against Velorn** | Since build cost doesn't matter, Velorn's main asset (lots of finished code) is worth less, and its architecture (pre-render caches, two compositors, no HTML layers) is the opposite of what the owner needs. [I] |

Tally: 1 meets, 5 partial, 3 no, 1 N/A.

## 5. Is it a better foundation than (a) HyperFrames or (b) our own Electron app?

**Short answer: no, not as a foundation. Yes, as a reference to study and copy ideas from.**

- **Against (a) HyperFrames** [I, based on the brief's description of HyperFrames as Apache-2.0 with player/studio/producer packages; I did not verify HyperFrames' internals here]: the owner's motion graphics are already HyperFrames HTML. Requirement 5 (live HTML/GSAP layers, preview = export) is the hardest one, and HyperFrames is HTML-native, so its player shows the same DOM that its producer renders. Velorn has no HTML layer type, and a Canvas 2D preview can't host one. Bolting an HTML layer onto Velorn means building a second rendering model inside a 220k-line codebase you don't control. Apache-2.0 is also friendlier than GPL-3.0 for shipping a custom build to the sister and to hired editors. Velorn is far ahead of HyperFrames on **NLE ergonomics**: ripple/roll/slip/slide, audio mixing, captions, FCPXML, and a mature MCP tool surface.
- **Against (b) our own Electron app:** Velorn shows the work is feasible, and one person plus agents built it in about 7 months. But our own app can be designed around the requirements from day one: an HTML-capable compositor for one-renderer WYSIWYG, an embedded Claude Code PTY pane, comments as first-class data in MCP, a plugin API, a project format that is portable across machines, and a supported Electron version. Forking Velorn means inheriting EOL Electron, untyped god files, ComfyUI-centric UI, a pre-render architecture, GPL obligations and a single upstream maintainer.
- **What is worth taking from Velorn** (study, or reuse under GPL only if the fork itself goes GPL):
  1. The MCP design: `previewOnly` by default, checkpoint, `run_mcp_action_plan`, `find_timeline_items` before targeting, and frame/contact-sheet inspection tools so Claude can "look".
  2. The WebCodecs + mp4box sequential-decode cursor, and the raw-RGBA-to-ffmpeg export pipe with its fallbacks.
  3. The Reddit critique: 100+ tools is heavy context. Ship a skill plus a small core tool set.
  4. The Windows lesson: code-sign from day one. AV reputation warnings scare non-technical users.
  5. Issue #130: hidden Electron windows throttle `requestAnimationFrame` to about 1 Hz. Never yield on rAF in a background render worker.

## 6. Open questions not verified

- Whether `project.comfystudio` stores relative or absolute media paths (this matters for Drive handoff).
- Real playback performance of a 15-minute, multi-layer 1080p/4K timeline. There are no benchmarks, and I did not run the app.
- How closely the Canvas 2D preview and the WebGL2 export match in practice.
