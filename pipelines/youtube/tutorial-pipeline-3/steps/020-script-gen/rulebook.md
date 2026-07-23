# Script generation rulebook (step 020)

You are writing the full narration script for a VO-first tutorial video. The
voiceover generated from this script is the master timeline: a freelancer will
record the screen while listening to it, section by section. Nothing you write
can be fixed by editing later — the script IS the video's spine.

## Inputs (read all before writing)

1. `videos/<slug>/inputs/topic.md` — the topic, channel, target length.
2. `videos/<slug>/inputs/vision.md` — the owner's angle and must-cover points.
   Every point in vision.md must be covered or explicitly listed as dropped in
   your self-check.
3. `videos/<slug>/inputs/transcripts/` — competitor transcripts on this topic.
   These are your factual ground truth for what the tool does.
4. The tool's dossier: `pipelines/youtube/dossiers/tools/<tool>.md` (if present).
5. The channel's script Style DNA pack under
   `pipelines/youtube/competitor-styles/` — match its voice, pacing, and hook
   conventions. Do not import another channel's voice.

## Output

Two files in `videos/<slug>/`:

- `script.json` — conforming to the contract in `PIPELINE.md` (stage:
  "generated"). Run `node lib/lint-script.mjs videos/<slug>/script.json` and fix
  every error before you finish.
- `script.md` — a human-readable render for the tutorial maker: per section, a
  heading `## s01 [demo]` or `## s01 [no demo]`, the display text, the notes
  line, and each flag on its own line as `> FLAG (VERIFY): exact button label`.

## Sectioning rules

- A section is one continuous beat of narration, 45–170 words (about 20–60
  seconds spoken). Shorter is better than longer: the freelancer records one
  clip per demo section, and a blown take costs the whole section.
- One screen context per demo section. If the narration moves from the pricing
  page to the editor, that is two sections.
- Every section must stand alone at its start: no "as I just showed" across a
  section boundary that a cutaway could break.
- Order sections for the viewer, not for the tool's menu structure.

## The demo flag

- `demo: true` = the narration describes actions or states visible on the
  tool's screen. The freelancer WILL record this section. Its recording.status
  starts as "pending".
- `demo: false` = talk: context, opinion, comparison, verdict. No footage will
  ever exist for it (avatar or graphics cover it downstream). Its
  recording.status is "none".
- When in doubt, prefer demo: false — an unnecessary recording costs money; a
  missing one costs a re-record round.

## Flags: never guess UI facts

You have not seen the tool's current screen. Any claim about exact UI text,
menu paths, button labels, on-screen prices, or dialog contents must be a flag,
not a guess:

- `[VERIFY: <what to confirm>]` — you believe the surrounding text is right but
  a human must confirm it against the live tool.
- `[FILL: <what to write, rough notes are fine>]` — you cannot write this part
  at all without seeing the tool; the tutorial maker fills it.

Every inline marker must have a matching entry in the section's `flags` array.
Facts that come verbatim from a transcript or the dossier do not need a flag —
cite nothing, just write. Inventing a menu path without a flag is the one
unforgivable error in this step.

## Grounding rules

- Every factual claim must be traceable to topic.md, vision.md, a transcript,
  or the dossier. If it is in none of them, either flag it or cut it.
- Prices, plan names, and limits change: anything numeric about the tool that
  will appear ON SCREEN gets a `[VERIFY: ...]` even if a transcript states it.
- Never reference the freelancer, the recording process, or "this video's
  script" in narration text.

## Style rules

- Match the channel Style DNA pack for hook shape, sentence rhythm, and
  vocabulary. The hook is section s01 and is always demo: false.
- Write for the ear: short sentences, no parentheses, numbers under 13 spelled
  out. Avoid tongue-twisters — this text goes to TTS verbatim.
- `notes` is for the recorder ("stay on the dashboard", "scroll slowly") and
  for QC (it names the expected on-screen event) — write one whenever the
  section expects a specific visible moment.

## Self-check (do this before finishing, in order)

1. Lint passes: `node lib/lint-script.mjs videos/<slug>/script.json` → exit 0.
2. Every vision.md point is covered, or listed by you as deliberately dropped
   with one line of reasoning.
3. Read s01 aloud: would the target viewer keep watching? If unsure, rewrite it
   once before finishing.
4. Count flags: a typical 8-minute tutorial has 5–15. Zero flags on a script
   full of UI claims means you guessed — go back and flag. More than 25 means
   the knowledge base was too thin; say so in your final report.
5. Confirm every demo section names, in its text or notes, something visibly
   checkable on screen.
