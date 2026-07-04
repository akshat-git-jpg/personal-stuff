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

## Session update — 2026-07-01 (bespoke-graphics economics; distinct thread from the roast above)

This session re-opened a **different** question than the roast: not "add a few data-driven insert graphics to the user's formulaic comparison channel," but "what does it cost to produce *genuinely Devsplainers-style, fully-animated* motion graphics (a 10-min all-MG video), and can a cheaper/local/self-hosted model do the authoring so marginal cost approaches zero?" Keep the two threads separate — the prior "~85% data-swap / 8 templates" finding applies to the user's own screen-recording comparison format, NOT to true Devsplainers bespoke graphics.

**Key correction to the earlier "reusable kit → data-swap" model (user pushed back, and was right):**
- The user watched multiple Devsplainers videos: compositions are **bespoke and script-specific with no cross-video duplicates** (crosshair-on-memory-card, robot-in-trash, funnel, slider, users-around-a-model, etc.). Templating the *output* (same component, new JSON) would produce exactly the generic look they're avoiding. **Drop the JSON-fill idea for this style.**
- What DOES reuse is the **atom/design-system layer** (4 semantic colors, 2 fonts, pill/card/line-icon/connector/section-header/watermark, motion grammar), not the scene compositions. Bespoke composition ≠ no reuse — the atoms reuse, the arrangement is custom per scene.

**Motion-graphics count (measured this session):** analyzed a second Devsplainers video, "AI Agent Memory: The Part Nobody Explains" (https://youtu.be/Ez4siJMzLX8), 10:39, 4K. Method: 480p yt-dlp download → ffmpeg 1 frame/5s (128 frames) → tiled into 6×6 montages → visual inspection. Result: **fully animated, no live footage/talking-head; ~55–65 distinct animated scenes per 10 min (~6/min); only 9 hard cuts** (scene-detect threshold 0.3) — everything else morphs in place. Plan on **~60 scenes per 10-min video.**

**Revised cost model (earlier per-video estimate was too optimistic):**
- Rendering still costs **$0 tokens** (local Remotion/ffmpeg/headless-Chrome) — unchanged by bespoke-ness. This is the part people wrongly fear; it is NOT AI video generation (no Sora/Veo/Runway credits).
- Token cost = **~60 small bespoke frontend-animation coding tasks** per video → **~5–12k tokens/scene → ~300k–900k tokens per 10-min video** (I previously lowballed by assuming templating).
- $ by model for code-gen (~500k tok): Opus ~$20–50 · Sonnet ~$4–10 · **Gemini 2.5 Flash / Haiku ~$0.50–2**. At weekly cadence, even naive-bespoke on Flash is a few dollars/month.

**Local / cloud-hosted model analysis (the user's actual question):**
- **Hardware fact (checked this session): MacBook Pro, Apple M2 Pro, 16 GB, 10-core; no ollama/LM Studio installed.** 16 GB unified memory caps local models at 7B (comfortable) / 14B (tight, and rendering also needs RAM); a 32B coder (~20 GB, smallest I'd trust for bespoke frontend composition) won't fit. **Verdict: local-on-this-Mac can't hit the quality bar for bespoke art-directed scene code.**
- **Cloud-hosted self-host (rent GPU, run 32–70B): NOT cost-effective at weekly volume.** H100 ~$1,400/mo 24/7; even spot L4/A10 used only during gen ~$5–10/mo + ops/cold-start, and still loses to Flash on price AND quality. Self-hosting only pays off at high steady batch volume (dozens/week).
- **Gemini UI subscription: use for the non-agentic half** (script + art-direction/storyboard) — flat fee, $0 marginal, but can't run the 60× compile/render/fix loop (no tool-calling). Code-gen loop still wants an API.

**Recommended stack (my opinion, this session):**
1. **Drop local + cloud-self-hosting.** Can't win at this hardware/volume.
2. Backbone: **HTML-first authoring + local render + local TTS (or ElevenLabs) = $0 for the heavy parts.** (Tool: Hyperframes for scene authoring — see tool-choice reversal below.)
3. **Two-model split:** strong model or Gemini UI does art-direction (script → 60 scene specs: metaphor + layout + atoms + timing, ~30–60k tok, cheap); **Gemini 2.5 Flash** turns each spec into a self-contained HTML/CSS+GSAP scene.
4. **Reusable ATOM kit** (built once) so each scene's code is small + constrained to house style — this is what makes Flash viable (not scene templates).
5. **Local verify loop = free iteration:** render one still + auto-check (renders / fits frame / only kit colors+fonts); cheap model iterates at $0; strong model or human spot-checks the rendered stills.
6. **The real compounding lever — growing scene corpus + retrieval:** bespoke scenes rhyme even when not identical. Each shipped scene becomes a few-shot/RAG example, so by video ~10 the cheap model retrieves-and-adapts the 3 closest past scenes instead of inventing from scratch. **Each video makes the next cheaper** — opposite of a fixed template that ages generic.

**Tool choice — Hyperframes vs Remotion (REVERSES the earlier "Remotion for the kit" call, but only for Thread B / bespoke):**
- Both are HTML under the hood (Remotion = React→DOM→Chrome frames; Hyperframes = plain HTML/CSS+GSAP scenes → headless-Chrome capture). The difference is the *authoring model*.
- The original handoff (line 12) chose **Remotion** explicitly *because the work was framed as "structured-data → repeated UI, `.map()` over a tool list"* — Remotion's core strength. **Thread B killed that premise:** the graphics are bespoke, not data-driven, so Remotion's main justification largely evaporates for this style.
- Since the cost plan hinges on **Gemini Flash authoring the bespoke scenes**, and cheap models are strongest at plain HTML/CSS (most abundant training data) and weakest at framework-specific correctness (Remotion's `useCurrentFrame`/`interpolate`/`Sequence` frame math), **Hyperframes/plain-HTML gives higher first-pass success + lower token cost on the step that dominates the budget.** Self-contained HTML scenes also drop cleanly into the per-scene verify loop.
- **Where Remotion still wins (the gap to plan for):** assembling the full 10-min video (60 scenes sequenced + VO-synced to the frame + transitions) in one deterministic render, and frame-exact determinism vs capture jitter.
- **Decision (Thread B): HTML-first split, not a single winner.** Author bespoke scenes in **Hyperframes/HTML** (cheap-model-friendly, self-contained, easy to verify); **assemble + VO-sync with ffmpeg** (simple concat + audio); reach for a thin Remotion/timeline wrapper *only* if fancy cross-scene transitions become necessary. Do NOT default to Remotion because the old note said so — that call was for Thread A's data-driven format.
- **Thread A unchanged:** for the user's formulaic screen-recording comparison channel (genuinely `.map()`-over-data scorecards/pricing/verdict components), **Remotion is still the right pick** per the original roast decision. The reversal above applies only to the bespoke-Devsplainers thread.

**Proposed next step (offered, not yet approved):** prototype the atom kit + **3–4 genuinely different bespoke scenes** rendered to MP4, generated via Flash against a local verify loop, to get a **measured token/$ per scene** instead of the estimate — the only way to settle whether Flash clears the quality bar for the user's eye.

## Formal spec (2026-07-01) — READ THIS BEFORE BUILDING
- **`hyperframes/SPEC.md`** — the approved design + build plan for the Devsplainers-clone motion-graphics pipeline. Supersedes the loose plan in the session-update notes above for anything implementation-related.
- Locked decisions in the spec: clone the Devsplainers look exactly (per `README.md` design system); build fresh in **`Devsplainers/hyperframes/`** (atom kit + per-video scenes); **do NOT reuse or modify `TY/yt-visuals-hyperframe/`** (unrelated POC); Hyperframes invoked as an `npx` tool (no dependency on that folder); deliverable = ~30 individual scene MP4s for a 5-min script (assembly/VO + cheap-driver choice deferred to phase 2); two-pass static→motion with a user review gate on static stills; Opus builds kit + storyboard, cheap model builds scene code.

## Build progress (2026-07-01) — M0 COMPLETE ✅
Working dir: **`TY/ai-video-production/Devsplainers/hyperframes/`**. Reads `hyperframes/SPEC.md` (§5 = the atom kit; §12 = M0 build order).

**M0 done + verified (this session):** the full atom kit is built and all 4 example scenes render clean through the verify script (success criterion §11.1 met).
- `hyperframes.json` at the project root marks `hyperframes/` as the render root.
- `kit/tokens.css` — 4 semantic colors + tints, Anton + JetBrains Mono `@font-face`, type/spacing/radius/stroke/motion vars. Hexes tuned against `reference-frames/`.
- `kit/atoms.css` (622 lines) — all 35 components across Tier 1/2/3.
- `kit/atoms.md` — the catalog (class table + markup notes + recipe table) — the cheap model's authoring reference.
- `kit/recipes.js` — global `R.*` GSAP helpers (fadeUp, slideIn, popIn+stagger, drawOn, countUp, staggerIn, grow, needle w/ svgOrigin, finite pulse, flash).
- `kit/scaffold/{index.html,meta.json}` — the scene template (CONTENT / MARKUP / TIMELINE split, chrome, clip/track structure).
- `kit/examples/{01-title-card,02-loop-diagram,03-gauge,04-compare-cards}/` — 4 few-shot refs; 01 + 04 mirror `reference-frames/` 01 & 05; all rendered + eyeballed + pass verify.
- `verify/verify.mjs` — SPEC §7 gate (ensures kit symlink, color/font/watermark static checks, `hyperframes lint`, snapshot render + 1920×1080 canvas check). Machine-readable `--json`; proven to PASS all 4 and FAIL a planted-defect scene.
- `serve.mjs` — fresh contact-sheet gallery (localhost:4321); tiles seek each paused timeline to `progress(1)` so you review the final look. Assets resolve through the kit symlink (verified HTTP 200).

**KEY ARCHITECTURE DECISION (verified by render), now in SPEC §8:** Hyperframes serves a standalone composition with its *own folder* as the web root, so `../kit/…` paths 404 + fail lint. Fix that keeps the kit single-source AND scenes self-contained with no build step: **each scene folder carries a relative `kit` symlink → `hyperframes/kit/`**, and references assets root-relatively (`kit/tokens.css`). `@font-face` urls resolve relative to tokens.css so fonts load at any depth. `verify.mjs` auto-creates the symlink if missing.

**Render/verify commands (from `hyperframes/`):**
- `npx hyperframes@latest render kit/examples/01-title-card -o out.mp4 --fps 30`
- `node verify/verify.mjs kit/examples/01-title-card [--json]`
- `node serve.mjs` → http://localhost:4321

**Next = M1 (storyboard), BLOCKED on the user supplying the 5-min script.** Then M2 static + review-gate (cheap model), M3 motion + render. Nothing committed (user's call; TY repo → run github-router before any commit). Side effect of `hyperframes init` probe: the official `hyperframes-*` skills got linked into the skill dirs — harmless/useful.

### (superseded) original M0 plan
Working dir: **`TY/ai-video-production/Devsplainers/hyperframes/`**. Reads `hyperframes/SPEC.md` (§5 = the atom kit; §12 = M0 build order).

**Done this session:**
- **Atom kit is evidence-based, not guessed.** Frame-analyzed the channel's #1 video ("Google's OKF", `P_E29-87THI`, 100.6k views, 97 frames @ 5s) + the memory video. Rewrote `SPEC.md` §5 into a **35-item, 3-tier kit**: Tier 1 primitives (chrome/text/pills-cards/data-code/icons/connector), Tier 2 composed diagrams (pipeline, node-graph, bar, gauge, grid-of-cells, status-bar, mapping-table, timeline-dots, loop), Tier 3 scene templates (title, numbered-section, authority card, pull-quote, color-flash, outro CTA). M0 milestone now lists the build order.
- **Folder skeleton created:** `kit/{fonts,scaffold,examples}/`, `verify/`, `videos/`.
- **Fonts self-hosted** in `kit/fonts/` (full-coverage OFL files from source repos — an earlier Google-Fonts-css2 pull grabbed tiny wrong-unicode-range subsets, since replaced): `Anton-Regular.ttf` (168K, headline) + `JetBrainsMono-{Regular,Medium,Bold}.woff2` (data/mono). **Gotcha:** Anton is `.ttf` → `@font-face` needs `format('truetype')`; JetBrains are woff2.

**NOT done — remaining M0 (build in this order):**
1. `kit/tokens.css` — `:root` color tokens (§3 table), `@font-face` for Anton+JetBrains, spacing scale, motion-timing vars. (Tune exact hexes against `okf_*` reference frames.)
2. `kit/atoms.css` + `kit/atoms.md` — Tier-1 primitives (§5).
3. `kit/recipes.js` — GSAP helpers (fadeUp, slideIn, popIn/overshoot, drawOn, countUp, staggerIn).
4. Tier-2 composed diagrams, then Tier-3 scene templates.
5. `kit/scaffold/index.html` — scene template (CONTENT block + markup + separate TIMELINE + hyperframes duration/fps meta).
6. `kit/examples/` — 4 built scenes (title / loop-diagram / gauge / compare-cards) doubling as few-shot refs.
7. `verify/verify.mjs` (§7 checks) + `serve.mjs` (gallery; **build fresh — do NOT copy from `yt-visuals-hyperframe/`**).

**Guardrails:** Hyperframes is an `npx hyperframes@latest render <folder> -o out.mp4 --fps 30` tool — no local install, zero dependency on the forbidden `yt-visuals-hyperframe/` POC. Nothing committed yet (user's call; TY repo → run github-router before any commit). **Generation driver DECIDED (2026-07-01): Antigravity** — it generates scenes in parallel (Steps 2 & 4) and verification runs in batches with an Antigravity fix pass (SPEC §6/§7). Per-video workflow (Step 1 storyboard) is blocked on the user supplying the **5-min script**. Frame stills + montages from the analysis are in the ephemeral job tmp (`$CLAUDE_JOB_DIR/tmp/okf_*`) — regenerate via the method in the Verification section if needed.

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
**Active work = Thread B, M0 build (see "Build progress (2026-07-01)" section).** Resume by building `kit/tokens.css` next, then work down the remaining-M0 list. The atom plan is locked in `hyperframes/SPEC.md` §5. Then the two-thread context below is background.

Two live threads — confirm with the user which one is active:
- **Thread A (original roast plan):** build the single data-driven Remotion scorecard/verdict component fed by one real past video's JSON, render it, and use it as the 48-hour retention test — measuring token cost on ccusage. This is for the user's own *formulaic screen-recording comparison* channel (graphics as inserts).
- **Thread B (this session, 2026-07-01):** replicate *full Devsplainers-style bespoke motion graphics* (a ~60-scene, 10-min all-MG video). Decided: drop output-templating (compositions are bespoke); **author scenes in Hyperframes/plain HTML** (reverses the earlier "Remotion for the kit" call — see tool-choice note) via Gemini Flash + reusable atom kit + local verify loop + growing scene-corpus retrieval; **assemble + VO-sync with ffmpeg**, Remotion timeline only if transitions demand it; skip local/cloud-self-host (M2 Pro 16 GB too small, self-host not cost-effective weekly). **Next step: prototype atom kit + 3–4 bespoke scenes via Flash against a local verify loop to get a measured token/$ per scene.** No code built yet.
