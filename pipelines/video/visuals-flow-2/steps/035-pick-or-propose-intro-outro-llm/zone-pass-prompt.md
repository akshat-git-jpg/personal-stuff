# Intro + conclusion pass

You are placing motion graphics for the **intro and conclusion of a tutorial
video only**. A separate pass handles the body; do not cue it.

## Inputs and outputs

`{{STRUCTURE}}` — the measured zone spans, in seconds, from the owner's three
source recordings. These are facts, not estimates.

`{{CATALOG}}` — the shared card collection. Every card here is available to you.

`{{TRANSCRIPT}}` — the full transcript with timestamps. You are given the whole
script so you can see what the intro promises and what the conclusion pays off,
but you may only place cues inside the zone spans above.

Output **raw JSON**, no prose, no fences:

```json
{
  "cues": [
    {
      "id": "z01",
      "zone": "intro",
      "card": "enacted/promise-split",
      "anchor": "verbatim words from the transcript",
      "beats": [{ "anchor": "verbatim words", "reveal": "short on-card text" }],
      "variables": {}
    }
  ]
}
```

Every cue MUST carry a `"zone"` field of `"intro"` or `"conclusion"`, and its
anchor MUST fall inside that zone's span. Use `z` ids so zone cues never collide
with the body pass's `c` ids. Anchors are quoted **verbatim** from the
transcript — they are matched by string, so an approximation resolves to the
wrong second or fails outright.

To request a card that does not exist yet, set `"card": "flag"` and add
`"flag_why"` describing the card you actually want. That is an expected outcome
here, not a failure — the owner approves new zone cards at step 070 before
anything renders.

## The rules

<!-- BEGIN GENERATED ZONE RULES — edit lib/zone-rules.mjs, then run node lib/build-zone-prompt.mjs -->
You are authoring the INTRO and the CONCLUSION only. The video structure block names their exact spans, measured from the source files the owner recorded. Every cue you emit MUST carry a `zone` field of "intro" or "conclusion" and MUST anchor inside that zone. The body is authored by a separate pass against a separate rulebook — do not cue it, do not reason about its pacing, and do not assume what it contains beyond the transcript you are given.

These two zones carry the most weight in the video and are worth spending more on than any equivalent stretch of body. The opening decides whether anyone stays; the conclusion is the payoff the opening promised. Author them with your strongest devices, and prefer a card that ENACTS the point — shows it happening — over one that titles it. Commissioning a NEW card for a zone is an expected outcome, not a last resort: if nothing in the catalog does the job, flag the cue and describe the card you actually want.

There is deliberately NO required structure for either zone — no mandatory hook slot, no mandatory agenda card, no fixed running order. What an intro needs is a judgment call about THIS script. Never add a card because a slot exists; add it because the narration gives you something to enact. An intro that fills five prescribed slots badly is worse than one that does three things well.

Motion is the quality bar in a zone, not cue count. A zone can be dense with cues and still feel dead if the cards are static slates and the footage underneath is not moving. Before you finish, walk the zone start to end and ask what is MOVING at each second: a card revealing beats, footage in motion, or the presenter. If the answer for some stretch is "nothing", that stretch is the defect — fix it there rather than adding another card somewhere easier.

There is ONE card collection, shared with the body. No card is reserved for a zone and no card is forbidden in one — a body card is a fine choice in an intro when it genuinely fits. Choose on merit, never on where the card came from. Commissioning a NEW card for a zone is an expected outcome, not a failure: set `card` to the slug you would build (a slug NOT in the catalog) and add a `propose` object `{"does", "kind", "placement", "beats", "variables"}`. The owner approves or kills it at step 037, step 038 builds it, and it joins the shared collection — so the body can use it on the next video.

The presenter must actually land in the intro. Do not wallpaper the opening with fullframe cards — leave the host real time on screen early, because a tutorial that opens on wall-to-wall graphics has nobody on it to trust yet. The same applies in reverse at the conclusion: the payoff lands better from a person than from a slate.
<!-- END GENERATED ZONE RULES -->

## The constraints

<!-- BEGIN GENERATED ZONE CONSTRAINTS — edit lib/zone-constants.mjs, then run node lib/build-zone-prompt.mjs -->
These are HARD constraints checked by lib/lint-cues.mjs (W15-W17, W19) and
lib/stillness.mjs (W18) after you produce your cues.
A violation is a defect, not a stylistic choice. Budget against them BEFORE placing cues.

- Inside the intro or the conclusion, consecutive fullframe cues must start no more than 20s apart, measured START to START — and the zone's first fullframe must start within 20s of the zone opening (lint W15). The body allows 45s; a zone does not, because 45 seconds without a new frame is where the opening loses the viewer.
- At least half of a zone's fullframe cues must be `enacted/` cards — ones that DO the point rather than title it (lint W16).
- Every zone with any fullframe cues needs at least 2 `enacted/` cards regardless of the fraction (lint W16). One moving card among static slates reads as an accident, not a style.
- A zone must carry at least 3.0 cues per minute of its own length (lint W17). This is a regression floor, not a padding target — do not add a cue to reach it; if the zone cannot carry that many, the zone is being under-written and the narration is the thing to fix.
- No stretch of a zone may show more than 8s of visually static frame — footage that is not moving, with no card and no avatar over it (lint W18, measured from the footage by lib/stillness.mjs). A frozen frame in the opening is the single defect the owner has called out most.
<!-- END GENERATED ZONE CONSTRAINTS -->

## What a zone is

The intro and conclusion are the two stretches the owner judges hardest. The
opening decides whether anyone stays; the conclusion is the payoff the opening
promised. Spend more here than you would on any equivalent stretch of body.

## Motion is the bar

Read this before you place anything, because it inverts the obvious approach.

A previously rejected intro was measured at a **higher** cue rate than the body
of the same video — it was not short of graphics. It read flat because three of
its four fullframe cards merely *named* their point (a title card, a statement
slate, a table of contents) instead of enacting it, and because the footage
underneath sat visually still for a long stretch with nothing covering it.

So: adding more cues is not the lever. Ask, second by second, **what is moving**
— a card revealing its beats, footage in motion, or the presenter. Any stretch
where the honest answer is "nothing" is the defect, and it is fixed at that
stretch, not by adding a card somewhere more convenient.

## Commissioning a new card

There is one shared card collection. No card is reserved for a zone, and none is
forbidden in one — a body card is a fine choice when it genuinely fits.

If nothing in the catalog does the job, do not settle for the nearest slate.
Propose the card: set `card` to the slug you would build (a slug that is NOT in
the catalog) and add a `propose` object alongside it.

```json
"propose": {
  "does": "<what the card DOES on screen, one line>",
  "kind": "single|beat",
  "placement": "fullframe|overlay",
  "beats": 3,
  "variables": ["<what varies>"]
}
```

The owner approves or kills each proposal at step 037; step 038 builds the
survivors. A card built for a zone joins the shared collection and is available
to the body on the next video. Reserve `flagged: true` for the rare case where
you cannot even describe the card that would work.

## Rubric

Before you return, check your own output:

1. Every cue has a `zone` field and anchors inside that zone.
2. Every anchor appears verbatim in the transcript.
3. The enacted share and gap limits above are met — count them, do not estimate.
4. Nothing was added purely to satisfy a floor.
5. Walking each zone start to end, something is moving at every second.
