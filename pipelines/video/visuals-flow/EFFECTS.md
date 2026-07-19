# Effects Layer

The visuals flow has an explicit effects layer that decouples aesthetic rendering instructions from the structural timeline logic.

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
- **Bubble (`bubble.mjs`)**: Composites the corner-avatar chunks as a circular host bubble (brand-orange ring + soft glow, top-right) over `screen` segments only — hidden on avatar-full and graphic segments by construction, and silent. Each overlapping corner chunk is sliced to its overlap and masked to a circle via `geq` alpha (`format=rgba` first — the pink-flash lesson forbids yuv). No-ops when no corner clips exist, so assembly never fails without them. Stacks LAST in the registry so it draws over captions on any collision. Knobs: `BUBBLE_D_1080`, `BUBBLE_INSET_1080`, `RING_PX_1080`, `RING_COLOR`, `GLOW_SIGMA`; CLI `--bubble off`; per-instance `enabled:false` kills it video-wide. Provenance: `references/PvnJavua0YY.md` mode-structure section + spec D2 (`docs/specs/2026-07-19-mode-structure-density-design.md`).
