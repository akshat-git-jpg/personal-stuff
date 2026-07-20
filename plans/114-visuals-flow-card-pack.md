<!-- boss frontmatter -->
---
executor: claude-p
model: opus
test_cmd: bash pipelines/video/card-library/scripts/check-cards.sh
ui:                      # blank — ui:true screenshot gate removed 2026-07-18 (decisions.md). Visual QC = executor render+inspect (boss rules.md rider) + owner eyeball vs the per-card rubrics below.
deploy:                  # none — cards go live when merged to main (VPS repo-sync cron pulls every ~15 min); no deploy command.
needs: []
---

# Plan 114: visuals-flow card pack — prompt-typing, tool-icon hero, kinetic statement, icon-pill list (+ reusable icon set)

## Summary

- **Problem statement**: Four new motion-graphics cards are wanted for the card library (from owner reference frames): a "Prompt" panel that types itself out, a glassy tool app-icon hero, a centered kinetic statement with a highlighted keyword, and a neon icon+pill list. None exist today, and there is no generic (non-brand-logo) icon source for list rows.
- **Goals**:
  - Add 4 new Hyperframes cards under `pipelines/video/card-library/`, each in **our brand theme** (burnt-amber bg + orange accent + Inter — DESIGN.md), each token-themeable via `:root` (a green/other re-skin is a `:root` edit, motion untouched).
  - Introduce a small **reusable inline-SVG icon set** (named generic icons) so list-style cards can show concept icons without brand logos.
  - Register all 4 in `catalog.json` (so the cue pass can select them) and pin them in `gallery-order.json`.
  - Card 1 (`prompt/prompt-typing`) is **already authored** — its full HTML is inlined below verbatim; the executor places it and verifies. Cards 2–4 are specified with structure, motion, catalog entry, and a per-card visual rubric.
- **Executor proposed**: `claude-p` / Claude **Opus** — novel card authoring is Opus-class per HANDOFF.md model routing; visual/taste output.
- **Done criteria** (terse — full list below): `bash pipelines/video/card-library/scripts/check-cards.sh` exits 0 (all 4 cards shaped + in catalog + nothing untracked); `npx hyperframes@latest lint` passes (2 known warnings OK) for each; each card renders a frame that meets its rubric.
- **Stop conditions** (terse): a card overflows its frame at declared capacity; the icon set can't render an icon deterministically; a card needs a hue outside the palette to work (that's a design decision — stop and report).
- **Test / verification for success**: structural `check-cards.sh` (merge gate) + per-card `hyperframes lint` + executor renders a midpoint frame and inspects it against the inlined rubric (boss render+inspect rider).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. Author each card by
> COPYING the nearest existing card and following DESIGN.md + HYPERFRAMES.md —
> never touch the shared TIMELINE motion feel of other cards. If anything in
> "STOP conditions" occurs, stop and report. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 35aeff4..HEAD -- pipelines/video/card-library`

## Status

- **Priority**: P2
- **Effort**: L (4 cards + icon set)
- **Depends on**: none
- **Risk**: MED — all-additive (new folders + catalog rows), but visual/taste output that needs render+inspect; the icon set is the one novel shared asset.
- **Category**: feature
- **Difficulty**: tricky (visual taste; novel cards — Opus per HANDOFF)
- **Planned at**: commit `35aeff4`, 2026-07-21

## Why this matters

The card library is the visual vocabulary the visuals-flow cue pass draws from; every new card is a new thing the LLM can put on screen at the right beat. These four come straight from owner-collected reference frames of a strong AI-tools explainer, so they fill real gaps: a prompt-reveal panel (for videos *about* prompting/AI tools), a clean tool hero, a punchy statement beat, and an icon+pill list. Building them generically (token-themeable, a shared named icon set) means they're reusable across videos and re-skinnable per video without touching motion. The house design system is strict (DESIGN.md: burnt-amber bg, one orange accent, semantic green/rose, gold for wins — **no new hues without a deliberate reason**); the owner chose brand-default for all four, so the green of the reference frames is NOT adopted — it's available later as a `:root` swap.

**Load-bearing house rules (do NOT re-litigate):**
- **DESIGN.md palette is mandatory.** Use the `:root` tokens exactly. No green/yellow neon — the reference look is adapted to orange accent. Logos render muted (`filter: saturate(0.5) brightness(0.95); opacity: 0.9;`) and small.
- **HYPERFRAMES.md composition contract.** Root carries comp config; timed top-level elements are `.clip` with `data-start`/`data-duration`/`data-track-index`; GSAP animates children of a clip, never the clip; **one paused timeline registered on `window.__timelines[<comp-id>]`**; deterministic only — **no `Math.random`, `Date.now`, `fetch`, `requestAnimationFrame`, or infinite repeats** (`repeat:-1` fails lint). Canvas redraw via `tl.eventCallback('onUpdate', …)`.
- **A card is only real once pushed** (card-library CLAUDE.md). `check-cards.sh` fails on any untracked file under card-library — the executor must `git add` every new card folder. Cards reach render2 automatically ~15 min after merge to main; there is NO deploy step and NO screenshot gate (removed 2026-07-18).
- **Not a near-duplicate** (DESIGN.md item 6): these four were checked against the catalog — `prompt/*`, a glass tool tile, a keyword statement, and an icon+pill list are all new. (The owner explicitly wanted the standalone statement card even though running keyword-captions exist.)

## Current state

All paths under `pipelines/video/card-library/`.

- **Theme + contract**: `DESIGN.md` (palette/typography/layout/motion), `HYPERFRAMES.md` (composition contract, variables, rendering). Read both before authoring.
- **Exemplars to copy**:
  - Text reveal + `:root` tokens + `getVariables` pattern → `title/title-kinetic-lines/index.html` (kinetic word reveal; the cleanest template).
  - Beat/progressive-reveal contract → `checklist/checklist/index.html` (rows reveal on beats) and README.md "Beat contract".
  - Muted brand logo via injected registry → `overlay/stat-hit/index.html`:
    ```js
    const LOGOS = VARS.__logos ?? {};
    const logoEl = document.getElementById('logo');
    if (DATA.logo && LOGOS[DATA.logo]) { logoEl.src = LOGOS[DATA.logo]; logoEl.style.display = 'block'; }
    else { logoEl.remove(); }
    ```
    (logo `<img>` style: `filter:saturate(0.5) brightness(0.95); opacity:0.9;`). Logo variable value = a `logos/registry.json` slug (e.g. `'openai'`, `'heygen'`); the board/render injects `__logos` as data URIs. If a needed slug is missing from `logos/registry.json`, the card must still render (logo removed) — do NOT hardcode brand imagery.
- **catalog.json**: array of `{slug, kind: "single"|"beat", placement, purpose, variables, [beat_shape], default_duration, [structural]}`. Example single entry (`title/title-kinetic-lines`):
  ```json
  { "slug": "title/title-kinetic-lines", "kind": "single", "placement": "fullframe",
    "purpose": "…", "variables": { "kicker": "string", "title": "string", "subtitle": "string" },
    "default_duration": 10 }
  ```
- **gallery-order.json**: ordering-only front-pin list (not a whitelist).
- **Merge gate** `scripts/check-cards.sh`: verifies every `<type>/<card>/index.html` shape, that each card is in `catalog.json`, and that **nothing under card-library is untracked**. It does NOT render or lint — do those separately.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Structural gate (merge gate) | `bash pipelines/video/card-library/scripts/check-cards.sh` | prints `card check OK`, exit 0 |
| Lint one card | `cd pipelines/video/card-library && npm_config_registry=https://registry.npmjs.org/ npx hyperframes@latest lint <type>/<card>` | passes; only the `gsap_studio_edit_blocked` + `google_fonts_import`/`font_family_without_font_face` warnings |
| Render a frame to inspect | `cd pipelines/video/card-library && npm_config_registry=https://registry.npmjs.org/ npx hyperframes@latest render <type>/<card> -o ~/kb-scratch/card-preview/<card>.mp4 --fps 30 --resolution 1080p` then extract a midpoint frame with `ffmpeg -y -ss <mid> -i <mp4> -frames:v 1 <png>` and LOOK at it | frame matches the card's rubric; no overflow |
| Drift check | `git diff --stat 35aeff4..HEAD -- pipelines/video/card-library` | only card-library files changed |

Note: card renders are generated media — write them to `~/kb-scratch/…`, NEVER commit them (pipelines/CLAUDE.md).

## Scope

**In scope** (create/edit only these):
- `pipelines/video/card-library/prompt/prompt-typing/index.html` (Card 1 — inlined below)
- `pipelines/video/card-library/tool-icon/tool-glass-tile/index.html` (Card 2)
- `pipelines/video/card-library/statement/keyword-statement/index.html` (Card 3)
- `pipelines/video/card-library/checklist/icon-pills/index.html` (Card 4)
- `pipelines/video/card-library/catalog.json` (add 4 entries)
- `pipelines/video/card-library/gallery-order.json` (pin the 4)

**Out of scope** (do NOT touch):
- Any existing card's `index.html`, `DESIGN.md`, `HYPERFRAMES.md`, `serve.mjs`, `logos/registry.json`, or visuals-flow code. No new brand logos.
- No render outputs committed anywhere.

## Git workflow

- Branch: `advisor/114-visuals-flow-card-pack`
- Commit per card (rollback granularity): `feat(card-library): <card> card`. No AI footers. Do NOT push.

---

## Shared conventions for all four cards

1. `:root` carries the palette so a per-video re-skin is a token edit (the "theme" seam). Use exactly:
   ```css
   :root {
     --bg-from:#3a1f08; --bg-to:#0a0805; --text:#ffffff;
     --text-dim:rgba(255,239,219,0.62); --accent:#fb923c;
     --font:'Inter','Helvetica Neue',Arial,system-ui,sans-serif;
   }
   ```
   Load Inter from Google Fonts (same `<link>` as the exemplar). Background: `radial-gradient(ellipse at 50% 24%, var(--bg-from) 0%, var(--bg-to) 64%)` on `#000` body.
2. Comp id unique per card; timeline registered as `window.__timelines['<comp-id>']`. Read variables via `window.__hyperframes?.getVariables?.()` with in-code defaults that produce a good standalone preview (defaults are what the gallery shows).
3. The "neon" look from the references is rendered in **orange accent** (border `var(--accent)` + a soft `box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 45%, transparent)`), NOT green.
4. Keyword highlight (cards 3 & 4): the highlighted phrase = `color:var(--accent); font-weight:800;` optionally on a `background: color-mix(in srgb, var(--accent) 16%, transparent); border-radius:8px; padding:0 .18em;` chip. Deterministic: wrap the keyword substring at build time, do not animate per-letter color.

---

## Card 1 — `prompt/prompt-typing` (ALREADY AUTHORED — place verbatim)

kind `single`, placement `fullframe`, default_duration 12. Types the prompt over the clip length (reads `data-duration` so it fits whatever duration the pipeline assigns), orange `[m:ss]` timestamp tags, GSAP-driven caret blink (finite), box auto-scrolls to keep the caret in view. **Create the file with exactly this content:**

```html
<!doctype html>
<!--
  PROMPT CARD · Typewriter Reveal   (Hyperframes card)
  A "Prompt" panel on the brand burnt-amber background. The prompt text types in
  character by character over the whole clip, [0:00–0:02] timestamp tags glow in
  the brand orange, a caret blinks at the end, and the box auto-scrolls down so the
  newest line stays in view — for showing an AI-video / tool prompt being written.
  1920x1080, 30fps.

  ┌─────────────────────────────────────────────────────────────────────────┐
  │  EDITOR: you ONLY ever touch the  ===== CONTENT =====  block and the      │
  │  :root  colors below. Change  title / prompt / colors  there. Do NOT      │
  │  touch the  ===== TIMELINE (LOCKED) =====  script — that's the motion.    │
  │  Ask Gemini: "only change DATA and :root, never the timeline."            │
  │  The typing fits the clip length automatically — a longer/shorter card    │
  │  just types slower/faster; the box scrolls to keep up.                    │
  └─────────────────────────────────────────────────────────────────────────┘

  Render:  npx hyperframes@latest render prompt/prompt-typing -o out.mp4 --fps 30
  Override: --variables '{"title":"Prompt","prompt":"Your prompt text...\n[0:00–0:02] ..."}'
-->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Prompt.</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* ===== THEME (editor may change these colors) ===== */
      :root {
        --bg-from: #3a1f08;   /* radial origin (burnt amber) */
        --bg-to: #0a0805;     /* near-black warm undertone */
        --text: #ffffff;
        --text-dim: rgba(255, 239, 219, 0.62);
        --accent: #fb923c;    /* title glow, timestamp tags, caret */
        --font: 'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; font-family: var(--font); color: var(--text); }
      #root { position: relative; width: 1920px; height: 1080px; }

      #bg { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 24%, var(--bg-from) 0%, var(--bg-to) 64%); }
      /* soft accent glow behind the panel */
      #glow { position: absolute; inset: 0; background: radial-gradient(ellipse 52% 40% at 50% 46%, color-mix(in srgb, var(--accent) 13%, transparent) 0%, transparent 70%); }

      #frame { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 90px; }

      /* the Prompt panel (GSAP animates #panel, not the .clip shell) */
      #panel { width: 1240px; max-height: 900px; display: flex; flex-direction: column;
        background: rgba(255, 255, 255, 0.045); border: 1px solid rgba(255, 255, 255, 0.11);
        border-radius: 30px; padding: 40px 44px 46px; backdrop-filter: blur(2px);
        box-shadow: 0 40px 120px rgba(0, 0, 0, 0.45); will-change: transform, opacity; }

      /* header: "Prompt" centered with an info glyph */
      #head { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 26px; }
      #head .label { font-size: 34px; font-weight: 800; letter-spacing: -0.5px; color: var(--text); }
      #head .info { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--text-dim);
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 19px; font-weight: 700; font-style: italic; color: var(--text-dim); font-family: Georgia, serif; }

      /* the scroll box — inner text is taller than the box; JS drives scrollTop.
         overflow hidden (no scrollbar chrome) + a top fade where text scrolls off. */
      #scroll { position: relative; flex: 1; min-height: 0; overflow: hidden; border-radius: 18px;
        background: rgba(0, 0, 0, 0.34); border: 1px solid rgba(255, 255, 255, 0.06);
        padding: 30px 34px; height: 620px;
        -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 44px, #000 100%);
        mask-image: linear-gradient(to bottom, transparent 0, #000 44px, #000 100%); }

      #body { font-size: 33px; line-height: 1.5; font-weight: 500; color: var(--text);
        white-space: pre-wrap; word-break: normal; }
      #body .ts { color: var(--accent); font-weight: 700; }

      /* caret: a solid accent bar that flows right after the typed text; GSAP blinks it */
      #caret { display: inline-block; width: 3px; height: 0.95em; margin-left: 2px; vertical-align: -0.12em;
        background: var(--accent); border-radius: 1px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="prompt" data-start="0" data-duration="12" data-width="1920" data-height="1080"
      data-composition-variables='{"title":"Prompt","prompt":"Cinematic food film of a pasta dish being plated in a cozy home kitchen. No dialogue. No people. Photoreal.\n[0:00–0:02] Overhead wide. Rustic wooden table. Empty bowl centered. Hands enter frame from above, ladle pours pasta in a slow arc. Steam rises immediately.\n[0:02–0:05] Extreme close-up, side angle. Fork pierces the pasta and twirls slowly. Sauce clings and glistens. Depth of field razor thin, background blurs warm amber.\n[0:05–0:08] Slow motion, top-down. Thin stream of olive oil poured from above catches the kitchen light. It falls in a perfect golden thread across the pasta surface.\n[0:08–0:11] Macro close-up. Fresh basil leaves drop in slow motion onto the dish one by one. Each lands and settles. Steam curls around them."}'>
      <!-- Track 0: background -->
      <div id="bg" class="clip" data-start="0" data-duration="12" data-track-index="0"></div>
      <!-- Track 1: accent glow -->
      <div id="glow" class="clip" data-start="0" data-duration="12" data-track-index="1"></div>
      <!-- Track 2: content (static clip shell; GSAP animates #panel + children) -->
      <div id="frame" class="clip" data-start="0" data-duration="12" data-track-index="2">
        <div id="panel">
          <div id="head"><span class="label"></span><span class="info">i</span></div>
          <div id="scroll"><div id="body"><span id="typed"></span><span id="caret"></span></div></div>
        </div>
      </div>
    </div>

    <script>
      /* =====================================================
         ===== CONTENT =====  (editor / Gemini edits ONLY this)
         title  : the panel heading ('Prompt')
         prompt : the full prompt text, typed out verbatim. Use \n for line
                  breaks. Any [0:00–0:02] style tag is auto-highlighted orange.
         ===================================================== */
      const VARS = (window.__hyperframes && window.__hyperframes.getVariables ? window.__hyperframes.getVariables() : null) || {};
      const DATA = {
        title: VARS.title ?? 'Prompt',
        prompt: VARS.prompt ?? 'Cinematic food film of a pasta dish being plated in a cozy home kitchen. No dialogue. No people. Photoreal.\n[0:00–0:02] Overhead wide. Rustic wooden table. Empty bowl centered. Hands enter frame from above, ladle pours pasta in a slow arc. Steam rises immediately.\n[0:02–0:05] Extreme close-up, side angle. Fork pierces the pasta and twirls slowly. Sauce clings and glistens. Depth of field razor thin, background blurs warm amber.\n[0:05–0:08] Slow motion, top-down. Thin stream of olive oil poured from above catches the kitchen light. It falls in a perfect golden thread across the pasta surface.\n[0:08–0:11] Macro close-up. Fresh basil leaves drop in slow motion onto the dish one by one. Each lands and settles. Steam curls around them.',
      };

      /* ===== TIMELINE (LOCKED) ===== */
      const $ = (id) => document.getElementById(id);
      const root = $('root');
      const DURATION = parseFloat(root.dataset.duration) || 12;   // fit typing to the clip length
      const FULL = DATA.prompt;
      document.querySelector('#head .label').textContent = DATA.title;

      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const TS = /\[\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\]/g;
      const highlight = (s) => esc(s).replace(TS, (m) => '<span class="ts">' + m + '</span>');

      const typed = $('typed');
      const scroll = $('scroll');
      let lastN = -1;
      function render(n) {
        if (n === lastN) return;
        lastN = n;
        typed.innerHTML = highlight(FULL.slice(0, n));
        scroll.scrollTop = scroll.scrollHeight;
      }
      render(0);

      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.from('#panel', { opacity: 0, y: 26, scale: 0.985, duration: 0.5, ease: 'power3.out', transformOrigin: '50% 50%' }, 0);
      tl.to('#caret', { opacity: 0, duration: 0.5, ease: 'steps(1)', yoyo: true, repeat: Math.max(1, Math.ceil(DURATION / 0.5)) }, 0);
      const START = 0.55, TAIL = 0.5;
      const typeDur = Math.max(0.5, DURATION - START - TAIL);
      const count = { v: 0 };
      tl.to(count, { v: FULL.length, duration: typeDur, ease: 'none', onUpdate: () => render(Math.round(count.v)) }, START);
      tl.set(count, { v: FULL.length, onComplete: () => render(FULL.length) }, START + typeDur);
      window.__timelines['prompt'] = tl;
    </script>
  </body>
</html>
```

catalog.json entry:
```json
{ "slug": "prompt/prompt-typing", "kind": "single", "placement": "fullframe",
  "purpose": "a 'Prompt' panel that types its text out over the clip; [m:ss] timestamp tags glow orange, a caret blinks, the box auto-scrolls — for showing an AI-tool/video prompt being written",
  "variables": { "title": "string", "prompt": "string — the full prompt, \\n for line breaks; [m:ss] tags auto-highlight" },
  "default_duration": 12 }
```

**Rubric**: burnt-amber bg; centered translucent panel titled "Prompt" with an info glyph; at a mid frame the text is partially typed with the caret visible and earlier lines scrolled up under a soft top fade; `[m:ss]` tags are orange; no text spills outside the panel.

---

## Card 2 — `tool-icon/tool-glass-tile`

kind `single`, placement `fullframe`, default_duration 6. A glassy iOS-style rounded-square app-icon tile centered, holding a muted brand logo, with the tool name beneath the tile and an optional one-line subtitle.

**Structure**: `#bg` (gradient) · `#glow` (accent glow behind tile) · `#frame` clip containing `#tile` (the glass icon, ~300×300, `border-radius:64px`, `background:rgba(255,255,255,0.06)`, `border:1px solid rgba(255,255,255,0.14)`, `backdrop-filter:blur(3px)`, soft inner highlight) with a centered `<img id="logo">` (muted-logo filter, ~150px) → below the tile a `#name` (56px, weight 800, white) and optional `#subtitle` (32px, `--text-dim`).

**Variables**: `{ "logo": "string — logos/ registry slug", "name": "string", "subtitle": "string (optional, '' to hide)" }`. Defaults: logo `'openai'` if present in registry else omit (tile still renders as an empty glass tile — never a broken img), name `'GPT Image 2'`, subtitle `''`. Read the logo via the `__logos` pattern from `overlay/stat-hit` (inlined in Current state).

**Motion** (one paused timeline, id `toolicon`): `#tile` scale `0.9→1` + opacity `0→1`, `ease:'back.out(1.6)'`, 0.55s at 0; `#glow` opacity `0→1` power2 at 0.1; `#logo` scale `0.8→1` + opacity, power3.out at 0.25; `#name` opacity + y `18→0` at 0.45; `#subtitle` opacity at 0.65. No loops.

catalog.json entry:
```json
{ "slug": "tool-icon/tool-glass-tile", "kind": "single", "placement": "fullframe",
  "purpose": "hero for one tool/model: a glassy app-icon tile with the tool's (muted) logo, its name beneath, and an optional subtitle — the 'this is the tool' beat",
  "variables": { "logo": "string — logos/ registry slug", "name": "string", "subtitle": "string (optional)" },
  "default_duration": 6 }
```

**Rubric**: centered glass rounded-square tile on burnt-amber bg; the logo inside is muted (desaturated, not full-color) and comfortably padded; the name reads clearly under the tile; soft accent glow; gentle pop-in; if the default logo slug is absent the tile still renders cleanly (no broken-image icon).

---

## Card 3 — `statement/keyword-statement`

kind `single`, placement `fullframe`, default_duration 5. One punchy centered sentence, revealed word-by-word, with a highlighted keyword phrase in accent.

**Structure**: `#bg` · `#glow` · `#frame` clip with a single `<h1 id="line">` (60–76px, weight 800, `letter-spacing:-1px`, `line-height:1.18`, `text-align:center`, `max-width:1500px`). Build the line from `text`: split into words, wrap each in a clip mask (like `title-kinetic-lines`'s `.mask`/`.word`). The contiguous run of words that forms `keyword` gets class `kw` on the inner `.word` (accent color + weight 800 + the highlight chip from Shared conventions). Match `keyword` case-insensitively as a whole-word span inside `text`; if not found, no highlight (still valid).

**Variables**: `{ "text": "string — the sentence", "keyword": "string (optional) — a verbatim phrase inside text, rendered in accent" }`. Defaults: text `"You're also not tied to one company's AI"`, keyword `"one company's AI"`.

**Motion** (id `statement`): words slide up out of their masks, `yPercent:118→0`, `ease:'expo.out'`, `duration:0.7`, `stagger:0.06` at 0.2; the keyword chip background scales in (`scaleX:0→1`, transformOrigin left, power3.out) timed to when its words land. No loops.

catalog.json entry:
```json
{ "slug": "statement/keyword-statement", "kind": "single", "placement": "fullframe",
  "purpose": "a single punchy centered statement revealed word-by-word with one keyword phrase highlighted in the accent — a standalone emphasis beat (distinct from running captions)",
  "variables": { "text": "string", "keyword": "string (optional) — verbatim phrase inside text, shown in accent" },
  "default_duration": 5 }
```

**Rubric**: one centered sentence on burnt-amber bg; words rise in staggered; the keyword phrase is clearly accent-colored with a subtle highlight chip; legible at YouTube compression; no wrap overflow past `max-width`.

---

## Card 4 — `checklist/icon-pills` (+ the reusable icon set)

kind `beat`, placement `fullframe`. A vertical list of rows; each row = an accent-outlined icon tile (left) + an accent-outlined text pill (right). Rows reveal one per beat. Any row may highlight a keyword.

**The reusable inline-SVG icon set** — put this map at the top of the card's script (it is the generic, extensible icon source; future cards can copy it, and a later injected `__icons` registry is the promotion seam — note it in a comment). Each value is inline SVG, `viewBox="0 0 24 24"`, `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"` on the `<svg>`, so the tile's `color` drives it. Use these names (Feather/Lucide-style paths). Author the paths from your knowledge of that icon set; these four are given exactly and the rest must be equivalently simple/recognizable:
```js
const ICONS = {
  brain:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">…brain/cpu glyph…</svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  person:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  bolt:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  gear:     '…', lock: '…', clock: '…', chart: '…', chat: '…', shield: '…', doc: '…', search: '…', star: '…', cloud: '…',
};
const iconSvg = (name) => ICONS[name] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>';
```

**Structure**: `#bg` · `#frame` clip with `#rows` (flex column, gap ~34px, centered). One `.row` per beat = `<div class="icon-tile">`(88×88, `border-radius:22px`, `border:2px solid var(--accent)`, dark fill, `box-shadow:0 0 18px color-mix(in srgb,var(--accent) 40%,transparent)`, holds `iconSvg(icon)` at ~44px, `color:var(--accent)` or muted white) + `<div class="pill">`(auto width, `border-radius:44px`, `border:2px solid var(--accent)`, dark fill, same glow, padding `18px 34px`, text 34px weight 600 white, keyword span in accent per Shared conventions). Rows are built from `beats`.

**Beat contract** (README.md): `beats` = array; each beat reveals on its `at` time (the resolver adds `at`). `beat_shape`: `{ "icon": "string — icon-set name", "text": "string", "keyword": "string (optional) — verbatim phrase inside text" }`. Defaults (standalone preview): three beats — `{icon:'brain', text:'The memory'}`, `{icon:'calendar', text:'The scheduling'}`, `{icon:'person', text:'The way it learns your work over time', keyword:'work over time'}`.

**Motion** (id `iconpills`): container fades ~0.3s before the first row; each row reveals on its beat — `icon-tile` scale `0.85→1` + opacity `back.out(1.4)`, then `pill` opacity + x `-24→0` power3.out 0.05s later; the accent glow eases up with it. No all-at-once, no loops. Follow `checklist/checklist` for wiring beats → timeline positions.

**Capacity**: measure honestly — fill to `max_beats` rows at `max_reveal_chars` chars and confirm no overflow; record both in catalog. Target `max_beats: 4`, `max_reveal_chars: 40` (verify by rendering the filled card).

catalog.json entry:
```json
{ "slug": "checklist/icon-pills", "kind": "beat", "placement": "fullframe",
  "purpose": "vertical list of icon-tile + text-pill rows revealing one per beat, accent-outlined with a soft glow; optional keyword highlight per row — for enumerating features/capabilities",
  "variables": {},
  "beat_shape": { "icon": "string — icon-set name (brain|calendar|person|bolt|gear|lock|clock|chart|chat|shield|doc|search|star|cloud)", "text": "string", "keyword": "string (optional) — verbatim phrase inside text" },
  "max_beats": 4, "max_reveal_chars": 40, "default_duration": 8 }
```

**Rubric**: 3 rows at defaults, each an accent-outlined icon tile + text pill with a soft orange glow (the reference's neon look, in brand orange not green); icons are recognizable; rows reveal one by one; the keyword ("work over time") is accent-highlighted; at 4 rows × 40 chars nothing overflows the frame.

---

## Steps

1. **Card 1** — create `prompt/prompt-typing/index.html` verbatim from above; add its catalog entry; `git add`. **Verify**: `npx hyperframes@latest lint prompt/prompt-typing` passes; render a frame at ~6s and confirm the rubric.
2. **Card 2** — author `tool-icon/tool-glass-tile/index.html` per spec (copy `overlay/stat-hit` for the `__logos` wiring, `title/title-kinetic-lines` for scaffold); add catalog entry; `git add`. **Verify**: lint passes; render a ~3s frame vs rubric.
3. **Card 3** — author `statement/keyword-statement/index.html` (copy `title/title-kinetic-lines` masks); add catalog entry; `git add`. **Verify**: lint passes; render a ~3s frame vs rubric (words in, keyword highlighted).
4. **Card 4** — author `checklist/icon-pills/index.html` with the icon set (copy `checklist/checklist` for the beat wiring); add catalog entry with `max_beats`/`max_reveal_chars`; `git add`. **Verify**: lint passes; render at defaults AND render a fill-to-capacity variant (`--variables` with 4 rows × 40 chars) — confirm no overflow.
5. **Pin in gallery** — add the 4 slugs to `gallery-order.json` (front). **Verify**: valid JSON.
6. **Gate** — `bash pipelines/video/card-library/scripts/check-cards.sh` → `card check OK`, exit 0 (this also fails if any card file is left untracked — ensure all four folders + catalog + gallery-order are `git add`ed/committed).

## Test plan

- Per card: `hyperframes lint` (2 known warnings acceptable) + a rendered midpoint frame inspected against the card's rubric (render+inspect rider for visual output; write renders to `~/kb-scratch/`, never commit).
- Card 4 additionally: a fill-to-capacity render (4 rows × `max_reveal_chars`) to prove the declared capacity.
- Merge gate: `bash pipelines/video/card-library/scripts/check-cards.sh` exits 0.

## Done criteria

- [ ] Four new files exist: `prompt/prompt-typing`, `tool-icon/tool-glass-tile`, `statement/keyword-statement`, `checklist/icon-pills` (each `<type>/<card>/index.html`).
- [ ] All four are in `catalog.json` with the entries above (card 4 with `beat_shape` + `max_beats` + `max_reveal_chars`).
- [ ] `bash pipelines/video/card-library/scripts/check-cards.sh` prints `card check OK`, exit 0 (nothing untracked).
- [ ] `npx hyperframes@latest lint <card>` passes for each (only the 2 known warnings).
- [ ] Each card's rendered midpoint frame meets its rubric; card 4 at 4×40 does not overflow.
- [ ] `git diff --stat 35aeff4..HEAD` lists only files under `pipelines/video/card-library/`.

## STOP conditions

- A card can only be made to look right with a non-palette hue (green/yellow neon etc.) → STOP and report (palette change is an owner design decision, not an executor call).
- A card overflows its frame at declared capacity and can't be fixed by sizing within the palette/type rules → STOP.
- The icon set can't render an icon deterministically (e.g. needs an external asset) → STOP; every icon must be inline SVG.
- A needed logo slug is missing from `logos/registry.json` → do NOT add logos or hardcode imagery; render the card with the logo removed and note it. (Adding registry logos is out of scope.)
- After 5 self-fix attempts a Done criterion still fails → write `BLOCKED: <which> unreachable after 5 attempts` and stop.

## Maintenance notes

- The inline `ICONS` map in `checklist/icon-pills` is the first generic (non-brand) icon source in the library. If a second card needs concept icons, the clean promotion is an injected `__icons` registry (parallel to `__logos`) rather than copy-paste — noted as the seam in the card's comment.
- All four cards keep their palette in `:root`; a per-video green/other re-skin is a `:root` token edit (or Gemini edit) with motion untouched — that is the "themeable" contract the owner asked for.
- `catalog.json` and `gallery-order.json` are shared files — this is intentionally ONE plan so the four additions don't collide across branches. A future card should append, not restructure.
- After merge, `check-cards.sh --publish` confirms everything is pushed; render2 serves the new cards within ~15 min (VPS repo-sync cron) — no deploy step.
