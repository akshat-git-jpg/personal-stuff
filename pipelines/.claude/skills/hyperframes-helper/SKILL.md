---
name: hyperframes-helper
description: Opinionated production layer ON TOP OF the official Hyperframes skills — three-level workflow, 16 lint gotchas with fixes, 10 motion-graphics recipes, storyboard templates, and a talking-head cut pipeline. For basic authoring/rendering use the official `hyperframes` skill instead. Triggers on "hyperframes helper", "storyboard a video", "storyboard the title cards", "level 3 video pipeline", "cut the retakes", "silence cut my recording", "hyperframes lint gotchas", "motion graphics recipe".
user-invocable: true
metadata:
  author: Jay (RoboNuggets, https://robonuggets.com) — CC BY 4.0; installed by kbtg
  version: 1.0.0
---

# Hyperframes Helper

A practical kit for building motion-graphics videos with Hyperframes — HeyGen's open-source HTML-to-MP4 renderer. Three levels of effort matched to three different goals.

## What is Hyperframes

Hyperframes is an open-source video composition framework. You write HTML/CSS/GSAP, it renders to a deterministic MP4. The output looks like motion graphics; the source is just a webpage. That makes it agent-native — LLMs can write it first try, no React/Remotion bundler dance.

- **GitHub:** https://github.com/heygen-com/hyperframes
- **Docs:** https://hyperframes.heygen.com
- **License:** Apache 2.0 — free, fully local, no HeyGen API key needed

## Install Hyperframes

You only need Node.js. Hyperframes runs via `npx`:

```bash
# Verify Node is available
node --version

# See what Hyperframes can do
npx hyperframes@latest --help

# Scaffold a new project
npx hyperframes@latest init my-video
cd my-video

# Add the official agent skills (gives you /hyperframes, /gsap, /website-to-hyperframes)
npx skills add heygen-com/hyperframes

# Open Studio (live preview at http://localhost:3002)
npx hyperframes@latest preview

# Lint your composition
npx hyperframes@latest lint

# Render to MP4
npx hyperframes@latest render -o output.mp4 --fps 30
```

First render downloads Chrome (~101 MB), one-time. Cached after that.

This kit ships **on top of** Hyperframes — it's a layer of patterns, templates, and recipes you reach for once you've decided which Level you're working at.

---

## The Three Levels

The complexity floor depends on what you want. Pick the level that matches.

---

### Level 1 · Website-to-Video

Fastest path. You already have a webpage / component / animated CSS — turn it into an MP4.

**When to use:**
- You found a beautiful animated component on the web and want a 6-second loop
- You have a brand site and want a 15-second hero animation as a video file
- You want a quick capture of an interactive demo

**How:**

```bash
# In your Hyperframes project
/website-to-hyperframes
```

The official Hyperframes website-to-video skill handles this end to end. It captures the page, wraps it as a Hyperframes composition, and renders. Read more in the [Hyperframes docs](https://hyperframes.heygen.com).

**Where to find good source HTML:**
- **[21st.dev](https://21st.dev)** — high-quality React component examples. Many work great as Hyperframes scenes — strip the React wrapper, keep the HTML/CSS/animations.
- **[CodePen](https://codepen.io)** — search for "shader", "particles", "loader" — lots of self-contained animated CSS pens.
- **Hyperframes registry** — `npx hyperframes@latest catalog` shows blocks/components shipped with Hyperframes itself.

**Output:** a single MP4, deterministic, captured at the fps you choose.

---

### Level 2 · Storyboards

You're producing original motion graphics from scratch and want to iterate on the layout BEFORE committing to a real composition. Iterating in Studio costs ~15 min per cycle. Iterating on a storyboard HTML costs ~1 min.

**When to use:**
- Original motion-graphics video (intro, hook, ad, lesson trailer)
- You have a brief but no clear shot list yet
- You want to share a visual plan before writing GSAP

**How:**

1. Copy `templates/storyboard-template.html` into your project as `storyboard.html`
2. Fill in scene cards: scaled 1920×1080 layout previews + motion notes per scene
3. Open in browser, share the path with your reviewer
4. Iterate in HTML — drag elements around the preview boxes, rewrite motion notes
5. Once locked, only THEN move to the real composition

**The storyboard template ships with:**
- Header with title + meta pills + horizontal proportional timeline bar
- Sticky table of contents for nav
- Scene cards (two-pane: scaled layout preview + notes panel)
- Pre-styled placeholder elements: video frame, text panels, sample cards, watermark, motion arrows
- Same typography + color tokens as the composition template

**Mark-up methods your reviewer can use:**
- Open the file, add `<!-- COMMENT: ... -->` tags inline
- Screenshot the page and draw arrows
- Just describe in chat: "scene 3 should X"

**Why this saves time:** every storyboard iteration that catches a layout mistake saves you a 15-minute compose-lint-preview cycle. Five storyboard rounds = one composition round.

---

### Level 3 · Guided Videos

Fully custom production with a real camera recording at the centre. The full RoboNuggets pipeline — three steps:

```
┌──────────────┐    ┌─────────────────┐    ┌───────────────────┐
│ STEP 01      │ ─→ │ STEP 02         │ ─→ │ STEP 03           │
│ Cut the      │    │ Storyboard the  │    │ Add in motion     │
│ Video        │    │ Title Cards     │    │ graphics          │
└──────────────┘    └─────────────────┘    └───────────────────┘
```

**When to use:**
- Talking-head intros and outros
- Lesson openers where you appear on camera
- Any video where you're cutting a real recording AND adding motion graphics on top

#### Step 01 · Cut the Video

Two passes — silence cut, then retake cut. Both use ffmpeg.

**Pass A — silence cut** (`templates/silence-cut.sh`)

```bash
ffmpeg -i input.mkv -af "silencedetect=noise=-30dB:d=0.4" -f null - 2>&1 | grep silence
```

This prints all silence regions. Build keep-ranges with a 0.04s pad on each side, then re-encode with tight 1s GOP keyframes (Hyperframes-ready). Template includes the full `filter_complex trim/atrim/concat` skeleton.

**Pass B — transcribe** (`templates/transcribe-whisper.py`)

```bash
pip install faster-whisper
python templates/transcribe-whisper.py input_silence_cut.mp4
```

Outputs `*.transcript.json` + `*.transcript.txt` with word-level timestamps.

> Why faster-whisper instead of WhisperX: torchaudio is fragile on Windows (libtorchaudio load errors). faster-whisper uses CTranslate2 — no torch dependency.

**Pass C — retake cut** (`templates/cut-retakes.py`)

Identify retake clusters from the word-level transcript. Apply the **last-take rule**: when a phrase is repeated, keep only the LAST take and cut everything before it (false starts, earlier attempts, "let me start over" markers). Drop your `KEEPS` ranges into the script and run.

**Alternative tool:** if you'd rather skip the manual pass, [video-use](https://github.com/browser-use/video-use) is an automated video-editing agent that can cut filler words and false starts. Slower per run, fewer fine-tuning hooks, but zero scripting required.

**Tip:** ship a `script-review.html` — a side-by-side of "current script vs proposed clean script" with retakes struck through in red, last-takes highlighted in green, and a numbered cut table (range, duration, what it removes, why). Lets reviewers approve cuts before any re-encode.

#### Step 02 · Storyboard the Title Cards

This is Level 2, applied inside the bigger pipeline. Use `templates/storyboard-template.html` to plan the title cards / overlay scenes that will sit on top of your cut video.

**Common title-card patterns:**
- **Floating cards** on one side of the screen (right or left), one per spoken beat, paced to the transcript
- **Centred big text** for major moments — "*major* upgrade", "*open source*", "*free & open source*"
- **Animated highlights** (curved underlines, glowing words, pulsing borders)
- **Brand corner pills** (status pill top-left, counter top-right, brand pill bottom-left)

See `templates/recipes.md` for copy-paste implementations.

#### Step 03 · Add in Motion Graphics

Centre stage motion graphics that appear at specific beats. Common shapes:

- **Shader flashes** — Three.js fragment shader as a 0.5–1s transition flourish
- **Wireframe globe** — D3 `geoOrthographic` with country outlines + halftone dots, on a transparent canvas
- **Chroma-keyed character** — 3D rendered icon flip on green-screen, keyed out via SVG `feColorMatrix` filter
- **Logo assemblies** — segments fade-in stagger, then breathe loop
- **Big closing text + icons** — final tagline with a row of brand marks

Each pattern has a copy-paste recipe in `templates/recipes.md`.

**Composition tip:** start each motion graphic centred on canvas, then animate it sliding to one side as a label fades in on the other. Three sequential motion graphics tell a story without crowding.

---

## Critical Framework Rules (lint gotchas)

These are non-negotiable — every one corresponds to a Hyperframes lint error you WILL hit if you skip:

1. **Every timed element needs `class="clip"` + `data-start` + `data-duration` + `data-track-index`.** No exceptions.

2. **GSAP must NOT animate clip elements.** The framework manages clip visibility. Animating opacity/visibility on a `class="clip"` div = `gsap_animates_clip_element` error. Fix: wrap each scene in an outer clip-shell + inner animatable div.

3. **Clips on the same track CANNOT overlap (even by 0.001s).** Floating-point precision bites — `start=23.85, duration=4.55` ends at `28.400000002`, collides with `start=28.40`. Either bump duration to `4.54` or move to a different track.

4. **Visually-overlapping elements need separate tracks.** Four sample cards visible together → tracks 12, 13, 14, 15 (one each).

5. **GSAP timeline must be paused + registered.**
   ```js
   window.__timelines = window.__timelines || {};
   const tl = gsap.timeline({ paused: true });
   // ... tl.from(...) ...
   window.__timelines["main"] = tl;  // matches data-composition-id
   ```

6. **Deterministic logic only.** No `Math.random()`, no `Date.now()`, no `fetch()`. Render is frame-by-frame seek.

7. **Video uses `muted` + separate `<audio>` element.** Playing audio through the `<video>` tag breaks frame seek.

8. **Source video needs tight keyframes (1s GOP).**
   ```bash
   ffmpeg -i in.mp4 -c:v libx264 -preset fast -crf 18 \
     -r 30 -g 30 -keyint_min 30 \
     -force_key_frames "expr:gte(t,n_forced*1)" \
     -c:a aac -b:a 192k -movflags +faststart out.mp4
   ```

9. **Canvas-based animations must redraw on timeline tick.** Don't use `requestAnimationFrame`. Use `tl.eventCallback('onUpdate', () => drawCanvas(tl.time()))`.

10. **`hard kill` not strictly required for clip elements.** Framework hard-cuts at clip end. Don't `tl.set(..., {visibility: hidden})` on clip elements.

11. **`repeat: -1` (infinite) is FORBIDDEN.** Lint error: `gsap_infinite_repeat`. Use a finite count derived from the hold duration:
    ```js
    const HOLD = 6.0, CYCLE = 1.6;
    const repeats = Math.max(0, Math.floor(HOLD / CYCLE) - 1);
    tl.to('.element', { ..., repeat: repeats, yoyo: true });
    ```

12. **Multiple `<audio>` elements with the same `src` cause echo.** The framework gates clip *visibility* but several preloaded audio elements still play simultaneously in Studio preview. Use ONE `<audio>` clip pointing to a pre-cut clean audio file.

13. **Pseudo-elements (`::before` / `::after`) cannot be GSAP'd.** Replace with real DOM child divs.

14. **Studio's auto-assigned inline `style="z-index: N"` may be inverted.** If hex bg or vignette appears on top of video after Studio edits, bulk-strip inline z-indexes:
    ```python
    import re
    s = open('index.html').read()
    out = re.sub(r' style="z-index: \d+"', '', s)
    open('index.html', 'w').write(out)
    ```

15. **Stacking context gotcha for the contracted-video frame.** If `#videoFrame { z-index: 2 }`, sibling float-text without z-index gets buried below it. Either give the floats explicit `z-index ≥ 2`, OR remove videoFrame's z-index and place behind-elements (like a shader) BEFORE videoFrame in DOM.

16. **`z-index: -1` traps an element behind the body's background.** When `body { background: #000 }`, a `z-index: -1` element renders BEHIND the body paint and disappears. Use DOM ordering instead — place the "behind" element earlier in the DOM, no z-index.

## Multi-clip cut-editing pattern (Studio-draggable cuts)

Hyperframes Studio explicitly **cannot split a clip mid-source** ([per the docs](https://hyperframes.heygen.com/guides/timeline-editing)). The workaround:

Keep the uncut source on disk, then define multiple `<video>` clips on the timeline, each with a different `data-media-start`. Drag the LEFT handle of any clip in Studio to fine-tune that segment's cut boundary live — no ffmpeg re-run.

```html
<div id="videoFrame">
  <video class="stage-video clip" data-start="0.00" data-duration="2.56"
         data-media-start="2.24" data-track-index="2" muted playsinline preload="auto"
         src="assets/source-uncut.mp4"></video>
  <video class="stage-video clip" data-start="2.56" data-duration="3.74"
         data-media-start="9.12" data-track-index="3" muted playsinline preload="auto"
         src="assets/source-uncut.mp4"></video>
  <!-- alternate tracks 2/3 so adjacent clips don't collide on a shared track -->
</div>
```

Trade-off: audio CANNOT be split this way (rule 12 — echo). Pre-cut a single clean audio file via `cut-retakes.py` and use ONE `<audio>` clip. When you drag video boundaries in Studio, you'll need to re-cut the audio to keep sync.

For one-shot delivery with no Studio drag-editing needed, use a single ffmpeg-cut `source.mp4` + single `<audio>` `source.mp4` — simpler.

## Studio editing limits (per official docs)

Studio supports only:
- ✅ Drag clip horizontally → updates `data-start`
- ✅ Drag clip between rows → updates `data-track-index`
- ✅ Drag right handle → updates `data-duration` (end-trim)
- ✅ Drag LEFT handle on **media** clips → updates `data-start` + `data-media-start` (front-trim into source)
- ✅ Reorder rows vertically → updates inline `z-index`
- ❌ Splitting / cutting clips mid-source
- ❌ Front-trim on non-media (motion) clips
- ❌ Keyboard shortcuts
- ❌ Multi-select
- ❌ Undo / redo

Source: https://hyperframes.heygen.com/guides/timeline-editing

## Rendering at highest quality

```bash
cd [project] && npx hyperframes@latest render \
  -o renders/final.mp4 \
  --fps 30 --quality high --crf 16 --gpu
```

- `--quality high` — top quality tier
- `--crf 16` — near visually-lossless (lower = bigger file, higher quality; standard is 18-23)
- `--gpu` — GPU encoding
- Render time on 16-core: ~2.5–3 min for a 30s composition with video + GSAP

Two renders can run in parallel — Hyperframes spawns 5–6 worker Chrome processes per render anyway, so two renders share well.

## Recipes

`templates/recipes.md` ships 10 copy-paste patterns. Reach for them once you've got the basics:

1. **Liquid glass card** — frosted iOS-style backdrop blur with sheen and refraction
2. **Pulse border** — single-color rotating gradient on the card edge
3. **White-glow text** — multi-layer text-shadow for readability over video
4. **Curved underline** — animated SVG curve beneath an em highlight
5. **Chroma key** — green-screen knockout via SVG `feColorMatrix`
6. **Multi-clip cut-editing** — the data-media-start pattern above
7. **Pulsing rings** — concentric outward pulse around a logo
8. **Corner notes** — status / counter / brand pill chrome
9. **D3 globe** — wireframe earth with halftone dots, transparent canvas
10. **Pixel-art icon row** — sample row of small character icons (8×8 pixel grid)

## Files in this kit

```
hyperframes-helper/
├── SKILL.md                          ← this file
└── templates/
    ├── composition-template.html     ← scaffold: tokens, hex mesh, GSAP, watermark
    ├── storyboard-template.html      ← Level 2 storyboard, 5-scene starter
    ├── recipes.md                    ← copy-paste pattern library (10 recipes)
    ├── silence-cut.sh                ← Step 01 / Pass A: ffmpeg silence trim
    ├── transcribe-whisper.py         ← Step 01 / Pass B: faster-whisper transcript
    └── cut-retakes.py                ← Step 01 / Pass <your-project-path> last-take-rule retake removal
```

For Level 3's globe motion graphic, you'll also want the [Natural Earth land geometry](https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json). Download it, wrap as `window.NE_LAND = ...;` in a `.js` file, and drop into your composition's `assets/` folder.

## References

- **Hyperframes GitHub:** https://github.com/heygen-com/hyperframes
- **Hyperframes docs:** https://hyperframes.heygen.com
- **Studio editing guide:** https://hyperframes.heygen.com/guides/timeline-editing
- **video-use (alt video editor):** https://github.com/browser-use/video-use
- **21st.dev (HTML component reference):** https://21st.dev
- **GSAP docs:** https://gsap.com/docs

---

Created by Jay from [RoboNuggets](https://robonuggets.com). Free to use under CC BY 4.0 with attribution.
