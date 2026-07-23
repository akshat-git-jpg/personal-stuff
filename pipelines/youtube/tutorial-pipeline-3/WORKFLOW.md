# tutorial-pipeline-3: VO-first tutorial workflow

**Date:** 2026-07-23 (v3 — owner brainstorm folded in: no reviewer, no scratch-walkthrough
fallback, demo-flag split with visuals-flow, TTS/QC flows specified)
**Status:** concept only. This file describes how the workflow works and why. No scripts,
no folder layout yet. Implementation gets planned separately when the owner says go.
**Replaces:** tutorial-pipeline-2's ordering. See "What changes from t-p-2" below.

## The problem this solves

tutorial-pipeline-2 records the screen first and generates the brand-voice TTS after.
The new audio is a different length from the original narration, so it drifts out of
sync with the footage, and t-p-2's answer was a segment map plus retime arithmetic that
stretches video to fit audio. The owner reviewed that machinery on 2026-07-22 and
rejected it (`docs/tts-screen-sync-brainstorm-handoff.md` has the full autopsy).

The fix is ordering, not math. Generate the voiceover first, then record the screen
while listening to it. There is no sync step because nothing ever goes out of sync.
Same call as the multi-channel final workflow (decisions.md 2026-07-12).

## The rules

1. The voiceover is the master timeline. Once a section's TTS is locked, its timing
   never changes. Everything else is performed or placed against it.
2. The script is born in sections, and sections flow through everything: scripting,
   TTS, recording, assembly. Nobody ever works on "the whole video" in one shot.
3. The script decides only what is TRUE about the content (what needs a demo);
   visuals-flow decides how everything looks (avatar vs graphics, overlays, effects).
   One fact axis, one presentation axis, no overlap.

## The workflow

**1. Inputs (owner).** Three things go in:
- The topic.
- The knowledge base: transcripts of videos on the same topic, the tool's dossier
  (`pipelines/youtube/dossiers/`), and the owner's vision notes for this video.
- The channel's script Style DNA (`yt-style-copy`), so multi-channel output doesn't
  converge into one voice.

**2. Script generation (Claude, rulebook-driven).** Claude writes a structured script
from the inputs. There is no separate human review: the generation rulebook is the
quality mechanism. It encodes how to write from the dossier and Style DNA (structure,
hook, coverage, grounding: every factual claim traceable to the knowledge base) and
ends with a self-check pass against its own rules before the script is emitted. Beyond
writing well, the step has two duties:
- Mark every section `demo: yes/no`. A demo section is one whose narration describes
  actions in the tool; those are the only sections that will ever need a recording.
  Non-demo sections (context, opinions, comparisons) are free content: no footage will
  ever be expected for them, so the script can explain anything.
- Flag, never guess, anything demo-specific it cannot know from transcripts: exact
  menu names, current pricing on screen, what a dialog actually says. Flags are scoped
  placeholders — `[VERIFY: exact button label]`, `[FILL: steps to export, rough notes
  are fine]` — instructions to the tutorial maker, not holes in the prose.

**3. Verification pass (tutorial maker).** The tutorial maker reads the script while
exploring the actual tool and resolves every flag: confirms labels, fills in demo
steps, corrects anything the tool's current UI contradicts. Their writing surface is
the flags, not the whole script. Rough notes are acceptable input; the next step
cleans them.

**4. Polish and lint (automated).** A script pass, not a Claude session: cleans the
tutorial maker's notes into script voice, checks Style DNA consistency, and hard-fails
if any flag is unresolved. Nothing reaches TTS with a `[VERIFY:...]` still in it.

**5. TTS (tutorial maker, self-serve UI).** Every section gets TTS here, demo or not —
the whole voiceover comes from this step. Details in "The TTS flow" below. The step
ends with every section locked.

**6. Recording (tutorial maker) — in parallel with visuals-flow planning.** The
recording list is simply the demo sections, known the moment TTS locks. For each one:
play that section's audio on headphones, perform the clicks along with it, one clip
per section. The voice leads, the cursor follows. A mistake or a slow page load means
redoing a 40-second section, not a 10-minute take. Deliverable: per-section clips
named by section id, uploaded to the video's Drive folder. Never an assembled video —
assembly is deterministic downstream, and a hand-assembled video would block avatar
and graphics sections from slotting in.

Meanwhile, visuals-flow runs its shot pass and cue pass on the locked VO: which
non-demo sections become avatar vs graphics, where overlays and corner bubbles sit on
top of demo footage, per its existing calibration and budget caps. None of those
decisions affect what gets recorded, so nothing blocks the freelancer.

**7. Intake QC (automated).** Two gates, detailed in "The QC flow" below. Failures
bounce back to the tutorial maker as a section list, not a conversation.

**8. Visuals and assembly (visuals-flow).** Demo-section clips concatenate into a
VO-aligned screen recording by construction — exactly the `screen.mp4` contract
visuals-flow's assembly already expects. Avatar clips render for their sections,
graphics render per the cue pass, effects apply, deterministic assembly on the VO
timeline.

**9. Backstop watch, then upload.** The owner watches the `--draft` render of each
video until the pipeline earns trust, then delegates the watch. This is the only
human quality gate after the script rulebook, and for the first videos it doubles as
the calibration loop: what it catches becomes rulebook and lint rules.

## The script contract

The script is the one artifact every actor and tool reads, so its shape is the real
interface of this pipeline. Per section:

- `id`: stable identifier; names the TTS file and the recording clip.
- `demo`: yes/no. Yes = the tutorial maker records this section. That is the entire
  meaning of the field; presentation of non-demo sections belongs to visuals-flow.
- `text`: the narration. Two forms: display text (source of truth, used later for
  captions) and spoken text (respellings applied, fed to the engine).
- `flags`: zero or more scoped placeholders for the tutorial maker (empty after step 4).
- `notes`: anything the recorder needs that isn't narration ("stay on the pricing page
  until the section ends"). Notes double as expected-event hints for QC.

Section length targets comfortable single-take recording, roughly 20 to 60 seconds of
narration. Exact schema is an implementation decision.

## The TTS flow

Each section moves through a state machine:

    drafted → flags resolved → polished → TTS generated → TTS LOCKED → recorded → QC passed

- **Generate.** Spoken text goes to IndexTTS-2 on Modal with the locked production
  reference voice and house defaults. No knobs in the UI. Same text = cached; nothing
  is synthesized twice.
- **Regenerate.** TTS is stochastic, so a regen button re-rolls the take. Capped at 3
  per section; hitting the cap notifies the owner (Telegram) instead of silently
  spending more Modal money. Pronunciation problems are fixed in the respell box (per
  section spoken-text overrides for names like HeyGen), not by burning regens.
- **Lock.** The tutorial maker accepts the take — they listen before recording to it
  anyway, and they catch pronunciation in context. Locking freezes the section's audio
  timing. This is the load-bearing state: recording is performed against locked audio.
- **Invalidate on change.** If a section's text changes after lock, the section
  version-bumps, its lock clears, and any existing recording for it is automatically
  moved to the re-record list. This rule is what keeps the desync bug class extinct.

## The QC flow

**Gate 1 — intake, mechanical.** Per uploaded clip: filename matches a section id;
clip duration is at least the section's audio duration (shorter means the take didn't
run through the whole track) and not absurdly longer (recording left running);
resolution and fps meet spec; every demo section is present before the batch closes.

**Gate 2 — content, filmstrip.** The visuals-flow QC machinery (plan 110), pointed at
incoming recordings: for each section, pull contact-sheet frames at expected moments —
section notes like "click export" supply timestamps for free, since VO timing is
locked — and score whether the screen plausibly shows the right thing at the right
time. Catches wrong-screen and started-late failures. It cannot verify fine-grained
performance (the exact click landing on the exact word); recording to the playing
track makes being right the path of least resistance, and the backstop watch covers
the rest.

**Backstop.** Owner watches the assembled draft before upload (first videos; then
delegated). Also the answer, for now, to final-workflow's open problem #3.

## The tutorial maker UI

The single biggest build in this pipeline, and the thing that removes the owner from
the per-video loop (final-workflow's open problem #1: the processor is the throughput
cap). Two phases:

- **v1 (minimum useful):** token-link auth; script displayed in sections; per-section
  TTS generate / play / regen (capped) / respell / lock; link to the video's Drive
  upload folder; section checklist showing state. Server-side proxy holds the Modal
  secret; the freelancer never sees credentials.
- **v2 (cockpit):** flag editing inline (step 3 happens in the UI too), per-section
  upload with instant Gate-1 feedback, progress visible to the owner.

v1 is enough to run the first videos. Don't build v2 until v1 has survived a real
freelancer.

## Roles

| Actor | Does | Cost |
|---|---|---|
| Owner | topic, knowledge base, vision; backstop watch on early videos | time |
| Claude | script generation under the rulebook (step 2); polish/lint (step 4, scripted) | sub |
| Tutorial maker | flag resolution, TTS generate + lock, per-section recording | ~$20/video |
| Editor | placement QC on assembled video where warranted | ~$10/video |
| TTS | IndexTTS-2 on Modal | ~$0.50/video |

No reviewer (owner call, 2026-07-23: the script rulebook is the quality mechanism; a
separate review gate re-checked what the rulebook should already enforce). The
tutorial maker never writes free prose, never narrates, never edits a timeline. Each
of their tasks is the cheap version of a job: verifying against a live tool, pressing
generate, and performing clicks to a track.

## What changes from t-p-2

Keeps, roughly as-is: research inputs, script-from-transcripts, TTS engine, avatar
clips, graphics, the visuals-flow assembly.

Repositions: the screen recording, from before the script to after the TTS.

Drops entirely: the segment map (`segments.json`), the retime arithmetic (step 125),
the ffmpeg stretch-assembly (step 162), and the script rulebook's no-reorder /
no-add / no-cut constraints. All of it existed only to glue new audio onto old footage.

New here: the sectioned script contract with the demo flag, the tutorial maker's
self-serve TTS UI with lock semantics, and the automated polish/lint and intake QC
gates that keep humans out of the per-video loop.

## What this cannot do

Footage that already exists and cannot be re-recorded does not fit this pipeline.
Those videos get a polish-only dub through the legacy talk-over sync in
`pipelines/video/tts/` (fine for voice-over-screen, roughly 1 to 2 seconds of slack,
no click-along promises), or a re-record to a fresh VO. No new sync automation gets
built for that case.

Topics with a thin knowledge base are a known risk: Claude writes from transcripts,
and with few transcripts the flags won't catch everything it confidently invents. The
verification pass (step 3) is the guard; if a thin-coverage video comes back with
heavy corrections, that's the signal to gather more source material before scripting,
not to add pipeline machinery.

## Decisions taken (owner, 2026-07-23)

- Coverage split: script marks `demo: yes/no` only; visuals-flow's shot pass owns
  avatar-vs-graphics and all overlays, running in parallel with recording.
- TTS lock is the tutorial maker's call.
- Backstop: owner watches the draft render of early videos, then delegates.
- No reviewer; the script rulebook + self-check is the script quality gate.
- No scratch-walkthrough step or fallback.
- Deliverable is per-section clips, never a tutorial-maker-assembled video.
- Regeneration cap: 3 per section. Section length target: 20 to 60 seconds.

## Deliberately undecided

Step numbering and folder layout, the exact section schema, which t-p-2 steps port
verbatim, where the UI is hosted (VPS vs Worker) and its auth details, and how the
recording list and shot pass hand off to visuals-flow in code. All of that belongs to
the implementation plan, not this doc.
