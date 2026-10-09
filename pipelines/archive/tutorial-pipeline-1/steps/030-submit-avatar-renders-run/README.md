# 030 · submit-avatar-renders  ·  [RUN]  (submits only — NO polling)

- **In:** step 020's extracted audio + `shared/avatar_mapping.py`
- **Out:** `output/<title>.heygen-manifest.json` (one job per segment, with `video_id` once real)
- **Run:** `python3 run.py [<video_title>]`
- **Next:** step 040 waits + downloads once renders finish

Each job calls `heygen-web generate-from-template --template <id> --audio <file>` — real,
HAR-verified 2026-07-09. `shared/avatar_mapping.py`'s ids are HeyGen TEMPLATE ids (a
pre-composed background + avatar bubble, already correctly framed) — see
`tooling/cli/heygen-web/API-REFERENCE.md`'s "Create from template" section. The same template
renders every segment; there's no per-segment engine split anymore.
