# Hyperframes — working notes

Practical notes from building this project. Hyperframes is HeyGen's open-source
(Apache-2.0) HTML-to-video renderer: you write HTML + GSAP, it renders a
deterministic MP4 by seeking a paused timeline frame by frame and screenshotting
with headless Chrome, then encoding with ffmpeg. Same pipeline as the old
`html-to-video` tool, but the motion model and easing are far better.

- Docs: https://hyperframes.heygen.com
- GitHub: https://github.com/heygen-com/hyperframes
- Version this project was built against: 0.6.97

## Why we use it here

The video editor isn't technical. He edits a card's HTML with Gemini and renders
it without a terminal. Hyperframes fits because the source is plain HTML+GSAP
(Gemini knows both cold) and GSAP gives professional easing for free — which was
the exact thing missing from the earlier hand-rolled `interp()` cards (those were
linear, so the motion looked stiff next to the original Remotion videos).

## The project model (important)

A Hyperframes "project" is a **directory**, not a file. The CLI (`lint`, `render`,
`preview`) operates on a directory that contains an `index.html`. So:

- Each card lives in its own folder as `index.html`: `section/section-counter-scale/index.html`.
- A card folder needs **only** `index.html` to lint/render. The shared
  `hyperframes.json` + `meta.json` at the project root make the whole tree a project.
- Render a specific card by passing its folder as the DIR arg:
  `npx hyperframes@latest render section/section-counter-scale -o out.mp4 --fps 30`
- `--composition path/to/x.html` also exists, but folder-per-card is simpler.

## Composition contract (the rules that matter)

These mirror the lint checks. Break them and `lint` fails:

1. Root element carries the comp config:
   `data-composition-id`, `data-start`, `data-duration` (seconds), `data-width`, `data-height`.
2. Every **timed** top-level element needs `class="clip"` + `data-start` +
   `data-duration` + `data-track-index`. Children of a clip do **not** need this.
3. GSAP must NOT animate a `.clip` element itself — only its inner children.
   Pattern: a static `.clip` shell wraps an inner div that GSAP animates.
4. Clips on the **same track** cannot overlap in time (watch float precision).
   Visually-overlapping elements go on **separate** `data-track-index` values.
5. The GSAP timeline must be **paused and registered**, keyed to the composition id:
   ```js
   window.__timelines = window.__timelines || {};
   const tl = gsap.timeline({ paused: true });
   // ...tweens...
   window.__timelines["counter"] = tl;   // key === data-composition-id
   ```
6. Deterministic only: no `Math.random()`, `Date.now()`, `fetch()`, or
   `requestAnimationFrame` driving animation. The renderer seeks frames; anything
   time-based or random breaks reproducibility.
7. Canvas animations: redraw on the timeline tick via
   `tl.eventCallback('onUpdate', () => draw(tl.time()))`, not rAF.
8. No infinite repeats (`repeat: -1` is a lint error) — use a finite count.

## Easing (the whole point)

GSAP eases come for free — `ease: 'power3.out'`, `'expo.out'`, `'back.out(2)'`,
plus `stagger` for ripples. This is what makes the motion smooth without
hand-rolling spring math. Counting numbers deterministically: tween a plain
object with `roundProps`:
```js
const counter = { v: 0 };
tl.to(counter, { v: TARGET, duration: 0.5, ease: 'none', roundProps: 'v',
  onUpdate: () => { el.textContent = String(Math.round(counter.v)).padStart(2,'0'); } }, 0.2);
```

## Per-video content without editing code: variables

Hyperframes has a native variable system — the best fit for "same card, new text
per video":

- Declare defaults on the root: `data-composition-variables='{"number":"02","title":"The Winners"}'`.
- Read them in the script:
  `const VARS = window.__hyperframes?.getVariables?.() || {};`
  then fall back to defaults: `VARS.number ?? '02'`.
- Override at render time, no code touched:
  `render ... --variables '{"number":"04","title":"Final Verdict"}'`
- `--batch path.json` renders one output per row of a JSON array (bulk).

Our cards support both: editor can change the `DATA`/CONTENT block by hand (or via
Gemini), OR pass `--variables`.

## Rendering

```bash
npx hyperframes@latest render <card-folder> -o out.mp4 --fps 30 --quality high
```

- First render downloads Chrome once (`chrome-headless-shell` via puppeteer cache,
  ~100 MB). `npx hyperframes browser ensure` pre-downloads it (used in the Docker image).
- `--quality high` renders at 2× DPR → a 1920×1080 composition outputs **3840×2160**.
  Use `--resolution 1080p` if you want true 1080p out.
- Other useful flags: `--crf 16` (near-lossless), `--gpu`, `--format webm/mov`
  (transparent), `--workers auto`.
- `lint <dir>` before rendering. Common **non-blocking** warnings we accept:
  - `gsap_studio_edit_blocked` — Studio can't drag-edit GSAP-controlled elements.
    Expected: our motion is locked on purpose.
  - `google_fonts_import` / `font_family_without_font_face` — fonts load fine online;
    for offline/sandboxed renders, bundle local `.woff2` via `@font-face`.

## Gotchas hit while building this

- **npm registry**: global npm here points at a work CodeArtifact registry that
  401s on public packages. Fix with a local `.npmrc` (`registry=https://registry.npmjs.org/`)
  and/or `npm_config_registry` env on any spawned `npx`.
- **`timeout`** isn't on macOS by default (it's `gtimeout`).
- Preview from `file://` or an iframe shows the **start** state (timeline paused at 0),
  which for entrance animations is mostly invisible. To preview a real frame, inject a
  tiny script that seeks every `window.__timelines[*]` to `~0.6` after load. The gallery
  and the render tool both do this.

## CLI map (v0.6.97)

`init` scaffold · `add`/`catalog` registry blocks · `preview` Studio (live) ·
`render` to MP4 · `lint`/`validate`/`inspect`/`snapshot` checks · `compositions`
list · `cloud`/`lambda`/`cloudrun` distributed render · `browser ensure|path|clear`.
