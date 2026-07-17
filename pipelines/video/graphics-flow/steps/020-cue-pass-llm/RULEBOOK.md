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

These are starting defaults, not physics — when the script structure fights a
rule, follow the script and note why in the cue's context.

1. Place a fullframe cue at each natural section boundary, targeting one per
   60–120 seconds of runtime.
2. Overlays are sparse: at most one per minute, and only where a spoken point
   benefits from visual reinforcement.
3. Never let two fullframe cues' spoken coverage overlap.
4. No cue in the first 15 seconds or the last 20 seconds of the video.
5. A 30-minute video should land roughly 18–28 cues total.

## Choosing a card

Route by what the VO is DOING at that moment, using each catalog card's
`purpose` line to match:

- Enumerating advantages and drawbacks → a pros-cons card.
- Walking an ordered list → a checklist or bullet-points card.
- Comparing tools feature-by-feature → a feature-matrix or summary-table card.
- Delivering a final judgment → a verdict card.
- Opening a section → a section or title card.
- Reinforcing a single claim or number → an overlay card.

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
- Spell product names exactly as the script spells them, not as you'd
  normally capitalize them.

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

## Novel cards (flagged cues)

Flagged cues are reviewed on the storyboard board (plan 065), not
auto-corrected. When a flag is approved:

1. Author the new card into the library following BOTH card-library contracts:
   the Beat contract (card-library `README.md`) for timing mechanics, and the
   design system (card-library `DESIGN.md`) for palette, typography, layout,
   and motion — including honestly measured `max_beats`/`max_reveal_chars`.
2. Add a matching entry to `catalog.json` (beat-smoke.sh enforces the fields).

This grows the catalog so future videos flag less over time. Authoring
executor is Sonnet by default; Antigravity is only used under the recorded
render-plus-visual-inspection mitigation (decisions.md 2026-07-07).

## Rubric

A reviewer scores a cues.json against these 10 checks; all 10 must pass:

1. Valid JSON matching the `PIPELINE.md` schema.
2. Every anchor is a verbatim ≥3-word transcript quote.
3. Anchors appear in script order across the whole file.
4. Cue density is within Section 2's bounds for the video's runtime.
5. No two fullframe cues have overlapping spoken coverage.
6. Every `card` slug exists in `catalog.json`.
7. Every beat's `reveal` matches its card's `beat_shape`.
8. Every reveal `text` is 6 words or fewer.
9. No cue anchors into the first 15s or the last 20s of the video.
10. Every flagged cue carries a `note` explaining what's missing.
