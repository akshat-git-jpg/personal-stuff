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

- **Whip (`whip.mjs`)**: Inserts whip-pan transitions on screen<->avatar boundaries.
- **Beats (`beats.mjs`)**: Synchronizes zoom punch-ins on avatar shots with transcript gaps and overlay cue placements.
- **Captions (`captions.mjs`)**: Renders burned-in word-level captions.
- **Drift (`drift.mjs`)**: Adds a slow Ken Burns effect to static screen segments.
