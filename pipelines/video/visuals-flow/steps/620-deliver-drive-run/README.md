# 620 · deliver to Drive · [RUN]

Upload the **approved full-resolution final** back to the video's own Drive
folder — the `Output/` subfolder of the folder that also holds `Input/`
(owner ask 2026-08-01: "render the final best-quality video back to the source
drive output folder").

- **In:** `~/kb-scratch/video/visuals-flow/<slug>/final.mp4` (the full-res
  assemble, which itself refuses to build without the 120 approval),
  `run-config.json` `drive_folder` + `drive_account` (step 005)
- **Out:** `Output/<slug>-final.mp4` in the video's Drive folder
- **Skip when:** the video has no Drive folder (a local-only run) — record
  `skipped` in the ledger with that reason.
- **Next:** nothing — this is the last step of a delivery run. (140
  davinci-export stays on-request and is unrelated.)

```bash
bash run.sh <slug> deliver
```

## Ordering and gates

1. **The final-cut approval (530) is checked here AGAIN and is never waived** —
   delivery without an approved `final-cut.json` exits 1. Plan 194 removed
   express review, so no run-config setting can skip it.
2. The uploaded file is the **full-resolution** `final.mp4`, never
   `final-draft.mp4` — drafts are review material, not deliverables. If the
   final is missing, build it first: `node lib/assemble.mjs <slug>` (no
   `--draft`).
3. Re-delivery is safe: the upload passes `--overwrite`, so a fixed final
   replaces the old file in place instead of stacking copies. If cues/shots
   changed since the last full-res assemble, re-run the assemble before
   delivering — this step ships whatever `final.mp4` is on disk.

## Configuration (step 005)

```bash
bash run.sh <slug> configure --drive-folder <folder-id> --drive-account <email>
```

- `drive_folder` — the id from the folder's URL
  (`drive.google.com/drive/folders/<ID>`). It is the video's TOP folder (the
  one containing `Input/` and `Output/`), not the `Output/` folder itself —
  the step finds-or-creates `Output/` so the convention holds even on a fresh
  folder.
- `drive_account` — which OAuth token uploads
  (`tooling/cli/drive/pp-drive accounts` lists them; the account must have
  write access to the folder).

Uses `tooling/cli/drive/pp-drive` — no MCP, shared Google token cache.
