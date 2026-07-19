# Cue-pass prompt

Model-agnostic prompt for the graphics flow's one LLM step. Sessions paste **the
prompt only** (this whole file, with its placeholders filled) into whichever executor
is running the cue pass. It is self-contained; it has no repo access, so every rule
is inlined below rather than linked. `RULEBOOK.md` is the judgment archive the
060 fold maintains and syncs from; it is not a session input.

---

You produce motion-graphic cues for a voiceover-driven video. Output ONLY
cues.json content — no other text.

## Schema

```json
{
  "video": "string",
  "approved": false,
  "cues": [
    {
      "id": "c01",
      "card": "catalog-slug",
      "anchor": "verbatim >=3-word transcript quote",
      "lead": 0.5,
      "hold": 3.0,
      "variables": { "...card variables except beats": "..." },
      "beats": [
        { "reveal": { "...beat_shape fields": "..." }, "anchor": "verbatim >=3-word quote" }
      ],
      "flagged": false
    }
  ]
}
```

Single-card cues (catalog `kind: "single"`) use `beats: []`.

## Rules

Density (defaults — follow the script when it disagrees). The default for any
moment is NO graphic: the screen recording carries the video, and a graphic
must earn its slot by adding what footage can't. Demo/walkthrough stretches
are already visual — leave them bare. When in doubt during demo/walkthrough stretches, skip.
- Fire a fullframe/canvas beat every 45–90s of VO.
- Overlays: up to 3 per minute during review/verdict stretches.
- Never two overlapping fullframe cues.
- Cold-open beat allowed in the first 15s; end-card allowed in the last 20s.

Choosing a card — route by what the VO is doing, matching catalog `purpose`
lines:
- Narration makes a claim, lists items, or states numbers and the screen does not show it → fullframe canvas beat (`slate/headline-chips`, `comparison/table-rows`, section slates). The screen already shows what is spoken → no graphic.
- Enumerating pros/cons -> pros-cons; ordered list -> checklist or bullet-points; feature-by-feature comparison -> feature-matrix or summary-table; final judgment -> a verdict card; opening a section -> a section/title card; one reinforced claim -> an overlay card.
If nothing fits, set `flagged: true`, `card` to the closest slug, and add a `note` field explaining the gap — never force a bad match.

Specificity wins (mandatory): big number -> overlay/stat-hit; plan/credit
economics too dense to say -> comparison/credits-math; step walkthrough NOT
shown on screen -> process/step-flow; who-should-buy-what payoff ->
verdict/persona-match.

Result-review overlays:
- VO judges a result while footage shows it (a pro or con is spoken) →
  `overlay/verdict-chips`, one beat per spoken judgment, ≤4.
- VO announces a rating or score ('gets a 9.5 out of 10') →
  `overlay/score-pill` at the spoken score; `winner:true` only for a
  final-verdict winner.
- VO walks per-product numbers (price/specs) across 3+ products →
  `comparison/table-rows`, one beat per product row, cells pipe-separated,
  anchor each beat at that product's first spoken number.
- VO states a claim then lists items under it →
  `slate/headline-chips`: headline = the claim, one chip beat per listed item.

Structural consistency (mandatory): a repeated semantic slot — e.g. the
section opener for each compared tool — uses the SAME card every time; mixing
cards across parallel items is a defect, not variety. Structural cards
(catalog `structural: true`) are exempt from the repetition cap.

Repetition cap (non-structural cards): the same fullframe card at most 3 times
per video. overlay/stat-hit: max 3 per video, >=90s apart, only for numbers the
VO leans on — drop the least impressive rather than exceed. Other overlays: vary
callout's style and position when repeating.

Step narration (mandatory): if the VO narrates actions the screen recording
shows ("go to the site, click X"), NO graphic — step-flow is only for
processes not visible on screen.

Pricing (mandatory): no per-tool pricing/credits graphics during tool segments
(the pricing page is on screen); consolidate into ONE pricing comparison
graphic in the final comparison section. When the `comparison/table-rows` card
is used, do NOT also emit stat-hit cues for the same numbers.

Anchors: verbatim quotes copied exactly from the transcript, contractions and
all, never paraphrased; at least 3 consecutive words; pick phrases unlikely
to repeat; anchors must appear in script order across the whole file — the
resolver matches forward-only, so an out-of-order anchor is a hard error. A
cue's anchor is where the card appears; a beat's anchor is where that point
begins.

Beats: one beat per spoken point, anchored at the phrase that starts it;
`reveal` follows the card's `beat_shape` exactly; reveal text is a 2–6 word
summary of the point, never the transcript sentence; fewer than 2 beats
usually means a single-card cue is the better fit.

Capacity (hard limits): each beat card's catalog entry declares `max_beats`
and `max_reveal_chars` — never exceed either. Too many points? Split into two
consecutive cues of the same card, or keep only the strongest points. Reveal
too long? Summarize harder.

Variables: fill every non-beat variable the card lists; sentence-case text.
Product names: the transcript is ASR output and often GARBLES brand names — all
on-screen text (variables, reveal text) must use the correct official spelling;
only anchors stay transcript-verbatim, garbles and all.
Logos: when a cue is about a specific tool, set its `logo` slug (lowercase alphanumeric tool name). For `summary-table`, set `productLogos` aligned with `products`. Only slugs that exist may be used — the resolver rejects unknown ones. Seeded slugs: openart, higgsfield, synthesia, heygen, arcads.

```
CATALOG (the only cards you may use):
{{CATALOG}}

TRANSCRIPT (verbatim word sequence via `node lib/transcript-text.mjs <slug>` — never raw transcript.json):
{{TRANSCRIPT}}
```

## Output rules

- raw JSON only — no markdown fences, no commentary.
- `flagged` cues are allowed; never skip a point because no card fits.
- When unsure between two cards, prefer the one whose `purpose` line matches
  the VO's action more closely.
