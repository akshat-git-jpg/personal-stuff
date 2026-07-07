# Motion-graphics strategy handoff (2026-07-07 session)

Session handoff — diagnosis + recommendation for fixing repetitive/low-quality motion
graphics in the explainer-video pipeline. Assessment only; **no code changed, no plan
written yet**. Audience: the next agent picking this up.

## Where it started

Owner's problem: Hyperframes-based motion graphics look repetitive and lower-quality
than competitors (Devsplainers, Fireship) because videos reuse the same small component
library; he wants better quality without API token spend. Constraints established with
the owner:

- Claude + Antigravity monthly subscriptions only — no API-metered cost; cost lever is
  model routing + fewer retry loops, not dollars.
- Paid asset subscriptions are acceptable (~$12–40/mo range discussed, not committed).
- 15–30 min human review per video, no more.
- Style bar: Devsplainers-like educational explainers (tech niche, psychology later).
  Fireship-tier (human AE editors) explicitly not the target.

## Diagnosis (delivered to owner)

Repetition is architectural, not a model-creativity problem:

1. `pipelines/video/card-library/` (37 cards) deliberately locks timelines and swaps
   only content/colors — whole prebaked cards will always read as repetitive.
2. The competitor doesn't have "more creativity" — per the owner's own analysis in
   `pipelines/youtube/competitor-styles/channels/devsplainers/video-style-dna.md`,
   Devsplainers is a small constrained design system whose variety comes from
   **per-scene composition of small atoms** (diagrams, gauges, node graphs built fresh
   per sentence), not from a bigger library of finished cards.
3. Huge untapped parts supply: the Hyperframes registry (`npx hyperframes add`) has
   ~120 blocks + ~25 components (15 transition families, 15 text effects, 12
   lower-thirds, code-viz, data-viz, VFX). The `hyperframes-registry` and `lottie`
   skills already exist in `pipelines/.claude/skills/`. LottieFiles (~800k animations,
   API + MCP, ~$20/mo paid tier) and IconScout (~$12/mo, real REST API) can inject
   asset variety. AI video-gen (Kling/Runway/Veo, mid-2026) still can't do clean
   deterministic 2D vector explainer graphics — b-roll inserts only, not the mainline.

## Recommendation (Approach A — owner leaned yes, then deferred the plan)

Two-tier composition pipeline, all inside subscription tokens:

1. **Creative direction — Opus, once per video, text-only.** Beat-by-beat visual
   storyboard from script + Devsplainers style DNA. Each beat gets a *named* treatment
   (registry block / kit atom / Lottie search query). Anti-repetition rules in the
   prompt: no two adjacent beats share a treatment; each video uses ≥N treatments new
   to the channel.
2. **Scene build — Sonnet, per scene.** Compose the devsplainers atom kit
   (`pipelines/youtube/competitor-styles/channels/devsplainers/hyperframes/kit/` —
   tokens.css, 35 atoms, R.* motion helpers) + registry blocks installed on demand +
   Lottie/IconScout assets recolored to the 4-color palette. Sonnet parameterizes
   battle-tested components instead of hand-rolling GSAP — the current token burn is
   lint failures and render-inspect-fix loops, not first drafts.
3. **Human review = storyboard contact sheet** (hyperframes-helper Level 2, static
   HTML, ~1 min/cycle) before composition work; final snapshot glance before mux.
4. **Kit promotion:** scene treatments that work get folded back into the atom kit, so
   creativity is paid once and reused free.
5. Card-library demoted to utility cards (CTA, ToC, like-subscribe).
6. Reroute `pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/020-build-graphics`
   from agy to Sonnet — this **reverts a deliberate 2026-07-07 owner override** in
   `decisions.md`; the 2026-07-05 PoC verdict ("thin-kit + Antigravity failed quality
   on all four axes; keep Antigravity out of the graphics path") supports the revert,
   but the plan must name it explicitly. agy keeps mechanical grind (render, stitch,
   ffprobe checks).

Rejected as standalone strategies: asset-injection-only (clip-art variety breaks the
design-system look) and freelancer/AE-template hybrid (rented quality, nothing
compounds; escape hatch for a rare flagship video).

Honest ceiling: this reaches the Devsplainers tier (visibly designed, varied,
code-generated), not Kurzgesagt/Fireship tier (human motion designers).

## Key files

- `pipelines/youtube/competitor-styles/channels/devsplainers/video-style-dna.md` —
  the style thesis the recommendation rests on.
- `pipelines/youtube/competitor-styles/channels/devsplainers/hyperframes/kit/` —
  the 35-atom kit that becomes the composition base.
- `pipelines/video/card-library/` — the 37-card library being demoted.
- `pipelines/youtube/explainer-videos-pipeline-1/4-motion-graphics/` — the stage a
  plan would rewire.
- `decisions.md` — 2026-07-05 and 2026-07-07 entries constrain actor routing (see
  point 6 above).

## Status / open questions

- **Owner has NOT green-lit implementation.** He asked for a plan draft on 2026-07-08,
  then immediately deferred: "no need for plan now". Do not write the plan or build
  anything until he says go.
- Undecided: which paid asset subscriptions, if any (LottieFiles vs IconScout vs free
  tiers only).
- Undecided: kit-promotion as a pipeline step vs a periodic manual pass.
- No running state left behind: no background processes, servers, worktrees, or file
  changes from the session (this doc + its README index line are the only artifacts).

## Pick up here

When the owner says go: invoke the `orchestrate` skill and write the implementation
plan into `plans/` (per `plans/WORKFLOW.md` + `_TEMPLATE.md`, registered in
`plans/README.md`) covering registry + Lottie wiring, the Opus storyboard stage with
variety rules, the 020-build-graphics reroute (agy → Sonnet, acknowledging the
decisions.md override), and the kit-promotion loop.
