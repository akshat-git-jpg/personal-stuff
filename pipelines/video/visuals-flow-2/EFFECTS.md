# Effects Layer

The visuals flow has an explicit effects layer that decouples aesthetic rendering instructions from the structural timeline logic. (Audio design lives in lib/sound/ — see PIPELINE.md).

## Pipeline Architecture

The pipeline consists of three steps:

1. **plan**: `resolve.mjs` maps words to visual components and creates `resolved.json`.
2. **effects-plan**: `effects-plan.mjs` takes the structural `resolved.json`, runs the effects registry modules to compute default effect instances, merges them with any manual overrides in `effects.json`, and writes out the final `effects.json`.
3. **assemble**: `assemble.mjs` executes the assembly. It passes the manifest through the effect modules to compute FFmpeg filter chains and visual rendering choices.

## The JSON Contract (effects.json)

The `effects.json` manifest is a simple document defining a list of visual effect instances.

```json
{
  "video": "slug",
  "instances": [
    { "id": "whip-12.0", "type": "whip", "at": 12.0, "direction": "left", "enabled": true },
    { "id": "beat-15.5", "type": "beat", "at": 15.5, "punch": 1.08, "enabled": true },
    { "id": "captions", "type": "captions", "fontPx": 72, "enabled": true }
  ]
}
```

The system preserves any manually modified fields during regeneration. Setting `"enabled": false` turns off the effect instance.

## The Registry & Module Interfaces

Effects are implemented as independent modules registered in `lib/effects/registry.mjs`. Each module exports an interface up to 3 optional hooks:

1. **`plan(ctx)`**: Analyzes the structural timeline to produce a list of default effect instances.
2. **`transformSegments(segments, instances, ctx)`**: Modifies the base timeline segmentation before rendering. (e.g., used by `beats.mjs` to split a continuous avatar shot into distinct sub-segments for punch-ins).
3. **`contribute(seg, instances, ctx)`**: Yields FFmpeg filter chain instructions for a specific video segment.

## Core Modules

- **Whip (`whip.mjs`)**: Inserts transitions at boundaries. avatar→screen and →graphic only; cuts INTO the host are hard by design (reference asymmetry). Provenance: spec D3.
  - `blur` (default): whip-pan transitions on `avatar>screen` boundaries. Skip if <1s segment or overlapping overlay.
  - `flash`: brightness-bloom wipe on `screen>graphic` and `avatar>graphic` boundaries. Skip rules same as blur. Knobs: `FLASH_GAIN`, `FLASH_COLOR`, per-instance `style`. Reference: `references/vPqSgj8Ta3Y.md` moment 1:27.2.
- **Beats (`beats.mjs`)**: Synchronizes zoom punch-ins on avatar shots with transcript gaps and overlay cue placements. Knobs: `BEAT_MIN_SPAN`. Provenance: spec D3.
- **Captions (`captions.mjs`)**: Renders burned-in word-level captions on screen segments. Load-bearing words render in brand orange via `markKeyword` (numbers/currency/percent, `CAP_ACCENT_LEXICON` brand names, ALL-CAPS emphasis — `lib/captions.mjs`); the rest white with black outline. Knobs: `CAP_ACCENT_LEXICON`, `fontPx`/`yFrac` per instance. Provenance: `references/-vwHldNaGPI.md` (spoken-sync keyword highlight; plan 096).
- **Drift (`drift.mjs`)**: Adds a slow Ken Burns effect to static screen segments.
- **Bubble (`bubble.mjs`)**: Composites the corner-avatar chunks as a circular host bubble (brand-orange ring + soft glow, top-right) over `screen` segments only — hidden on avatar-full and graphic segments by construction, and silent. Each overlapping corner chunk is sliced to its overlap and masked to a circle via `geq` alpha (`format=rgba` first — the pink-flash lesson forbids yuv). The ring+glow is drawn on a PADDED canvas (`S = D + 2*PAD`, `PAD ≥ 3*GLOW`) and composited at `OX-PAD`/`OY-PAD`: at exactly `DxD` the ring sits on the canvas edge and `gblur` gets clipped by it, which renders as a hard-edged rectangle around the bubble (fixed 2026-07-20). Sizing is measured off `references/vPqSgj8Ta3Y.md` — bubble ≈28% of frame height, hugging the corner; note the doc's "~120px" is a ~480-tall-frame measurement, not a 1080 value. No-ops when no corner clips exist, so assembly never fails without them. Stacks LAST in the registry so it draws over captions on any collision. The ring is TWO INDEPENDENT LAYERS, because radial profiles taken off a high-zoom reference still show two different shapes, not one band at two brightnesses: away from the gleam a sharp ~5px-FWHM spike with **no halo**, at the gleam a blown-white ~12px-FWHM plateau reaching ~22px. So (1) a constant-colour hairline (`RING_PX_1080`, `CORE=1` blur for anti-aliasing only, no glow of its own), and over it (2) a travelling bloom — a **wider** band (`GLEAM_PX_1080`, near-white `GLEAM_COLOR`) whose ALPHA is shaped by `min(1, pow(...)^RING_SPIN_SHARP * RING_SPIN_BOOST)` and then softened by `GLEAM_SIGMA_1080`. The clamp gives the arc a flat top so it spans ~±40° as measured. That width difference is load-bearing: a gleam expressed as a colour shift *inside* the hairline keeps a uniform-width ring and does not read as motion around the circle (the 2026-07-20 first two attempts both failed this way). **The RATIO is the thing the eye reads — target ~2.40x** (reference: hairline 1.16% of D, gleam 2.78%); a third attempt got both layers individually plausible but left the ratio at 1.19x and still looked wrong. Band edges are centred on `R` and exactly their nominal width — the old `R-RING-1 .. R+1` form was silently `RING+2` wide, which is what inflated the hairline. Ring/blur widths stay FRACTIONAL (rounding a 2px hairline to whole pixels is a 50% error at draft res). These constants **cannot be derived on paper** — a closed-form gaussian FWHM overestimates what `gblur ... steps=2` renders — so they are calibrated by rendering and measuring with `scripts/measure-bubble-ring.py`, which prints our proportions against the reference targets. Re-run it after touching any ring constant. The avatar is framed by `AVATAR_ZOOM` + `AVATAR_FOCUS_X/Y` (fractions of the SOURCE frame, tuned on `specs-man` — retune per template): fitting the full source height framed head-and-torso at ~58% head-to-diameter, the reference is a portrait at ~73%. Knobs: `BUBBLE_D_1080`, `BUBBLE_INSET_1080`, `RING_PX_1080`, `RING_COLOR`, `GLEAM_PX_1080`, `GLEAM_COLOR`, `GLEAM_SIGMA_1080`, `RING_SPIN_PERIOD`, `RING_SPIN_SHARP`, `RING_SPIN_BOOST`, `AVATAR_ZOOM`, `AVATAR_FOCUS_X`, `AVATAR_FOCUS_Y` (all 1080-referenced and scaled by canvas height, so 720p draft and 1080p final look identical); CLI `--bubble off`; per-instance `enabled:false` kills it video-wide; ring is a two-tone conic gradient whose bright arc rotates (period `RING_SPIN_PERIOD`s), phase-continuous across segments. Provenance: `references/PvnJavua0YY.md` mode-structure section + spec D2 (`docs/specs/2026-07-19-mode-structure-density-design.md`).
