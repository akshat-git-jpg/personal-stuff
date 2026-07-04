# yt-visuals — current state & session handoff

A working note for future Claude sessions. Read this first when resuming work in this folder.

Last updated: 2026-05-28.

## At a glance

A Remotion-based cutaway-video generator for the user's YouTube affiliate comparison channel. Reads a per-video `plan.json` and renders each scene as its own MP4 that the editor drops onto their NLE timeline next to the tutorial-maker's screen recording. The rendered output for the example video lives at `cutaways/n8n-hosting/`.

The system is mid-iteration. The full 7-template pipeline runs end-to-end with the warm-amber design system. Multiple motion variants per slot are built and rendered for the user to compare; only the section divider has a locked-in winner so far.

## Design system

**Warm-amber palette** (defined in `src/design/theme.ts`). Pivoted from an earlier Apple-Pro purple system after the user shared reference screenshots from Tina-Huang-style AI YouTube channels.

| Token | Value | Notes |
|---|---|---|
| `bgGradientFrom` | `#3a1f08` | deep burnt-amber tint |
| `bgGradientTo` | `#0a0805` | near-black, warm undertone |
| `accentFrom` | `#fb923c` | bright orange |
| `accentTo` | `#c2410c` | burnt orange |
| `accentSolid` | `#fb923c` | primary accent |
| `accentGlow` | `rgba(251,146,60,0.45)` | text-shadow, glow halos |
| `win` | `#facc15` | gold — used for winner highlights & "WINNER" eyebrows |
| `cross` | `rgba(255,239,219,0.22)` | dim warm-white |
| `textPrimary` / `textSecondary` / `textTertiary` | warm-tinted whites | for tonal cohesion |

To pivot the entire system to a different palette, edit `theme.ts` and re-render. Every template + variant reads from these tokens.

**Typography:** Inter (loaded via `@remotion/google-fonts/Inter` in `src/design/font.ts`) as SF Pro Display substitute. Tabular numerals for prices & rankings via `fonts.tabular`.

**Motion language:** strong ease-out for entrances (`Easing.bezier(0.16, 1, 0.3, 1)`), elastic spring overshoot for celebratory pops (e.g., the verdict title, badges, chips). Continuous subtle motion encouraged during long holds — drifting particles, breathing gradients, gentle chip bob — never enough to distract from words.

## Production templates (the 7 currently shipped)

Each renders to `cutaways/<slug>/0N-<name>.mp4`. All read from `src/schema.ts` Zod types.

| File | Component | Notes |
|---|---|---|
| `01-title.mp4` | `templates/TitleCard.tsx` | Heading + 6+6+3 grid of brand-colored logos on white chips. No eyebrow, no subtitle, no VS separator (user removed). |
| `02-toc.mp4` | `templates/TableOfContents.tsx` | "In this video" + numbered list. Items stagger-reveal. |
| `03-section.mp4` | `templates/SectionDivider.tsx` re-exports `SectionDividerD` from `SectionDividerVariants.tsx` | **Locked-in winner: Particle Storm.** Light streaks + drifting particles + elastic-pop title + pulsing accent line. 5s. |
| `04-comparison.mp4` | `templates/ComparisonTable.tsx` | Original table layout, header + hairline + row reveal + winner column accent. Variants built but no winner picked. |
| `05-pricing.mp4` | `templates/PricingBars.tsx` | Bars grow + numbers count up. Winner glow. |
| `06-verdict.mp4` | `templates/Verdict.tsx` | Winner name in gradient + reason. Variants built (trophy/report-card/badges) but no winner picked. |
| `07-cta.mp4` | `templates/CtaDiscount.tsx` | Discount code in orange gradient + bobbing arrow toward description. |

Plus `00-preview-all.mp4` — stitched reel of all 7 back-to-back. Used for quick scrubbing only; editor drops the individual MP4s onto the timeline.

## Variants built (mockups for user to compare — not in production)

All rendered with the current warm-amber palette. Located under `cutaways/n8n-hosting/<slot>-variants/`. Composition IDs in Studio (Root.tsx) still use legacy `TitleA`/`ComparisonSurvival`/etc. — filenames have been renamed to descriptive slugs.

### Title (3 variants — `title-variants/`)
- `title-storm-pop.mp4` — particles + light streaks + elastic title pop + spring chips. Matches section D's vibe.
- `title-aurora-wave.mp4` — continuous aurora gradients + a vertical light bar sweeps L→R revealing chips. Title gradient shimmer.
- `title-cinematic-float.mp4` — breathing backdrop + lens vignette + chips bob continuously at offset phases.

### Section (3 variants — `section-variants/`)
- `section-counter-scale.mp4` — Variant B. Number flickers `00→01→02→03→04` then scales down; progress dots ripple in.
- `section-card-flip.mp4` — Variant C. Card flies in with rotateX, lands with spring bounce, gentle float.
- `section-particle-storm.mp4` — **Variant D, SHIPPED to production.** Particles + streaks + elastic title.

### Comparison (7 variants — `comparison-variants/`)
**Storm/aurora/spotlight style (motion-only, same layout):**
- `comparison-storm-cascade.mp4` — A. Storm + cell-by-cell stagger.
- `comparison-light-scan.mp4` — B. Light bar scans top→bottom revealing rows.
- `comparison-spotlight.mp4` — C. Calm reveal + winner column gets a continuous spotlight.

**Structural reformats (different layout from a standard table):**
- `comparison-survival.mp4` — Start with 15 platforms, eliminate via criteria, 4 survive with glow. *Matches the script's elimination narrative.*
- `comparison-bracket.mp4` — 4 tools → 2 → 1 (gold champion). Tournament tree.
- `comparison-radar.mp4` — 4 multi-axis spider shapes (setup/price/perf/support/scale/ease) draw sequentially.
- `comparison-tier-list.mp4` — S/A/B/C/F tier rows, S-tier glows gold. Most "YouTube-native" — matches the channel's affiliate ranking style.

### Verdict (3 variants — `verdict-variants/`)
- `verdict-trophy.mp4` — Trophy emoji drops in with spring + confetti falls + gold glow on winner card.
- `verdict-report-card.mp4` — Letter grade "A+" in gold gradient + 6 sub-grades (Setup A+, Price A+, etc.) in glass card.
- `verdict-badges.mp4` — Big logo card on left + 5 achievement-badge chips popping in on the right (BEST PRICE, FASTEST SETUP, BUILT FOR N8N, 24/7 SUPPORT, PRODUCTION READY).

## The 5 verdict options NOT YET BUILT

User narrowed verdict to 1/6/8 (rendered) from a menu of 8. The other 5 remain available as candidates if the user wants to try them:
- **2. Magazine Cover Layout** — split 50/50, brand-color block left + editorial type right.
- **3. Versus Face-Off (KO)** — two contenders, loser dims with strikethrough, winner scales up.
- **4. Passport Stamp ("APPROVED")** — round green stamp slams in at an angle.
- **5. BIG NAME (typography hero)** — massive winner name in gradient. "iPhone 17." energy. *My recommended pick for the channel's design system.*
- **7. Spotlight on Stage** — black stage, theatrical spotlight cone, winner slides up into the light.

## Active decisions

| Decision | Status |
|---|---|
| Cutaway format (full-screen MP4, not overlays) | ✅ locked |
| Editor's role (picks which cutaways to use, with `shot-notes.md` as guidance) | ✅ locked |
| v1 scope (Big + Small comparison videos only) | ✅ locked |
| v1 template list (the 7 above) | ✅ locked |
| Visual identity | ✅ warm-amber. Was Apple-Pro purple → user pivoted. |
| Title card layout | ✅ heading + 6+6+3 chip grid, no eyebrow/subtitle/VS |
| Section divider variant | ✅ Particle Storm (D) |
| Title card motion variant | ⏳ pending — 3 built |
| Comparison variant | ⏳ pending — 7 built. Strongest candidates per the user's video style: Survival (matches elimination narrative) or Tier List (matches affiliate-ranking format) |
| Verdict variant | ⏳ pending — 3 built (Trophy / Report Card / Badges). 5 more available unbuilt. |
| Whether to commit anything yet | ❌ NOT committed — user explicitly said wait until they're satisfied with output |

## Repo touchpoints

```
youtube/yt-visuals/
├── CLAUDE.md                              # static folder guide
├── STATUS.md                              # this file
├── package.json
├── remotion.config.ts
├── tsconfig.json
├── src/
│   ├── index.ts                           # registerRoot
│   ├── Root.tsx                           # ALL compositions — production + variants
│   ├── schema.ts                          # Zod schemas — plan.json contract
│   ├── design/
│   │   ├── theme.ts                       # colors, type, motion, durations — single source of truth
│   │   ├── font.ts                        # Inter via @remotion/google-fonts
│   │   ├── primitives.tsx                 # ApplePro background, FadeSlideIn, NumberTicker, GrowingBar, Eyebrow, Hairline
│   │   └── effects.tsx                    # Streaks, Particles, AuroraBlobs, LensVignette, BreathingBackdrop (shared)
│   └── templates/
│       ├── TitleCard.tsx                  # production
│       ├── TableOfContents.tsx            # production
│       ├── SectionDivider.tsx             # re-exports SectionDividerD (variant D)
│       ├── ComparisonTable.tsx            # production
│       ├── PricingBars.tsx                # production
│       ├── Verdict.tsx                    # production
│       ├── CtaDiscount.tsx                # production
│       ├── TitleCardVariants.tsx          # 3 title variants (A/B/C)
│       ├── SectionDividerVariants.tsx     # 3 section variants (B/C/D — D is exported as production)
│       ├── ComparisonTableVariants.tsx    # 3 motion-style comparison variants (A/B/C)
│       ├── ComparisonNewVariants.tsx      # 4 structural comparison variants (Survival/Bracket/Radar/TierList) — hardcode n8n-hosting data internally
│       └── VerdictVariants.tsx            # 3 verdict variants (Trophy/ReportCard/Badges) — hardcode extra mockup data
├── plans/
│   └── n8n-hosting/
│       └── plan.json                      # smoke-test plan (real script + KB)
├── public/
│   └── logos/                             # 15 brand SVG logos (Simple Icons + Devicon)
├── scripts/
│   ├── render-plan.mjs                    # main: plan.json → /cutaways/<slug>/{01-...07-*}.mp4 + preview reel + shot-notes.md
│   ├── render-stills.mjs                  # plan.json → PNG stills (for visual review)
│   └── fetch-logos.mjs                    # downloads brand logos from registry (--from-plan or by name)
└── cutaways/
    └── n8n-hosting/                       # (gitignored) rendered outputs
        ├── 00-preview-all.mp4
        ├── 01-title.mp4 ... 07-cta.mp4
        ├── shot-notes.md
        ├── stills/                        # PNG stills per template
        ├── title-variants/
        ├── section-variants/
        ├── comparison-variants/
        └── verdict-variants/
```

## How to run things

Always use `NPM_CONFIG_USERCONFIG=/dev/null` to bypass the global `~/.npmrc` (it has an expired Zluri CodeArtifact token that 401s on public packages).

```bash
cd youtube/yt-visuals

# Render the production 7 cutaways + preview reel for a plan
NPM_CONFIG_USERCONFIG=/dev/null node scripts/render-plan.mjs plans/n8n-hosting/plan.json

# Render just one scene type
NPM_CONFIG_USERCONFIG=/dev/null node scripts/render-plan.mjs plans/n8n-hosting/plan.json --only=title --no-preview

# Render PNG stills (review only, not for editor)
NPM_CONFIG_USERCONFIG=/dev/null node scripts/render-stills.mjs plans/n8n-hosting/plan.json

# Render any variant by composition ID and props
NPM_CONFIG_USERCONFIG=/dev/null npx remotion render src/index.ts <CompositionId> <output.mp4> --codec=h264 --props='<JSON>'

# Studio (browser-based, scrubber + live prop editing)
NPM_CONFIG_USERCONFIG=/dev/null npx remotion studio

# Fetch brand logos for a plan
node scripts/fetch-logos.mjs --from-plan plans/<slug>/plan.json

# Open any rendered MP4 (Mac)
open cutaways/n8n-hosting/00-preview-all.mp4
open cutaways/n8n-hosting/section-variants/section-particle-storm.mp4
```

## Pipeline (where this fits in TY)

```
yt-research/niches/<slug>/output/knowledge-base-compact.md  ─┐
yt-script/scripts/<slug>/script.md                          ─┼─►  Claude  ──►  plans/<slug>/plan.json
                                                            ─┘                       │
                                                                                     ▼
                                                                 node scripts/render-plan.mjs
                                                                                     │
                                                                                     ▼
                                                              cutaways/<slug>/01-title.mp4 ... 07-cta.mp4
                                                                              + 00-preview-all.mp4
                                                                              + shot-notes.md
```

The user (or future Claude) writes the `plan.json` for new videos by reading the niche's compact KB + final script. Plans match the Zod schema in `src/schema.ts`.

## What the user is likely to do next

Pulled from the message that triggered this doc: *"I will continue making more variants, experimenting with color, making more video parts, etc."*

Likely directions:
- **More color experiments.** Edit `theme.ts` and re-render — palette pivots already worked (Apple-Pro → warm-amber). Easy to try: deep blue + amber, monochrome with single accent, full color brand-matched theme.
- **More variants per existing slot.** Particularly likely for title, comparison, verdict — those have visible motion design but no winner picked. Variants files follow the same pattern: build the component, register a composition in `Root.tsx`, render via the variant compositions in Studio or shell.
- **New slide types** (post-v1 scope). Demo, How-to, Pricing tiers, Discount/coupon dedicated slides — each needs its own template + schema entry + Composition in Root.tsx + an example in plan.json.
- **Per-video plan.json generation.** Currently `plans/n8n-hosting/plan.json` was hand-written. Future: a script that reads `yt-research/<slug>/knowledge-base-compact.md` + `yt-script/<slug>/script.md` and emits a plan.json (Phase 2-style automated workflow). Not built yet.

## Open issues / things to watch

- **Variant composition IDs are still letters/legacy slugs** (`TitleA`, `ComparisonSurvival`, `VerdictTrophy`). File names are now descriptive but Studio sidebar still shows old IDs. Renaming would touch Root.tsx, the variant files' exports, and any render commands.
- **`ComparisonNewVariants.tsx` hardcodes the n8n-hosting platform data** (which platforms are in the Survival grid, who wins the Bracket, the radar scores, the tier-list assignments). If a winner is picked here, that data needs to be extracted into the schema so it works for any niche.
- **`VerdictVariants.tsx` hardcodes mockup extras** (the sub-grades for ReportCard, the 5 badges for Badges, the trophy emoji). Same extraction needed if picked.
- **Render-plan.mjs has no way to render variants.** Only production compositions go through it. Variants are rendered by direct `npx remotion render` calls with explicit composition ID and props (see "How to run things"). If a variant gets promoted to production, swap the production template's export to point at the chosen variant (like SectionDivider.tsx does for D).
- **No commits have happened.** The user explicitly said to wait until they're satisfied. When they say to ship, use the **github-router** skill — this is a personal project (TY), NOT Zluri/work.
- **Brand logos cover most major platforms** via Simple Icons (free, brand-colored SVGs). Heroku, AWS, Oracle use Devicon fallback (Simple Icons dropped them for trademark reasons). New platforms in new plans need a one-time `fetch-logos.mjs` run — registry lives in that script.

## Quick mental model for "where do I touch?"

| Want to... | Touch |
|---|---|
| Change colors/typography across everything | `src/design/theme.ts` |
| Change a production template's design | `src/templates/<Name>.tsx` |
| Try a new motion variant | Add to the right `<Slot>Variants.tsx` + register a Composition in `Root.tsx` |
| Promote a variant to production | Change the production `<Slot>.tsx` to re-export the variant (see `SectionDivider.tsx`) |
| Make a new video | Write `plans/<slug>/plan.json`, run `fetch-logos.mjs --from-plan ...`, then `render-plan.mjs ...` |
| Add a brand-new slide type | Add Zod schema + new template + new Composition in Root.tsx + extend `render-plan.mjs`'s TYPE_TO_COMP mapping + add it to plan.json |
