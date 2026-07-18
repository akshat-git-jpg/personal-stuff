# 080 · avatar-render  ·  [RUN]  (submit + download are separate invocations)

Turn the approved shot plan into avatar clips: one HeyGen 3 TEMPLATE render per
full-screen span + contiguous corner chunks covering the whole VO. Test mode
only (`engineMode: "test"`) — the HeyGen 4 production path does not exist yet
(design doc `docs/specs/2026-07-18-avatar-shot-plan-design.md`).

- **In:** approved `shots.json` + fresh `shots.resolved.json` + `resolved.json` + `vo.mp3`
- **Out:** `avatar-jobs.json` (committed) · clips in `~/kb-scratch/video/heygen/visuals-flow/<slug>/` (media policy — never in the repo; RENDERS.md rows auto-appended on submit) · `avatar-manifest.md` (committed)
- **Run:** `bash run.sh <slug> --template <registry-slug> --submit` → wait for HeyGen → `bash run.sh <slug> --download` (re-run until no `pending:` lines)
- **Rules:** live HeyGen calls are owner-run only (ToS-grey — heygen-web CLAUDE.md); anti-ban pacing is built in; template slug comes from `pipelines/video/heygen/registry.json`.
