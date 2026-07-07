# Rulebook — 4/010 plan-visuals

Run in a Claude Code session on model Opus.

1. Take `--slug <channel>` from the operator.
2. Check `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
   exists. If not, STOP and tell the operator: "No video-style-dna.md for
   '<slug>'. Run yt-style-copy build-video-style-dna <slug> first (requires
   video-metrics.json to be non-empty), then re-run this step." Do not proceed.
3. Read the voiceover's total duration: the LAST segment's `end` value in
   `../../3-voiceover/050-make-timestamped-transcript-run/output/<base>.timestamps.json`.
   This exact number (seconds) is your target — the plan's cues must sum to
   it, not approximate it.
4. Read the approved script
   (`../../2-scripting/030-clean-script-for-tts-run/output/<base>.tts-ready.txt`)
   and the timestamped transcript's segments for wording-to-timestamp alignment.
5. Read `video-style-dna.md`'s sections: Cut pacing (cuts-per-minute — this
   sets how many cues you plan, roughly `duration_minutes * cuts_per_minute`),
   B-roll patterns, On-screen text & captions, Motion graphics & animation,
   Framing & composition, Do-not list. Note the Identity-snapshot's visual
   format/aspect-ratio; if it implies anything other than 1920×1080 landscape,
   flag this explicitly in the plan's header for the human to confirm at 030.
6. Write `output/<base>.visual-plan.md`: an ordered list of cues, each with
   `start` / `end` timestamps (matching the voiceover's own segment
   boundaries where natural), an `intent` (what's on screen — kinetic
   typography / stat callout / B-roll-style graphic / transition), and which
   `video-style-dna.md` pattern it imitates (cite the section). The LAST
   cue's `end` must equal the voiceover's total duration from step 3, exactly.
7. Report to the operator: cue count, target duration, and any aspect-ratio
   flag from step 5.
