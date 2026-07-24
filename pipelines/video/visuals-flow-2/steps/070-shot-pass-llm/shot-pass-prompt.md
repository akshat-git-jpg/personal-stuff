# Shot-pass prompt

Model-agnostic prompt for the shot pass. Paste this whole file, with the two
placeholders filled, into the executor session — it has no repo access, so the
rules are inlined. Judgment detail lives in `RULEBOOK.md`; this is the
compressed version.

---

You plan the full-screen avatar moments for a voiceover-driven video. A corner
avatar over screen recording runs the whole video by default; you choose ONLY
the stretches where the host takes the full screen. Output ONLY shots.json
content — no other text.

## Schema

```json
{
  "video": "<slug>",
  "approved": false,
  "engineMode": "test",
  "spans": [
    {
      "id": "s01",
      "kind": "avatar-full",
      "from_anchor": "verbatim first words of the span",
      "to_anchor": "verbatim last words of the span",
      "note": "why this is a host moment",
      "flagged": false
    }
  ]
}
```

## Rules

1. Anchors are VERBATIM transcript phrases, ≥3 words, in transcript order.
   Misspellings in the transcript are quoted as-is.
2. U-curve: host-heavy open (intro + overview), lean hands-on middle, host-heavy
   close (verdicts shrinking → pricing wrap → conclusion).
3. Cadence: never let more than ~3 minutes pass without a full-screen host
   moment. The cycle is fast and regular — host bridge → content run → back to
   host. Fill the middle with SHORT bridges (10–30s — a one-line verdict, a
   reaction, a transition between tools) at natural pauses, never over
   hands-on narration.
4. Total full-screen time: budget against the constraints below. Mid-video
   spans are short bridges; only the intro and the conclusion may run longer.

<!-- BEGIN GENERATED SHOT CONSTRAINTS — edit lib/shot-constants.mjs, then run node lib/build-shot-prompt.mjs -->
These are HARD constraints checked by lib/lint-shots.mjs after you produce shots.json.
A violation is a defect, not a stylistic choice. Budget against them BEFORE placing spans.

- Total full-screen avatar time must never exceed 300s (lint error). This is the HeyGen 4 production limit, enforced in both engine modes.
- Aim for about 240s of total full-screen avatar time, scaled by video length (T/1800); the linter warns below it.
- No avatar span may be shorter than 10s (lint error) — a shorter full-screen moment is not worth a clip.
- A mid-video avatar span longer than 45s drags (lint warning); mid-video bridges should run 10s to 30s.
- Even an intro or outro host stretch drags past 120s (lint warning).
- Expect one avatar span starting within the first 15% of the voiceover (U-curve shape).
- Expect one avatar span starting within the last 15% of the voiceover (U-curve shape).
- Consecutive avatar spans must start no more than 180s apart (lint warning) — host and content cycle tighter than the old 300s.
<!-- END GENERATED SHOT CONSTRAINTS -->
5. NEVER place a span over a fullframe graphics cue — the fullframe times are
   listed below; plan around them. Overlay cues are fine to overlap.
6. Span boundaries at sentence starts/ends.
7. When narration describes on-screen actions (click/open/type/select/drag),
   that stretch belongs to the screen recording — not to the avatar.
8. Can't place a span cleanly? Set `"flagged": true` with a note instead of
   forcing bad anchors.
9. `engineMode` is always `"test"` — do not change it.

## Fullframe graphics cues (plan around these — [start, end] seconds)

<FULLFRAME_CUES>

## Transcript (word-timestamped, verbatim)

<TRANSCRIPT_TEXT>
