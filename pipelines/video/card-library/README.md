# YT Visuals — Hyperframes edition

The YT visuals card set as [Hyperframes](https://hyperframes.heygen.com) compositions:
plain HTML + GSAP that renders to MP4. GSAP gives the easing for free, so the motion
is smooth without hand-rolling spring math. (Replaces the old seekToFrame cards.)

Each card is one folder with an `index.html` inside it. To make a new version of a
card for a specific video, copy the folder, change the content, render.

```
video/card-library/
  serve.mjs             <- the gallery server (npm run serve)
  HYPERFRAMES.md        <- notes on how Hyperframes works (read this first)
  section/
    section-counter-scale/
      index.html        <- a card
```

Run **`npm run serve`** and open the printed `http://localhost:4321`. It's a board of
every card with a looping preview and a **Copy HTML** button, read **live** from disk —
edit a card, refresh the page, and the preview + Copy reflect it right away (no rebuild;
Copy re-reads the file on each click). Hand the editor that page; he previews, copies a
card, edits it with Gemini, pastes it into the render tool.

The render tool (the no-terminal "paste HTML, get MP4" web app) lives at
**https://render2.agrolloo.com** (source: `personal-stuff/apps/hyperframes-render`).

## Editing a card for a video

You have two ways. Pick whichever is easier for the moment.

### Option A — change the content in the file (Gemini-friendly)

Open the card's `index.html`. Near the bottom there's a block marked `===== CONTENT =====`:

```js
const DATA = {
  number: '02',
  title: 'The Winners',
  dots: 6,
};
```

Change those values. That's it. It's normal HTML, so you can paste the file into
Gemini and ask it to change the text, swap the title, recolor it, whatever — just
tell it: **only change the CONTENT block and the `:root` colors, never the TIMELINE.**
The timeline is the motion; leave it alone and every card keeps the same smooth feel.

### Option B — pass the content at render time (no editing at all)

The card also reads values straight from the render command, so you can keep the file
untouched and just hand it the text for this video:

```bash
npx hyperframes@latest render section/section-counter-scale \
  --variables '{"number":"04","title":"Final Verdict"}' \
  -o renders/final-verdict.mp4 --fps 30
```

Same card, different number and title, no code touched. Good when you're making the
same card for a bunch of videos.

## Rendering to video

From inside this folder:

```bash
npx hyperframes@latest render section/section-counter-scale -o renders/out.mp4 --fps 30
```

Add `--quality high` for a crisper (4K) file. First render downloads Chrome once
(~100 MB), then it's cached.

Want to preview it live in the browser while you tweak (like the old preview screen)?

```bash
npx hyperframes@latest preview
```

## The hosted renderer (no terminal)

The editor never opens a terminal. He uses the web tool at
**https://render2.agrolloo.com** — paste the card HTML, click Render, download the
MP4. It runs `hyperframes render` server-side in Docker (Chrome + ffmpeg baked in).
Source and deploy notes: `personal-stuff/apps/hyperframes-render`.

(This replaced the old `html-to-video` tool at render.agrolloo.com, which has been
fully removed.)

## Notes

- Node.js is the only requirement. Everything runs through `npx hyperframes`.
- A card folder only needs `index.html`. The shared `hyperframes.json` / `meta.json`
  at the root make the whole thing a Hyperframes project.
- `npm` here is pinned to the public registry via `.npmrc` (the global npm points at a
  work registry that 401s on these packages).
- Lint a card before rendering: `npx hyperframes@latest lint section/section-counter-scale`.
  The "Studio can't drag-edit these elements" and "Google Fonts" warnings are expected —
  the motion is locked on purpose, and the fonts load fine online.

## Beat contract (progressive-reveal cards)

1. A **beat card** accepts two extra variables: `beats` (array; item shape is card-specific
   and listed in `catalog.json` as `beat_shape`, always plus a required numeric `at` = seconds
   from card start) and nothing else new. Reveal timing comes ONLY from `beats[].at`.
2. The TIMELINE block builds reveals with `DATA.beats.forEach(...)` — no hardcoded per-item
   offsets. Entrance motion (easing, direction, duration of each reveal animation) stays fixed
   per card.
3. Defaults in `data-composition-variables` must encode the card's current 6s look, so the
   gallery preview and a variable-less render look exactly like today.
4. Card `data-duration` stays static in the file. Per-cue durations are applied by the flow's
   render step, which rewrites the attribute in a staged copy — cards must keep ALL their
   `data-duration` attributes at one identical value so a global rewrite is safe.
5. Single-shot cards (no progressive reveals) are exempt; they are `"kind": "single"` in
   catalog.json.
