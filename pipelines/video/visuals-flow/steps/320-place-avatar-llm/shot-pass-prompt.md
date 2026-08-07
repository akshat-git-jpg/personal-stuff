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
      "purpose": "avatar-full",
      "mode": "full", // or "side" — REQUIRED, no default
      "from_anchor": "verbatim first words of the span",
      "to_anchor": "verbatim last words of the span",
      "note": "why this is a host moment",
      "flagged": false
    }
  ]
}
```

## Modes — every span MUST declare one

`mode` is REQUIRED on every span. There is no default; omitting it is an error.

- `"full"` — the host takes the whole frame. Use when the host IS the content:
  the intro, the conclusion, a verdict, a reaction, a transition between tools.
  Nothing on screen competes with them.
- `"side"` — motion graphics fill the left 1200px, the host the right 720px, for
  the whole span. Use when the host is talking about a point that HAS a graphic:
  a claim with evidence, a comparison being narrated, a takeaway being explained.
  The graphic and the host are both load-bearing.

A `side` span MUST be covered by exactly one fullframe cue, and that cue's card
MUST be side-capable (listed under "Side-capable cards" below). A `side` span
that covers a card not on that list is a defect.

Prefer `side` whenever a fullframe graphic already occupies the window and the
host has something to say over it — that is the case this mode exists for. Reach
for `full` when the host needs the frame to themselves.

## Rules

1. Anchors are VERBATIM transcript phrases, ≥3 words, in transcript order.
   Misspellings in the transcript are quoted as-is.
2. U-curve: host-heavy open (intro + overview), lean hands-on middle, host-heavy
   close (verdicts shrinking → pricing wrap → conclusion).
3. Cadence: never let more than ~3 minutes pass without a host moment. The
   cycle is fast and regular — host bridge → content run → back to host. Fill
   the middle with SHORT bridges (10–30s — a one-line verdict, a reaction, a
   transition between tools) at natural pauses, never over hands-on narration.
4. Total host time: budget against the constraints below. Mid-video spans are
   short bridges; only the intro and the conclusion may run longer.

<!-- BEGIN GENERATED SHOT CONSTRAINTS — edit lib/shot-constants.mjs, then run node lib/build-shot-prompt.mjs -->
These are HARD constraints checked by lib/lint-shots.mjs after you produce shots.json.
A violation is a defect, not a stylistic choice. Budget against them BEFORE placing spans.

- Total full-screen avatar time must never exceed 300s (lint error). This is the HeyGen 4 production limit, enforced in both engine modes.
- Aim for about 240s of total full-screen avatar time, scaled by video length (T/1800); the linter warns below it.
- No avatar span may be shorter than 10s (lint error) — a shorter full-screen moment is not worth a clip.
- A mid-video avatar span longer than 45s drags (lint warning); mid-video bridges should run 10s to 30s.
- Even an intro or outro host stretch drags past 120s (lint warning).
- Expect one avatar span starting within the first 15% of the voiceover (U-curve shape).
- The host must be ON SCREEN within the first 15 seconds (mandatory, lint E8). Two shapes satisfy it and the pass may choose either: (a) a SIDE-mode span overlapping the opening card, so the host sits beside the motion graphic from the top; or (b) a full-screen span starting at or before the 15s mark, after a short opening graphic. This is NOT an "avatar first" rule — opening on a motion graphic is explicitly fine (owner, 2026-08-02: "I don't want to put a hard rule that avatar should be the first thing, but it should be in the starting"). The host simply cannot be late. Two earlier bounds were each too loose, which is why this one is an absolute number rather than a proportion or a zone: the first-15%-of-runtime rule permits 4:49 on a 32-minute video, and the old "somewhere before the intro ends" rule permitted 0:59 on an 86.7s intro and was rejected on sight. If every window before the mark is occupied by fullframe cards, take one of them in `side` mode rather than pushing the host later; if no card there is side-capable, shorten a card rather than skip the host.
- Expect one avatar span starting within the last 15% of the voiceover (U-curve shape).
- Consecutive avatar spans must start no more than 180s apart (lint warning) — host and content cycle tighter than the old 300s.
- A panel-mode avatar occupies 28% of canvas width, inset bottom-right, preserving the source clip aspect ratio.
- A panel-mode avatar sits 32px from the right and bottom canvas edges.
- A panel-mode avatar is masked to a rounded rectangle of radius 24px.
- In side mode the motion-graphics card renders 1200px wide at x=0, full canvas height.
- In side mode the host occupies the right 720px of the canvas, full height, cover-cropped from the source clip. The split is a hard edge — no inset, no corner radius.
<!-- END GENERATED SHOT CONSTRAINTS -->
5. A `full` span must NEVER overlap a fullframe graphics cue — those windows are
   listed below; plan around them. A `side` span is the opposite: it REQUIRES a
   covering fullframe cue whose card is side-capable. Overlay cues are fine to
   overlap in either mode.
6. Span boundaries at sentence starts/ends.
7. When narration describes on-screen actions (click/open/type/select/drag),
   that stretch belongs to the screen recording — not to the avatar.
8. Can't place a span cleanly? Set `"flagged": true` with a note instead of
   forcing bad anchors.
9. `engineMode` is always `"test"` — do not change it.

## Fullframe graphics cues (plan around these — [start, end] seconds)

<FULLFRAME_CUES>

## Side-capable cards (a `side` span may only cover one of these)

<SIDE_CAPABLE_CARDS>

## Transcript (word-timestamped, verbatim)

<TRANSCRIPT_TEXT>
