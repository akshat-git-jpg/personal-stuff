# 055 - review the plan markdown

**[OWNER]** &nbsp; You read the raw markdown first and get your edits in cheap.

The owner reads `videos/<key>/script-plan.md` as plain markdown — in an editor, no server, no browser — and gives feedback the session applies to that same file. Added 2026-08-23 (owner): reading a file is faster than booting the desk, so wording and structure fixes land here, and 060 is left to catch only what breaks in the two-track UI.

**Reads:** `script-plan.md`

**Gate:** the words are right in the markdown

---

## What you do

Open the file:

```
pipelines/youtube/yt-script/videos/<key>/script-plan.md
```

Read it top to bottom. Say what to change in the terminal and the session edits
that same file. You can also edit it yourself — it is the source of truth, not a
generated copy, so nothing has to be regenerated afterwards.

Then say go, and step 060 opens the desk on the file you just approved.

## Why this comes before the desk

Two different questions, and the cheap one goes first.

- **055 asks: are the words right?** Section order, what a beat covers, a claim
  that came out wrong, a beat that should not exist. All of that is visible in the
  markdown, and reading a file costs nothing.
- **060 asks: does it read right in the UI?** A beat that is fine as markdown but
  splits badly across the two tracks, a `SHOW` lane that says nothing once it is
  on its own, an instruction track he will misread. Only the desk shows that.

Booting the desk to catch a wrong section order is the slow way round.

## Watch for

- **Do not repair the format by hand.** The lane forms in
  `SCRIPT-PLAN-INSTRUCTIONS.md` are parsed by `lib/beats.mjs`, and an unrecognised
  form falls through to plain prose **silently** — no error, no lane. If a lane
  looks wrong, say so and the session fixes it against the instructions.
- **A body `SAY` is meant to read like a prompt, not a finished line.** That is
  correct, not a gap. Finished copy there is the bug.
