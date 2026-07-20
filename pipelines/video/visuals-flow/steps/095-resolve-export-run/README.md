# 095 — Resolve timeline export

Turns an assembled video into a DaVinci-Resolve/Premiere-importable timeline
for human touch-up: `timeline.fcpxml` + full-res segment clips (overlay-free
V1 base cut; overlays ride lane 1 as separate movable clips; vo on lane -1).
Enforces the same gates as step 090 (approvals, downloads, media present) and
shares `assembly-cache/`.

    bash steps/095-resolve-export-run/run.sh <slug> [--bundle] [--jobs N]

Out: `~/kb-scratch/video/visuals-flow/<slug>/resolve-export/`
(`timeline.fcpxml`, `segments/`, `README.md`; `--bundle` adds `media/` with
vo.mp3 + overlay movs copied in for a portable handoff).
