# Session Handoff — Motion-graphics for the comparison-video channel (Devsplainers-style)

## Where it started
User asked to reverse-engineer the visual style of a Devsplainers YouTube video, then expanded the question into: should they add Devsplainers-style motion graphics to their own software-comparison channel, how many tokens would that cost on a Claude Pro plan, is the "build a reusable kit once, reuse per video" model actually real for their format, and which tool to use. Session ended with a roast-council verdict and a tool decision. No code built yet — this is a decision/analysis session.

## Decisions locked + what shipped
- **Reverse-engineered the Devsplainers visual system** → lives in `/Users/kbtg/codebase/TY/ai-video-production/Devsplainers/README.md` + `reference-frames/`. Key style: near-black bg, 4 semantic accent colors (white/blue/amber/red + green), condensed-grotesk + monospace type pairing, ~6 reusable components (pill badge, type-tagged card, single-weight line-art SVG icons, underlined section header, connector, accumulating corner badges). Concluded it's code-generated 2D motion graphics (Remotion-style), VO-driven, faceless.
- **Token model (the key reframe):** video *rendering* costs **zero LLM tokens** (it's CPU/ffmpeg). Tokens are spent only when Claude writes/iterates the component code. So cost does NOT scale with video length. One-time kit build ≈ a few focused Claude sessions; per-video cost ≈ near-zero **if** the kit is data-driven and Claude stays OUT of the per-video loop.
- **Reuse analysis of the user's 3 real comparison videos** (see Analysis findings below): format is rigidly formulaic. ~8 templates cover ~80% of graphics scenes; ~85% of scenes are pure data-swaps; a mature kit means only **1–3 genuinely new graphics per video**. Reuse is high *within the graphics layer*, but graphics are only ~15–30% of runtime — the screen-recording demos stay bespoke capture every video.
- **Current video format:** screen-recording walkthroughs + picture-in-picture webcam, NO motion graphics today. Graphics would be *inserts* wrapped around demos, not a full-screen animated video.
- **ROAST VERDICT: RESHAPE** (medium-high confidence). Do NOT build the full 8-component kit. Build the **3 affiliate-decision components only** — rating-bar scorecard, pricing-tier cards, verdict "best-for" card — fed from a per-video data file (JSON/sheet). Keep Claude out of the per-video loop (the token bomb). Editor keeps After Effects for the 1–3 bespoke "angle" graphics. It's a **retention play, not CTR** (graphics live inside the video; thumbnails/titles own CTR). Validate retention on 2–3 videos before committing graphics to every upload. Council scores: Contrarian 3 · Expansionist 9 · Logician 6 · Researcher 8 · Buyer 6.5.
- **Tool decision: Remotion for the kit.** Reasons: the job is structured-data → repeated UI (`.map()` over tools), which is React/Remotion's core strength; Recharts/D3 drop in for rating bars; user already ships React apps in this repo; mature ecosystem; free at solo scale (Remotion BSL is free for individuals/≤3-person teams, paid only at 4+ orgs or hosted automation). **Hyperframes** is NOT the kit tool — its real value to this user is a *different* job: the talking-head cut pipeline (silence-cut → whisper transcribe → retake-cut) for trimming raw recorded footage.
- **Claude Code + After Effects MCP — EVALUATED, NOT ADOPTING (decided 2026-06-30).** A third approach surfaced (video: "Claude Code + After Effects MCP: The Future of Motion Design" by AI Aidan — https://youtu.be/YTOwQj-n7ME): Claude Code drives AE through an MCP bridge to create comps, scaffold simple scenes, and write expressions live. Verdict after watching the full transcript: it's a **scripting/expression copilot inside AE, not a data-driven scene engine** — the creator himself admits scene generation is "super simple… nothing crazy; still needs human creativity," and the genuinely strong demo is expression-writing (expressions are JavaScript → Claude's home turf). It's weakest exactly where the kit's need is (data-driven reuse + headless/programmatic render for the SEO-pages/Shorts upside), the bridge is a hobbyist setup (Google-Drive download, "MCP Bridge–Auto" panel) with maturity/version-compat risk, and driving AE per-video re-triggers the Pro-plan token bomb. **Decision: Remotion stays the backbone; we are NOT building the kit on AE-MCP.** It's parked as an optional, low-priority trial the editor could throw a single real expression task at — not on the critical path. Bespoke per-video graphics stay in plain After Effects (editor's hands), per the roast verdict.
- **Storyboard = plan before build.** Lightweight table per video mapping each script beat → template → data to fill → duration → over-demo-or-fullscreen. Make it before building graphics (wireframe-before-UI). For the user's formulaic format it's near fill-in-the-blank once the kit exists.

## Analysis findings (load-bearing for any future build)
The 3 analyzed videos (AI video tools ×5, InVideo Studio vs AI, AI app builders ×5) all run the same spine:
> hook → criteria preview → contender lineup → [tool spotlight + demo + pricing + pros/cons] ×N → comparison table/scorecard → verdict-by-use-case → outro

**8 reusable templates** (priority order — the first 3 are the money components):
1. Rating-bar scorecard (criteria × tools, X/5 bars) ← build first
2. Pricing-tier cards (free + paid tiers, price, bullets) ← build first
3. Verdict "best-for" card (use-case → recommended tool) ← build first
4. Tool-spotlight lower-third (name + logo + feature bullets, repeated per tool)
5. Contender-lineup card (N logos + one-liner each)
6. Criteria-list card (the judging axes)
7. Title / hook card
8. Outro / subscribe card

Bespoke per-video (stays in AE): the one "signature angle" graphic per video (e.g. the single-shared-prompt fairness device in the app-builder video; the build-race timer in the InVideo video; the 3-way pricing-category split in the AI-video-tools video).

## Key files for next session
- `/Users/kbtg/codebase/TY/ai-video-production/Devsplainers/README.md` — read first; the Devsplainers visual-system reverse-engineering (colors, type, components, production method).
- `/Users/kbtg/codebase/TY/ai-video-production/Devsplainers/reference-frames/` — 6 stills from the Devsplainers video showing the target aesthetic.
- `/Users/kbtg/codebase/TY/ai-video-production/Devsplainers/HANDOFF.md` — this file.
- Tooling already installed (both accounts): `remotion-best-practices` skill, `hyperframes-helper` skill, `pp-elevenlabs` (TTS). Hyperframes set up at `/Users/kbtg/codebase/TY/hyperframes-vs-remotion/`.
- ccusage dashboard for measuring token spend: `/Users/kbtg/codebase/personal-stuff/tooling/cli/ccusage-dashboard/`.
- Memory files touched: none this session.

## Running state
- Background processes: none (all subagents — transcript analysis + 5 roast council members — completed).
- Dev servers / ports: none.
- Open worktrees / branches: none (working in main checkout per personal-stuff norms; no commits made).
- Temp artifacts: downloaded videos, VTT transcripts, and sampled frames are in `$CLAUDE_JOB_DIR/tmp/` (job-scoped, ephemeral — will be cleaned up; do not rely on them).

## Verification — how to confirm / reproduce
- Frame analysis method (to re-sample any video): `yt-dlp -f "bestvideo[height<=720]+bestaudio" -o video.webm <url>` then `ffmpeg -i video.webm -vf "fps=1/8,scale=640:-1" frames/f_%03d.jpg` and Read the frames.
- Transcript method: `yt-dlp --skip-download --write-auto-subs --sub-lang en --sub-format vtt <url>`.
- The 48-hour validation test (the real "does this work" check): build ONE data-driven Remotion component (scorecard or verdict) fed by one real past video's JSON, render it, drop it into the next upload at the verdict beat, and compare the YouTube retention curve at that timestamp against baseline. Measure the token cost of building it on the ccusage dashboard.

## Deferred + open questions
- Deferred: building the actual component kit — gated on the 48-hour test outcome.
- Deferred: the full 8-component kit and the Expansionist's "data-layer → SEO pages / Shorts / sellable template" upside — only if the pilot proves out.
- Parked: Claude Code + AE-MCP — optional editor trial for expressions only; explicitly NOT the kit path (see decision above). Don't revive as the backbone.
- Open: does the user want to proceed to the 48-hour pilot now? Which past video's data should seed the first scorecard? Has the editor agreed to a hybrid (data-fed components for the formulaic 80%, AE for bespoke) rather than a full Remotion switch — adoption is the #1 risk per the Buyer/Logician.
- Open: is the user on Pro / Max / API for the build sprint? Pro is tight for the iteration-heavy one-time build (see token model); a Max month or API was suggested for the build, Pro is fine for per-video data-swaps after.

## Pick up here
Build the single data-driven Remotion scorecard/verdict component fed by one real past video's JSON, render it, and use it as the 48-hour retention test — measuring token cost on ccusage — before building anything else.
