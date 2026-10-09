# Avatar Renderer

This is the UIfor the tutorial pipeline.

:## What it does
You paste a Google Drive folder link, and it generates 3 avatar clips (intro, body, conclusion) and puts them back into that folder's `output/` directory.

## How to run
1. Open the local-apps dashboard.
2. Press **Start** on **avatar renderer**.
3. Press **Open**.

## The folder rule
Your Google Drive folder **must be named like** `Something @ g1` or `Something @ g2`.
The `@ g1` or `@ g2` suffix is what picks the avatar.

The folder must contain your three recorded clips: `intro.mp4`, `body.mp4`, and `conclusion.mp4` (either in an `input/` folder or at the root).

## Timing
**It takes 15-20 minutes to run.** That is completely normal and not a hang! The system paces itself on purpose so it doesn't get blocked by the video provider. You can leave the tab open in the background while it works.

## Troubleshooting: Login Expired
If the page says the login expired, ask Kushal. That means the `infra/secrets/heygen-web-curls.txt` file needs a refresh, and only he can do it.

## One-time setup on a new Mac (for Kushal)
- `node`
- `ffmpeg` (`brew install ffmpeg`)
- The Google libraries on system python3: `python3 -m pip install -r tooling/mcp/google-shared/requirements.txt`
- **`infra/secrets/heygen-web-curls.txt`** — this file is gitignored and not in a fresh clone, so it must be copied in by hand.
- No `pipelines/venv` is required.
