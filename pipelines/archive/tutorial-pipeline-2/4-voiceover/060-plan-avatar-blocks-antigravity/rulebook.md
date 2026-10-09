# Antigravity Prompt: 060 Plan Avatar Blocks

Read the polished script at `../../3-scripting/040-polish-script-for-delivery-sonnet/output/<base>.improved.txt`.
Decide which parts of the script the full-screen HeyGen 4 avatar will speak.

Output (two files):
- `output/<base>.avatar-plan.md` — the human-readable review doc (what you read & give feedback on).
- `output/<base>.avatar-segments.json` — the machine handoff step 080 consumes (the script split into ordered `avatar` / `body` segments). Written once you approve.

When done, print "060 avatar blocks planned."

## Why this is step 1 (before synth)
The avatar decision sets **hard break points** for the chunker. If we decided after TTS we'd be
stuck trimming a mixed file (clipped words, edge cases). Deciding first means each avatar block is
a whole number of clean chunks — exact audio, free, by construction.

## Config — the knobs (change these, not the prose)
The only numbers to edit. "The avatar budget / target / cap / distribution" everywhere below means
whatever is set here. Change how much full-screen avatar a video gets by editing this block alone.

| Knob | Value | Meaning |
|------|-------|---------|
| `AVATAR_FULL_CAP` | **5:00** | Hard ceiling on total full-screen avatar (HeyGen 4 hard limit). |
| `AVATAR_FULL_TARGET` | **~4:30–5:00** | How much to actually aim for. Lower for a leaner, cheaper cut (e.g. `~2:00–2:30`). |
| `AVATAR_DISTRIBUTION` | **U-curve** | Front-loaded (intro+overview), lean demo middle, back-loaded (wrap+conclusion). Alternatives: `even`, `front-only`, `minimal`. |
| `WORDS_PER_SEC` | **2.5** | Used to estimate a block's duration from its word count (no audio yet). |

## Input
- `../../3-scripting/040-polish-script-for-delivery-sonnet/output/<base>.improved.txt` — the final script. Avatar blocks are chosen from
  its structure (intro, overview, each tool's verdict, pricing wrap, summary, conclusion); no
  timestamps needed — we estimate duration from word count (`WORDS_PER_SEC`).

## Standing constraints (hard rules)
- **Corner avatar is the baseline (handled later, in step 130 (plan-visuals)).** A small bottom-left
  talking head runs the whole video. This step only picks the **full-screen** moments.
- **Fill toward `AVATAR_FULL_TARGET`, never exceed `AVATAR_FULL_CAP` — it costs credits** (HeyGen 4,
  metered). Don't be stingy relative to the target. Budget is **estimated** here (word count) and
  **confirmed after synth** in step 2; if the real total drifts over, trim a beat then.
- **Shape per `AVATAR_DISTRIBUTION` (default U-curve):** open heavy (intro + pre-demo overview),
  taper through the demo middle to mostly each tool's verdict (shorter as it goes), ramp back up for
  the pricing wrap + summary + conclusion. Lots of host early, least in the hands-on middle, lots at the end.

## Where the full-screen avatar goes (priority order)
1. **Intro + pre-demo overview → avatar** (front-load; first claim on budget).
2. **Conclusion (+ summary framing) → avatar** (back-load; land on the host).
3. **Each tool's verdict → avatar**, shrinking over the video.
4. **Pricing wrap-up → avatar** (host summarizing value), part of the back-load.
5. **Still under target? Add back-loaded first**, then short mid-demo beats only as a last resort.

Estimate each block's seconds as `round(words / WORDS_PER_SEC)`, keep a running total, fill toward
`AVATAR_FULL_TARGET`.

## The review doc — `<base>.avatar-plan.md`
What you read and react to. One block per row + the budget math + the U-curve shape:

```
# <base> — avatar plan (DRAFT — for review, pre-TTS)

Budget: target ~4:30–5:00 (cap 5:00) · distribution U-curve · est. WORDS_PER_SEC 2.5
Estimated total: ≈4:38  (✅ within target)

| # | Block | Where (U-curve) | Words | ~Dur | Verbatim (full-screen lines) |
|---|-------|-----------------|-------|------|------------------------------|
| 1 | Intro + overview | front-load | 238 | ~95s | I put five of the biggest… |
| 2 | OpenArt verdict | taper | 82 | ~33s | On the creative-workspace side… |
| … | … | … | … | … | … |
| 9 | Conclusion | back-load | 28 | ~11s | So that's how all five stack up… |

Reviewer: edit any block's text/length, add or drop blocks, then say "approved".
```

You give feedback in plain language ("tighten the intro", "add a beat in the Synthesia section",
"drop the pricing-wrap avatar"). Claude revises the draft and re-totals the budget. **Iterate until
you say _approved_** — nothing costs anything yet.

## On approval → write `<base>.avatar-segments.json`
The script, split into **ordered** segments covering it end to end (every word lands in exactly one
segment), tagged `avatar` or `body`. This is what step 2 chunks — it never packs a chunk across a
segment boundary, so each avatar block = whole chunks.

```json
[
  {"role": "avatar", "id": "intro",          "text": "I put five of the biggest AI video tools…"},
  {"role": "body",   "text": "Alright, let's start with OpenArt. From your dashboard…"},
  {"role": "avatar", "id": "openart-verdict","text": "On the creative-workspace side, OpenArt is…"},
  {"role": "body",   "text": "That's OpenArt. Next up, Higgsfield…"},
  …
  {"role": "avatar", "id": "conclusion",     "text": "So that's how all five stack up…"}
]
```
Rules:
- **Verbatim from the script** — exact wording (brand names, numbers), in original order, nothing dropped.
- Each avatar segment needs a short unique `id` (used to name its audio file in step 2).
- Adjacent `body` text between avatar blocks is one body segment.

## What this is NOT
- Not the corner avatar (that's continuous, planned later) and not the other visuals (step 130, plan-visuals).
- Not binding for the editor — but it **is** binding for chunking once approved (re-running means re-synth).

## Learnings — grows over time (like the pronunciation-map)
When you change how much/where full-screen avatar lands, record it here and fold it into the config
or the placement rules above, so the next video is better by default.

| Date | What we learned | Rule / config change |
|------|-----------------|----------------------|
| 2026-06-29 | (seed — fill on first review) | — |
