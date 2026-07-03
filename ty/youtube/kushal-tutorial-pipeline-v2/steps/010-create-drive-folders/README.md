# 010 · create-drive-folders  ·  [RUN]  (first step)

Creates the empty handoff folder tree in Google Drive **up front**, so the structure exists from
day one and step 170 only has to upload files into folders that already exist — step 170 never
creates folders.

- **In:** a video title (`--title`)
- **Out:** the folder tree in Drive under `<drive-root>` (default `video production`) +
  `output/<title>.drive-folders.json` (maps each subfolder → its Drive id, read by step 170)
- **Run:** `python3 run.py --title "Video Title" [--account EMAIL] [--drive-root "video production"]`
- **Next:** run the pipeline; step 170 `--drive` uploads produced files into this structure

Creates, under `<drive-root>`:

```
<title>/
  script-writer/{input, output}
  video-editor/
    input/{full-block-spokesperson, talking-head-spokesperson, plan, audio, screen-recording}
    output/
```

Uses `lib/drive.py` → the `pp-drive` CLI (sibling `personal-stuff/tooling/cli/drive/`), which reuses
the Google OAuth token cache. **Idempotent:** re-running finds the existing folders. Pass the **same
`--title`** to step 170 so it locates this step's manifest.
