# 050 · render · [RUN] (last step)

- **In:** `videos/<slug>/resolved.json`
- **Out:** `videos/<slug>/renders/*.mp4|mov` (final clips, gitignored) +
  `videos/<slug>/manifest.md` (committed editor manifest)
- **Run:** `bash run.sh <slug> [--only <cueId>] [--quality draft|standard]`
  (equivalent to `node lib/render.mjs <slug>`)

Stages each card in a scratch dir per cue (copies `hyperframes.json`, `meta.json`,
and the card folder from `card-library/`, rewrites `data-duration`, renders via
`npx hyperframes@latest render`), verifies the rendered duration with `ffprobe`
within tolerance, then writes `manifest.md` at the workdir root (not inside
`renders/`, since `renders/` is gitignored and the manifest is a committed
text artifact).
