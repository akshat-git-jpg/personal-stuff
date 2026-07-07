# 170 · package-for-handoff  ·  [RUN]  (final step)

Assemble everything into the **Drive-style folder tree** you keep under "video production", ready
to upload. Mirrors your role/input/output convention.

```
output/<title>/
  script-writer/{input, output}
  video-editor/
    input/
      full-block-spokesperson/    ← A4 full-screen avatar videos
      talking-head-spokesperson/  ← A3 corner avatar videos (≤7-min parts)
      plan/                       ← visual-plan.md + avatar-fullscreen.md + .srt + timestamps
      audio/                      ← the full voiceover (one file)
      screen-recording/           ← you drop the raw recording here
    output/                       ← editor fills
```

- **Run:** `python3 run.py [<base>] [--title "Video Title"]`
- **Pulls from:** step 150 (avatar videos), 80 (visual plan), 50 (avatar script), 70 (srt/timestamps),
  60 (voiceover). Copies what exists; `HANDOFF.md` lists what's included and what's still missing.
- **Then:** add the screen recording, and upload `output/<title>/` into Drive → video production.

Mechanical copy only — no transforms. Re-run anytime (e.g. after step 150 download lands the videos).
