# visuals-flow

This is the motion graphics pipeline (core idea, enacted cards, sound design, dense motion).
- **Spec**: [docs/specs/2026-07-24-visuals-flow-v2-design.md](../../../docs/specs/2026-07-24-visuals-flow-v2-design.md)
- **Fallback**: v1 (`../visuals-flow`) remains frozen but functional as a fallback.
- **Entry point**: `bash run.sh <slug> status` to see where a video is, or `bash run.sh <slug> <step>` to run it.
See [PIPELINE.md](PIPELINE.md) for the flow and schemas, and [INTEGRATION.md](INTEGRATION.md) for caller contracts.

**Golden no-regression check** (`scripts/golden.mjs`, for assemble.mjs changes; needs local media, so it is not in `scripts/check.sh`):
- `node scripts/golden.mjs check --plan-only` (~10s) diffs every ffmpeg argument list plus assembly.md against `tests/golden/<slug>/plan.json`.
- `node scripts/golden.mjs check` (~5 min) also re-encodes a draft and compares 20 frames by SSIM; `record` rewrites the snapshot after an intended change.
- Media is a frozen copy in `~/kb-scratch/video/golden/<slug>/` (reference frames in `frames/`); `stage` recreates it from the live workdirs.
