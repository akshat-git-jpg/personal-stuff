# Video Review

A free frame.io-style review page for freelancer edits, at `review.agrolloo.com`.

- The owner signs in with a PIN, makes a **project** (one per video title) and sends its
  secret link to the editor.
- The editor opens the link (no login) and uploads each cut as a **version** with any name.
  The page refuses a file that is not an MP4, is over 720p, or is over 12 MB per minute.
  Export setting to give editors: **MP4 (H.264), 1280x720, 1.5 Mbps**.
- The owner watches a version, pauses and types a note. The note sticks to that second and
  to a dot on the frame (center unless the owner clicks a spot). The editor sees the notes,
  read-only, and clicking one jumps the video there.
- The owner marks one version **Final**. Uploads close; the editor sends the full-quality file
  on Google Drive, outside the app.

## Storage stays free (R2, 10 GB)

- Only the 2 newest video files per project are kept. Older versions keep their notes.
- Final keeps only the Final file. 30 days after Final, that file goes too.
- Half-finished uploads older than 48 hours are dropped.
- Uploads stop at 9 GB used.

Cleanup runs on upload, on Final, and when the owner opens the home page. There is no cron.

## Run locally

```
cp .dev.vars.example .dev.vars
npm install && npm run db:local
npm run build && API_PORT=8790 npm run dev:api     # app on http://localhost:8790
npm test                                            # unit tests
npm run fixtures && E2E_PIN=1234 npm run e2e        # full owner + editor flow in Chrome
```

Deploy steps are in `CLAUDE.md`.
