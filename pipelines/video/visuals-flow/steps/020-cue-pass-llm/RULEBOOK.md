# Cue-pass rulebook

The operating manual for the graphics flow's one LLM step: transcript.json →
cues.json. Any executor (Claude, agy, Antigravity) follows this to produce a
cues.json that the rest of the flow (resolve → render) can consume without
review. Schema is owned by `PIPELINE.md` — this file restates it for
convenience but never forks it. If they disagree, PIPELINE.md wins.

## Inputs and outputs

Inputs:

- `transcript.json` — word-level timestamps from the transcribe step. You read
  the words for their text and their order only; you never write a timestamp.
- `catalog.json` — the full set of cards you may choose from.

Output: `cues.json` only, matching the schema in `PIPELINE.md`. You never
write `resolved.json`, durations, absolute times, or file paths — the resolver
computes all of that from your anchors.

Schema: see PIPELINE.md's cues.json section.

## Cue density

Every number below is judgment context, not the source — `lib/cue-constants.mjs`
is the single source of truth for thresholds; `lib/lint-cues.mjs` enforces it and
`lib/build-prompt.mjs` renders it into `cue-pass-prompt.md`. Retune density
there, not here. The routing prose that used to live in this section (which
graphic fires when, and how cadence interacts with demos and cold opens) has
moved the same way: `lib/cue-rules.mjs` is the single source, cited below by id.

Rule: `R_DENSITY` in `lib/cue-rules.mjs`.

Owner recalibration 2026-07-21: earlier videos had multi-minute bare
stretches; the target is now ~2× that density. This is the reason the default
flipped from "the footage shows it, skip the graphic" to "add something or
punctuate the stretch."

Rule: `R_DEMOS` in `lib/cue-rules.mjs`.

Owner fold 2026-07-18 (test-01 c06/c09/c15): a `process/step-flow` that
re-labelled steps already visible on screen was rejected as redundant. The
correction is punctuation with the SPOKEN layer, not blanking the stretch.

These are starting defaults, not physics — when the script structure fights a
rule, follow the script and note why in the cue's context.

1. Fire a fullframe/canvas beat every 35–60s of VO (fullframe cadence is measured over narration only, so a long demo is not a cadence failure).
2. Between fullframe beats, punctuate with overlays — up to 3 per rolling
   minute; a demo/bridge stretch should not go >~50s without at least a
   lightweight overlay or statement (W6).
3. Rule: `R_NO_OVERLAP` in `lib/cue-rules.mjs` — no dated fold; predates this log.
4. Rule: `R_COLD_OPEN_ZONE` in `lib/cue-rules.mjs` — no dated fold; predates this log.

## Choosing a card

Route by what the VO is DOING at that moment, using each catalog card's
`purpose` line to match.

Rule: `R_CHOOSING` in `lib/cue-rules.mjs` — no dated fold; predates this log.

Rule: `R_RESULT_REVIEW` in `lib/cue-rules.mjs` — no dated fold; predates this
log. This is the split for judging a result already on screen (a verdict-chip
or score-pill overlay) versus stating a claim that needs its own fullframe
card (headline-chips or table-rows).

**New cards (2026-07-21 pack) — when to fire each:**

- VO dictates or the screen shows a **prompt** (an AI image/video/text prompt) →
  `prompt/prompt-typing`: the prompt types itself out over the beat. Put the
  prompt in `variables.prompt` verbatim (keep any `[m:ss]` shot tags inline —
  they auto-highlight); `variables.title` defaults to "Prompt". A single-card
  cue (`beats: []`).
- VO names or switches to a **specific tool/model** as a hero moment ("this is
  the model we'll use") → `tool-icon/tool-glass-tile`: `logo` = the tool's
  registry slug, `name` = its official name, optional `subtitle`. This is the
  punchy "here's the tool" beat, distinct from a section opener (which frames a
  whole section). A single-card cue.
- A **single punchy assertion or bridge** with one phrase worth emphasizing →
  `statement/keyword-statement`: `text` = the spoken line (one sentence),
  `keyword` = the 2–4 words carrying the point. It is the sibling of
  `slate/kinetic-sentence`; use both freely to PUNCTUATE bridge stretches
  (they draw from the every-35–60s fullframe cadence, not a separate quota).
- **Enumerating features/capabilities** where a concept icon helps ("the
  memory / the scheduling / the way it learns your work") (unless the screen is currently showing those capabilities being set — during a demo this card is illegal (fullframe)) →
  `checklist/icon-pills`: one beat per item, `icon` = an icon-set name
  (brain|calendar|person|bolt|gear|lock|clock|chart|chat|shield|doc|search|star|cloud),
  `text` = the item, optional `keyword`. Prefer this over a plain checklist when
  the items are concepts that read better with an icon.

Rule: `R_STRUCTURAL` in `lib/cue-rules.mjs`.

Owner fold 2026-07-18: v2 swapped two of five tool openers to different
section cards to dodge the repetition cap. Wrong tradeoff — consistency wins.

Rule: `R_REPETITION` in `lib/cue-rules.mjs` — no dated fold; predates this log.

Rule: `R_PRICING` in `lib/cue-rules.mjs`.

Owner fold 2026-07-18 (test-01 c20–c24): per-tool pricing cards during tool
segments duplicated what the pricing page already showed on screen. The
correction is one consolidated comparison graphic, not one card per tool.

Rule: `R_COLD_OPEN_TITLE` in `lib/cue-rules.mjs`.

Owner fold 2026-07-20 (test-02 c01): a text-only intro title buried the
compared tools in a subtitle line. The intro is the video's most important
graphic, so the products themselves have to be the visual hero.

Rule: `R_VERDICTS` in `lib/cue-rules.mjs`.

Owner fold 2026-07-20 (test-02 c32): two favorites got joined into one verdict
box instead of two back-to-back cards, each with its own reason.

Rule: `R_UNITS` in `lib/cue-rules.mjs`.

Owner fold 2026-07-20 (test-02 c24): a bare number on a card left the viewer
to decode the unit from context.

Rule: `R_NO_IDLE` in `lib/cue-rules.mjs`.

Owner fold 2026-07-20 (test-02 c29): 18.9s of empty table scaffold before the
first beat landed. The fix is anchoring at the sentence right before the
first beat, not the section opener.

Rule: `R_KINETIC` in `lib/cue-rules.mjs` — no dated fold; predates this log.
This covers when `slate/kinetic-sentence` fires and how often; the mechanics
below (quoting, accent phrase, anchoring) are this card's authoring detail,
not duplicated elsewhere.

Quoting (mandatory): `variables.text` is the voiceover **verbatim**, one
sentence, ≤18 words, `beats: []`. Paraphrasing is not a style slip — the
resolver matches `text` word-for-word forward through the transcript and a
paraphrase fails to resolve at step 030. If the spoken sentence runs long,
either quote the clause carrying the point or split into two consecutive
kinetic-sentence cues.

Accent phrase (mandatory): `variables.accent` is the 2–4 words carrying the
sentence's *point*, not merely its nouns, and must appear verbatim and
contiguously inside `text`.
- "Because picking the wrong model just **burns credits**" → the consequence.
- "It highlights some of the **cool technical features**" → the substance,
  not "It highlights".
- Wrong: accenting a brand name or a number just because it stands out —
  that's already handled by caption keyword accent; this is a semantic
  choice, not a salience one.

No beats, no per-word anchors: the cue authors `"beats": []` — per-word timing
is derived from the transcript by the resolver, never authored here.

Anchor: the sentence's own opening words (≥3), not a phrase earlier in the
narration — word matching starts at the anchor.

Interaction with the shot pass: this card is `fullframe` and occupies a bridge
the shot pass might otherwise fill with a full-screen host span; it cannot
overlap another fullframe cue's spoken coverage (the resolver rejects
overlaps, same as any other fullframe card).

The flagged-cue fallback is part of `R_CHOOSING` in `lib/cue-rules.mjs`. See
Section 8 (Novel cards) for what happens after a flag is approved.

## Anchors

- Anchors are verbatim quotes copied exactly from the transcript words,
  contractions and all — never paraphrased.
- An anchor is at least 3 consecutive words.
- Pick phrases unlikely to repeat elsewhere in the transcript.
- Anchors must appear in script order across the whole cues.json: the resolver
  matches forward-only from the previous anchor, so an out-of-order anchor is
  a hard error, not a warning.
- A cue's anchor is where the card APPEARS — the sentence that introduces the
  topic. Each beat's anchor is the phrase that begins that specific point.
- A beat's anchor must begin after its cue's anchor phrase ends — the resolver enforces this (it will report "anchor not found").

## Beats

- One beat per spoken point.
- A beat's anchor is the phrase that starts that point, not the whole
  sentence.
- `reveal` follows the card's `beat_shape` from catalog.json exactly.
- Reveal text is a 2–6 word summary of the point — never the transcript
  sentence verbatim.
- A beat-card cue with fewer than 2 beats should usually be a single-card cue
  instead; beat cards exist to show a sequence revealing over time.
- **Capacity is a hard limit.** Each beat card's catalog entry declares
  `max_beats` and `max_reveal_chars`. Never exceed either. If the VO covers
  more points than `max_beats`, split into two consecutive cues of the same
  card (e.g. "Pros" then "Cons" as separate pros-cons cues) or keep only the
  strongest points — dropping weak points is better than an overflowing card.
  If a reveal can't be said within `max_reveal_chars`, summarize harder.

## Variables

- Fill every non-beat variable listed in the card's catalog `variables`.
- Text is sentence-case.
- Product names in ANY on-screen text (variables and beat reveals) use the
  correct official spelling — the transcript is ASR output and garbles names
  (test-01: HeyGen → "Heigen/Hazen"); only anchors stay transcript-verbatim.
- When a cue is about a specific tool, set its `logo` slug (lowercase alphanumeric tool name). `summary-table` gets `productLogos` aligned with `products`. Only slugs that exist may be used — the resolver rejects unknown ones.

## Worked example

Sample transcript excerpt (VO-first: the transcript is the locked script's
TTS output, so wording matches the script near-verbatim):

> Let's talk about Bramble, a project tracker a lot of small teams are
> switching to. First, let's look at the pros and cons. On the plus side,
> the free tier is genuinely unlimited for up to five users, which is rare
> these days. It also syncs instantly across every device without any lag,
> so your team never loses a beat. On the downside, the mobile app crawls
> whenever you have more than a few hundred tasks loaded. And there's no
> offline mode at all, so a dead wifi signal means you're stuck waiting.
> One quick tip before we move on: you can drag any task straight into a
> project without opening a menu first.

The correct cues.json for that excerpt:

```json
{
  "video": "bramble-review",
  "approved": false,
  "cues": [
    {
      "id": "c01",
      "card": "pros-cons/pros-cons",
      "anchor": "let's look at the pros",
      "lead": 0.5,
      "hold": 3.0,
      "variables": { "title": "Bramble" },
      "beats": [
        { "reveal": { "kind": "pro", "text": "Unlimited free tier for 5 users" }, "anchor": "the free tier is" },
        { "reveal": { "kind": "pro", "text": "Instant cross-device sync" }, "anchor": "syncs instantly across every device" },
        { "reveal": { "kind": "con", "text": "Mobile app slows down" }, "anchor": "the mobile app crawls" },
        { "reveal": { "kind": "con", "text": "No offline mode" }, "anchor": "there's no offline mode" }
      ],
      "flagged": false
    },
    {
      "id": "c02",
      "card": "overlay/tip-banner",
      "anchor": "one quick tip before",
      "lead": 0.5,
      "hold": 3.0,
      "variables": {
        "kind": "tip",
        "label": "Pro tip",
        "text": "Drag tasks directly into any project",
        "edge": "bottom"
      },
      "beats": [],
      "flagged": false
    }
  ]
}
```

A second excerpt, this one a bridge with nothing on screen worth showing:

> Before we get into setup, one thing is worth saying plainly. Because
> picking the wrong model just burns credits, and there's no undoing that
> once a run finishes.

The correct cue for that bridge:

```json
{
  "video": "bramble-review",
  "approved": false,
  "cues": [
    {
      "id": "c07",
      "card": "slate/kinetic-sentence",
      "anchor": "because picking the wrong",
      "lead": 0.2,
      "hold": 2.0,
      "variables": {
        "text": "Because picking the wrong model just burns credits",
        "accent": "burns credits"
      },
      "beats": [],
      "flagged": false
    }
  ]
}
```

## Novel cards (flagged cues)

Flagged cues are reviewed on the storyboard board (plan 065), not
auto-corrected. When a flag is approved:

1. Author the new card into the library following BOTH card-library contracts:
   the Beat contract (card-library `README.md`) for timing mechanics, and the
   design system (card-library `DESIGN.md`) for palette, typography, layout,
   and motion — including honestly measured `max_beats`/`max_reveal_chars`.
2. Add a matching entry to `catalog.json` (beat-smoke.sh enforces the fields).

This grows the catalog so future videos flag less over time. Authoring
executor is Opus (owner decision 2026-07-18 — card authoring is occasional
library growth, not the per-video loop, so the Opus-stays-out-of-the-loop rule
doesn't apply); Antigravity is only used under the recorded
render-plus-visual-inspection mitigation (decisions.md 2026-07-07).

## Rubric

A reviewer scores a cues.json against these 10 checks; all 10 must pass (note: checks 3–9 and the repetition/stat-hit caps are machine-checked by `lib/lint-cues.mjs`, so the reviewer runs it instead of eyeballing those):

1. Valid JSON matching the `PIPELINE.md` schema.
2. Every anchor is a verbatim ≥3-word transcript quote.
3. Anchors appear in script order across the whole file.
4. Cue density is within Section 2's bounds for the video's runtime.
5. No two fullframe cues have overlapping spoken coverage.
6. Every `card` slug exists in `catalog.json`.
7. Every beat's `reveal` matches its card's `beat_shape`.
8. Every reveal `text` is 2–6 words.
9. No cue anchors into the first 15s or the last 20s of the video.
10. Every flagged cue carries a `note` explaining what's missing.
