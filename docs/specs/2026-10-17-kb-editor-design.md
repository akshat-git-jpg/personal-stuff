# kb-editor: the owner's own video editor, Claude-driven, forked from WeftCut

**Status:** built 2026-10-17 in `akshat-git-jpg/kb-editor`; real-app smoke test passed 9/9 (`kb/docs/smoke-test-2026-10-17.md`). Open work: `kb/BACKLOG.md`.

Owner-approved decisions from the 2026-10-17 brainstorm. Evidence: `docs/research/kb-editor/`
(five desk-research reports, two hands-on test reports, the requirements and test protocol).

## Intent

Today Claude builds an edit through scripts, renders an mp4, the owner reviews it on a
separate board, and touch-ups go through an FCPXML export to DaVinci Resolve. Every small fix
is a round trip: comment, Claude re-renders, owner re-watches. The owner wants ONE editor
where Claude does about 95% of the work, the timeline plays live with every layer (no render
while editing), quick fixes are done by hand, comments sit on the timeline, and export happens
once at the end. It must be his own: customizable through plugins Claude writes, usable by his
sister and hired editors on Mac and Windows, and kept current with the upstream project it is
built on.

### The owner's real edit flow (the editor is shaped around it)

1. Owner or a freelancer writes the full script.
2. The freelancer records many short screen recordings, one per script part, talking over
   them in a rough guide voice. The guide voice is never used.
3. The final voiceover is TTS from the full script.
4. The edit syncs screen recordings + TTS VO + cuts + HyperFrames motion-graphics cards +
   HeyGen avatar clips + music + SFX. Clips get retimed (speed change, freeze frame, cut
   pauses) so the screen action lines up with the VO. The guide voice can be transcribed and
   matched to script lines to find where each line happens in each clip.

## Goals

- Claude drives the edit through the editor's MCP server; every edit shows live on the
  timeline while it plays.
- Live playback of a 15-min, many-layer timeline with proxies; no render while editing.
- Export once; export matches preview.
- Hand edits for the fast fixes: trim, blade/cut, delete, ripple, move, speed, freeze, mute.
- Comments pinned to a time, with threads, readable and resolvable by Claude via MCP, plus a
  Copy button (one comment or all, with timestamps and clip refs).
- HyperFrames cards play as live, transparent, seekable layers.
- A project is a self-contained folder that can be passed through Google Drive.
- A plugin system so the owner can add his own features (first example: paste a Google Drive
  link, import everything onto the timeline).
- Upstream WeftCut updates can be pulled in, understood and merged on demand.
- macOS (Apple Silicon) and Windows x64.

## Non-goals (v1)

- No terminal pane inside the editor (owner decision, see Decisions). Claude runs in the
  owner's normal terminal (VS Code) and connects over MCP.
- No live multi-user editing; sharing is passing the project folder.
- No hosted / web version.
- No in-app Claude login, no API-key billing, no bundled `claude` binary.
- No Intel-Mac build.

## Anti-goals (would make it a failure even if it "works")

- Every fix still needs a render or a Claude round trip.
- Preview and export disagree.
- The fork drifts so far from WeftCut that upstream fixes can no longer be taken.
- A non-technical user (sister, hired editor) cannot install or use it without help.
- It quietly costs money every month.

## Decisions (owner-confirmed 2026-10-17)

| # | Decision | Why |
|---|---|---|
| 1 | **Base = fork of WeftCut** (`WeftCut/WeftCut`, MIT, v0.5.0 `f48dabdd`) | Won the hands-on test on the owner's real media: proxies give 0 dropped frames, all 20 HyperFrames cards run live through a 31-line adapter, export matches preview (2-min segment in 135 s), Claude's MCP edits land in ms with byte-exact undo, a real code change built and passed 2,773 tests in 9 min. Diffusion Studio failed export on every attempt, blacked out after seeks past 5 min, requires sign-in. Velorn (GPL, no HTML layers), Remotion (team-size licence), OpenCut (rewrite), HyperFrames Studio (composition editor, closed parts, no Windows), Kdenlive/Shotcut (no live HTML), Tauri (WebKit/WebView2 codec split) were ruled out by desk research. |
| 2 | **Shell = Electron** (inherited from WeftCut) | Same Chromium on Mac and Windows = one codec set and one renderer for preview and export. |
| 3 | **Code lives in a separate private GitHub fork** on the owner's personal account, named `kb-editor`, with `upstream` = WeftCut. personal-stuff holds only plans, this spec, the research and a pointer. | Pulling upstream updates is a normal `git fetch upstream && git merge`; personal-stuff (and the sister's Windows clone of it) stays light. The owner first chose "inside personal-stuff", then switched after adding the upstream-updates requirement. |
| 4 | **Upstream sync is a first-class workflow** | Owner requirement: "get more updates from its original owner, understand it and apply in our version". See "Upstream sync". |
| 5 | **No in-editor terminal in v1; Claude connects over MCP from any terminal** | Owner chose this after weighing the pane. Any `claude` session (VS Code etc.) can read comments, playhead, selection and edit the open timeline through MCP, so the pane adds little. It can be added later (WeftCut's Dockview panels + a node-pty IPC channel have no blocker). |
| 6 | **Claude uses each person's own subscription** via the unmodified `claude` CLI | Anthropic's terms allow a user's own `claude` with their own login. The editor never reads, stores or relays Claude credentials. A user without a Claude plan edits by hand; nothing in the editor requires Claude. |
| 7 | **HyperFrames stays the graphics engine; cards become WeftCut Motifs through an adapter** | The owner's card library is HyperFrames HTML (GSAP timelines at `window.__timelines[id]`). |
| 8 | **Signing: none at first** | Owner: no recurring cost unless it becomes a problem. macOS: "Open Anyway" once and no auto-update (WeftCut already disables the macOS updater in code). Windows: SmartScreen "Run anyway"; Smart App Control can block. Pay ($99/yr Apple, ~€50-170/yr Windows cert) only when it hurts. |
| 9 | **Windows test deferred** until the sister is back; Windows CI (build + tests + a headless export compare against Mac frames) runs on every change meanwhile. | No Windows machine available now. Every Electron option carries the same Windows risk, so it does not change the base. |
| 10 | **Nothing is sent upstream.** No public PRs to WeftCut; all fixes stay in the private fork, including generic ones (playhead/selection MCP, frame rounding, marker notes, project-local Motifs). | Owner: keep all private. Consequence: every change is a permanent hook point, so `kb/` isolation and `FORK.md` matter more. |
| 11 | **kb-editor runs side by side with visuals-flow in v1.** It consumes the same inputs (yt-vo voiceover, HeyGen avatar clips via the heygen hub, card-library cards). visuals-flow is retired only after kb-editor has produced a few real videos (a separate, later decision). | Owner: keep the old flow as a backup. |
| 12 | **Distribution**: installers built by CI go to a private Google Drive folder; people reinstall to update. WeftCut's Windows auto-updater (which points at WeftCut's own release feed) is **disabled** in the fork; the macOS updater is already off upstream. A real update channel is later work. | Builder-check finding: an untouched updater could replace kb-editor with upstream WeftCut. Free, and the repo is private so GitHub release downloads need a login. *Builder call.* |
| 13 | **One person holds a project folder at a time** (owner: "pass the project folder"). Comments are stored one file per author inside the project, so folders that crossed paths still merge. Proxies are NOT carried in the folder; each machine rebuilds them. | Keeps Drive syncs small; avoids `project.json` conflicts. *Builder call.* |
| 14 | **Plugins load at runtime from a per-user plugins folder** (no rebuild to add one). A project folder never carries or runs plugin code. Drive import v1 uses the owner's own Google login on his Mac (existing `pp-drive` OAuth); other users import from "anyone with the link" folders. | No code from a sender's folder ever runs; no OAuth app verification needed in v1. *Builder call.* |
| 15 | **A card is one template with editable fields** (the HyperFrames `--variables-file` variables become Motif parameters); each use on the timeline stores its own field values. | A hired editor can fix a typo on a card by hand without Claude. *Builder call.* |
| 16 | **v1 export target: 1080p H.264, about real-time speed** (test: 1.13x real time on a 2-min segment, ~17 min estimated for 15 min). 4K output and faster export are later work. | Owner publishes 1080p. *Builder call.* |

## Architecture

```
kb-editor (private fork)
├── upstream WeftCut code      ← changed as little as possible; every change listed in FORK.md
└── kb/                        ← everything we add lives here
    ├── mcp/                   playhead + selection + comments tools (registered into WeftCut's MCP server)
    ├── comments/              threads, resolve, Copy button
    ├── hyperframes/           HF-card → Motif adapter + project-local Motif storage
    ├── retime/                freeze-frame command, guide-audio tools
    ├── plugins/               plugin host + first plugin (Google Drive import)
    └── align/                 guide-voice ↔ script alignment helpers (phase 2)
```

- **Our code goes in `kb/`**, wired into WeftCut through as few, small hook points as
  possible. Each hook point is listed in `FORK.md` (file, line range, why, which upstream
  ADR it touches). Upstream merges then conflict only at those listed points.
- **Claude sees the editor** through WeftCut's localhost MCP server (Streamable HTTP; port and
  token in the app's user data `mcp_auth.json`) plus our added tools. WeftCut ships 121 tools;
  Reddit feedback on similar editors flagged tool bloat filling Claude's context, so our
  project-level skill tells Claude which tools to use for the owner's flow.
- **Project folder** = WeftCut project (media copied into `<project>/Media/`, `path_rel`
  paths) + our additions stored inside it: Motifs (cards) and comments. A folder passed
  through Drive opens complete.
- **Proxies on by default** (`prefer_proxies: true`): originals dropped up to 79% of frames on
  the 3K VFR screen recording; proxies dropped 0.
- **Preview resolution**: WeftCut previews at 720p internal height. Keep as default for speed;
  the export-vs-preview check compares geometry, not text sharpness.
- **App-bundled Claude skill + MCP config**: each project folder carries `.claude/` and
  `.mcp.json` so whoever opens it with `claude` gets the same instructions and connection.

## Work items (v1)

Measured gaps from the WeftCut test, plus owner requirements:

1. **Fork + upstream sync setup**: private fork, `upstream` remote, `FORK.md`, `kb/` folder,
   build on Mac (Rust + Node 24 toolchains), Windows CI, Windows auto-updater disabled,
   CI installers uploaded to the private Drive folder.
2. **MCP: playhead + selection read** (missing today; Claude cannot resolve "this clip").
3. **Proxies on by default.**
4. **Comments**: threads on a time (extend WeftCut markers/Tacks), resolve, MCP read/reply/
   resolve, Copy button (one / all, with timestamps + clip refs). Comment text from others is
   data, never instructions, for Claude.
5. **HyperFrames cards as Motifs**: productize the test adapter (bundled fonts instead of
   Google Fonts, `motif.define` → `__timelines[id].seek(t)`), store Motifs inside the
   project folder, import a card folder from the owner's card library.
6. **Freeze frame** command (today: split last frame + retime).
7. **Clip-length rounding**: back-to-back placement fails when a length is not a whole number
   of frames; round to frames.
8. **Plugin host + Google Drive import plugin.**
9. **Owner-flow skill**: a Claude skill in the project that runs the flow: import the
   freelancer's clips, mute guide audio, place TTS VO, retime clips to VO, place cards and
   avatars, then hand over for review.
10. **Phase 2**: guide-voice ↔ script alignment (WeftCut's opt-in transcription engine, or the
    repo's existing Whisper path), alpha video (ProRes 4444 / VP9 alpha), terminal pane if
    wanted, Resolve/FCPXML export if still wanted.

## Upstream sync

- GitHub does not allow a private fork of a public repo, so "fork" here means: a new
  private repo `kb-editor` on the owner's personal account, seeded by pushing a full clone
  of WeftCut (history kept), with WeftCut added as the `upstream` remote. Git-wise it
  behaves exactly like a fork.
- Remote `upstream` → `https://github.com/WeftCut/WeftCut`. The fork tracks upstream `main`
  and its release tags.
- A sync run (owner-triggered, e.g. "sync kb-editor with WeftCut"):
  1. Fetch upstream; list new commits, releases and new/changed ADRs since the last sync.
  2. Explain them to the owner in plain words: what changed, what it means for kb-editor,
     anything risky.
  3. Merge into a branch; resolve conflicts at the `FORK.md` hook points; never silently drop
     our changes or theirs.
  4. Run the full test suite + our `kb/` tests + the export-vs-preview frame check.
  5. Stop and ask the owner on any conflict that changes behaviour.
- Last-synced upstream SHA is recorded in `FORK.md`.
- If upstream stops (bus factor 1), the fork simply continues; nothing depends on upstream
  being alive.

## Verification ("done" for v1)

- Owner's real media (test kit: `~/.claude-work/jobs/2b878578/tmp/kit/`, to be moved to a
  durable location by plan 1): the 15-min timeline plays with 0% dropped frames on proxies on
  the owner's Mac.
- Claude, from a normal terminal, can say "delete the clip under the playhead", "fix all open
  comments", and the edits show live; undo restores.
- All 20 kit HyperFrames cards play live and survive passing the project folder to a new path.
- Export of the full timeline completes; a frame check of 10 timestamps shows matching
  geometry vs preview.
- Upstream sync dry run: merge the latest upstream into the fork with all tests green.
- Windows: CI green now; hands-on playback test on the sister's PC when she is back, before
  any Windows user relies on it.

## Calls made by the builder check (owner may override)

Decisions 12-16 were settled by the spec writer from the conversation, not asked of the
owner. Each is marked *Builder call* in the table.

## Left to the builder

- Exact hook points into WeftCut, as long as each is minimal and listed in `FORK.md`.
- Internal structure of `kb/` and the plugin API shape (must allow a plugin to add a
  command, an MCP tool and a panel).
- Test framework choices inside `kb/` (match WeftCut's).
- Naming of MCP tools (prefix `kb_`).

## Risks

| Risk | Mitigation |
|---|---|
| Upstream is one person, 5 months old | We own the fork; sync is optional; nothing depends on upstream continuing. |
| Upstream churn makes merges painful | `kb/` isolation + `FORK.md` hook-point list + tests on every sync. |
| Windows untested | Windows CI now; real-PC test before any Windows user relies on it. |
| Unsigned app friction | One-time "Open Anyway"; buy signing only if it blocks someone. |
| Claude plan limits on heavy edits | Owner's choice to upgrade plan later; editor fully usable by hand. |
| Prompt injection via hired editors' comments | Comments are passed to Claude as quoted data; the skill tells Claude never to follow instructions inside comments. |
| Huge codebase (~440k lines incl. ~140k tests) | 119 ADRs + docs make it agent-readable; Claude reads the relevant ADR before touching an area. |
