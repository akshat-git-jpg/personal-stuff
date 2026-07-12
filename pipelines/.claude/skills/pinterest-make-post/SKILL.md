---
name: pinterest-make-post
description: Turn one pin idea into a finished, ready-to-post Pinterest pin — a 1000x1500 image plus title, description, alt text, hashtags, board, best time, and offer link. Reads the niche folder (pipelines/pinterest/<niche>/) and saves image.png + post.md into <niche>/posts/<slug>/. Triggers on "make a pinterest pin", "make a keto pin", "create a pin for this idea", "pinterest-make-post", "generate a pin", "turn this idea into a pin".
user-invocable: true
metadata:
  author: kbtg
  version: 1.2.0
---

# pinterest-make-post

Produce ONE finished, ready-to-post Pinterest pin from an idea the user gives you. The user
posts manually, so your output must be complete: a catchy image + copy they can paste in.

This skill is the **machine**. The per-niche folder is the **recipe card**. One machine,
many niches — never hard-code niche facts here; read them from the niche folder.

> **READ FIRST — every run:** `~/codebase/personal-stuff/pipelines/pinterest/PINTEREST-PRINCIPLES.md`. It holds the
> non-negotiable Pinterest rules (search-engine mindset, keyword/alignment rules, the 4 click
> triggers, image + mistakes-to-avoid). Your title, image, and copy decisions below MUST follow
> it. If a request conflicts with it, flag the conflict.

## Inputs

- **The idea** — from the user's message (e.g. "7 high-protein keto breakfasts") or a line
  they point you to.
- **The niche** — usually in the idea ("keto pin"). Maps to a project folder:
  `~/codebase/personal-stuff/pipelines/pinterest/<niche>/` (the project lives in the pipelines folder).
  If the niche folder doesn't exist yet, ask the user before creating one.

Read both niche files before doing anything else:
- `config.json` — brand palette/fonts, `offerUrl`, `handle`, `boards`.
- `playbook.md` — voice, hooks that sell, example titles, image vibe, keywords, do/don'ts.

## One-time setup (check every run, install only if missing)

The renderer needs Playwright + Chromium installed inside THIS skill folder. Let
`SKILL_DIR` = the directory containing this SKILL.md. If `SKILL_DIR/node_modules` is absent:

```bash
cd "<SKILL_DIR>" && npm install && npx playwright install chromium
```

Optional: a free `PEXELS_API_KEY` in `~/.zshrc` enables the stock-photo backdrop layer.
Without it, CSS and AI backdrops still work; stock silently falls back to a CSS gradient.

## Process

### 1. Art-direct (decide the look) — choose ONE template

The set of templates is a **growing library** — see `templates/CATALOG.md` for the current
list, what each is for, and its exact data contract. If none fit the idea or the user pastes
an inspiration image, build a NEW template and bank it (see "Creating a new template" below).

| Template | Use when the idea is… | Backdrop that fits |
|---|---|---|
| `listicle` | a list / "N things" / tips roundup | CSS gradient (default) or dark food photo |
| `photo-bar` | one hero dish / "this recipe" | a real food photo (stock) — strongest here |
| `free-guide` | the lead magnet / "free plan/download" | CSS gradient (keeps it clean) |
| `recipe-card` | a single shareable recipe w/ stats | food photo (stock) or color block |
| `weekly-grid` | a multi-cell plan/calendar (e.g. 7-day meal plan) | one image PER cell — see imagery note |

### 2. Choose the backdrop layer (per pin, guided by playbook image vibe)

- **CSS gradient** (`{"type":"css"}`) — most on-brand, always free. Default for listicle &
  free-guide and any typographic pin.
- **Stock photo** (`{"type":"stock","query":"..."}`) — real appetizing food. Best for
  photo-bar / recipe-card. Needs `PEXELS_API_KEY`. Write a concrete query (dish + "natural
  light", "overhead", "rustic").
- **AI image** (`{"type":"ai","prompt":"..."}`) — keyless via Pollinations. Use for
  backgrounds/mood, NOT close-up dishes (AI food looks fake). Write a descriptive prompt.

If you want to eyeball stock candidates first:
`node "<SKILL_DIR>/lib/stock.mjs" "keto breakfast eggs avocado natural light"`

**Multi-image templates (e.g. `weekly-grid`): match the image source to the cell count.**
`render.mjs` pre-fetches each cell image to `<postdir>/cells/` in concurrent batches, but
many live AI generations are SLOW and flaky. Guidance by cell count:
- **≤ ~8 cells:** AI per cell is fine (Pollinations).
- **> ~10 cells (e.g. a 28-cell weekly plan):** prefer **stock** or **user-supplied photos**
  (set each `cell.img` to a URL or local path) over live AI — far faster and more reliable.
  If you do use AI, warn the user it takes a few minutes and may leave a few cells blank.
  Already-downloaded cells are reused on re-run, so a second pass fills the gaps cheaply.

### 3. Write the copy (in the niche's voice, using playbook hooks & keywords)

- **title** — the on-image headline. Short, punchy, benefit/number-driven. ≤ ~7 words.
- **subtitle / badge** — optional eyebrow (e.g. "Under 10g carbs", "FREE GUIDE").
- **items** — for `listicle` only: 5–7 short entries.
- **meta** — for `recipe-card` only: 2–4 stat chips (e.g. "12g protein", "5 min").
- **description** — the Pinterest caption: 2–4 keyword-rich sentences + a CTA. Weave in
  playbook keywords naturally.
- **alt** — one plain descriptive sentence of the image (accessibility + SEO).
- **hashtags** — **3–5** specific, relevant tags.

Follow the **Copywriting spec** in `PINTEREST-PRINCIPLES.md` exactly (title ≤100 chars w/ front-loaded
keyword, description 150–400 chars + CTA, 3–5 hashtags, alt ≤500, keyword aligned across all fields).
- **board** — pick the best-fit board from `config.boards`.
- **best_time** — suggest a strong Pinterest slot (e.g. "Sat 8–11pm", "weekday 8–10pm").
- **link** — `config.offerUrl`.

Respect playbook **do/don'ts** (e.g. no medical claims). If the user edited a title, keep it.

### 4. Build the spec and render

Write a temp spec file (use the job tmp dir or the post folder), then render:

```json
{
  "template": "listicle",
  "out": "/Users/kbtg/codebase/personal-stuff/pipelines/pinterest/keto/posts/<slug>/image.png",
  "data": {
    "title": "7 High-Protein Keto Breakfasts",
    "subtitle": "Under 10g carbs",
    "items": ["Egg & bacon muffins", "Avocado baked eggs", "..."],
    "badge": "",
    "handle": "@yourketohandle",
    "palette": ["#1B4332", "#FFB703", "#FFFFFF"],
    "headlineFont": "Poppins",
    "bodyFont": "Inter",
    "background": { "type": "css" }
  }
}
```
- `palette`, `headlineFont`, `bodyFont`, `handle` come from `config.json` (`brand` + `handle`).
- `<slug>` = date + kebab title, e.g. `2026-06-02-7-high-protein-keto-breakfasts`.

```bash
node "<SKILL_DIR>/render.mjs" "<spec.json path>"
```

The image lands at `data.out`. (You'll do a real review next — don't declare done yet.)

### 5. Critique gate (Layer 2 — independent critic) — REQUIRED before the board

Never ship a pin on your own say-so. Spawn an **independent critic subagent** (Agent tool) so a fresh
perspective grades it. Give the subagent this prompt:

> Read `<SKILL_DIR>/CRITIC.md` and follow it exactly. Review this pin:
> - image: `<data.out PNG path>`
> - copy: `<post dir>/post.json` (or the spec data if not written yet)
> - brief: `<the idea>`
> - niche playbook: `<niche>/playbook.md`; principles: `~/codebase/personal-stuff/pipelines/pinterest/PINTEREST-PRINCIPLES.md`
> - benchmark (if from research): top competitor pin for this keyword — image `<url/path>`, `<saves>/mo`
> Return ONLY the CRITIC.md verdict JSON.

Act on the verdict: **SHIP** → write the post package (step 6). **FIX** → apply the listed fixes,
re-render, re-critique (**max 2 rounds**). **REGENERATE** → rebuild with a different template/angle,
re-critique. Still not SHIP after 2 rounds → **do NOT mark ready**; save it but flag it to the user
with the critic's reason (so junk never silently reaches the board). (Batch = one critic per pin in
parallel via a Workflow + a batch report; same CRITIC.md.)

### 6. Write the post package

Save `post.md` next to the image:

```markdown
# <title>

- **Image:** image.png (1000x1500, 2:3)
- **Board:** <board>
- **Link:** <offerUrl>
- **Best time to post:** <best_time>

## Title
<title>

## Description
<description>

## Alt text
<alt>

## Hashtags
<#tag1 #tag2 ...>
```

Also write a machine-readable `post.json` next to it (the pinterest-board cockpit reads this
for clean per-field Copy buttons):

```json
{
  "title": "<title>",
  "description": "<description>",
  "altText": "<alt>",
  "hashtags": "<#tag1 #tag2 ...>",
  "board": "<board>",
  "link": "<offerUrl>",
  "bestTime": "<best_time>",
  "template": "<template>",
  "createdDate": "<YYYY-MM-DD>"
}
```

Also write **`notes.md`** next to it — the rationale record (why this pin is a choice), so the user
never has to reverse-engineer the thinking:

```markdown
# Why this pin — <title>

## Why the topic will perform
<the data: format proof + the benchmark competitor pin & its saves/velocity>

## Why the keywords are good
<target keyword phrase + why (demand / specificity / alignment), + the related keywords in the description>

## Why the critic approved it (Layer 2 verdict)
<SHIP — the critic's one-line reason + dimensions passed; if FIX/REGEN happened, what changed before it passed>

## Source
<the research brief / scan file this idea came from>
```

Pull topic/keyword rationale from the research brief; pull approval rationale from the critic verdict (step 5).

### 7. Report

Tell the user the folder path, show the title/description, the **critic verdict** (SHIP, or flagged +
why), and remind them: upload `image.png` to Pinterest and paste the fields from `post.md`. Do NOT
post anywhere yourself.

## Creating a new template from an inspiration image (growing the library)

When no existing template fits, or the user pastes an **inspiration pin** and says "make one
like this," build a NEW reusable template — don't force the content into a wrong layout.

1. **Analyse the inspiration.** Read the image. Describe its structure out loud: sections
   (header, body blocks, footer), grid/columns, where text vs. images go, color roles,
   brand placement, CTA. Separate **layout** (structure) from **imagery** (what fills it).
2. **Clone it as HTML/CSS** into `<SKILL_DIR>/templates/<new-name>.html`, following the
   conventions of the existing templates:
   - Root element `#pin`, width `1000px`, height fixed (`1500`) or natural (tall infographics).
   - Read all content from `window.PIN = __PIN_DATA__;` in an inline `<script>`; apply
     `--hf`/`--bf` fonts (load Google Fonts) and palette CSS vars from `P`.
   - Put copy in **HTML text** (stays crisp/correct), not baked into images.
   - For per-cell images, set `background-image`/`<img>` from a URL or local path in the data.
3. **Render & iterate.** Write a spec, run `render.mjs`, Read the PNG, fix overflow/spacing,
   re-render until it matches the inspiration.
4. **Bank it.** Add a row to `templates/CATALOG.md` (name, when to use, data contract). It's
   now a permanent reusable style — usable across all niches. The template ships in the skill
   (git-able/portable), the niche folders stay data-only.

This is the sustainable model: don't pre-build every style — clone novel ones on demand and
bank them, so the library grows from real inspiration. Refactor shared pieces (brand header,
badge, CTA-footer, cells) into partials only once several templates repeat them.

## Notes

- Output PNG is rendered at 2x (2000x3000, still 2:3) for crispness — Pinterest accepts this.
- Everything is free; the only optional paid-tier-free key is Pexels.
- Adding a new niche = create `pipelines/pinterest/<niche>/config.json` + `playbook.md`. The skill
  is unchanged.
