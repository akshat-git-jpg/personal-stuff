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

Word-sync cues (catalog `kind: "word-sync"`, e.g. `slate/kinetic-sentence`)
carry no beats and instead fill `variables.text` (the voiceover verbatim) and
optionally `variables.accent` (a phrase verbatim inside `text`):

```json
{
  "id": "c07",
  "card": "slate/kinetic-sentence",
  "anchor": "verbatim >=3-word transcript quote — the sentence's own opening words",
  "lead": 0.2,
  "hold": 2.0,
  "variables": { "text": "voiceover sentence, verbatim, <=18 words", "accent": "2-4 verbatim words inside text" },
  "beats": [],
  "flagged": false
}
```

## Rules

<!-- BEGIN GENERATED CONSTRAINTS — edit lib/cue-constants.mjs, then run node lib/build-prompt.mjs -->
These are HARD constraints checked by lib/lint-cues.mjs after you produce cues.json.
A violation is a defect, not a stylistic choice. Budget against them BEFORE placing cues.

- Any non-structural fullframe card may be used at most 3 times per video (lint E3). Structural cards (catalog `structural: true`) are exempt.
- overlay/stat-hit: at most 3 per video (lint E2).
- Consecutive overlay/stat-hit cues must start at least 90s apart (lint E2).
- No cue may END in the last 20s of the video except the end-card slugs listed below (lint E4 — a HARD ERROR, not a preference).
- Consecutive fullframe cues must start at least 35s apart, measured START to START across narration time (lint W1).
- Consecutive fullframe cues must start no more than 60s apart, measured START to START across narration time (lint W1).
- At most 3 overlay cues may START within any 60s window (lint W2).
- Total cue count must be at least 1.0 per minute of video (lint W3).
- Total cue count must be at most 1.9 per minute of video (lint W3). For a 20-minute video that is 20-38 cues in total — budget before you place.
- No interior narration stretch may run longer than 50s with no graphic of any kind (lint W6).
- End-card slugs exempt from the last-20s rule: brand/, link-in-description/, like-subscribe/
<!-- END GENERATED CONSTRAINTS -->
<!-- BEGIN GENERATED ROUTING RULES — edit lib/cue-rules.mjs, then run node lib/build-prompt.mjs -->
Density (defaults — follow the script when it disagrees). Keep the video visually active: motion graphics are a near-constant presence, not a rare garnish. A graphic still must ADD something (structure, a number/list, a comparison, or the spoken POINT of a bridge) — but "the footage shows it" is not a licence to leave a long stretch bare.

Never two overlapping fullframe cues.

Cold-open beat allowed in the first 15s (this zone stays sparse — W6 does not police it).

Choosing a card — route by what the VO is doing, matching catalog `purpose` lines:
- Narration makes a claim, lists items, or states numbers and the screen does not show it → fullframe canvas beat (`slate/headline-chips`, `comparison/table-rows`, section slates). The screen already shows what is spoken → no graphic.
- Enumerating pros/cons -> pros-cons; ordered list -> checklist or bullet-points; feature-by-feature comparison -> feature-matrix or summary-table; final judgment -> a verdict card; opening a section -> a section/title card; one reinforced claim -> an overlay card.
If nothing fits, set `flagged: true`, `card` to the closest slug, and add a `note` field explaining the gap — never force a bad match.

Specificity wins (mandatory): big number -> overlay/stat-hit; plan/credit economics too dense to say -> comparison/credits-math; step walkthrough NOT shown on screen -> process/step-flow; who-should-buy-what payoff -> verdict/persona-match.

Result-review overlays:
- VO judges a result while footage shows it (a pro or con is spoken) → `overlay/verdict-chips`, one beat per spoken judgment, ≤4.
- VO announces a rating or score ('gets a 9.5 out of 10') → `overlay/score-pill` at the spoken score; `winner:true` only for a final-verdict winner.
- VO walks per-product numbers (price/specs) across 3+ products → `comparison/table-rows`, one beat per product row, cells pipe-separated, anchor each beat at that product's first spoken number.
- VO states a claim then lists items under it → `slate/headline-chips`: headline = the claim, one chip beat per listed item.

Kinetic-sentence interstitial (mandatory): for a bridge with no footage, UI, or data worth showing and a single spoken point, use `slate/kinetic-sentence` instead of leaving it on camera — a frequent choice, drawn from the same fullframe cadence above, not an extra quota (`statement/keyword-statement` is a close sibling for the same job). `variables.text` is the voiceover verbatim, one sentence, <=18 words, `beats: []` — paraphrasing fails resolution at step 030; split long sentences into two consecutive cues instead. `variables.accent` is the 2-4 verbatim, contiguous words carrying the sentence's point (the consequence or substance, e.g. "burns credits", "cool technical features" — not a brand name or number picked for salience). Anchor at the sentence's own opening words.

Structural consistency (mandatory): a repeated semantic slot — e.g. the section opener for each compared tool — uses the SAME card every time; mixing cards across parallel items is a defect, not variety. Structural cards (catalog `structural: true`) are exempt from the repetition cap.

Repetition cap (non-structural cards): follow the caps above — for overlay/stat-hit, keep only the numbers the VO leans on most and drop the least impressive rather than exceed the cap. Other overlays: vary callout's style and position when repeating.

Demos & step narration (mandatory): do NOT lay a redundant graphic over a click the screen already shows — no `process/step-flow` re-labeling visible steps (step-flow is only for processes NOT on screen). During a demo/playback stretch only `placement: overlay` cards may be used (this is enforced via lint E5). But do NOT leave a long demo stretch bare either: punctuate it with the SPOKEN layer — `overlay/callout`, `overlay/lower-third`, `overlay/tip-banner`, `overlay/stat-hit`, or `overlay/verdict-chips`. Test: echoes the click → skip; adds the narration's point/label → keep.

Pricing (mandatory): no per-tool pricing/credits graphics during tool segments (the pricing page is on screen); consolidate into ONE pricing comparison graphic in the final comparison section. When the `comparison/table-rows` card is used, do NOT also emit stat-hit cues for the same numbers.

Cold open (mandatory for comparison videos): the intro title card makes the compared products the VISUAL hero — `title/title-aurora-wave` with `platforms` logo chips, never a text-only title.

Verdicts (mandatory): one winner per verdict card. Two favorites = two verdict cards back to back, each anchored at its own "X was the best" phrase.

Units (mandatory): numeric values on cards carry their unit (prefix "$", suffix "ms"/"/mo") — never a bare number.

Beat cards must not idle: anchor so the FIRST beat lands within ~8s of the card appearing — when the VO rambles before its first data point, anchor at the sentence right before the first beat, not the section opener.
<!-- END GENERATED ROUTING RULES -->

New cards (2026-07-21) — when to fire each:
- VO dictates or the screen shows a **prompt** (AI image/video/text prompt) →
  `prompt/prompt-typing`: `variables.prompt` = the prompt verbatim (keep any
  `[m:ss]` shot tags inline), `variables.title` defaults "Prompt", `beats: []`.
- VO names/switches to a **specific tool/model** as a hero moment →
  `tool-icon/tool-glass-tile`: `logo` = tool registry slug, `name` = official
  name, optional `subtitle`, `beats: []`. Distinct from a section opener.
- A **single punchy assertion/bridge** with one phrase to emphasize →
  `statement/keyword-statement`: `text` = the spoken line, `keyword` = the 2–4
  words carrying the point, `beats: []`. Sibling of `slate/kinetic-sentence`;
  use both to punctuate bridge stretches.
- **Enumerating features/capabilities** where a concept icon helps (unless the screen is currently showing those capabilities being set — during a demo this card is illegal (fullframe)) →
  `checklist/icon-pills`: one beat per item; beat = `{icon, text, keyword?}`,
  `icon` ∈ brain|calendar|person|bolt|gear|lock|clock|chart|chat|shield|doc|search|star|cloud.

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
Logos: when a cue is about a specific tool, set its `logo` slug (lowercase alphanumeric tool name). For `summary-table`, set `productLogos` aligned with `products`; for `title-aurora-wave`, set `platforms[].logo`; for `table-rows`, per-beat `logo`. Only slugs that exist may be used — the resolver rejects unknown ones. Available slugs: {{LOGO_SLUGS}}

```
PLAN SKELETON (generated by `node lib/plan-skeleton.mjs <slug>` — the legal
placement grid for THIS video, already consistent with every hard constraint
above). Place one fullframe cue per slot, inside its legal window; if a slot has
nothing worth showing, leave it empty and say so rather than inventing filler.
Fill the ledger as you go — the per-card counts in it are what keep you inside
the repetition cap.
{{SKELETON}}

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
