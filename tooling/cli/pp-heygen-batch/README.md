# pp-heygen-batch

Reads `videos/<key>/heygen-selections.json` (produced by the yt-script desk in
avatar mode, plan 266), slices the per-section wavs to each selection's spoken
range, calls HeyGen via `tooling/cli/heygen-web`, downloads mp4s, and uploads
them to Drive.

Runs entirely on the owner's Mac. The HeyGen cookie stays local.

## Usage

    pp-heygen-batch <video-key> [--dry-run] [--engine mlx|faster]

Prints the Drive folder share link on the last line of stdout.

## Pool safety

Refuses to start if the sum of Avatar IV seconds requested exceeds the
`/1200` monthly pool remaining (read from `heygen-web usage`). Never
downgrades IV to III to fit — it stops.

## Dependencies

- `node`, `python3` with `mlx-whisper` or `faster-whisper`, `ffmpeg`, `ffprobe`.
- `tooling/cli/heygen-web/heygen-web.mjs` on the same repo checkout.
- `pp-drive` in `PATH` and authenticated for the target Google account
  (`kushalbakliwal25@gmail.com` by default).
