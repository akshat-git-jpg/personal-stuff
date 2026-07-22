# TTS-to-screen-recording sync: brainstorm handoff

**Date:** 2026-07-22
**Status:** problem open. The existing approach was reviewed and rejected by the owner. No replacement chosen yet.
**For:** a fresh session that will brainstorm this from scratch.

## The problem in one paragraph

A freelancer hands over a screen recording with their own narration. We take the transcript,
write a better script from it, and generate a TTS voiceover in the brand voice. The new audio
is now a different length from the original narration, and it no longer lines up with what is
happening on screen. When the voice says "click generate", the click already happened four
seconds ago. The question is how to put the new audio back in sync with the old video.

## Why this is hard

The screen recording has fixed-time events in it. Cursor moves, menus opening, a button
turning blue. Those cannot move. The original narration was recorded at the same moment as
those events, so it was glued to them for free. Generating new audio breaks the glue.

It gets worse over the length of a video. Measured in `pipelines/video/tts/SYNC-PROBLEM.md`:
TTS runs about 6% slower than the original narration, so a 158 second video came out with a
167 second voiceover. Every phrase lands a bit later than the one before it, and the error
piles up. By the end of a long tutorial you are many seconds adrift.

Two facts from that doc are worth keeping, because both were learned the hard way:

1. Slowing the TTS down makes sync worse, not better. The voice is already slower than the
   original, so slowing it pushes everything later still. Slowing only helps clarity.
2. Gaps only push one direction. Adding silence moves a phrase later, which is easy. Moving a
   phrase earlier only works until the gap hits zero, and since TTS runs long, earlier is the
   direction you usually need.

## What already exists (built, never run)

`pipelines/youtube/tutorial-pipeline-2` already contains a full answer to this problem. It is
real code, not a scaffold. It has never produced output.

| Step | File | What it does |
|---|---|---|
| 040 | `3-scripting/040-polish-script-for-delivery-sonnet/rulebook.md` | rewrites the script, and is supposed to also emit `segments.json`, the map |
| 125 | `4-voiceover/125-build-assembly-plan-run/run.py` (141 lines) | the retime arithmetic |
| 162 | `7-final-assembly/162-auto-assemble-run/run.py` (106 lines) | executes the plan with ffmpeg |

### How it works

The original narration is thrown away, but its Whisper word timestamps are kept. Those
timestamps act as labels on the footage: we know he said "now click generate" at 4:32, and
because he clicked while saying it, we know the click is at 4:32 too.

Step 040 writes a map. For each block of the new script, it records which slice of raw footage
that block is talking about:

```json
{"seg_id": 7, "raw_start": 272.0, "raw_end": 280.0, "script_text": "Now click generate."}
```

Step 125 then compares each block's footage length against its TTS length and stretches the
video to fit the audio:

```python
speed = footage_dur / target_dur      # 8.0s of footage over 9.4s of VO = 0.85
```

Guardrails are `SPEED_BAND = (0.85, 1.18)`. Anything the speed change cannot absorb becomes
either a freeze on the last frame (when footage is too short) or a `flag: true` for a human to
fix by hand (when footage is too long even at maximum speed).

The reason it stretches video rather than audio: a screen recording tolerates mild retiming and
a face does not. Nobody notices a cursor moving 9% faster. Everybody notices stretched speech.

The drift problem is handled by re-anchoring every block to its own VO start time. Block 7
starts when block 7's audio starts, whatever block 6 did. Errors cannot accumulate across
blocks, which is the main advantage over the older dub approach that anchored 22 second chunks
and applied one global speed.

### Where it stalled

There is no `segments.json` anywhere in the pipeline, and no `assembly-plan.json`. Step 040
produced `BODY_2.improved.txt` and `BODY_2.changelog.md` and never wrote the map. Step 125 has
nothing to join against, so the BODY_2 video stops dead after step 120.

## The owner's verdict

Reviewed on 2026-07-22 and rejected: "I don't think this is a viable approach."

The specific reasoning was not recorded, so a new session should ask rather than assume. For
what it is worth, these are the structural objections visible in the code, and any of them
could be what prompted the call:

- **The rewrite is not allowed to be a rewrite.** Step 040's rulebook (line 32) says of the
  order of steps: "They follow the recording. Don't reorder." It self-limits to small edits,
  and says a tight script should "pass through mostly untouched". That constraint is
  load-bearing, because a 1:1 block-to-footage map is the only thing making 125's arithmetic
  possible. So the promise of "write a better script" is mostly withdrawn by the fine print.
  You get to fix rambling and tighten the hook. You do not get to restructure.
- **It cannot add or remove content.** The rulebook's validation rule (line 71) is explicit:
  "Every sentence of `improved.txt` belongs to exactly one segment, in order." A sentence
  explaining something the freelancer never demonstrated has no segment to belong to, so it is
  forbidden by construction. Cutting a rambling section leaves footage belonging to no block.
  This is the sharpest statement of the tension in the whole pipeline, and it is worth reading
  the rulebook's schema section before proposing anything.
- **Sync is only guaranteed at block boundaries.** Inside a block, a click can still drift,
  because TTS sets its own word pace. `SYNC-PROBLEM.md` puts the ceiling on this whole family
  of approaches at sentence level, roughly ±0.3s, and says frame-perfect is not reachable this
  way.
- **Flags may not be rare.** The design bets that few blocks fall outside the speed band. That
  bet has never been tested against real footage, because the chain never ran. If flags are
  common, the human edit job comes back, and removing that job was the point.
- **The word matching is unverified.** 125 walks the VO word list and advances by word count
  alone, never checking that the words match. Nothing detects a slip, it just silently
  misaligns everything downstream.

## Prior art: do not re-derive this

`pipelines/video/tts/SYNC-PROBLEM.md` already worked through four options for this exact
problem. Read it first. Summary:

| Option | Idea | Ceiling |
|---|---|---|
| A | warp audio to video, anchor each sentence to its original timestamp | ~±0.3s, sentence level |
| B | warp video to audio with freeze frames and trimmed dead time | good, needs safe cut-point detection |
| C | VO first: generate TTS, then record the screen while listening to it | frame perfect |
| D | word-level anchoring on action words like "click" | tightest, fragile and artifact prone |

Two things follow from that doc:

**The owner already picked C, for a different pipeline.** decisions.md line 129, dated
2026-07-12: the final workflow is VO first, the tutorial maker records the screen while
listening to the finished voiceover, and the dub-flow sync work was retired. This is why
`pipelines/video/visuals-flow` needs no retiming at all. Its `assemble.mjs` says outright
"Master timeline = voiceover", and the only fitting mechanism in the whole file is a
freeze-extend on the tail. Its screen recordings are aligned by construction.

**C is not available here.** The recording already exists and the freelancer is gone. That is
what makes this problem different from the one already solved. SYNC-PROBLEM.md kept the dub
path alive only as "a legacy fallback for dubbing pre-existing recordings", which is exactly
the situation in tutorial-pipeline-2.

Also note that t-p-2's 125 and 162 are effectively a local re-implementation of option B, built
after the hub had already stopped investing in dub sync. Nobody appears to have connected the
two, which is worth knowing before anyone builds a third version.

## Open questions for the brainstorm

1. What was the actual objection to the map-and-retime approach? Everything else depends on
   this.
2. How much rewrite freedom is genuinely needed? If the honest answer is "a lot, because the
   raw recording is not good enough to just polish", then no approach that maps script blocks
   to existing footage will work, and the problem becomes generating visuals for the orphaned
   script rather than syncing to what exists.
3. Is a human pass acceptable, and how long? "No editor at all" and "sub-second sync on a
   rewritten script from pre-existing footage" may not both be reachable.
4. Does this need to work on BODY_2 specifically, or on a future recording where the contract
   with the freelancer could change? If the contract can change, option C reopens and this
   whole problem disappears.
5. Are avatar segments and motion graphics a sync tool rather than decoration? Cutting away to
   a fullscreen avatar or a graphic hides the screen entirely, which means those spans do not
   need to sync at all. They could absorb arbitrary amounts of script that has no matching
   footage. The existing design already reserves spans for `a4_block` but only treats them as
   content, never as slack.

Question 5 is the one I would push on first. It is the only idea in this list that turns the
rewrite freedom problem into something other than a tradeoff.

## Files worth opening, in order

1. `pipelines/video/tts/SYNC-PROBLEM.md` (the problem and the four options)
2. `pipelines/youtube/tutorial-pipeline-2/SPEC.md` section 2, "sync by construction"
3. `pipelines/youtube/tutorial-pipeline-2/4-voiceover/125-build-assembly-plan-run/run.py`
4. `pipelines/youtube/tutorial-pipeline-2/3-scripting/040-polish-script-for-delivery-sonnet/rulebook.md`
5. `decisions.md` line 129 (the VO-first call)

## Unrelated bug found while investigating

Not part of this problem, but recorded so it is not lost. `visuals-flow` cannot run against an
external workdir because two libs ignore `resolveWorkdir` and hardcode a slug path:
`lib/segments.mjs:113` and `lib/plan-skeleton.mjs:169`. The second is broken for local slugs
too, since `root/../../videos` resolves to `pipelines/videos`, one level too high. It landed in
b550e6c on 2026-07-21.
