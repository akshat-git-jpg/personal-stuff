---
name: yt-style-copy
description: Clone a competitor YouTube channel's script and/or visual editing style from its style pack. Verbs: fetch-transcripts/build-script-style-dna (script), fetch-video/build-video-style-dna (visual — independent sides), suggest-topics, suggest-titles, write-script. Triggers on "yt-style-copy", "clone <channel>'s style", "build script style dna", "build video style dna", "suggest topics for <channel>", "suggest titles like <channel>", "write a script in <channel>'s style".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# yt-style — competitor style cloning

All data lives in style packs: `pipelines/youtube/competitor-styles/channels/<slug>/`
(layout in that folder's CLAUDE.md). Route on the verb; if the verb or slug is
missing, list `channels/` and ask which channel + verb in one question.

Never load the whole transcript corpus for generation — that is exactly what
the DNA exists to avoid. Generation verbs read ONLY `script-style-dna.md`,
`rubric.md`, `exemplars/`, and (for topics) `videos.json`.

## fetch-transcripts <channel-url>

Not an LLM task. Tell the user to run (or run for them):

    python3 pipelines/youtube/competitor-styles/ingest.py <channel-url> --limit 30

Re-running later picks up new uploads. Then suggest `build-script-style-dna`
if `script-style-dna.md` doesn't exist yet.

## fetch-video <channel-url>

Not an LLM task. Tell the user to run (or run for them):

    python3 pipelines/youtube/competitor-styles/fetch_video.py <channel-url> --limit 30

Downloads at 720p, measures cut pacing, caches frames, and deletes the raw
video per video — independent of `fetch-transcripts`; run it even if the
channel has no script pack. Re-running later picks up new uploads. Then
suggest `build-video-style-dna` if `video-style-dna.md` doesn't exist yet.

## build-script-style-dna <slug>

The one expensive session per channel. Requires `transcripts/` to be non-empty.

1. Read `channel.json` + `videos.json`. Compute the median view count and note
   every video ≥ 2× median (the outliers).
2. Read ALL transcripts in batches of ~8. After each batch, append raw
   observations to `distill-notes.md` in the pack (hooks seen verbatim,
   structure beats, recurring phrases, pacing impressions, CTA moments).
   Don't polish; capture evidence with video ids.
3. Synthesize `script-style-dna.md` with EXACTLY these sections (all required —
   every claim backed by at least one verbatim example with its video id):
   - **Identity snapshot** — ≤5 lines: format(s), audience, energy, POV.
   - **Hook formulas** — each distinct opening pattern, 2 verbatim examples
     each, typical hook length in words/seconds.
   - **Structure map** — beat-by-beat skeleton per format they use, with
     rough % of runtime per beat.
   - **Pacing & rhythm** — words-per-minute estimate (words ÷ duration from
     frontmatter), sentence-length habits, question frequency, repetition
     devices.
   - **Language fingerprint** — recurring phrases and verbal tics (verbatim),
     vocabulary level, contractions/slang habits, words they NEVER use.
   - **Transitions & retention devices** — how sections connect; open loops,
     callbacks, pattern interrupts, with examples.
   - **CTA style** — when and how they ask (sub/like/links/product), verbatim.
   - **Title patterns** — cluster their titles into named patterns with
     examples; flag which patterns the outliers use.
   - **Topic performance** — median views; the outlier list with a one-line
     "what it shares with other outliers"; visibly under-explored adjacent
     topics.
   - **Do-not list** — things this channel never does (so a clone won't).
4. Write `rubric.md`: 12–15 binary pass/fail checks derived from the DNA,
   each check quoting the DNA section it enforces (e.g. "Hook is ≤25 words
   and uses one of the 3 hook formulas"). This is the QC gate for `write-script`.
5. Pick exemplars into `exemplars/` (copy the full transcript files):
   one top outlier, one maximally typical video, and — if the channel runs
   multiple formats — one of the format the owner most wants to make.
   State the picks + one-line reasons at the top of `rubric.md`.
6. Delete `distill-notes.md`. Report: DNA sections written, rubric check
   count, exemplar picks.

Refresh policy: re-run build-script-style-dna only when the pack gains ~10+
new transcripts or the channel visibly changed style; it overwrites
DNA/rubric (git holds history).

## suggest-topics <slug>

Load `script-style-dna.md` (Topic performance + Title patterns) and `videos.json`.
Produce 10 topic suggestions this channel would plausibly make next but
hasn't: each with (a) one-line rationale grounded in their outliers, (b) the
format it fits, (c) 2 title variants using their named title patterns.
Append as a dated section to `output/topics.md` (create if missing).

## suggest-titles <slug> "<topic>"

Load `script-style-dna.md` (Title patterns). Produce 8 title variants for the topic,
each labeled with the pattern it uses; mark the 2 the outlier data favors.
Print in chat; no file write unless asked.

## write-script <slug> "<topic>"

Loads `script-style-dna.md`, `rubric.md`, and every file in `exemplars/`. Output dir:
`output/scripts/<topic-kebab-slug>/`. Target length: the channel's median
video duration × the DNA's words-per-minute (state the computed word target
before writing).

- **Pass 1 — outline.** Write `outline.md`: the hook fully drafted (not
  summarized), then each structure-map beat with 1-2 lines of planned content
  and a word budget. STOP and wait for explicit approval. Do not start the
  script in the same reply.
- **Pass 2 — full script.** Only after approval. Write `script.md` in the
  channel's exact voice — spoken lines only, no camera directions unless the
  channel's own scripts imply them. Any factual claim you cannot verify from
  the conversation gets a `[VERIFY: …]` placeholder rather than an invented
  fact.
- **Pass 3 — QC (same session, automatic).** Score the draft against every
  `rubric.md` check. Revise the script until every check passes or the misses
  are genuinely inapplicable. Append a scorecard to the bottom of `script.md`
  as an HTML comment (`<!-- rubric: 14/15 pass; #7 n/a because … -->`).

## build-video-style-dna <slug>

The expensive video session per channel (independent of `build-script-style-dna`
— a channel can have one, the other, or both). Requires `video-metrics.json`
to be non-empty.

1. Read `video-metrics.json` + `videos.json`. Using view counts and
   `cuts_per_minute`, pick a representative subset: the top view-count
   outlier, one maximally typical video, one per visually distinct format
   if the channel runs several, and any video whose `cuts_per_minute` is a
   clear outlier vs the channel median (a "high-energy edit" signal worth
   its own look). Aim for roughly 5-8 videos total — enough range without
   reviewing every video's frames.
2. For each chosen video, list `.video-cache/<video_id>/` (sorted by
   timestamp). If it has more than ~40 frames, evenly subsample down to
   ~40 before reading anything — pick every Nth file rather than reading
   the full set (some channels' longer shots generate hundreds of interior
   samples; Tier 1 extraction is free, but Tier 2 review is not, so cap
   here, not at extraction time). Read the (sub)sampled frames in batches
   of ~10 images. After each batch, append raw observations to
   `video-distill-notes.md` in the pack (B-roll moments, caption/overlay
   style, motion-graphics/animation beats, framing, thumbnail impressions —
   capture evidence with video id + timestamp, don't polish yet).
3. Synthesize `video-style-dna.md` with EXACTLY these sections (all required
   — every claim backed by at least one example with its video id and
   timestamp):
   - **Identity snapshot** — ≤5 lines: visual format(s) (talking-head /
     screen-recording / animated / hybrid), overall visual energy,
     dominant color grade or aesthetic.
   - **Cut pacing** — cuts-per-minute and shot-length distribution computed
     across the FULL `video-metrics.json` (every fetched video, not just the
     reviewed subset), and how pacing varies by video length or format.
   - **B-roll patterns** — how often and when B-roll appears vs talking-head,
     typical B-roll sources, examples with video id + timestamp.
   - **On-screen text & captions** — burned-in caption/lower-third/callout
     style, timing relative to speech, examples.
   - **Motion graphics & animation** — kinetic typography, transition
     styles, animated overlays/icons, examples.
   - **Thumbnail style** — composition/color/text patterns across the
     reviewed videos' frames.
   - **Framing & composition** — camera angle and shot-composition habits.
   - **Do-not list** — visual patterns this channel never uses.
4. Copy 15-20 of the most illustrative frames referenced in the DNA into
   `frames/exemplars/` (rename descriptively, e.g.
   `<video_id>_<timestamp>s-lower-third.jpg`), so a claim can be visually
   spot-checked later.
5. Delete `video-distill-notes.md` and everything left in `.video-cache/`.
   Report: DNA sections written, evidence frames kept.

There is no `video-rubric.md` — nothing consumes it yet. `write-script`
reads only `script-style-dna.md`/`rubric.md`/`exemplars/`; it does not read
`video-style-dna.md`.

Refresh policy: re-run build-video-style-dna only when the pack gains ~10+
new measured videos or the channel visibly changed its visual style; it
overwrites `video-style-dna.md` (git holds history).

## Guardrails

- Style is cloned; facts are not. Never copy a competitor's specific claims,
  numbers, or sponsor reads into a generated script.
- One channel per invocation — no blending styles unless explicitly asked.
- If `script-style-dna.md` is missing for the requested slug, run
  `build-script-style-dna` first (confirm with the user — it's the
  expensive step).
