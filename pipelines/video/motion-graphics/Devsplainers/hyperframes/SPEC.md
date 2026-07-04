# SPEC — Devsplainers-style motion-graphics pipeline (Hyperframes)

**Date:** 2026-07-01
**Status:** Design approved (brainstorm), pre-implementation
**Home:** `pipelines/video/motion-graphics/Devsplainers/hyperframes/`
**Companion docs:** `PIPELINE.md` (the run-order map + `steps/`), `../README.md` (visual-system reverse-engineering), `../HANDOFF.md` (session history + decisions)

---

## 1. Goal

Produce **bespoke, Devsplainers-style 2D motion graphics** — faceless, fully-animated
explainer scenes — as individual rendered MP4 clips, cheaply and repeatably. Target for
the first run: **~30 scenes for a 5-minute script** the user will supply.

The cost strategy: **a strong model (Claude Opus) builds the reusable kit once and does the
cheap per-video art-direction; a cheap agentic driver (Antigravity) generates the per-scene
code in parallel and then verifies in batches; the user reviews static stills before any
motion is generated.** Rendering is local and free.

## 2. Scope

**In scope (this phase):**
- The reusable **atom kit** (design tokens + atom components + motion recipes + scaffold + examples + verify script).
- The **per-video workflow**: script → storyboard → static scene generation → review gate → motion pass → render.
- **Deliverable: ~30 individual scene MP4s + a preview gallery.**

**Out of scope (deferred to phase 2):**
- Final assembly (concatenating clips) and voiceover / VO-sync. Output is per-scene MP4s only.
- The hosted `render2.agrolloo.com` renderer (it reads from the old POC folder; not wired to this).
- Whether Step-1 art-direction/storyboard runs on Claude Opus or is also pushed to an Antigravity/Gemini surface (cheap either way). The scene-generation driver itself is **decided — Antigravity** (§6).
- Rebranding to the user's own channel identity (this phase clones the Devsplainers look exactly).

**Explicitly forbidden:**
- **Do NOT reuse or modify `pipelines/video/card-library/`.** It is a POC for a different system. This project is built fresh and standalone; Hyperframes is invoked as an `npx` tool, so there is no dependency on that folder.

## 3. Target visual system (clone Devsplainers exactly)

Reverse-engineered in `../README.md` and confirmed on a second video this session
("AI Agent Memory", ~60 scenes / 10 min). The kit encodes this system as tokens so every
scene inherits it for free.

### Canvas
- **1920×1080 @ 30fps** default; `--quality high` (4K) available at render time.
- Near-black background, never pure black.

### Color tokens (semantic — color carries the argument)
| Token | Hex (starting values) | Meaning |
|---|---|---|
| `--bg` | `#0D0D0D` | background |
| `--surface` | `#141414` | card / panel fill |
| `--fg` | `#F5F5F5` | neutral / primary text |
| `--blue` | `#2E7DFF` | old / technical / RAG / vector-DB concept |
| `--amber` | `#FACC15` | new / hero concept |
| `--red` | `#FF3B30` | problems, catches, "the business read" |
| `--green` | `#22C55E` | good / forgiven / free |

Scenes may use **only** these tokens (enforced by the verify script). Exact hexes may be tuned once against reference frames during Phase 0.

### Typography
- **Headlines:** heavy condensed grotesk, all-caps, tight tracking. Free clone: **Anton** (Druk-substitute); alt Archivo Black. Self-hosted WOFF2 for deterministic render.
- **Section labels:** same family, small, wide letter-spacing ("THE SPEC", "THE CATCH").
- **All data / labels / file names / watermark:** monospace — **JetBrains Mono** (alt Space Mono). Mono everywhere = the developer aesthetic.

### Motion (restrained, ~3/10)
- Elements fade / slide / scale in on a beat; dashed connectors "draw on"; pills pop with a slight scale overshoot. Never bouncy or flashy.
- GSAP eases: `power2.out` / `power3.out`; pill overshoot `back.out(1.6)`; typical in ~0.35s, stagger ~0.06s.

### Watermark
- Bottom-right monospace channel mark on every frame. Token-driven (`--watermark-text`), default placeholder — swap for the real channel handle when rebranding (phase 2). Styled identically to the Devsplainers mark.

## 4. Repository layout

```
Devsplainers/hyperframes/
  SPEC.md                     <- this file
  kit/
    tokens.css                <- :root design tokens (colors, fonts, spacing, timing)
    atoms.css                 <- styles for all atom components
    atoms.md                  <- catalog: each atom's markup + props + when to use
    fonts/                    <- self-hosted WOFF2 (Anton, JetBrains Mono)
    recipes.js                <- shared GSAP motion helpers (fadeUp, drawOn, popIn, countUp…)
    scaffold/
      index.html              <- the scene template (CONTENT block + markup + TIMELINE)
    examples/
      01-title-card/index.html
      02-loop-diagram/index.html
      03-gauge/index.html
      04-compare-cards/index.html
  verify/
    verify.mjs                <- renders a scene still + runs the checks (§7)
  serve.mjs                   <- gallery/contact-sheet server (localhost) — built fresh, NOT copied from the POC
  videos/
    <video-slug>/
      storyboard.md           <- ~30 scene specs (Opus output, §6 phase 1)
      scenes/
        s01-<slug>/index.html
        s02-<slug>/index.html
        ...
      stills/                 <- static-pass PNGs for the review gate
      renders/                <- final per-scene MP4s (the deliverable)
```

## 5. The atom kit (Phase 0 — built once by Opus)

**Evidence base:** derived by frame-analyzing the channel's #1 video ("Google's OKF",
P_E29-87THI, 100.6k views, 97 frames @ 5s) plus the "AI Agent Memory" video. This is the
observed vocabulary, organized in three tiers: **primitives** (base atoms), **composed
diagrams** (built from primitives), and **scene templates** (recurring full-scene layouts).
Everything is styled only from `tokens.css`.

### Design tokens (`tokens.css`)
`:root` with the color tokens (§3), font-family vars, a spacing scale, and motion-timing vars.

### Tier 1 — Primitives (`atoms.css` + `atoms.md`)

**Chrome (persistent per scene):**
1. **Section label** — top-left small-caps, wide tracking, optional underline ("THE PROBLEM", "THE CATCH", "THE PITCH"). Breadcrumb variant with `→` chain ("Google AI Lab → THE BIGQUERY TEAM").
2. **Topic tag** — top-center underlined source/brand label ("GOOGLE CLOUD").
3. **Catch-stack** — top-right red pills that accumulate (CATCH 1 → 2 → 3).
4. **Watermark** — bottom-right mono channel mark (token-driven).

**Text:**
5. **Headline** — big condensed all-caps; hero word can be amber/red.
6. **Numbered section title** — big amber number + white caps ("2 SCALE").
7. **Caption line** — centered, sentiment-colored (green good / red bad / amber hero).
8. **Arrow-mapping list** — key `→` value rows, hero row highlighted.
9. **Pull-quote** — large centered quote + mono attribution.

**Pills / cards:**
10. **Pill badge** — rounded-full chip; semantic color; label / status / `required` variants.
11. **Type-tagged card** — rounded rect + colored corner tag (`metric`/`table`/`playbook`/`special`) + mono content.
12. **Stamp / banner** — solid or angled red callout ("STANDARD", "ENTERPRISE STANDARD").
13. **URL / CTA pill** — bordered rounded pill with link text.

**Data / code (all monospace):**
14. **Mono data block** — bordered box: vector nums `0.42 -0.19…`, `type: metric`, paths.
15. **File-tree listing** — directory tree (`wiki/ index.md revenue.md …`).
16. **Diff block** — green `+ added` / red `- removed` lines.
17. **Search-box mock** — magnifier + query + results line.
18. **Big-stat** — large number with count-up ("9,000+", "$$$", "2 YEARS").

**Icons — line-art set (single-weight ~2px stroke, no fill):**
19. **Icon set** — file, chunk-grid, database cylinder, folder (hero), person, model-face (happy/sad/neutral states), gear, clock, lock, magnifier, checkmark, arrow, funnel, tombstone, trash-bin, git-branch, `</>`, crosshair.

**Edge:**
20. **Connector** — dashed line that draws on; straight or crossing; optional arrowhead. The shared edge for all diagrams.

### Tier 2 — Composed diagrams (built from primitives)
21. **Pipeline / flow** — nodes + draw-on connector + under-node pill labels (the RAG doc→chunks→embed→vectorDB row).
22. **Node-graph / linked cards** — type-tagged cards joined by connectors, incl. crossing many-to-many ("QUERY #3 …AGAIN").
23. **Bar / comparison chart** — vertical bars grow-in; single-dominant-bar-vs-blanks variant ("WILL IT STICK?").
24. **Gauge / dial** — semicircle + animated needle ("what stops it drifting").
25. **Grid-of-cells** — scale/context grid with one highlighted cell + big-stat.
26. **Progress / status bar** — horizontal bar (red STALE / green good) with pill marker ("+1 MONTH").
27. **Mapping table** — two-column rows: label card `→` pill, with arrows.
28. **Timeline dots** — row of dots, some filled amber (commits/steps).
29. **Loop diagram** — labeled nodes on a ring around a center label (from the memory video).

### Tier 3 — Scene templates (recurring full-scene layouts)
30. **Title card** — headline + subtitle + intro flow.
31. **Numbered-section intro** — big number + section title (chapter divider).
32. **Person / authority card** — photo + name + role pills (Karpathy).
33. **Pull-quote scene** — centered quote + attribution.
34. **Full-screen color flash** — solid amber/red emphasis beat / transition.
35. **Outro CTA endcard** — icon + "GET THE HOTTER TAKES" headline + URL pill + "link in description".

### Motion recipes (`recipes.js`)
Reusable GSAP helpers so motion is consistent and cheap-model-generatable: `fadeUp`, `slideIn`, `popIn` (overshoot), `drawOn` (connectors), `countUp`, `staggerIn`. Scenes compose these rather than hand-rolling tweens.

### Scene scaffold (`scaffold/index.html`)
Template a generated scene starts from:
- `<head>` imports `tokens.css`, `atoms.css`, `recipes.js`, GSAP.
- A **`CONTENT` block** (`const DATA = {…}`) — the only place text/values live.
- Markup composed from atoms, reading from `DATA`.
- A **`TIMELINE`** section (GSAP) — the motion. Kept separate so a content-only change never touches motion.
- Hyperframes duration/fps meta.

### Example scenes (`examples/`)
3–4 genuinely different fully-built scenes (title card, loop diagram, gauge, compare-cards) that double as **few-shot references** for the cheap model.

### Verify script (`verify/verify.mjs`)
See §7.

## 6. Per-video workflow

Division of labor: **Opus = kit + plan; Antigravity (parallel) = scene volume; user = review gate.**
Antigravity drives Steps 2 & 4: it generates scenes **concurrently** (many at once, not one-by-one),
then verification runs as a **batch** over the produced set (§7).
(Workflow "Steps" below are within-video stages; not to be confused with project "phase 2" = deferred work in §2/§10.)

**Step 1 — Storyboard (Opus, cheap text).**
Input: the 5-min script. Output: `videos/<slug>/storyboard.md` — ~30 scene specs, each with:
beat / voiceover line → visual metaphor → atoms used → layout sketch → accent color → duration → notes.
User sanity-checks the *plan* here (cheap, text-only) before any pixels.

**Step 2 — Static generation (Antigravity, parallel).**
Antigravity generates the ~30 static `index.html` scenes **concurrently** (final-frame look,
**no motion yet**) using only kit atoms + tokens, starting from the scaffold. Render each to a
still (`stills/`). Assemble into a **contact-sheet gallery** via `serve.mjs`.

**Step 3 — REVIEW GATE (user).**
User flips through the static contact sheet and gives per-scene feedback ("scene 12 metaphor is
off", "recolor 7 to blue"). Iterate on **static only** — cheap. Lock the look.

**Step 4 — Motion pass (Antigravity, parallel).**
Antigravity adds the GSAP `TIMELINE` to each *approved* static scene (in parallel) using
`recipes.js`. Render each to MP4:
`npx hyperframes@latest render videos/<slug>/scenes/sNN-<slug> -o renders/sNN.mp4 --fps 30`.

**Step 5 — Batch verify (local, $0).**
After a generation batch completes, run verify across the **whole batch** at once (§7); collect
the machine-readable failure list; Antigravity does a **fix pass** on just the failing scenes;
re-verify the batch. Repeat until the batch is green.

**Deliverable:** `videos/<slug>/renders/*.mp4` (~30 clips) + the preview gallery.

## 7. Batch verify (checks)

`verify/verify.mjs` accepts **one scene folder or a whole `scenes/` dir** (batch mode). In batch
mode it verifies every scene, prints a per-scene pass/fail table, and writes a machine-readable
failure report (`verify-report.json`: scene → list of failed checks) that Antigravity consumes to
fix only the failing scenes. Per scene it renders and asserts:
1. **Renders** without error at 1920×1080.
2. **Color discipline:** no colors outside the token palette (lint the CSS/inline styles for raw hexes not in `tokens.css`).
3. **Font discipline:** only Anton + JetBrains Mono are used/loaded.
4. **Frame fit:** no content clipped outside the 1920×1080 safe area.
5. **Watermark present.**
6. **hyperframes-helper lint gotchas** pass (run its lint checks).

Exit non-zero if any scene fails; the `verify-report.json` reason list drives Antigravity's batch fix pass.

## 8. Tooling / commands

> **Load-bearing architecture decision (2026-07-01, verified by render):**
> Hyperframes renders a *standalone* composition by serving its **own folder as
> the web root** — external `../kit/…` paths climb above root and 404 (also a
> hard lint error `invalid_parent_traversal_in_asset_path`). To keep the kit
> single-source AND every scene self-contained (no build/inline step), each
> scene folder carries a relative **`kit` symlink** pointing back at
> `hyperframes/kit/`, and references assets root-relatively as `kit/tokens.css`,
> `kit/atoms.css`, `kit/recipes.js`. `@font-face` urls inside `tokens.css`
> resolve relative to that css file, so fonts load through the symlink at any
> depth. `verify.mjs`/`serve.mjs` (and any scaffolder) must ensure this symlink
> exists before render. Proven: `kit/scaffold` renders a pixel-correct frame.

- **Render a scene:** `npx hyperframes@latest render <scene-folder> -o out.mp4 --fps 30` (`--quality high` for 4K). The scene folder must contain a `kit` symlink (see above).
- **Live preview while authoring:** `npx hyperframes@latest preview`.
- **Render-time content injection:** `--variables '{"title":"…"}'` (for same-scene reuse across videos).
- **Gallery / contact sheet:** `node serve.mjs` → localhost (built fresh for this project).
- **Verify (single):** `node verify/verify.mjs <scene-folder>`.
- **Verify (batch):** `node verify/verify.mjs videos/<slug>/scenes` → per-scene table + `verify-report.json`.
- **Skill:** `hyperframes-helper` (recipes, lint gotchas, storyboard templates) + official `hyperframes` skill for authoring/rendering basics.

## 9. Cost model

- **Opus spend:** the kit (one-time) + per-video storyboard (cheap text, ~a paragraph × 30).
- **Cheap-model spend:** all 30 scenes' static + motion code + fix iterations — the volume.
- **Render / verify:** local, $0.
- **Review is visual and early** (static stills), so no motion tokens are spent on a rejected layout.
- **First-video measurement:** record the actual token/$ per scene (via the ccusage dashboard for any Claude spend, and the cheap driver's own metering) to validate the model and decide whether the cheap driver clears the quality bar or whether static-layout falls back to Opus.

## 10. Open decisions (deferred to phase 2)

- Antigravity tuning: how many scenes to generate in parallel and the batch size for verify + fix passes (tune during the first video).
- Final assembly + voiceover (stitch + VO-sync) vs hand clips to the editor.
- Rebrand from the Devsplainers clone to the user's own channel identity (colors/fonts/logo/handle).
- Whether to wire a hosted "paste HTML → MP4" renderer for the editor.

## 11. Success criteria

1. Kit renders all 4 example scenes clean through the verify script.
2. For the supplied 5-min script: a locked static contact sheet the user approves, then ~30 rendered scene MP4s that pass verify.
3. A measured token/$ per scene from the first video, with a clear read on cheap-model quality vs Opus-fallback.

## 12. Milestones

- **M0 — Kit:** built in order — (a) `tokens.css` + self-hosted fonts, (b) Tier-1 primitives + `recipes.js`, (c) Tier-2 composed diagrams, (d) Tier-3 scene templates, (e) `scaffold/` + 4 example scenes, (f) `verify.mjs` + `serve.mjs`; all examples pass verify. (Opus)
- **M1 — Storyboard:** `storyboard.md` (~30 specs) from the user's script; user sanity-checks. (Opus)
- **M2 — Static + review:** static scenes generated, contact sheet served, user locks the look. (cheap model + user)
- **M3 — Motion + render:** timelines added, ~30 MP4s rendered and passing verify; token/$ measured. (cheap model)
