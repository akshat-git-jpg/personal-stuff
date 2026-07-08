# 030 · submit-avatar-renders  ·  [RUN]  (submits only — NO polling)

- **In:** step 020's extracted audio + `shared/avatar_mapping.py`
- **Out:** `output/<title>.heygen-manifest.json` (one job per segment, with `video_id` once real)
- **Run:** `python3 run.py [<video_title>]`
- **Next:** check HeyGen yourself; step 040 downloads once renders finish

Each job calls `heygen-web generate-from-audio`, whose HTTP body is a `[TODO][HNS]` stub until the
audio-upload request is captured (see `tooling/cli/heygen-web/HANDOVER.md`) — jobs come back
`status: "stub-not-wired"` until then; this step still runs end-to-end today.
