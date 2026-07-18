# 050 · render · [RUN] (last step)

- **In:** `videos/<slug>/resolved.json`
- **Out:** `videos/<slug>/renders/*.mp4|mov` (final clips, gitignored) +
  `videos/<slug>/manifest.md` (committed editor manifest)
- **Run:** `bash run.sh <slug> [--only <cueId>] [--quality draft|standard] [--force]`
  (equivalent to `node lib/render.mjs <slug>`)

Before rendering, the script enforces two gates: it requires `cues.json` to have `approved: true`, and it verifies `resolved.json` is perfectly fresh compared to a real-time re-resolution of `cues.json`. Pass `--force` to override both gates.

Stages each card in a scratch dir per cue (copies `hyperframes.json`, `meta.json`,
and the card folder from `card-library/`, rewrites `data-duration`, renders via
a pinned `hyperframes` version overrideable via `HYPERFRAMES_VERSION`), verifies the rendered duration with `ffprobe`
within tolerance, then writes `manifest.md` at the workdir root. The manifest is derived directly from clips existing on disk, so re-running with `--only` refreshes that clip and the manifest keeps every other existing row.
