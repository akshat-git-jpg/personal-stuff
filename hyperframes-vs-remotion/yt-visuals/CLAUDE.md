# yt-visuals — cutaway video generator (Remotion)

Generates the **full-screen cutaway clips** for a comparison video — title cards, table of contents, section dividers, comparison tables, pricing bar charts, verdict cards, and CTA / discount-code cards. Each cutaway renders as its own lossless MP4 that the video editor drops onto their NLE timeline next to the tutorial-maker's screen recording.

The screen recording remains the primary content (whoever is showing the actual UI). These cutaways replace the recording during transitions, comparisons, and other "explainer" moments.

## v1 scope

- Big + Small comparison videos only.
- 7 cutaway templates: title, toc, section, comparison, pricing, verdict, cta.
- Single Apple-Pro visual identity (deep black + restrained purple gradient, refined typography).
- Other video categories (Demo, How-to, Pricing, Discount) are post-v1.

## Pipeline

```
yt-research/niches/<slug>/output/knowledge-base-compact.md  ─┐
yt-script/scripts/<slug>/script.md                          ─┼─►  Claude  ──►  plans/<slug>/plan.json
                                                            ─┘                       │
                                                                                     ▼
                                                                 node scripts/render-plan.mjs
                                                                                     │
                                                                                     ▼
                                                              cutaways/<slug>/01-title.mp4 ... 07-cta.mp4
                                                                              + 00-preview-all.mp4 (stitched)
                                                                              + shot-notes.md
```

## Run

From this folder:

```bash
# Render every scene in a plan
node scripts/render-plan.mjs plans/<slug>/plan.json

# Render specific types only (skip the rest)
node scripts/render-plan.mjs plans/<slug>/plan.json --only=pricing,verdict

# Skip the stitched preview reel
node scripts/render-plan.mjs plans/<slug>/plan.json --no-preview

# Render PNG stills (visual review only — not for the editor)
node scripts/render-stills.mjs plans/<slug>/plan.json

# Open Remotion Studio to iterate on a single template visually
NPM_CONFIG_USERCONFIG=/dev/null npx remotion studio
```

> Use `NPM_CONFIG_USERCONFIG=/dev/null` on any `npm`/`npx` command from this folder if the global `~/.npmrc` has a stale Zluri CodeArtifact token (causes 401s on public packages).

## Layout

```
yt-visuals/
├── CLAUDE.md                         # this file
├── package.json                      # Remotion 4.x + zod + @remotion/google-fonts
├── remotion.config.ts                # Studio + bundle config (no Tailwind)
├── tsconfig.json
├── src/
│   ├── index.ts                      # registerRoot entry
│   ├── Root.tsx                      # all 7 compositions + the Preview reel
│   ├── schema.ts                     # Zod schemas — the contract for plan.json
│   ├── design/
│   │   ├── theme.ts                  # Apple-Pro tokens: colors, type, motion, durations
│   │   ├── font.ts                   # Inter loaded as SF-Pro substitute
│   │   └── primitives.tsx            # ApplePro background, FadeSlideIn, NumberTicker, GrowingBar, Eyebrow, Hairline
│   └── templates/
│       ├── TitleCard.tsx
│       ├── TableOfContents.tsx
│       ├── SectionDivider.tsx
│       ├── ComparisonTable.tsx
│       ├── PricingBars.tsx
│       ├── Verdict.tsx
│       └── CtaDiscount.tsx
├── plans/
│   └── <slug>/
│       └── plan.json                 # which scenes, what content (Claude writes this)
├── scripts/
│   ├── render-plan.mjs               # plan.json → folder of MP4s + preview reel + shot-notes.md
│   └── render-stills.mjs             # plan.json → PNGs at the "settled" frame of each scene (review only)
└── cutaways/                         # gitignored — render outputs
    └── <slug>/
        ├── 00-preview-all.mp4
        ├── 01-title.mp4 ... 07-cta.mp4
        ├── shot-notes.md
        └── stills/
```

## plan.json shape

Defined and validated by `src/schema.ts` (Zod). Each scene is a discriminated union by `type`. See `plans/n8n-hosting/plan.json` for a full example, or read the schema directly — types are exported.

```json
{
  "slug": "n8n-hosting",
  "title": "Best n8n Self-Hosting in 2026",
  "scenes": [
    { "type": "title", "data": { ... } },
    { "type": "toc", "data": { ... } },
    { "type": "section", "data": { "number": "04", "title": "The Winners" } },
    { "type": "comparison", "data": { "tools": ["A","B"], "rows": [...], "winnerColumn": 0 } },
    { "type": "pricing", "data": { "items": [{ "label":"A", "value":8.99, "winner":true }] } },
    { "type": "verdict", "data": { "winner": "...", "reason": "..." } },
    { "type": "cta", "data": { "code": "AGROLLOO", "discount": "...", "cta": "..." } }
  ]
}
```

## Writing a plan.json (for Claude)

When the user says **"make a video plan for niche `<slug>`"**:

1. Read `../yt-research/niches/<slug>/output/knowledge-base-compact.md`.
2. Read `../yt-script/scripts/<slug>/script.md`.
3. Identify the cutaway moments in the script — opening hook (→ `title`), the "in this video" intro (→ `toc`), each major section break (→ `section`), each side-by-side comparison (→ `comparison`), each pricing reveal (→ `pricing`), each winner declaration (→ `verdict`), and the affiliate CTA near the outro (→ `cta`).
4. Pull prices, tool names, features, and the verdict **verbatim** from the KB. Don't invent.
5. Write the JSON to `plans/<slug>/plan.json`. Match the schema in `src/schema.ts`.

Once the JSON exists, the user (or you) runs `node scripts/render-plan.mjs plans/<slug>/plan.json`. The folder of MP4s is then handed to the video editor.

## Visual identity (Apple Pro)

Tokens in `src/design/theme.ts`. Notable choices:

- Background: radial gradient from indigo `#1e1b4b` → near-black `#0a0a0f`.
- Single restrained accent: purple `#a78bfa` → indigo `#6366f1` gradient.
- Type: Inter at refined weights (300/400/500/600/700). Tabular numerals for prices and rankings (`fontFeatureSettings: '"tnum"'`).
- Motion: strong ease-out `Easing.bezier(0.16, 1, 0.3, 1)` for entrances. Default 28-frame fade-and-slide-up per element, 6-frame stagger between siblings.
- Heavy negative space — `framePadding: 140px`.

## Where this fits in the TY repo

- **Inputs are read from `../yt-research/` and `../yt-script/`.**
- **Output is consumed by the video editor**, not by any TY script.
- **No new sheets, no D1, no KV.** This sub-project doesn't touch Google Sheets or Cloudflare — those belong to `yt-analysis/`.
- **Single git repo (TY).** Like `yt-research/` and `workers/redirector/`, this folder has its own `package.json` + `node_modules` because npm expects them here. It does NOT have its own `.npmrc` or `.gitignore` — those live at the TY root.
