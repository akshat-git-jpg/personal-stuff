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
3. Total full-screen time: aim near 4 minutes for a ~30-min video, never above
   5 minutes total. No span under ~15 seconds; prefer spans under ~2 minutes.
4. NEVER place a span over a fullframe graphics cue — the fullframe times are
   listed below; plan around them. Overlay cues are fine to overlap.
5. Span boundaries at sentence starts/ends.
6. When narration describes on-screen actions (click/open/type/select/drag),
   that stretch belongs to the screen recording — not to the avatar.
7. Can't place a span cleanly? Set `"flagged": true` with a note instead of
   forcing bad anchors.
8. `engineMode` is always `"test"` — do not change it.

## Fullframe graphics cues (plan around these — [start, end] seconds)

<FULLFRAME_CUES>

## Transcript (word-timestamped, verbatim)

<TRANSCRIPT_TEXT>
