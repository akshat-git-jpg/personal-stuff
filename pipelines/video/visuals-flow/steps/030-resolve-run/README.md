# 030 · resolve · [RUN]

- **In:** `videos/<slug>/cues.json`, `videos/<slug>/transcript.json`, `card-library/catalog.json`
- **Out:** `videos/<slug>/resolved.json` (absolute times + merged variables)
- **Run:** `bash run.sh <slug>` (equivalent to `node lib/resolve.mjs <slug>`)
- **Next:** step 040 — owner reviews on the storyboard board

Matches each cue's anchor forward-only against the transcript; a bad or
out-of-order anchor is a hard error (exit 1, no `resolved.json` written). Also
callable with a path instead of a slug — see `lib/resolve.mjs`'s slug-or-path
resolution.
