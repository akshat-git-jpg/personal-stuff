# Reference: vPqSgj8Ta3Y — Youri van Hofwegen, "Best AI Video Generators Right Now (2026)"

16:32 · 176K views · analyzed 2026-07-19 (analyze-reference.sh, 199 moments, top-40 sheets + 4 overview sheets + timestamped transcript). Same-niche channel (AI-tool reviews); owner wants this editing style cloned.

## Format snapshot

**Footage-first, not talking-head-first.** The video is ~70% full-screen content
(generated AI clips, Higgsfield UI screencasts, graphic slates) with a
**persistent circular avatar bubble** (~120px, top-right, neon-green ring) over
every non-talking-head segment. Full-frame talking head (warm orange room,
vertical green LED strips) appears only in short bridges between tests.
Brand color: neon green (#39FF6A-ish) + yellow-green CTA; all graphic slates
sit on a dark green-black animated-gradient background.

## Moment table

| time | kinds | what happens (mechanism) | already have? | candidate? |
|---|---|---|---|---|
| 0:11.5 | cut+flash | Green light-leak wipe: UI screencast → 5-clip intro montage grid (2-row collage, all clips playing). Wipe = neon-green bloom blob sweeps in ~5f, cut under it, sweeps out ~3f (~0.3s total, 30fps) | no (whip is dark-blur) | YES — signature |
| 0:16.3 | cut+flash | Montage grid → talking head: **plain hard cut** (no green). Return-to-host is always undecorated | hard cuts yes | — |
| 0:45.2 | cut+flash | UI screencast (Higgsfield presets) → TH hard cut. UI segments have a **slow push-in zoom** the whole time they're on screen | drift (Ken Burns) close | partial |
| 1:02.2 | cut+flash | TH → green wipe → **section icon slate**: glowing green icon in rounded square + small label ("Physics") on dark animated gradient, scales/fades in, holds ~2s | section-opener cards (different look) | YES |
| 1:17.0 | cut+flash | TH → green wipe → footage. Spoken: "lighting, colors, B-rolls" | — | — |
| 1:27.2 | cut+flash | TH → green wipe → footage + **prompt panel overlay** (dark rounded translucent card, "Prompt" header + full prompt text) fades in over footage | overlay cards exist | YES (prompt/quote panel) |
| 1:29.9 | cut+flash | Footage + prompt panel → TH hard cut | — | — |
| 1:46.7 | cut+flash | UI → green wipe → footage. Criteria chips seen nearby: stacked pill chips (icon + text, green outline) tick in one-by-one as he lists criteria | checklist card (fullframe) | YES (overlay chip stack) |
| 2:01.7 | cut+flash | Footage → footage green wipe (underwater → cliff run) at "here's the result" — new-clip reveals get the wipe too | — | — |
| 2:42.5 | cut | Footage (with 2 verdict chips bottom-left: "Clean underwater scene" ✓ + "Weird shirt removal" ✗) → TH hard cut. **Verdict chips appear at the exact second the critique is spoken and persist to segment end** | overlay track exists | YES — verdict chips |
| 3:18.8 | cut+flash | UI (Grok panel, push-in zoom) → green wipe → footage | — | — |
| 5:07.2 | cut+flash | **Kinetic-text slate**: headline "So in other words, you can't create..." + 3 icon chips (Short films / Character videos / Anything with dialogue) ticked in as spoken; slate holds w/ subtle bg drift; exits via green wipe → campfire footage + prompt panel fade-in | beat cards similar | YES (headline+chips slate) |
| 12:20.0 | cut+flash | TH → green wipe → footage + **comparison table** (bottom panel: Model / Max Length / Max Resolution / Cost; 5 rows with logos). **Rows populate one-by-one as each model's numbers are spoken** (12:43 SeaDance row → 13:05 Kling row → 13:27 Veo…) | comparison card (fullframe, all-at-once) | YES — progressive rows |
| 13:05.0 | cut+flash | Same table pattern, next row | — | — |
| 15:34.4 | cut+flash | TH → green wipe → footage + model-name chip (bottom, "Kling 3.0") during per-model recommendation run | lower-third exists | partial |
| 15:54.1 | cut+flash | Same, "Wan 2.7" | — | — |
| ~14:52 | (overview) | **Scoreboard graphic**: tab bar "Physics / Audio / Fighting / Value" with winner logo under each, revealed per round as he recaps | persona-match finale card | YES (rounds scoreboard) |
| ~2:11 etc | (overview) | **Score badge**: pill "Physics · 9.5/10" with tool logo pops on footage at the exact second the score is spoken (every model × every round) | stat-hit card | YES — score pill |
| ~16:21 | (overview) | End card: Higgsfield logo + "Link in description" + down arrow on green-glow slate | link-in-description card | have |

## The rule system (when → what)

1. **Every cut INTO new content gets the green light-leak wipe** (TH→footage,
   footage→footage on a new test clip, TH→slate, UI→footage). Returns to the
   host are plain hard cuts. Wipe ≈ 8–10 frames total, directional, heavy bloom.
2. **Say a list → chips tick in.** Criteria/consequence lists render as stacked
   icon pill chips appearing item-by-item in sync with speech (on slates AND as
   overlays on footage).
3. **Say a verdict → verdict chip.** During result review, each spoken
   pro/con becomes a small ✓/✗ pill pinned bottom-left of footage; persists
   until the segment ends.
4. **Say a score → score pill.** "gets a 9.5 out of 10" always coincides with
   the score badge popping on the footage.
5. **Say numbers across products → table builds row-by-row** in sync with
   narration; table persists across several segments.
6. **New round → icon slate.** Each section/round announcement = 1–2s glowing
   icon divider slate.
7. **Recap → scoreboard.** Winner-per-round tab graphic at the recap, then
   per-model recommendation run with model-name chips.
8. **Host is a bubble, not a base layer.** Screen/footage is the base; the
   presenter persists as a corner circle over everything except full TH bridges.
9. **UI screencasts always drift** (slow push-in), never static.

## New-effect shortlist for visuals-flow

1. **green-wipe transition** (our-brand recolor: orange) — light-leak bloom wipe
   for cut-INTO-content boundaries; EFFECTS.md recipe, whip-style module.
2. **verdict-chip overlay** — spoken-synced ✓/✗ pill chips on footage.
3. **score-pill overlay** — "<label> · N/10" badge card timed to spoken score.
4. **progressive comparison table** — row-by-row reveal synced to anchors
   (variant of comparison card).
5. **headline+chips slate** — kinetic sentence + item-by-item chip stack card.
6. **icon section-divider slate** — 1.5–2s glowing icon + label (restyle of
   section opener to divider-slate form).
7. **corner avatar bubble** — circular PIP with brand ring (deferred corner
   track exists in shot pass; this is the reference look for it).
8. **rounds scoreboard card** — winner-per-round recap tab graphic.

Evidence sheets: `~/kb-scratch/video/visuals-flow/_reference/vPqSgj8Ta3Y/` (regenerable via `bash scripts/analyze-reference.sh https://youtu.be/vPqSgj8Ta3Y`).
