# review-studio: operate-doc

A review-only app over the recipes' video folders. It renders nothing and runs no pipeline step.

## Contract with the recipes

- It reads `pipelines/video/<recipe>/videos/<slug>/` and the recipe's media root (`~/kb-scratch/video/<recipe>/<slug>/versions.json`).
- Every write goes through the recipe's own code: visuals-flow's `appendFinalFeedback`, `saveFeedbackImages` and `applyFeedback` (for `_global` notes) from `lib/board.mjs`, and animate-flow's `appendFinalItem`. Never write a second copy of that logic here.
- Comments use the shared key `final-<version>:<n>`. The studio adds one optional field, `why`. Both old boards keep unknown fields when they edit.
- `lib/compat.test.mjs` runs the old visuals-flow board and the studio against one `feedback.json`. If it fails, the two boards have drifted.

## Adding a recipe

Add an adapter to `lib/recipes.mjs`: `videosDir`, `mediaDir`, `approved`, `timeline` (words, cards, parts), `addComment`, `dropImages`, `saveNotes` (or null).

## Layout

- `server.mjs`: the HTTP API and the built UI on port 4340 (`REVIEW_PORT` overrides).
- `lib/store.mjs`: list, detail, edit, delete, notes. Reads disk on every request, so the old board's writes show at once.
- `lib/media.mjs`: timeline thumbnails and voice peaks from ffmpeg, cached in `~/kb-scratch/video/review-studio-cache/`.
- `ui/`: Vite + React + TS. `npm run build` needs Node 22 (`source scripts/node22-path.sh` on the Mac).

## Test

```bash
npm test
```
