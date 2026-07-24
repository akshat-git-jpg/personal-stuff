# How Loop Studio works, step by step

A plain walkthrough of the Loop Studio video pipeline, written to understand it against
visuals-flow. This doc covers the mechanics (how it makes a video). For the comparison, the ranked
list of what's worth copying, and the fresh-install fixes, see
[2026-07-23-critique-and-v2-handoff.md](2026-07-23-critique-and-v2-handoff.md).

Loop Studio is a set of Claude/Codex skills wrapped around a Remotion 4 engine, installed at
`~/.claude-personal/skills/` (the engine is `loop-studio/core/engine/remotion/`). Its whole bet is the
opposite of visuals-flow: bespoke per-beat authoring instead of templates. Higher craft ceiling,
slower and artisanal. The flow below is how it gets from an idea to a finished video.

## The flow at a glance

- Step 0 — Get the head (talking-head only: record and cut, or generate an avatar)
- Step 1 — Understand the whole video first
- Step 2 — Route by format
- Step 3 — Set up the project folder
- Step 4 — Write the screenplay before any code
- Step 5 — Load brand and taste before the first render
- Step 6 — Build in the engine (visuals, then sound, then mix)
- Step 7 — Review on the finished video
- Step 8 — Learn (fold lessons back in)

Steps 0 and 8 wrap around the rest. Step 0 only applies to talking-head videos; Step 8 feeds the
next video. The examples below use the 7-second avatar-3 short built on 2026-07-23 (a HeyGen avatar
saying "Hey, this is a quick test of our unlimited avatar pipeline, generated and downloaded straight
from the command line") and a hypothetical "I tested 5 AI video tools" comparison.

---

## Step 1 — Understand the whole video first

Before touching a scene, you answer three things about the whole video. What is it about (subject).
What does the viewer walk away with (promise). And the one core idea plus a through-line, meaning a
motif or object that recurs and evolves across scenes. In their docs this is "Law 0," and it's
non-negotiable. The reason: their claim is that v1 should already be good, and the way you get there
is understanding the whole before authoring any part. Build scene by scene and each beat looks fine
alone but the video feels like disconnected cards.

The output is not a file, just three decisions you carry forward.

Example, the "5 AI tools" video:
- Core idea (the argument, not the topic): "Most of these tools are great demos but fall apart on a
  real project, and only one survives." ("5 AI tools" is a subject with no spine; this has tension.)
- Through-line motif: one real 60-second ad every tool has to finish. The same unfinished progress
  bar appears for each tool and stalls at a different point; at the finale only the winner's fills.
- Plain-language frame: "treat it like a race, same track, same finish line, five runners." So a
  technical point (one tool caps at 720p) becomes that runner tripping before the line, not a bullet.

Each decision constrains a later step: the core idea decides which beats live or die in Step 4; the
motif becomes a real recurring object authored in Step 6; the frame decides how the hardest scene is
enacted rather than labelled.

visuals-flow contrast: your cue pass opens mechanically (transcribe, segments, place the best card at
each anchor). It's local by design and near-free. It never asks "what is the one argument" or "what
recurs across the video." That missing whole-video step is steal-list item #4.

---

## Step 2 — Route by format

One branching decision in two layers. First the treatment (how it looks): talking-head (the designed
motion-graphics treatment, the default, covering explainers / YouTube / talking-heads; two flavors,
head plus b-roll or the flagship head-composited-into-scenes), or vlog (assemble from raw shoot
footage). Second, for talking-head, the format (the shape): short (9:16, under 60s, one idea, 3 to 6
fast beats), longform (16:9, multi-minute, multi-section), or intro (a cold-open hook, ~40s or less).

The pair points at one editor doc (short.md / longform.md / intro.md), each of which reads the shared
treatment rules plus creative-standard and adds only the shape-specific rules. Format decides canvas,
runtime, beat density, hook timing, caption rules, safe zones, the subscribe bug, and how much sound
is justified. Their line: "a short is not a lesser video, it's the full creative standard at a
tighter shape."

Example: the avatar-3 clip was 7 seconds, vertical, a person talking, so it routed to talking-head +
short, which pulled in short.md's rules (1080x1920, captions always on inside the middle 70 percent,
one idea, hook by ~2s, one marker word, subscribe bug at 60 to 80 percent, which we skipped as too
short). A 5-minute version would route to longform.md instead (16:9, multi-section, a real score).

visuals-flow contrast: your pipeline is effectively one format (beat-synced graphics over a screen
recording plus avatar spans, landscape). There's no route-by-format branch. Producing shorts as well
as long videos would need per-format rule sets you don't have today.

---

## Step 3 — Set up the project folder

Every video lives in one folder, `projects/<name>/`, and nothing about it lives anywhere else. At the
root is `video.json`, a manifest declaring mode, flavor, aspect, fps, grade, subject/identity, brand
variant, music, and the beat map. Around it: `source/` (head footage), the screenplay
(`design_<name>.json`), `renders/`, and the review and version history. The review tool later
attaches to this same folder and keeps `versions.json` plus `versions/<label>.mp4`, so v1, v2, v3 all
track in one place. Their rule: never scatter a video across ~/Downloads.

Example video.json for the short:

```json
{
  "name": "avatar3-short", "mode": "talking-head", "flavor": "explainer",
  "format": "short", "aspect": "9:16", "fps": 30, "head": "avatar",
  "brand": "buildloop", "grade": { "lut": "", "feel": "clean, neutral" },
  "music": "one bed, under the VO", "quality_bar": "video-taste"
}
```

visuals-flow contrast: you already do this well. `videos/<slug>/` is the same idea (transcript.json,
cues.json, resolved.json, manifest.md committed; media gitignored; feedback.json in the folder). The
only difference is Loop Studio front-loads all config into one `video.json`; yours is spread across
`cue-constants.mjs` and per-step files. A small per-slug manifest is the clean way to add per-video
overrides (a different aspect or brand for one video) in v2.

---

## Step 4 — Write the screenplay before any code

The heart of the system, and the closest analog to your cue pass. Before any scene code, you author
`design_<name>.json`: a `concept` block up top (core idea + through-line from Step 1), then one row
per beat (usually one spoken clause). Fields per row:

- start, end, narration — the clause and its timing, from the transcript.
- mode — how the head sits: full, panel, or hidden.
- object — what is on canvas (the thing you enact).
- action — what the object does, which register (dark = problem, light = solution), what fires on
  which spoken word.
- continuity — what carries over from the previous beat. This is where the through-line motif lives.
- copy — words on screen, including the one marker word (the single lime-wiped word).
- sync — frame-accurate cues tied to specific spoken words.

This is where the creative decisions get made, in words, before code. It separates ideation (this
file) from execution (Step 6). Two real beats from the short:

```json
{ "id": "b2", "start": 1.6, "end": 3.3, "narration": "of our unlimited avatar pipeline",
  "mode": "full", "object": "an UNLIMITED plate above the head, plus the caption phrase",
  "action": "on 'unlimited' a lime plate snaps in above the head; 'unlimited' is the caption marker word",
  "continuity": "same full-frame head as beat 1; captions keep rolling",
  "copy": { "marker": "unlimited", "mono_label": "LOOP STUDIO / AVATAR" },
  "sync": [ { "at": 1.94, "event": "UNLIMITED plate snaps in" } ] }
```
```json
{ "id": "b4", "start": 5.1, "end": 7.06, "narration": "straight from the command line",
  "mode": "full", "object": "a terminal card typing the real command",
  "action": "on 'command line' a zsh window slides in and types '$ loop avatar --generate --download'",
  "continuity": "head stays full-frame; a BUILD-LOOP.AI tag fades in underneath",
  "copy": { "marker": "line", "mono_label": "$ loop avatar" },
  "sync": [ { "at": 5.5, "event": "terminal slides in" }, { "at": 5.7, "event": "typing starts" } ] }
```

visuals-flow contrast (the important one): your `cues.json` says "pick this card, fill these
variables, anchor it here." Loop Studio's `design_<name>.json` never picks a pre-built card; it
describes what to enact (object, action), the register, the continuity/motif carry-over, and the
exact word each thing fires on. One selects a template, the other specifies a bespoke enactment. The
`continuity` field is the motif you don't have; `object`/`action` are the enactment your reveal-cards
don't require. Closing the gap without dropping templates = add those fields for a new "enacted
device" card class. Steal-list items #3 and #4.

---

## Step 5 — Load brand and taste before the first render

Right before building, you load three sets of constraints so v1 already obeys them:

- brand.json + brand-book.md — machine-readable tokens (colors, fonts, caption style, logo, LUT).
  The engine imports brand.json and derives the whole palette, so it's the locked look and it's
  per-owner swappable. Creativity lives in ideas, enactment, and motion; palette/type/names are
  locked.
- video-taste — the compounding quality bar: universal.md (every rule learned across their v7 to
  v26 history), by-type/ (per-format rules), by-subject.md (who's on camera), my-rules.md (owner
  preferences, never overwritten by updates).
- creative-standard.md — the 10 laws, the screenplay method, the device library, the falsifiable v1
  self-audit.

The point is that v1 comes out on-brand and at the bar without burning rounds on "off-brand color" or
"broke contrast." (The Step 0 toolchain smoke test stays on defaults; you only load all this for the
first creative render.)

Example: the short came out raisin/lime/silver in Space Grotesk and JetBrains Mono because those came
from brand.json, not a choice. Rules like "one marker word per frame" and "captions in the safe zone"
are video-taste applied up front.

visuals-flow contrast (you're ahead): your `DESIGN.md` + `catalog.json` is the brand contract, and
your `RULEBOOK.md` + `cue-constants.mjs` + `lint-cues.mjs` is the taste memory. Crucially yours is
machine-enforced: the linter fails you, plus convergence metrics and edit-delta. Loop Studio's
video-taste is prose a model is asked to obey. Keep your linter advantage. Two things worth borrowing:
brand.json as one swappable token file (clean for per-channel looks), and the universal.md vs
my-rules.md split (never overwrite the owner's own preferences).

---

## Step 6 — Build in the engine

Execution, in three sub-stages that run in order.

6a. Author the scenes and render. Each screenplay row becomes hand-written Remotion code: object ->
component, action -> animation timed to the words, continuity -> the motif element carried over, sync
-> cues firing on exact frames. Registers switch dark/light, the head composites in one of three modes
(full / panel / hidden), and durations are locked to the voiceover so nothing drifts. Render each comp
with `render-film.mjs`. This is bespoke authoring, not template filling: the craft and the cost.

6b. Sound design. `detect_events.py` frame-diffs the rendered video to find where things happen, then
`build_sfx.py` places sound with meaning: different timbre per kind of moment, pitch rising as things
accumulate and falling on loss, steady ticks for a counter, a low drone bed underneath. The sound
argues what the picture argues.

6c. Mix and master. `build_v<N>.sh` combines it: voice centered with a processing chain, music looped
from its sustained core and sidechain-ducked under the voice, an SFX bus, then a frame-exact stitch
(each segment's audio trimmed to its exact video frame length, concat, mux once) and a master to
minus 14 LUFS. It verifies the container after (video duration == audio duration, both start at zero).

Where does the sound come from? A folder of about 20 wav files in `public/sfx2/` (a small kit:
card-pop, thock, whooshes, tear, scratch, tick, drone_low, plus Epidemic Sound clips es_typing,
es_success, es_ping, es_impact, es_riser, es_blip, es_swipe, es_select). It is sample-based, not
synthesized. IMPORTANT: that folder does NOT ship in the bundle (public/ only has brand/, logos/,
projects/) because the Epidemic samples are licensed. The value that DID ship is the code: the
placement-and-pitch logic (`pop_semi` pitches a sound by semitone to build a melody across a run;
timbre assigned by meaning; gain jitter; accents spaced; the mix soft-clipped). So the samples are
commodity, the logic is the IP.

Example: for the short, 6a is `Avatar3Short.tsx` (each beat's object/action became a component:
UnlimitedChip, TerminalCard, word-timed Captions). I skipped 6b and 6c entirely (used the head's own
audio, no SFX, no music, no master), which shows how separable the sound stage is.

visuals-flow contrast: 6a's equivalent is `render.mjs` rendering cards from `resolved.json`, but yours
fills templates while theirs writes bespoke JSX. That's the core scale-vs-craft trade. 6b and 6c you
simply do not have: your effects layer is visual only (whip/flash/drift/captions), no sound-event
detection, no semantic SFX, no ducking, no loudness master. Steal-list item #2, and the most
self-contained to add because it bolts onto the end of assemble without touching the card pipeline.
You would bring your own ~20-sound kit and port the placement logic.

---

## Step 7 — Review on the finished video

A frame.io-style review tool that runs on the finished mp4. `make_review.py <mp4> --project <Name>
--label v1` builds a folder in `~/Downloads/<Name>-Review/` with `review.html`, a `serve.py`, and a
`versions/` history; serve.py serves it on a localhost port. You scrub the video, drop comments pinned
to exact timestamps (and to a spot on the frame), and click "Send to Claude," which writes
`feedback_latest.json`. Each note has an id; Claude fixes each and runs `post_status.py` to mark it
done, and because the page polls every couple of seconds you watch the to-dos check off live. Two hard
gates: publish and paste the link on every render without being asked (Gate A), and tick each note off
live on "feedback done" (Gate B). Every render is a new version. The tech is simple: a page, a server,
a JSON file. The value is the interaction.

Example: this session both the smoke render (localhost:8929) and the short (localhost:9136) were
published to this tool with the link pasted.

visuals-flow contrast: this is steal-list item #1 and your open problem #3. Your board (localhost:4322)
reviews the storyboard before render, which is cheap iteration Loop Studio lacks, so keep it. But you
have no post-render, scrub-the-actual-video reviewer with timestamped/point-pinned comments and live
check-off; your post-render check is a static filmstrip. Run both: keep your pre-render board, add
their post-render reviewer (plug it in after assemble, publishing final.mp4). Easiest thing on the
list to port.

---

## Step 8 — Learn (fold lessons back in)

After a review round, general lessons (the reusable rule, not the one-off fix) get written into
video-taste (my-rules.md for owner preferences, universal.md for shared rules). If a review forced a
new way to show an idea, that device is promoted from the one-off scene into the shared concept
library (`bb2/concepts.tsx`) so it becomes a reusable primitive. The never-repeat-a-mistake step; the
taste memory compounds.

visuals-flow contrast (you're ahead): your `060-feedback-fold` (Opus) does exactly this and more.
Owner feedback becomes durable edits to RULEBOOK/prompt/DESIGN/catalog, items marked folded,
feedback-status blocks a new cue pass while anything is unprocessed, plus edit-delta and convergence
metrics. Their "promote a device into concepts.tsx" is your "add a card to the catalog." You already
do this, machine-tracked rather than prose.

---

## Step 0 — Get the head (talking-head only)

The raw material for a talking-head video, gathered first. Two sources. Recorded: a real person to
camera, then cut with the cut engine (`core/engine/cut/`) using a strict method (transcribe +
forced-align, author a keepers.json selecting the last clean complete take of each line, drop
retakes/fillers, render, verify by re-transcribing which fails on any repeat; their reference: 250s of
retakes to 50s, zero repeats). AI: generate an avatar (avatar-video / HeyGen, or Higgsfield), which
comes out as one clean take with nothing to cut. The avatar-3 clip was the AI path. A pure
motion-graphics video with no host skips Step 0 entirely.

visuals-flow contrast: you handle the head differently and more completely. You're voiceover-first
(TTS voice + separate screen recording + HeyGen avatar spans as one lane among screen-rec and
graphics). Their cut engine is the part you correctly skip, because TTS-first means no messy takes.

---

## The one-paragraph takeaway

Loop Studio front-loads human judgment (Steps 1, 2, 4) and back-loads finish (6c, 7), and hand-authors
the middle. visuals-flow front-loads determinism (transcribe, one cue pass, lint) and scales the
middle with templates. The three places Loop Studio genuinely reaches higher are the ones visuals-flow
does not have yet: the whole-video concept step (1), the sound and mix stage (6b/6c), and the
finished-video reviewer (7). Everything else, visuals-flow either already does or does more rigorously.
That is the whole map for the v2 decision. See the handoff for the ranked steal-list and open
questions.
