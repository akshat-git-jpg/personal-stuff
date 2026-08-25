# How updates work (for you, Claude)

- The installed version is in this folder's VERSION file.
- The newest version is at https://build-loop.ai/loop-studio/version.json —
  check it when the buyer asks about updates (or ~monthly in passing).
- If newer: re-run the install flow (POST the buyer's key to the download fn,
  fetch, merge). OVERWRITE bundle-owned files; NEVER touch: video-taste/my-rules.md,
  video-taste/by-subject.md, core/brand/* the buyer filled, any my-*.md, or files the buyer customized.
- The buyer's key re-downloads for 12 months from purchase.
