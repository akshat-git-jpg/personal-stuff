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

| Field | Meaning |
|---|---|
| `video` | video slug, copied from the workdir name |
| `approved` | always `false` — a human/board flips this |
| `cues[].id` | short id, e.g. `c01` |
| `cues[].card` | catalog slug, e.g. `pros-cons/pros-cons` |
| `cues[].anchor` | verbatim ≥3-word transcript quote where the card appears |
| `cues[].lead` | seconds before the anchor the card starts (default 0.5) |
| `cues[].hold` | seconds held after the last beat (default 3.0) |
| `cues[].variables` | card variables excluding beats |
| `cues[].beats[].reveal` | beat-shaped object per catalog `beat_shape`, no `at` |
| `cues[].beats[].anchor` | verbatim ≥3-word quote where that beat lands |
| `cues[].flagged` | `true` when no card fits (see Section 8) |

## Cue density

Every threshold below is a copy for judgment context — `lib/cue-constants.mjs`
is the single source of truth; `lib/lint-cues.mjs` enforces it and
`lib/build-prompt.mjs` renders it into `cue-pass-prompt.md`. Retune density
there, not here.

**Keep the video visually active — motion graphics are a near-constant
presence, not a rare garnish.** (Owner recalibration 2026-07-21: earlier videos
had multi-minute bare stretches; the target is now ~2× that density.) Aim for
something on screen every ~35–50s, and **never let an interior stretch run
longer than ~50s with nothing but the raw recording** — `lib/lint-cues.mjs` W6
enforces this. A graphic still has to ADD something (structure at a boundary, a
number/list to hold onto, a comparison, or the spoken POINT of a bridge), but
"the footage already shows it" is no longer a licence to leave a long stretch
bare.

**Demos and walkthroughs get PUNCTUATED, not blanked.** Do not lay a redundant
graphic over a click the screen already shows — a `process/step-flow`
re-labeling visible steps is still wrong (owner fold 2026-07-18, test-01
c06/c09/c15). During a demo/playback stretch ONLY `placement: overlay` cards may be used (enforced by lint E5). But a long demo stretch should carry lightweight punctuation that
adds the SPOKEN layer, not the click: `overlay/callout`, `overlay/lower-third`, `overlay/tip-banner`, `overlay/stat-hit`, or `overlay/verdict-chips`. The test for a demo moment is: does
the graphic echo the click (skip it) or add the narration's point/label (keep
it)?

These are starting defaults, not physics — when the script structure fights a
rule, follow the script and note why in the cue's context.

1. Fire a fullframe/canvas beat every 35–60s of VO (fullframe cadence is measured over narration only, so a long demo is not a cadence failure).
2. Between fullframe beats, punctuate with overlays — up to 3 per rolling
   minute; a demo/bridge stretch should not go >~50s without at least a
   lightweight overlay or statement (W6).
3. Never let two fullframe cues' spoken coverage overlap.
4. Cold-open beat allowed in the first 15s (this zone stays sparse — W6 does
   not police it). No cue may END in the last 20s of the video except the
   end-card slugs (`brand/`, `link-in-description/`, `like-subscribe/`) — lint
   E4 raises this as a HARD ERROR, not a preference.

## Choosing a card

Route by what the VO is DOING at that moment, using each catalog card's
`purpose` line to match:

- Narration makes a claim, lists items, or states numbers and the screen does not show it → fullframe canvas beat (`slate/headline-chips`, `comparison/table-rows`, section slates). The screen already shows what is spoken → no graphic.

- Enumerating advantages and drawbacks → a pros-cons card.
- Walking an ordered list → a checklist or bullet-points card.
- Comparing tools feature-by-feature → a feature-matrix or summary-table card.
- Delivering a final judgment → a verdict card.
- Opening a section → a section or title card.
- Reinforcing a single claim or number → an overlay card.
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

**Structural consistency (mandatory).** Cards serving a parallel structural
role — the same semantic slot repeated once per compared item, like the
section opener for each of 5 tools — MUST use the SAME card for every item.
Mixing cards across parallel items makes the video asymmetrical and is a
defect, not variety. These cards carry `structural: true` in catalog.json and
are exempt from the repetition cap below; the linter knows. (Owner fold
2026-07-18: v2 swapped two of five tool openers to different section cards to
dodge the cap — wrong tradeoff, consistency wins.)

**Repetition cap (non-structural cards only).** The same fullframe card at
most 3 times per video. `overlay/stat-hit`: max 3 per video, ≥90s apart, only
for numbers the VO leans on — drop the least impressive rather than exceed.
Other overlays: vary callout's style and position when repeating.

**Pricing consolidation (mandatory).** Per-tool pricing/credits details during
tool segments stay on the screen recording — pricing pages are already on
screen. Consolidate pricing into ONE comparison graphic (e.g. a summary-table
with real prices) in the final comparison section. Never one pricing card per
tool. When the `comparison/table-rows` card is used, do NOT also emit stat-hit
cues for the same numbers. (Owner fold 2026-07-18, test-01 c20–c24.)

**Cold-open shows the products (mandatory for comparison videos).** Open on a card whose catalog
`roles` include `comparison-coldopen`, with the compared products supplied as
`platforms` entries carrying their logo slugs — never a text-only title. When
two products are compared, prefer `title/title-versus`: it renders both logos
at hero size with a VS between them, which is what a versus video promises in
its first seconds. The other `comparison-coldopen` cards lead with the title
and reduce the products to chips — use them only when there are more than
four products, or no logo exists for a product. (Owner fold 2026-07-20, test-02 c01.)

**One winner per verdict card (mandatory).** A verdict card's `winner` is
exactly one product. When the VO crowns two favorites, emit one verdict card
per winner, back to back, each anchored at its own "X was the best..." phrase
with its own reason. Never join names into one box. (Owner fold 2026-07-20,
test-02 c32.)

**Units on numbers (mandatory).** Any card that renders numeric values
(`bar-chart` bars, stat-hits, table cells) carries the unit ON the value —
prefix `$`, suffix `ms`/`/mo` etc. A bare number the viewer must decode from
context is a defect. (Owner fold 2026-07-20, test-02 c24.)

**Beat cards must not idle empty.** Anchor a beat-card cue so its FIRST beat
lands within ~8s of the card appearing (lint W5 enforces this). When the VO
introduces a section long before the first data point, anchor at the sentence
immediately preceding the first beat instead of the section opener. (Owner
fold 2026-07-20, test-02 c29: 18.9s of empty table scaffold.)

**Kinetic-sentence interstitial (`slate/kinetic-sentence`).** When it fires: a
narration bridge where there is no footage, UI, or data worth showing, and the
point is a single spoken assertion — this card is the alternative to letting
the host carry that bridge on camera. How often: this is a frequent device in
the reference, not a once-per-video special — whenever a bridge qualifies, use
it as one of the fullframe/canvas beats in the every-35–60s cadence (Section
2, rule 1); it draws from that same cadence rather than adding a separate
quota on top of it. `statement/keyword-statement` is a close sibling for the
same job (a spoken assertion with one phrase to emphasize) — reach for either.

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

If nothing in the catalog fits, do not force a bad match. Set the cue's
`flagged` to `true`, set `card` to the closest existing slug, and add a `note`
field explaining what's missing. See Section 8.

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
