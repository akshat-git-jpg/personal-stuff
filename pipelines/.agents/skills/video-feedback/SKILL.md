---
name: video-feedback
description: >
  Generate a frame.io-style HTML review tool for ANY video so Luuk can scrub, drop
  timestamped (and point-pinned) comments, and export them "for Claude" — then parse
  that feedback back into structured notes to act on. TRIGGER when Luuk wants to review
  a video, leave timestamped feedback/comments on a cut, "set up a reviewer / review
  tool / frame.io for this video", or pastes exported review feedback for you to apply.
---

# video-feedback — review any video, act on timestamped notes

A tiny, self-contained review tool (no accounts, runs locally) modeled on frame.io.
Two directions: **generate a reviewer** for a video, and **read back** the feedback.

## 1. Generate / update a reviewer (with version control)
```
python3 scripts/make_review.py <video_path> [--project NAME] [--label vN] [--open]
```
ONE reviewer per PROJECT: `~/Downloads/<project>-Review/`. Each call ADDS the video as a
version — a **dropdown** in the tool switches versions (newest = "latest", default), and
**each version keeps its own comments**. Project + version are auto-derived from the filename
(`NO_SIGNAL_v5.mp4` → project `NO_SIGNAL`, version `v5`); override with `--project`/`--label`.
Re-run on every new render — the **URL/port stay the same per project**, so Luuk keeps one bookmark.

**ALWAYS SHARE THE LOCALHOST URL (non-negotiable).** Every time you deliver, generate, or update a
reviewer/version, (1) make sure the server is running (`nohup python3 <project>-Review/serve.py &` if
`curl http://127.0.0.1:<port>/review.html` isn't 200 — the port is printed by `make_review.py` and is
in `serve.py`), and (2) end your message with the clickable URL: **`http://localhost:<port>/review.html`**.
Don't just say "reload the tool" or "open Open Review.command" — paste the actual URL so Luuk can click
straight through. The port is stable per project, so it's the same URL every version.

Folder contents:
- `review.html` — player + comment UI + version dropdown (BuildLoop-branded, keyboard-driven).
  Hovering the timeline shows a **live preview thumbnail** of that frame + its timecode (YouTube-style scrub).
- `versions/<label>.mp4` — symlink per version · `versions.json` — the version list (newest first)
- `serve.py` — Range-supporting local server (required for scrubbing; `file://` won't scrub)
- `Open Review.command` — double-click to serve + open

FPS is auto-detected. **Refreshing the page is safe** — notes live in `localStorage` keyed
`review:<project>:<version>`, so a reload keeps everything; only "Clear all" wipes them.

How Luuk uses it: open it, **just start typing** at any moment to attach a note to that
exact frame (video pauses, time locks); **click a spot on the frame** to pin a note to an
x/y position; then **"⧉ Copy for Claude"** (clipboard) or **"Download .txt"**.

## 2. Read the feedback back
The reviewer **auto-writes notes to disk** through serve.py (POST /feedback) on every change, and
the "✓ Send to Claude" button forces a write. So Luuk no longer has to copy-paste — when he says
**"feedback done"** (or "I left notes", "read my feedback"), read the newest file yourself:
```
~/Downloads/<PROJECT>-Review/feedback_latest.txt      # always the most recent version's notes
~/Downloads/<PROJECT>-Review/feedback_<label>.txt     # a specific version
```
Then apply them. (Copy-paste still works too — Luuk can paste the text or give a `<label>_feedback.txt`.)
Parse either with:
```
python3 scripts/parse_feedback.py <feedback.txt>     # or pipe the pasted text on stdin
```
Export format (one note per line):
```
[1:23.4] pos 31%,62% — the two event cards overlap here
[0:23.0] — hook is too busy, simplify
```
Parser returns JSON `[{t: seconds, mmss, x, y, text}]`, timecodes → seconds so you can map
each note straight onto the edit plan / render (e.g. the film_plan beats) and apply fixes.

## 2b. Reply on each note — check them off live, ask when vague (act like an editor)
As you work the notes, write your status back so it shows up live on each note in the reviewer
(the page polls `claude_status.json` every 2.5s):
```
python3 scripts/post_status.py <review_dir> "<PROJECT · vN>" '{"<noteId>":{"status":"fixed","message":"..."}}'
```
Use the note **ids from `feedback_latest.json`**. Per note set one of:
- `"fixed"` → ✓ what you changed ("pushed the clip 5s later")
- `"skipped"` → ✗ why not
- `"question"` → ❓ a clarifying question — **only when the note is genuinely too vague to act on.**
  Luuk gets an inline reply box; his answer syncs back into `feedback_latest.txt` as `↳ answered: …`,
  which you read on the next "feedback done". Default to acting; ask only when guessing would waste a round.
Write statuses incrementally (fixed ones as you go, then the questions) so Luuk watches them tick off.

## 3. Close the loop — make feedback compound (do this every round)
After applying a batch of notes, split each one:
- **Taste call for THIS video only** → just fix it.
- **A general preference** (would apply to a future, different video too) → fix it AND append the
  generalized rule to the **`video-taste`** skill (`universal.md`, `by-type/*`, or `by-subject.md`).
Then RE-READ the relevant `video-taste` file before regenerating, so you never undo a prior lesson.
This is what turns N rounds of feedback into a shrinking list next time — a note given once is never
needed again. (Mirrors how `me-context-update` grows `me-context`.)

## Notes
- Comments persist in the browser's `localStorage` (key `bbreview:<label>`), so they survive
  reloads; the export is the source of truth you act on.
- To review a NEW cut of the same video, re-run `make_review.py` on the new file (or use the
  in-tool "Load video…" button); notes are keyed per label.
- This pairs with the b-roll / vlog render pipeline: review a render → parse notes → adjust the
  plan → re-render.
