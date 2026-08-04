# Intro Studio: brainstorm and design handoff

Written 2026-08-02. This is a briefing document for a reviewer who has not seen
any of the preceding conversation. It covers the owner's problem, what we built,
what came out of it, why it fell short, and what I want to do next. Everything
here is either quoted from the owner, measured from files in this repo, or
labelled as my opinion.

**What I want from a review.** The design in section 9 is not built yet. One
review has already been done (section 10) and it found real gaps. I want a
second opinion on whether the design is right, whether the fixes to it are
right, and what everyone has still missed. Please read the actual files. Several
claims in earlier discussion turned out to be wrong when checked against disk.

---

## 1. The owner's problem, in his words

He runs a YouTube channel and has automated video production almost end to end.
The bodies of his videos are fine. The intros are not.

> "I'm making the entire video creation mainly focusing on motion graphics and
> creating the entire editing the entire video automatically. The prior context
> is I bought Loop Studio for 1000 and that was the inspiration on making this.
> Now my one issue is that the video is good, obviously it's good, but I want to
> make my intro extremely better. I'm okay with paying for more tokens, but I
> want my intro to be better. It's fine if we are not using standard templates.
> It's totally fine. Currently my intros are not that great and I have tried
> using visual flow too, but I am thinking that since the entire flow is tied to
> templates and making HTML code to make motion graphics, maybe that's why the
> intro is not looking great or that impressive. I just want to brainstorm on how
> to make intro great, basically by giving all the creative freedom to Claude. I
> did find Loop Studio intro to be very good."

Two things to hold onto. He suspects the template architecture is the cause, and
he is willing to spend more money per intro to fix it.

## 2. What visuals-flow is

`pipelines/video/visuals-flow/` (visuals-flow from here on) is a Node plus LLM pipeline
that turns a recorded voiceover and screen capture into a finished video. Read
`pipelines/video/visuals-flow/PIPELINE.md` for the step table. The short
version of the ordering that matters:

- `010-transcribe-run`: audio to `transcript.json`, with a quality pass that
  corrects mistranscriptions
- `015-map-segments-run`: measures where the intro, body and conclusion are, into
  `segments.json`
- `020-choose-concept-llm`: picks the video's through-line, into `concept.json`
- `030-pick-or-propose-graphics-llm`: body graphics. First step that reads
  `card-library/catalog.json`
- `035-pick-or-propose-intro-outro-llm`: intro and conclusion graphics, also from
  the catalog
- `037`, `080`, `120`: the three human review gates
- `100-render-avatar-run`: HeyGen avatar clips, owner-run
- `110-build-video-run`: assembly

Visuals come from `pipelines/video/card-library/`, a catalog of 66 sealed HTML
templates. A card takes variables and renders a self-contained full-frame or
overlay graphic. Cards are good. The library has a real design system behind it,
which becomes important in section 7.

## 3. Why the intros fail

My diagnosis, and the owner agreed with it: this is architectural, not a matter
of taste or effort.

**The largest unit of authorship is a sealed card, so nothing can carry across
beats.** Each card owns its own frame, enters, does its thing, and leaves. The
next card starts from nothing. An intro built this way is a sequence of unrelated
full-screen graphics, which is what "not impressive" means in practice.

The evidence that this is structural rather than a density problem is in
`pipelines/video/visuals-flow/lib/zone-constants.mjs`. The comment there
records that the rejected test-03 intro was measurably **denser** than the body
it preceded, at 3.57 cues per minute against the body's 2.30. Adding more
graphics was already tried. It did not help.

The owner's own feedback file for the last video
(`pipelines/video/visuals-flow/videos/best-ai-video-generator/feedback.json`)
backs this up. His intro complaints are all about *selection*, not quantity:
"this motion graphic decision itself was bad, this is not the correct motion
graphic to be used at this place", "we could have modified the same motion
graphic". Separately, "this avatar came very late, for two minutes no avatar
came."

For contrast, the Loop Studio intro editor
(`~/.claude-personal/skills/loop-studio/editors/intro.md`, the thing he paid
1000 for and admires) describes a single authored screenplay with a seven beat
arc, objects that get promoted and demoted between beats, a dark to light colour
change on the story's turn word, and the presenter's face docked into the
composition. Its stated principle is "continuity is the craft". None of that is
expressible as a sequence of sealed cards.

## 4. What we built

`pipelines/video/intro-studio/`, a standalone proof of concept that builds an
intro as one authored composition. No cards at all. The flow: split the recorded
intro into voice and screen, transcribe it, write a `screenplay.json` of beats,
author one HyperFrames HTML file covering the whole intro, render it, critique
it, deliver an mp4.

Decisions the owner made when we designed it:

- **Full takeover of the intro span.** The intro becomes 100% authored
  composition. The screen recording is dropped for that span and the avatar is
  composited into the design rather than laid over footage.
- **The voiceover is fixed.** The narration stays exactly as recorded. This
  constrains everything downstream and is worth remembering when you get to
  section 11.
- **One render, one critique**, with a retry only if the first round fails.
- **The seven beat arc is a default, not a formula.** This preserves an earlier
  decision of his, recorded in `lib/zone-rules.mjs` as `R_ZONE_NO_FORMULA` dated
  2026-07-28: "its subjective. Pls dont make this hardcoded."
- **Build it standalone first**, and do not touch the working pipeline until he
  is satisfied. This became a hard stop rule in all three implementation plans:
  no reads or writes of `visuals-flow/` or `card-library/`.
- **The face is required.** He was explicit that the presenter being in the
  composition is the point, not optional decoration.

The machine-checkable part is a screenplay schema and lint
(`lib/screenplay-schema.mjs`, `lib/lint-screenplay.mjs`). A beat carries an
intent, the exact transcript clause it covers, start and end times taken from
word timings, a colour register, where the face is (full, panel or none), a prose
description of the stage, and a `carries` field naming which earlier beat's
object it inherits and how it transforms. That last field is the whole point: it
makes "continuity is the craft" something a linter can check. Errors E1 to E7
cover verbatim clause matching, timing, gapless coverage, valid references and
enum values. Warnings W1 to W4 cover the continuity rule, register change, the
face landing early, and a 12 second cap per beat.

There is also a render gate (`lib/film-gate.mjs`) that measures the finished mp4:
duration, longest frozen stretch, mean luma, luma range, and frame size.

## 5. What came out

We ran it on a real recording, an 86.7 second intro for a five-way AI video tool
comparison. The result is `videos/poc-01/` in intro-studio, and the mp4 is in the
owner's Drive.

Thirteen beats. Five tiles that are the same five DOM elements from first frame
to last: they start as an unlabelled arc behind the presenter, refuse to line up
while he says the tools are not built for the same person, take their names one
at a time on the word each is spoken, compress into a single block on "which tool
wins", become the five rows of a comparison grid, demote to a five stripe rail
beside the agenda, and finally drop into the link plate. The colour register
turns from dark to light on his actual pivot line, "I did not go in looking for
one overall winner", with a trophy that rises and gets struck through.

The avatar is a grey placeholder box. HeyGen renders are owner-run, and the
existing avatar clips from the visuals-flow run of this same video do not cover the intro:
`avatar-jobs.json` shows the first clip starting at 59.5 seconds of the assembled
video, which is literally the "no avatar for two minutes" complaint.

**The owner's verdict:**

> "I did see that it has potential and it's better than my template flow. I liked
> it, but it's not at all up to the mark. The text is very badly decided. Its
> font is bad, very small letters. Doesn't look like my branding. The overall
> intro is not at all following my branding and there are bugs here and there
> where some text is overlapping with some motion graphic or something else.
> Logos are not used."

So: the structural idea works, the execution is off-brand and buggy.

## 6. The tool names are wrong on screen

Worth its own section because it settles an argument.

intro-studio transcribed the audio itself, because it was standalone. Here is the
same sentence three ways:

| Source | Text |
|---|---|
| Raw whisper | "Open Art, Higgs Field, Synthesia, **Cajun** and **Arcad**" |
| visuals-flow after its 010 quality pass | "OpenArt, Higgsfield, Synthesia, **HeyGen** and **Arcads**" |
| intro-studio, on its own | "Open Art, Higgs Field, Synthesia, **Hejian**, and **Arcad**" |

Check `pipelines/video/visuals-flow/videos/best-ai-video-generator/transcript.json`
against `transcript.whisper-raw.bak.json` in the same folder.

The film puts five tool names on screen and four of them are wrong. Only
Synthesia is correct. visuals-flow already solved this in step 010, and the isolation rule
meant intro-studio re-made a mistake the pipeline had fixed months ago. All five
tools also have real logos sitting in `card-library/logos/registry.json`.

## 7. Why it looks off-brand

This is the root cause, and it is not subtle once you look.

`pipelines/video/card-library/DESIGN.md` is 398 lines of design system: palette,
type scale, tracking, contrast, layout, motion, ambient motion, logo handling. It
is enforced by `card-library/scripts/check-type-scale.mjs`. It encodes months of
the owner's corrections, some dated within the last week.

intro-studio was given `brand.json`: five colour tokens and no typography at all.
I wrote that file. So when I authored the film, I sized type by eye.

| DESIGN.md requires | The film shipped |
|---|---|
| Font `Inter`, weights 400 to 900 | Helvetica Neue |
| Hero 120 to 200px, weight 800 to 900 | No hero at all. Largest text is 54px |
| Secondary 40 to 56px | Tile names 27px, column headers 19px |
| Labels 22 to 28px, uppercase, `0.12em`, accent colour | None |
| Tracking in `em` | I used `-0.4px`, `-0.5px`, `-0.8px` |
| Hero at least 2.5x the next largest text | Everything sits between 19px and 54px |

DESIGN.md predicts this failure in its own words: "Type that looks generous in a
browser reads as timid at 1080p on a phone. Size against the FRAME." It also
flags px tracking as "the single most-missed rule in the pre-2026-07-25 library".
I made exactly that mistake because I never read the file.

Same story for the rest. Logos come from a registry with data-URI inlining; the
film drew invented coloured rectangles. Ambient motion has four approved
treatments with a machine-checkable marker; the film invented an 11px
oscillation. Cards have capacity contracts and a QA gate; the film had no layout
checking at all, which is why the trophy overlapped the portrait and the avatar
panel overlapped the grid rows.

**One sentence version.** The hard stop rule that protected the working pipeline
was correct for write access, but it also cut off read access, so the film
inherited none of the accumulated taste. The isolation that made the POC safe is
what made it off-brand.

A useful split falls out of this. Loop Studio's intro doc is about *structure*,
and structure is the part that worked. *Brand* is what I failed to carry over,
and brand is the part that failed. That suggests the approach is sound and the
inputs were starved, rather than the idea being wrong.

## 8. Defects found while building and running

Listed because they say something about how much of this was untested, and
because a reviewer should know the code has been corrected.

Found by running the shipped pipeline for real, all now fixed and on `main`:

1. The production render path omitted `PRODUCER_EXPERIMENTAL_FAST_CAPTURE=false`
   while the test set it. Running it for real died with "drawElement canvas not
   initialized" and zero of 90 frames captured. Green tests, broken pipeline.
2. The render fixture sized itself in body CSS, which HyperFrames ignores, so it
   rendered 1080x1920 portrait. A portrait intro cannot hand off to a landscape
   edit.
3. The gate had no resolution check at all, which is why nobody noticed.
4. The screenplay lint could not match any clause containing a hyphen or
   apostrophe. It compared one transcript token to one clause word, but
   normalising splits tokens: "side-by-side" becomes three words. Every clause
   with "five-way", "side-by-side" or "let's" was unmatchable.
5. E2 and E3 contradicted each other on the first beat exactly as they already
   did on the last. E3 pins beat one to time zero; no recording starts speaking
   at 0.000.
6. The duration gate compared the container's length against the intro, but a
   container is as long as its longest stream and the audio encoder pads to its
   own packet size. The picture was accurate to 0.023s while the mux reported
   0.064s over, failing a 0.05s tolerance.
7. A HyperFrames composition root needs `data-composition-id` plus a matching
   `window.__timelines` registration, or capture readiness stalls 45 seconds per
   worker. A four second render took 94.

Found by extracting frames and looking, rather than by any gate:

- The register turn was invisible. A full-bleed 1920x1080 avatar covered the
  light background, so the film's most important moment rendered dark.
- All five tool names were visible from frame one, so the reveal-on-word never
  happened.
- A rotating radial gradient was used as ambient motion. It is radially
  symmetric, so it changes no pixels, and eleven separate stretches of the film
  registered as frozen.

That last group matters for process reasons. Every one of them passed a green
gate. This repo already has two recorded incidents of visually broken video
passing tests, and this is the third.

## 9. What I am proposing

Move the intro film into visuals-flow as a step, rather than keeping intro-studio
standalone. The owner asked for this and gave a constraint:

> "Just make sure that it's not using templatized things for intro and those
> templates are not influencing this intro creation anyway. That context should
> not come in intro, otherwise I am assuming those templates will definitely
> influence the intro creation. Currently we have given all the creative freedom
> for intro. If we are introducing the same concept in visual flow, just make
> sure that the creative freedom remains the same. Let's introduce this as a POC
> step which is skipped by default."

The design:

1. New step `025-author-intro-film-llm`, after `020-choose-concept-llm` and
   before `030-pick-or-propose-graphics-llm`. Skipped by default behind a flag.
2. Placement rationale: it needs the corrected transcript (010), the measured
   intro span from `segments.json` (015) and the through-line from `concept.json`
   (020), but it must be authored before anything loads `catalog.json`. Step 030
   is the first step that touches the catalog.
3. Creative freedom enforced by a gate that fails if the 025 prompt's resolved
   input set contains the card catalog or any card HTML.
4. Split `DESIGN.md` into a shared `BRAND.md` (palette, typography, tracking,
   motion, ambient motion, logos) and a card-only remainder (declared capacity,
   tightest-variant rule, side-ready cards, enacted device rules, new-card
   checklist). The film reads only `BRAND.md`.
5. The type scale gets a film variant, with a hero per beat rather than one hero
   per composition.
6. Avatar ordering: 025 renders with a placeholder so the intro is reviewable at
   the existing gates, and a later step re-renders once with the real clip after
   HeyGen at 100.
7. When the POC flag is on, the existing `035` step authors the conclusion only,
   so two steps do not both claim the intro.
8. The film is exempt from visuals-flow's cue-shaped gates (`lib/zone-rules.mjs`,
   `lib/lint-cues.mjs`, the zone bar warnings) rather than translated into them,
   because translating a film into cues would quietly recreate the card model.
9. No card harvest. The owner may revisit this but has no plan to: "I might
   decide later to make it a card but no plan as of now."

## 10. What the first review found wrong with that design

A review has already been run against section 9. Note for the record: it was
requested from Fable and the harness silently downgraded it to Sonnet, so treat
it as a Sonnet review. Its findings held up when I spot-checked them.

**Two things the design misses outright.**

*The avatar models do not compose.* visuals-flow's avatar pipeline is a discrete-span
system: `060-place-avatar-llm` produces `shots.json` spans, and
`100-render-avatar-run` turns those into separate HeyGen jobs. The film needs one
continuous clip covering the whole intro, repositioned per beat by its own CSS.
Section 9 says a later step "re-renders with the real clip" and never says where
that single clip comes from. A second HeyGen pass? Stitching spans? Neither is
free, and this is the same problem that forced the placeholder in the first place.

*Cross-zone CTA bookkeeping breaks.* `R_ZONE_LINK_CTA` in `zone-rules.mjs`
counts "link in description" mentions across the whole video: the first gets a
strong treatment, later ones get weaker. Today one pass authors both zones and
can see both. Split them, and the conclusion pass has no idea what the film did,
while the rulebook itself notes the first mention is usually in the intro. That
rule was folded from a real production bug on this exact video.

**Three corrections to the design.**

The `DESIGN.md` split misses the section "A graphic carries a mark, not text
alone" (lines 284 to 306). I assigned it to neither bucket, so it defaults to
card-only, and it is precisely the rule whose violation caused the missing logos.
Worse, splitting the document does not fix logos by itself. Nothing in section 9
puts a logo requirement into the authoring prompt or adds a logo line to the
critique rubric. Built as written, the logos are still missing.

"Hero per beat" is the wrong mechanism. `check-type-scale.mjs` works by regex
over static CSS looking for `--hero-size`. Film type is animated, so there is no
static declaration to grep. It needs rendered per-frame measurement, closer to
the existing `overflow-probe.mjs` than to a variant of the type gate. The model
is also wrong: DESIGN.md already has a `hero_shape` taxonomy of short, prose and
none, where `none` exists specifically for parallel lists and dense tables
because "sizing row 1 up invents a hierarchy the content does not have". Several
beats of the film are exactly that shape. A uniform 120px floor per beat would
manufacture the hierarchy that carve-out was written to prevent.

The design also quietly reverses a recorded decision. `R_ZONE_SHARED_CATALOG`
logs the owner on 2026-07-29: "No need to restrict on templates, there will be
one template collection which body and intro, conclusion anyone can use." A
bespoke non-catalog intro is further from that than what he rejected then. It may
be the right call now, since he has seen the render, but the plan should say so
out loud instead of stepping around it.

**A correction to my own claim.** I described the prompt-input gate as
mechanically guaranteeing creative freedom. It does not. It catches one
accidental leak, a file being loaded. It cannot catch the authoring session's own
card habits, and it cannot catch a film written as N self-contained beats with
entrance, hold and exit, which is a slideshow of cards without any catalog file
ever being read. The suggested fix is to pair it with running 025 as a stateless
subagent whose context is provably just the listed files. I think that is right.

**Smaller findings.** `zone-rules.mjs` says "the intro and the conclusion"
throughout and needs real edits rather than just a flag, or the conclusion pass
reads rules asserting authority it no longer has. The Review 1 and Review 2
boards are built around itemised cue lists and a single mp4 does not fit that
data model, which is unscoped engineering work. And `E13 open-cover`, a hard lint
error saying the video must never open on bare screen recording, has no hard
equivalent in the film gate, only a soft rubric line about the face landing
early.

## 11. Still open

**Is 86.7 seconds the real problem?** The Loop Studio reference intro is about 40
seconds. This one is more than twice that, and five agenda items narrated in
sequence is inherently list-shaped. Branding will make it look right. I do not
think it will make it punchy. Fixing that means changing the voiceover, which the
owner has held fixed so far. I raise it because no amount of typography work
addresses it, and I would rather say so now than after another render.

**Does a card's type scale transfer to a film at all?** A card is one slate with
one hero. A thirteen beat film is not. Per-beat `hero_shape` is the current best
answer but nobody has tested it.

**How is the film reviewed?** The three human gates are built for cue lists. If
the intro cannot be judged inside them, the owner ends up reviewing it somewhere
else, and that is a workflow question as much as an engineering one.

## 12. Where things are

- The POC pipeline: `pipelines/video/intro-studio/`, with its own `PIPELINE.md`
  and `CLAUDE.md`
- The worked example: `pipelines/video/intro-studio/videos/poc-01/`, containing
  `screenplay.json`, `transcript.json` and the authored `film/index.html`. Media
  is gitignored
- The design system in question: `pipelines/video/card-library/DESIGN.md` and
  `scripts/check-type-scale.mjs`
- The logo registry: `pipelines/video/card-library/logos/registry.json`
- The pipeline it would move into: `pipelines/video/visuals-flow/PIPELINE.md`
- The rules that constrain zone authoring: `visuals-flow/lib/zone-rules.mjs`
  and `lib/zone-constants.mjs`
- Implementation plans that built the POC: 180, 181 and 182 in `plans/`, landed
  via PRs 138, 139 and 140

Nothing in section 9 has been implemented. intro-studio is still standalone and
still walled off from visuals-flow and card-library.
