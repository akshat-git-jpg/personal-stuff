# Atom catalog — Devsplainers clone kit

The vocabulary every scene composes from. Style comes **only** from
`tokens.css`; markup uses the classes below (defined in `atoms.css`); motion
uses the `R.*` helpers (in `recipes.js`). Never write raw hexes or new fonts in
a scene — the verify script rejects them.

**Scene skeleton:** copy `scaffold/` (it has the clip/track structure, chrome,
and a `kit` symlink). Author flow: fill copy → compose atoms → add `R.*` motion.
Assets are referenced root-relatively (`kit/tokens.css`) and resolve through the
per-scene `kit` symlink — see SPEC §8.

Semantic color law: **white** neutral · **blue** old/technical/RAG · **amber**
new/hero · **red** problem/catch/cost · **green** good/free/forgiven.

---

## Tier 1 — primitives

| # | Atom | Class | Use / notes |
|---|------|-------|-------------|
| 1 | Section label | `.section-label` (`.is-red/.is-blue/.is-amber`, `.is-crumb`) | Top-left chapter tag. Add `<span class="underline">` for the red rule. |
| 2 | Topic tag | `.topic-tag` + `<span class="underline">` | Top-center source/brand ("GOOGLE CLOUD"). |
| 3 | Catch-stack | `.catch-stack` holding `.pill.is-red` | Top-right accumulating catches. |
| 4 | Watermark | `.watermark` | Bottom-right `<devsplainers>`. Required on every scene. |
| 5 | Headline | `.headline` (`.is-hero`; inner `.amber/.red/.blue`) | Big condensed caps; color one hero word. |
| 6 | Numbered title | `.numbered-title` + `.num` | "1 WHEN THE WORK HAPPENS". |
| 7 | Caption | `.caption` (`.is-good/.is-bad/.is-hero/.is-dim`) | Centered sentiment line. |
| 8 | Arrow-mapping list | `.map-list` > `.map-row` (`.arrow`, `.is-hero`) | key → value rows. |
| 9 | Pull-quote | `.pull-quote` + `.attr` | Big centered quote + mono attribution. |
| 10 | Pill | `.pill` (`.is-blue/.is-amber/.is-red/.is-green`, `.is-solid-*`, `.is-outline`, `.is-required`) | The workhorse chip. |
| 11 | Type-tagged card | `.card` > `.tag` + `.title` + `.lines>i` (`.is-blue/.is-red/.is-green/.is-neutral`) | Corner-tagged file/metric card. |
| 12 | Stamp | `.stamp` (`.is-angled`) | Solid red callout. |
| 13 | CTA pill | `.cta-pill` | Bordered URL/link pill. |
| 14 | Mono data block | `.data-block` (`.k`, `.hero`) | Vectors, `type:`, paths. |
| 15 | File-tree | `.file-tree` > `.root` + `.file` | `wiki/ index.md …`. |
| 16 | Diff block | `.diff` > `.add`/`.del` | Green +/red − lines. |
| 17 | Search-box | `.search-box` | Magnifier + query mock. |
| 18 | Big-stat | `.big-stat` + `.unit` | Large number; pair with `R.countUp`. |
| 19 | Icon | inline `<svg class="icon">` (`.is-blue/.is-amber/.is-red/.is-green`, `.is-sm/.is-lg`) | Line-art, no fill; stroke from tokens. See icon notes. |
| 20 | Connector | inline `<svg><line/path class="connector">` (`.is-blue/.is-amber/.is-solid`) | Dashed edge; animate with `R.drawOn`. |

**Icon authoring:** draw single-weight line-art as an inline `<svg class="icon …" viewBox="0 0 48 48" fill="none">` with `<path>`/`<line>`/`<circle>` — stroke, width, linecap all inherit from `.icon`. Built examples: document (ex 01), database cylinder + folder (ex 04). Keep the ~2.5px look by using the 48-unit viewBox.

## Tier 2 — composed diagrams

| # | Diagram | Class | Notes |
|---|---------|-------|-------|
| 21 | Pipeline | `.pipeline` > `.node` + `.link` | Nodes + connectors + under-node pills. |
| 22 | Node-graph | `.node-graph` > `.edges`(svg) + `.nodes` | Cards joined by connectors. |
| 23 | Bars | `.bars` > `.bar` (`.is-amber/.is-red/.is-green/.is-blank`) + `.val`/`.label` | Grow with `R.grow`. |
| 24 | Gauge | inline svg: `.gauge-arc` + `.gauge-fill` + `.gauge-needle` | See ex 03; needle via `R.needle(..., {svgOrigin})`. |
| 25 | Grid-of-cells | `.cell-grid` > `.cell` (`.is-on`) | Scale/context grid. |
| 26 | Status bar | `.status-bar` > `.fill`(`.is-good`) + `.marker` | Grow fill with `R.grow({axis:'x'})`. |
| 27 | Mapping table | `.map-table` > `.mt-row` (`.arrow`) | label → pill rows. |
| 28 | Timeline dots | `.dots` > `.dot`(`.is-on`) + `.line` | Steps/commits. |
| 29 | Loop | `.loop` ring + positioned `.node`s + `.center` | See ex 02; draw ring with `R.drawOn`. |

## Tier 3 — scene templates

| # | Scene | Class | Notes |
|---|-------|-------|-------|
| 30 | Title card | `.scene-title` + `.headline` + `.subtitle` | See ex 01. `.subtitle` = blue wide-tracked mono. |
| 31 | Numbered-section | `.scene-section` + `.numbered-title` | Chapter divider. |
| 32 | Authority card | `.authority` > `.photo` + `.name` + `.roles` | Person + role pills. |
| 33 | Pull-quote scene | `.scene-quote` + `.pull-quote` | Centered quote. |
| 34 | Color flash | `.color-flash` (`.is-amber/.is-red/.is-blue`) + `.word` | Full-screen transition; `R.flash`. |
| 35 | Outro CTA | `.scene-outro` + `.cta-head` + `.cta-sub` + `.cta-pill` | Endcard. |

---

## Motion recipes (`recipes.js`, global `R`)

All take `(tl, target, at, opts)`. `at` = start time (s) on the paused timeline.

| Helper | Does | Common opts |
|--------|------|-------------|
| `R.fadeUp` | fade + rise (default text entrance) | `y`, `duration` |
| `R.slideIn` | slide from a side | dir `'left'/'right'/'up'/'down'`, `dist` |
| `R.popIn` | scale overshoot (pills/badges) | `scale`, `stagger` (for groups) |
| `R.drawOn` | draw an SVG stroke on | `duration` |
| `R.countUp` | count a number up | `from`, `to`, `prefix`, `suffix`, `decimals` |
| `R.staggerIn` | staggered group fade+rise | `stagger`, `y` |
| `R.grow` | grow a bar/fill | `axis:'x'` for horizontal |
| `R.needle` | rotate a gauge needle | `svgOrigin:"cx cy"`, `from` |
| `R.pulse` | finite breathing (never infinite) | `hold`, `cycle`, `scale` |
| `R.flash` | punch-in for color-flash | `scale`, `duration` |

**Lint rules that bite** (see hyperframes-helper): animate the inner content div,
never the `.clip` shell; visually-overlapping elements need separate track
indices; same-track clips must not overlap in time; no `repeat:-1` (use
`R.pulse`); deterministic only. Motion stays restrained (~3/10) —
`power2/3.out`, pills `back.out(1.6)`, ~0.35s, stagger ~0.06s.
