# 04 - App shell and embedding Claude Code

Research date: 2026-10-17. Requirements: `REQUIREMENTS.md` in this folder.
Labels used below: **[F]** = fact from a cited source, **[I]** = my inference or judgement,
**[U]** = reported by a secondary source and not confirmed against a primary one, or untested.

---

## TL;DR

- **Shell: Electron.** Its Chromium is the same on macOS and Windows, so you get one codec matrix,
  one renderer for the HTML/GSAP cards, and a bundled Chromium you can also use for the final
  render. That gives preview == export. node-pty + xterm.js is the terminal stack VS Code ships.
  Tauri 2 fails the hard requirements: it runs WebKit on Mac and Edge WebView2 on Windows. Those two
  engines have different codec and alpha support, and neither one is the Chromium that does the export.
- **Claude: run the user's own, unmodified `claude` CLI in a PTY pane. The user signs in through
  Anthropic's own flow. Do NOT use the Agent SDK with a subscription.** The official Claude Code
  legal page allows this pattern in so many words. Wiring: the editor exposes a **stdio MCP server**
  (tools + state), a **UserPromptSubmit hook** that attaches playhead, selection and comments to each
  prompt, and optionally a **channel** (research preview) to push events like "new comment" into the
  session. Ship skills and commands as a **plugin in a marketplace repo**, plus a project `.claude/`
  folder inside every editor project.
- **Top risks:** (1) Anthropic's subscription rules for anything other than the plain CLI have
  changed three times in 2026. (2) Channels are a research preview, and custom channels need a
  "dangerously" flag. (3) Code signing: Microsoft's cheap signing service does not take individuals
  in India. Unsigned macOS apps cannot auto-update, and Windows Smart App Control can block unsigned
  apps outright. (4) Every user, including the sister and hired editors, needs their own
  Claude Pro/Max plan. The Free plan does not include Claude Code.

---

## Part A - App shell

### A1. What each shell actually is

| Shell | Engine on macOS | Engine on Windows | Native/back-end side | Notes |
|---|---|---|---|---|
| **Electron** | Bundled Chromium | Bundled Chromium (same version) | Node.js (full npm, native addons) | Used by VS Code, Descript-class apps; ~100-150 MB installer [I]; one author measured 323 MB unpacked on macOS vs 57 MB for Tauri [F: betterstack] |
| **Tauri 2** | System WKWebView (Safari engine) | System WebView2 (Edge Chromium, evergreen) | Rust (+ optional sidecars) | Small bundles. Two different engines, and both update with the OS or Edge, not with your app |
| **Electrobun** | System WKWebView by default, or bundled CEF (Chromium) | WebView2 by default, or bundled CEF | Bun | CEF bundling is ~100 MB vs ~14 MB system webview [F: Electrobun docs]. v1.18 (May 2026) moved CEF to Chromium 147 [F]. Young project, small ecosystem |
| **Neutralinojs** | System webview | System webview | Tiny C++ host; "extensions" as separate processes | No Node in-process, so no node-pty. Weakest fit [I] |
| **Local web app** (Node server + user's browser) | Whatever browser the user opens | Same | Node | Works, but the user's browser decides codecs (Safari vs Chrome) and is not pinned. "One-click install" still means packaging Node, so it ends up as Electron without the window [I] |
| **PWA + File System Access API** | Chromium browsers only | Chromium browsers only | None | Cannot spawn processes, so it cannot host `claude`, a PTY or ffmpeg. You'd need a local companion anyway, which makes it the row above [I] |

### A2. Codec and alpha support by engine

| Format | Chromium / Electron (Mac + Win) | WKWebView (Tauri on Mac) | WebView2 (Tauri on Win) |
|---|---|---|---|
| H.264 / AAC | Yes. Electron's ffmpeg ships proprietary codecs by default [F: Electron build config, via Eclipse IP thread and Electron commit] | Yes [F/I] | Yes (Edge uses Media Foundation) [I] |
| HEVC / H.265 | Yes, hardware decode, on by default since Electron 22. Chrome on Windows calls D3D11VA directly, "no need to install anything". Needs a supported GPU. No software fallback in stock Chromium [F: StaZhu guide] | Yes (VideoToolbox, with software fallback) [F: StaZhu] | Edge/WebView2 decodes through MFT and **needs the paid "HEVC Video Extensions"** from the Microsoft Store [F: StaZhu; Adobe help says it costs $0.99] |
| ProRes | **No.** Not in Chromium's codec list [F: chromium.org/audio-video] | Likely yes via AVFoundation [U, untested] | No [I] |
| VP9 / AV1 | Yes [F: chromium.org] | VP9 yes since Safari 14.1. AV1 only on hardware that has an AV1 decoder [I] | Yes [I] |
| **Alpha video** | **VP9-alpha WebM: yes.** HEVC-alpha: macOS only (WebCodecs, Chrome 107/108+) [F: StaZhu; rotato; Jake Archibald] | **HEVC-alpha: yes. VP9-alpha: no** (VP9 plays, transparency is dropped) [F: Jake Archibald 2024; rotato 2025] | VP9-alpha yes. HEVC-alpha no [I] |
| ProRes 4444 alpha | No | Native AVPlayer has known alpha bugs on Apple Silicon [F: CommandPost issue] | No |
| **WebCodecs** | Full (decode + encode, HEVC encode since Chrome 130) [F: StaZhu] | Safari 26 lists full support. 16.4-18.x was partial (no AudioDecoder) [F: caniuse; Softvelum]. A WebKit bug reported B-frame misordering in VideoDecoder [F: WebKit bug 287516] | Full (it is Chromium) [I] |

**What this means for this editor [I]:**
- HeyGen avatar clips and other overlays with transparency need **one alpha format that works on
  both OSes**. Only Chromium gives you that (VP9-alpha WebM on Mac and Windows). Under Tauri you'd
  ship HEVC-alpha for Mac and VP9-alpha for Windows, then test two pipelines forever.
- ProRes and odd camera formats won't play in any webview reliably. Plan for **import-time proxy
  transcodes** with a bundled ffmpeg (for example H.264 or VP9 proxies, VP9-alpha for anything with
  alpha). Proxies also fix 4K screen recordings that scrub badly. Export reads the originals.
- Big local files: Tauri's asset protocol had a history of loading whole files into memory and of
  hanging on seeks past ~3 GB. The community fix was a local HTTP server with range support
  [F: tauri#4133; tauri-asset-bug repo]. In Electron, a `protocol.handle` custom scheme or a localhost
  range server streams fine [I]. Treat the "read big files" requirement as a range-streaming server in
  any shell.

### A3. Codec licensing in Electron builds

- [F] Electron builds ffmpeg as a **shared library** with proprietary codecs (H.264, AAC, MP3)
  enabled. Each release also publishes a codec-free ffmpeg build you can swap in. The Chromium/CEF
  tracker says the reason is patent licensing when software decoders are distributed.
- [F] HEVC in Chromium/Electron uses the **OS hardware decoder**, not ffmpeg software decode.
- [I] For a free personal or family tool with a handful of users, the patent exposure from shipping
  Electron's default ffmpeg is the same as every Electron app (Slack, VS Code, Discord) and is
  negligible in practice. If the editor ever becomes a paid product, get a real legal review.
- [I] **Export encoding** is the bigger licensing question. A bundled ffmpeg with libx264 is GPL.
  Running it as a separate executable (not linked) is the usual safe pattern. The alternative is OS
  hardware encoders (VideoToolbox / Media Foundation) through an LGPL ffmpeg build or through
  WebCodecs `VideoEncoder`.

### A4. Preview == export: why the same engine matters

- [F] HyperFrames (HeyGen) and Remotion both render by driving **headless Chrome**. HyperFrames
  seeks GSAP timelines to an exact time, screenshots each frame, then pipes the frames to FFmpeg
  ("same input, identical output") [F: HyperFrames docs/coverage]. Remotion uses Chrome Headless Shell.
- [I] If the preview runs in the **same Blink/Skia/V8 build** as the export, these all match by
  construction: text shaping and fonts, CSS filters and blend modes, GSAP easing, color handling and
  video decode. With Tauri on Mac, preview is WebKit and export is Chromium (HyperFrames downloads
  its own Chromium). The two will differ visibly in font rendering, `backdrop-filter`, some blend
  modes and color management. That breaks hard requirement #5.
- [I] Even inside Electron, **pin one Chromium.** Render through Electron's own Chromium (a hidden or
  offscreen `BrowserWindow` driven frame by frame) rather than a separately downloaded
  chrome-headless-shell of a different version. Electron's offscreen rendering has a GPU shared
  texture mode and a bitmap mode capped at 240 fps, and it emits `paint` events per frame
  [F: Electron offscreen docs]. Frame-accurate export must be **seek-per-frame, not real-time
  capture** (deterministic clock, wait for video `requestVideoFrameCallback` / decoded frame, then
  capture). Use WebCodecs for exact video frames instead of `<video>` currentTime seeking, which
  isn't frame-exact [I].

### A5. Distribution, signing, updates

| Item | macOS | Windows |
|---|---|---|
| Signing cost | Apple Developer Program $99/yr for Developer ID + notarization [F, widely documented] | **Azure Artifact Signing** (renamed from Trusted Signing), ~$9.99/mo. **Individuals: USA/Canada only. Organizations: USA/Canada/EU/UK** [F: Microsoft Learn, codenote 2026]. So an individual in India can't use it. Alternatives: OV certificate on a cloud HSM. Certum lists cloud code signing from €49 (reseller prices €109-169/yr) [F/U] |
| Unsigned behaviour | Since Sequoia (15.0) the Ctrl-click "Open" bypass is gone. The user must try to open the app, then go to System Settings > Privacy & Security > "Open Anyway". Reports conflict on 15.1 [F: Macworld, OSnews, MacRumors] | SmartScreen shows "Windows protected your PC" > More info > Run anyway [I]. **Smart App Control** (on by default for some Windows 11 installs, wider since 25H2) blocks unsigned apps with no override except turning SAC off [F: textslashplain 2026, Computerworld] |
| Auto-update | electron-updater: **"a macOS app has to be signed before auto-updating will function"**, needs the zip target [F: electron.build docs] | electron-updater works with the NSIS target, signed or unsigned [F] |
| Installer | dmg + zip via electron-builder | NSIS `.exe` (one-click, per-user, no admin) |
| Update hosting | GitHub Releases / S3 / generic HTTP (free on GitHub) [F: electron-builder docs] | same |

[I] Recommendation for a 3-10 person user base:
- **macOS:** pay the $99/yr. Without it the owner gets no auto-update, and every hired editor hits a
  frightening dialog. This is the one recurring cost worth paying.
- **Windows:** start unsigned (SmartScreen "Run anyway" once per version, NSIS auto-update still
  works). Write a one-page "if Windows blocks it" note. If Smart App Control is on for the sister's
  PC, either buy a Certum-class OV certificate (~€50-170/yr) or switch SAC off on that machine.
  Revisit Artifact Signing if Microsoft opens it to Indian individuals.

### A6. Real apps on each shell

| App | Shell | Confidence |
|---|---|---|
| VS Code, Hyper, Theia (all xterm.js + node-pty terminals) | Electron | [F: node-pty README] |
| Screen Studio | Electron (v39) | [U: desktopinsights auto-detection] |
| OpenScreen (OSS Screen Studio alternative) | Electron + PixiJS | [F: pyshine write-up] |
| Kap (macOS recorder) | Electron | [I, long known; not re-verified] |
| Descript | Electron | [U, not confirmed in 2026 sources] |
| **Cap** (screen recorder + editor) | **Tauri 2 + Rust**, SolidStart UI. Capture and rendering run in Rust, not the webview | [F: cap.so llms-full, openalternative] |
| CapCut desktop | Not confirmed | [U] |
| OpenCut | Classic = web (Next.js), archived 2026-05-17. Rewrite: `apps/desktop` is a **GPUI (Rust, Zed's UI toolkit)** scaffold, "no features yet", Rust core not wired in; plans an MCP server + headless render | [F: OpenCut changelog, mer.vin Jul 2026, Codeberg Aug 2026] |

[I] Pattern: the Tauri and GPUI video apps (Cap, OpenCut) do decode and compositing in **Rust/GPU
natively**, not in the webview. That is a much bigger build: a custom compositor, plus HTML
graphics then need an embedded browser anyway. For "HTML/GSAP cards live on the timeline", a
Chromium-based compositor (Electron) is the direct fit.

### A7. Recommendation (Topic A)

**Electron, latest stable, with electron-builder + electron-updater**, and these rules:

1. Single Chromium for preview and export. The export renders inside Electron's own Chromium, frame
   by frame.
2. A bundled ffmpeg/ffprobe sidecar handles probing, proxies (VP9-alpha for transparent assets, H.264
   for the rest) and final encode/mux.
3. Media served through a custom protocol or a localhost server with byte-range support. Never load
   whole files.
4. WebCodecs for frame-exact decode where `<video>` isn't exact enough. Plain `<video>` is fine for
   rough playback.
5. Sign and notarize on macOS ($99/yr). Windows starts unsigned with a documented fallback.

**Why not the others:** Tauri gives two engines, codec divergence (HEVC needs a paid add-on on
Windows, alpha formats differ) and a preview/export engine mismatch. Electrobun+CEF is technically
viable (one Chromium) but young, and Bun + native addons like node-pty is a risk [I]. Neutralino and
PWA can't host a PTY. A plain local web app loses the pinned browser.

**Top risks (A):**
- Electron memory and size: ~150 MB installs and heavy RAM with many 4K layers. Mitigate with proxies
  and limits on simultaneously decoding `<video>` elements [I].
- Chromium HEVC is hardware-only. Older or unsupported GPUs (StaZhu notes NVIDIA gaps on some paths)
  get black frames. Mitigate by proxy-transcoding HEVC on import [F/I].
- Electron major releases every ~8 weeks. Pin a version and upgrade deliberately, because preview ==
  export depends on it [I].
- Code signing for an India-based individual on Windows (above).

---

## Part B - Embedding Claude Code with the user's subscription

### B1. Terminal pane

- [F] **node-pty** uses **ConPTY on Windows 10 1809+**. winpty support was removed. Requires Electron
  19+ / Node 16+. Users include **VS Code**, Hyper and Theia. Builds need Python + a C++ toolchain
  unless you use prebuilt forks (`@homebridge/node-pty-prebuilt-multiarch`, which has occasionally
  missed an Electron version) [F: microsoft/node-pty, homebridge fork README].
- [F] xterm.js is the front end, and its API exposes which Windows backend (conpty/winpty) is in use.
- [F] Claude Code's own requirements: macOS 13+, Windows 10 1809+. On native Windows,
  **Git for Windows is optional**. Without it Claude uses the PowerShell tool, with it the Bash tool.
  Native installs **auto-update in the background**. The macOS and Windows binaries are signed by
  Anthropic [F: code.claude.com/docs/en/setup].
- [I] Pattern: the editor runs `claude` (found on PATH or at its known install location) inside
  node-pty, with `cwd` = the project folder. On first run, if `claude` is missing, the editor offers a
  button that runs Anthropic's **official** install command (`irm https://claude.ai/install.ps1 | iex`
  / `curl -fsSL https://claude.ai/install.sh | bash`) in the pane. It does not bundle the binary
  (see B2 on why). Run `electron-rebuild` for node-pty in CI, built per-OS on GitHub Actions.
  A Tauri equivalent would be portable-pty (WezTerm). `tauri-plugin-pty` is early-stage [F].

### B2. Anthropic's rules (the key question)

Primary source: **https://code.claude.com/docs/en/legal-and-compliance** (fetched 2026-10-17). Verbatim:

> "**OAuth authentication** is intended exclusively for purchasers of Claude Free, Pro, Max, Team,
> and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other
> native Anthropic applications."

> "**Developers** building products or services that interact with Claude's capabilities, including
> those using the Agent SDK, should use API key authentication ... Anthropic does not permit
> third-party developers to offer Claude.ai login into their own applications, or to route requests
> through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not
> collect, store, or intermediate Claude.ai credentials or session tokens — sign-in to a Claude
> account must complete through Anthropic's own flow."

> "...Nor does it prevent an end user from signing in to the **unmodified Claude Code binary** with
> their own Claude subscription, including where a platform hosts Claude Code as described under
> *Can customers offer Claude Code in their products?*"

The same page, "Can customers offer Claude Code in their products?":
> "preinstalling or running Claude Code in your products or services ... requires agreeing to our
> Commercial Terms of Service and complying with the conditions below: **The Claude Code binary must
> not be modified** ... may not remove, disable, or restrict any authentication method built into it
> ... **Customers may not pay for, resell, or intermediate Claude usage** on their end users' behalf.
> Each end user must authenticate with their own Anthropic API key, Claude subscription plan
> credentials, or 3P inference provider credential."

Also: "Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code
and the Agent SDK." Branding: you may say your product "runs Claude Code" in plain text, but you
can't use the Claude Code name or logo as part of your product or feature name.

Agent SDK overview (https://code.claude.com/docs/en/agent-sdk/overview):
> "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai
> login or rate limits for their products, including agents built on the Claude Agent SDK. Use the
> API key authentication methods described in the Quickstart instead."

Timeline [F/U]:
- Jan 9, 2026: enforcement blocked Max OAuth in third-party clients [U: winbuzzer].
- Feb 19, 2026: docs update banning subscription OAuth in third-party tools. Anthropic later
  apologised for confusing wording [F/U: gigazine, alternativeto].
- Help Center "Use the Claude Agent SDK with your Claude plan"
  (https://support.claude.com/en/articles/15036540): a **June 15, 2026** update "paused the
  previously-announced changes to Claude Agent SDK usage". An **Oct 7, 2026** update: "Claude Max and
  Team plans now include monthly API credits, which cover the Claude Agent SDK, `claude -p`" plus the
  API and Managed Agents. It also says "You can still use the Claude Agent SDK, `claude -p`, and
  third-party apps with your subscription limits." Pro isn't mentioned in the Oct 7 credit [F, read
  via fetch summary]. Credit sizes quoted in a GitHub issue ($20/$100/$200) are [U].

**What this means for this editor [I]:**
- **Allowed (clearest ground):** the editor opens a terminal pane and runs the **user's own installed,
  unmodified `claude`**. The user types `/login` and completes Anthropic's browser flow. The editor
  never touches `~/.claude/.credentials.json` or the Keychain entry, and never reads or proxies
  tokens. This is "ordinary use of Claude Code" by the subscriber, with the editor acting like VS Code
  or a terminal emulator.
- **Avoid:** building the agent on the Agent SDK with subscription login, a custom chat UI that
  drives `claude -p` with the user's OAuth token, or reading or forwarding tokens. That is the
  "third-party developer offering claude.ai login" case. The Help Center text says SDK use under
  subscription limits is currently tolerated, but the docs still say "don't", and the policy moved
  three times this year.
- **Don't bundle the binary.** "Preinstalling" Claude Code in a product brings in the Commercial
  Terms conditions. Installing through Anthropic's own installer on the user's machine keeps it
  plainly "the user's Claude Code". Auto-update also stays Anthropic's job.
- **Personal or family use:** I found **no Anthropic statement that carves out "personal-use tools"**.
  The rule is framed by who authenticates and whose binary runs, not by audience size. The owner's
  own use is clearly fine. For the sister and hired editors, each must use **their own** plan or API
  key. Sharing the owner's login with hired editors would break "individual usage" [I].
- Naming: don't call the editor or pane "Claude Code ...". Use "Claude terminal" or "AI pane" and
  "runs Claude Code" in plain text.

### B3. Exposing editor state and tools to the session

| Mechanism | Direction | Status | Use it for |
|---|---|---|---|
| **MCP server (stdio)** declared in the project's `.mcp.json` (or `--mcp-config` on launch) | Claude -> editor (pull) | Stable. Transports: stdio, HTTP (recommended for remote), WebSocket. SSE deprecated [F: docs/mcp] | All timeline tools: `get_state`, `get_selection`, `list_comments`, `split_at`, `move_clip`, `set_in_out`, `add_layer`, `render`... Project-scoped servers prompt for approval once in interactive sessions [F]. `list_changed` updates tools live without a reconnect [F]. Tool output is capped at 25k tokens by default [F] |
| Implementation detail [I] | | | The stdio process is a thin bridge. It connects back to the running Electron app over a localhost socket or named pipe with a per-launch token. Alternatively, Electron hosts an HTTP MCP endpoint on 127.0.0.1 with a token. stdio is simpler for approval and lifecycle because Claude Code spawns it |
| **UserPromptSubmit hook** | editor -> Claude (on every prompt) | Stable | Add playhead time, selected clips and open comments as context on each owner message, so "cut here" always means the live playhead [I; hooks are documented at code.claude.com/docs/en/hooks] |
| **Channels** (`claude/channel` capability, `notifications/claude/channel`) | editor -> running session (push) | **Research preview.** Custom channels need `claude --dangerously-load-development-channels server:<name>`, which shows a warning dialog at launch. Requires claude.ai login. Ignored in `-p` and the SDK. Events are dropped silently if not registered, and there's no ack. Events queue while Claude is busy [F: channels-reference] | "Owner added comment at 03:12", "render finished", "import done". Optional, with graceful fallback |
| **PTY write** (the editor types into the terminal) | editor -> session | Always works | Fallback push: the editor pastes a line like `[editor] new comment #14 at 03:12: "..."` into the prompt. Crude but robust [I] |
| **IDE integration** (`/ide`) | both | Officially documented only for VS Code/JetBrains. Third-party analysis: the IDE writes `~/.claude/ide/<port>.lock` (port + auth token), the CLI connects over WebSocket and speaks MCP, and the IDE is the server (tools like diagnostics, open diff) [U: codepointer substack, Zed patch]. A missing token led to CVE-2025-52882 | **Don't imitate it.** It's an undocumented internal protocol that can change any release. Plain MCP gives the same result through a supported path |
| Other hooks (PostToolUse, Stop, Notification) | Claude -> editor | Stable | Show "Claude is editing..." in the UI, auto-snapshot the timeline before a batch of tool calls (undo point) [I] |

[I] Live "see changes on the timeline": the MCP tool mutates the editor's in-memory timeline model
(single source of truth). The UI re-renders right away and the project file autosaves. Claude never
edits the project JSON on disk directly, or if it does, the editor watches the file and reloads.
Every MCP mutation goes through the same undo stack as hand edits.

### B4. Shipping skills and plugins to users

- [F] A **plugin** bundles skills, agents, hooks and MCP servers. A **marketplace** is a git repo with
  `.claude-plugin/marketplace.json`. Users run `claude plugin marketplace add <owner>/<repo>` and
  `claude plugin install <name>@<marketplace>`. There's a one-shot form:
  `claude plugin install <name> --marketplace <owner/repo>` (v2.1.292+). Project scope writes
  `enabledPlugins` into `.claude/settings.json`, but each collaborator still has to install it once.
  Third-party marketplaces have **auto-update off by default** (users can turn it on). Private repos
  use local git credentials [F: docs/plugin-marketplaces, docs/discover-plugins].
- [I] Recommended layout:
  1. **Editor plugin** in a public GitHub marketplace repo (free): the editor's MCP server launcher,
     hooks, and skills like "edit-from-script" and "fold comments". The editor runs the install
     commands itself on first launch through the PTY or a child process, so a non-technical user
     never types them. It also turns auto-update on.
  2. **Every editor project folder carries `.claude/`** (CLAUDE.md with the project's conventions,
     `settings.json` enabling the plugin, `.mcp.json`). Because collaboration is "pass the folder on
     Drive", the hired editor's Claude picks up the same instructions automatically.
  3. **Owner's custom features** (for example "paste a Drive link -> import") are editor plugins
     (JS/TS modules the editor loads), each with a matching skill. Claude writes both. Keep the
     editor plugin API and the Claude skill separate. The editor plugin adds MCP tools via
     `list_changed`.

### B5. A user without a Claude subscription

- [F] "Claude Code requires a Pro, Max, Team, Enterprise, or Console account. **The free claude.ai
  plan does not include Claude Code access.**" Other options: an API key (Console, pay-as-you-go),
  Bedrock, Vertex or Foundry [F: docs/setup, docs/authentication].
- [I] So the editor must be **fully usable with no Claude**: all manual editing, comments, render.
  The Claude pane shows "Sign in to Claude Code (Pro/Max) or add an API key" and stays empty. The MCP
  server is generic, so any MCP-capable agent the user has could drive the editor later.
- [I] Cost reality: the sister and each hired editor need Pro (~$20/mo) or must work manually. The
  owner can't lend his login.

### B6. Recommendation (Topic B)

1. **Terminal pane:** xterm.js + node-pty (ConPTY) in Electron, running the user-installed,
   unmodified `claude` with `cwd` = project folder. First-run button runs Anthropic's official
   installer. Never touch credentials.
2. **State and tools:** a stdio MCP server bridged to the running app (localhost + token), declared
   in the project's `.mcp.json`. All edits go through the editor's command/undo layer.
3. **Context on every turn:** a UserPromptSubmit hook that adds playhead, selection and nearby
   comments.
4. **Push events:** a channel (dev flag) when available, falling back to PTY injection. Design so
   nothing breaks if channels change.
5. **Distribution:** one GitHub marketplace repo with the editor plugin, plus a `.claude/` folder
   inside every project. The editor installs the plugin silently on first run.
6. **No-subscription mode:** the editor works fully without AI.

**Top risks (B):**
- **Policy churn.** The plain-CLI-in-a-terminal pattern is explicitly allowed today, but Anthropic
  changed subscription rules for non-CLI use three times in 2026. Stay on the most conservative path
  (unmodified CLI, Anthropic's login flow) and recheck the legal page before each release.
- **Channels are a research preview.** The flag name, allowlist and behaviour can change. A community
  project reports push reliability of only 50-70% [U: claude-peers README]. Keep PTY injection as
  the fallback.
- **Claude Code CLI updates itself** (native install) and can change TUI behaviour, hooks or flags
  under the editor. Pin with `autoUpdatesChannel: "stable"` and smoke-test on each update [F/I].
- **Windows rough edges.** Without Git for Windows, Claude uses PowerShell, so skills must avoid
  bash-only commands, or the editor installs Git for Windows during setup [F/I]. node-pty native
  builds per Electron version.
- **Prompt injection.** Comments from hired editors arrive as text in Claude's context. Mark them
  as data in the hook and channel output, and require approval for destructive tools [I; the
  channels docs warn that ungated channels are an injection vector].

---

## Sources

Anthropic (primary):
- https://code.claude.com/docs/en/legal-and-compliance
- https://code.claude.com/docs/en/agent-sdk/overview
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- https://code.claude.com/docs/en/authentication
- https://code.claude.com/docs/en/setup
- https://code.claude.com/docs/en/channels-reference
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/plugin-marketplaces
- https://code.claude.com/docs/en/discover-plugins

Policy coverage (secondary):
- https://gigazine.net/gsc_news/en/20260220-anthropic-third-party-block
- https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/
- https://alternativeto.net/news/2026/2/anthropic-officially-bans-using-subscription-authentication-for-third-party-claude-use
- https://github.com/NousResearch/hermes-agent/issues/25267
- https://codepointer.substack.com/p/claude-code-cli-bridging-terminal (IDE lock-file protocol)
- https://cdn.jsdelivr.net/npm/claude-peers@0.8.3/GETTING_STARTED.md (channel reliability claim)

Shell, codecs, rendering:
- https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding
- https://www.chromium.org/audio-video
- https://gitlab.eclipse.org/eclipsefdn/emo-team/iplab/-/issues/7912 (Electron ffmpeg / codecs)
- https://ayakael.net/mirrors/electron/commit/5b4f715d2e6ffc1427205448825e85857f28240b
- https://github.com/chromiumembedded/cef/issues/3559
- https://jakearchibald.com/2024/video-with-transparency/
- https://rotato.app/read/transparent-videos-for-the-web
- https://caniuse.com/webcodecs
- https://softvelum.com/2025/09/nimio-safari-ios-macos-26/
- https://bugs.webkit.org/show_bug.cgi?id=287516
- https://github.com/tauri-apps/tauri/issues/4133
- https://github.com/mauritzn/tauri-asset-bug
- https://v2.tauri.app/security/asset-protocol/
- https://blackboard.sh/electrobun/docs/apis/bundling-cef
- https://framework.blackboard.sh/electrobun/guides/changelog/v1-18-0/
- https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun.md
- https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
- https://github.com/heygen-com/hyperframes
- https://developers.heygen.com/hyperframes-overview
- https://remotion.dev/docs/cli/render
- https://github.com/CommandPost/FCPCafe/issues/359 (ProRes 4444 alpha bug)
- https://helpx.adobe.com/premiere-elements/using/hevc-decoding-on-windows.html

Distribution:
- https://www.electron.build/docs/features/auto-update
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- https://azure.microsoft.com/pricing/details/artifact-signing/
- https://codenote.net/en/posts/windows-code-signing-ci-cost-per-signing-volume-2026/
- https://shop.certum.eu/code-signing.html
- https://textslashplain.com/2026/04/28/smart-app-control/
- https://www.computerworld.com/article/4043925/windows-11-smart-app-control-explained.html
- https://www.macworld.com/article/2457844/what-to-do-when-you-cant-open-an-app-you-just-installed-in-macos-sequoia.html
- https://www.osnews.com/story/141055/bug-or-intentional-macos-15-1-completely-removes-ability-to-launch-unsigned-applications/

Terminal and examples:
- https://github.com/microsoft/node-pty
- https://unpkg.com/@homebridge/node-pty-prebuilt-multiarch@0.13.1/README.md
- https://xtermjs.org/docs/api/terminal/interfaces/iwindowspty
- https://openapps.pro/packages/portable-pty
- https://gitee.com/web/tauri-plugin-pty
- https://cap.so/llms-full.txt
- https://openalternative.co/cap
- https://desktopinsights.com/apps/screen-studio
- https://pyshine.com/OpenScreen-Free-Screen-Recording-Studio/
- https://mer.vin/2026/07/opencut-explained-open-source-capcut-alternative-classic-editor-vs-ground-up-rewrite/
- https://codeberg.org/paperbyte/OpenCut
