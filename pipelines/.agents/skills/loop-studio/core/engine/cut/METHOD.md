# Talking-head cutter — THE method (mandatory, do not freestyle)

This is the ONLY approved way to cut a raw talking-head take in Loop Studio. It was
chosen by a head-to-head bake-off (2026-07-15): on 250s of retake-heavy raw, naive
auto-cutters left the retakes in **no matter which transcription model** was used
(mlx-whisper, Fish ASR, forced-align all leaked). This method produced a **perfect**
cut — 250s → 50s, **zero leftover retakes, every sentence complete**.

## The one idea that matters

**The transcription model is NOT the hard part — TAKE-SELECTION is.** Glued footage
re-attempts each line several times as *overlapping fragments* ("tries to" / "and
probably" / "and probably more than…"), not clean sentence repeats. No automatic
"collapse duplicate sentences" rule can untangle that. What untangles it is **you
(Claude) reading the word-timed transcript and choosing the ONE clean take per line** —
exactly what a human does deleting takes in Descript. The ASR underneath is
interchangeable; the selection is the craft.

## ⛔ NON-NEGOTIABLE PROCESS (2026-07-18, MKB 6-ad batch — Luuk: "this finally looks good, make these non-negotiable rules in the skill")

Proven end-to-end on the 6-ad MKB batch after ~15 review rounds. The transcript is a LOSSY HINT;
the **WAVEFORM is ground truth.** Every rule below exists because trusting the transcript instead of
the waveform produced a defect Luuk caught by ear or eye. Run all four stages, in order, every time:

```bash
CUT=~/.claude/skills/loop-studio/core/engine/cut
python3 $CUT/cut.py prep   RAW.mp4 WORKDIR                        # 1. LITERAL transcribe (correct language!) + forced-align
#        author WORKDIR/keepers.json                              # 2. LAST-take selection (R1)
python3 $CUT/finish.py     RAW.mp4 WORKDIR/keepers.json OUT.mp4   # 3. wave_snap -> level_cut -> tighten
python3 $CUT/cut.py verify OUT.mp4                                # 4. verify ON THE RENDER (+ waveform gap check, R8)
```

**R0a — VERIFY a "double" is really a double BEFORE cutting — two adjacent bursts are usually two DIFFERENT words.**
Do NOT infer a doubled word from "two RMS bursts + a long following token." That is exactly how a clean line gets
destroyed: on MKB ad3 the two bursts at 5.6–5.8 and 5.9–6.1 were **"Want"** then **"ja"** (the line "Want ja, een
vraag…"), NOT "ja ja" — cutting the second burst deleted the real "ja" and left "Want … een vraag", nonsense.
Before removing anything: (1) isolate-transcribe the exact clip at hi-fi (or read the raw keeper's own words), and
confirm the two bursts are the SAME token; (2) check the source keeper — if the whole phrase is ONE continuous take
(cs→ce spans it), there is no double, just adjacent words; (3) a doubled word looks like TWO near-identical bursts of
the same duration/shape back-to-back, not two different-length bursts. If in any doubt, leave it and ask. *(ad3,
2026-07-20: Luuk — "we say 'Want ja, een vraag…' why not keep that as one take? we get 'want' from another sentence
and then go on with 'ja'." The cut was reverted; the original line was already clean.)*

**R0c — "sounds like 2 takes / not one sentence" = a MID-SENTENCE keeper splice; rebuild the stray fragment from the CONTINUATION's take.**
When the client says a line "is still 2 takes" or "keep it as one take", the cause is usually that the keeper file
joined two different raw takes MID-PHRASE (on ad3, "Want ja" came from raw take @917 and "een vraag… iedereen kan dat"
from a different take @920 — spliced at the "ja|een" gap). Diagnose by reading the ACTUAL keeper file that built the
footage (there can be more than one — e.g. `editor/keepers/*.json` vs `ls_cut/*_keepers.json`; the short 1–2s segments
are the tell) and by checking the raw for a single continuous take of the whole phrase. FIX (zero graphics re-time):
locate the stray fragment's words in the SAME raw take as the continuation (they're right before it), and splice that
version into the finished footage IN PLACE — fit it to the exact same finished slot length (part1 = footage up to the
pre-fragment silence, part2 = raw[continuation-take fragment, fitted to the slot], part3 = footage from the continuation
onward) so total duration and every downstream sync point stay put, and NO motion-graphic keyframe moves. Both footage
and raw are usually the same res/fps → a plain `concat` re-encode. Back up the original footage first. *(ad3, 2026-07-20.)*

**R0b — IF a real double is confirmed, cut it from ALREADY-FINISHED footage via footage-cut + clock-remap + DISSOLVE.**
When a genuinely doubled word survives into a finished ad whose footage feeds a Remotion comp, do NOT re-run the
whole cutter or hand-shift dozens of keyframes. Instead: (1) build a cut copy of the footage —
**video `xfade` cross-dissolve (~0.2s) over the splice, audio hard-concat**, keeping the TOTAL removed constant
(e.g. exactly 0.30s); a hard video splice leaves a talking-head JUMP-CUT (hands/pose teleport) that reads as "a bad
cut / a 0.3s clip in between" — the dissolve masks it while the audio stays a single clean word. (2) In the comp,
remap only the motion/camera/caption clock past the cut: `const frame = raw < CUT_FRAME ? raw : raw + CUT_LEN_FRAMES`
(then `t=frame/30`) — `<Audio>`/`FootageLayer` seek the cut file by the RAW frame, so motion + word-timings stay
aligned with ZERO keyframe edits. (3) drop the comp `durationInFrames` by the removed frames. Gotchas: the ffmpeg
`xfade`/split graph must produce a valid moov (run it FOREGROUND — a trailing `&` masks ffmpeg's real exit code, and a
half-written file 500s Remotine's compositor "Invalid data"); force `-r <srcfps> -vsync cfr -movflags +faststart`;
and the cut times are in SECONDS on the source (mind source fps ≠ comp fps). *(MKB ad3, 2026-07-20: Luuk "very bad
cut here! a clip of like 0.3s is in between! make it clean" — the hard cut → dissolve fixed it.)*

**R1 — LAST take, ALWAYS.** Keep the LAST complete take of every line (the warmed-up final delivery).
Fall back to an earlier take ONLY when the last is a literal false-start / incomplete. NEVER optimize
"cleanliness" over recency. *(This OVERRIDES the old "cleanest complete take" rule below — that heuristic
kept warm-up takes that read clean but sound worse; Luuk, emphatic: "no I want the last takes always!")*

**R2 — The WAVEFORM sets every boundary, not the ASR time.** Whisper word times drift up to ~2s (a keeper
opened 2s into dead air). `wave_snap` moves each keeper's LEADING edge to the true 20ms-RMS energy onset —
only when leading silence >0.3s, with a LOW threshold so soft first words ("Een","Je") aren't clipped,
LEADING-ONLY (extending the tail grabs the next take's word: "Werkt.", "teams teams"). When a start feels
slow, print the RMS envelope and put cs on the first sustained energy. NEVER cut on a whisper word-edge.

**R3 — Collapsed doubles hide from the transcript — catch them THREE ways.** Whisper merges a restart
"X. X." into ONE long word and collapses it in the full-file transcript, so a plain 5-gram check passes a
DOUBLED cut (ad2/ad5/ad6 CTAs all shipped doubles this way). A double is real if ANY of: (a) forced-align
gives a word >1.2s (the merge), (b) a word-level re-transcribe of the RENDERED output shows an adjacent
repeat, (c) an isolated hi-fi transcribe of the span shows it. When found, move cs PAST the false-start to
the clean final attempt. ⚠ A TRUNCATED per-keeper clip can HALLUCINATE a double — always confirm on the
render/raw before re-cutting.

**R4 — "Last take" ≠ latest TOKENS.** After a good take the creator trails into restart spam
("Als… As… As…") that whisper collapses into clean-looking tokens; picking the latest ships garbage
(ad4 "Als ondernemer"). Forced-align score <0.4 on a keeper's own text = garbage take. "Last take" = the
last CLEAN COMPLETE delivery, verified on the waveform, not the last tokens.

**R5 — No dead air, EVER.** `tighten`: leading/trailing silence ALWAYS trimmed to ~0.1s (no rule may
"protect" it), interior silence >0.3s compressed to ~0.13s. Verify: lead <0.1s and no gap >0.45s on the
rendered waveform.

**R6 — No sub-1s sections.** Never isolate a clip <1s between two jump-cuts (`tighten` min-section): a
silence is cut only if the speech both before AND after it is long enough — EXCEPT leading/trailing
silence, where R5 wins.

**R7 — Per-take leveling, STATIC gain.** `level_cut`: bring each take to the batch median mean-volume with
a fixed per-take gain, THEN loudnorm I=-14. NEVER a dynamic normalizer (dynaudnorm pumps a voice+SFX master).

**R8 — Verify on the RENDERED OUTPUT, never the plan/transcript.** Re-transcribe + adjacent-repeat scan,
forced-align (no word >1.15s = no hold/collapse survived), waveform gap/lead check. The transcript "looking
clean" proves nothing — it is exactly what lies.

**R9 — The human reviews by WAVEFORM.** Show the cut's waveform (speech energy + silence shaded) so dead air
and tiny clips are visible — how real editors work. "Check the soundwaves" IS the review, not "read the transcript."

**Dependency:** forced alignment needs `torch`+`torchaudio` (MMS_FA, `align.py`). REQUIRED now — do NOT skip
align.py on a ModuleNotFoundError, install them; without ms-precise alignment R2/R3/R4/R8 don't work.

Tools (all in `core/engine/cut/`): `finish.py` (chains the 3 passes) · `wave_snap.py` · `level_cut.py` ·
`tighten.py`. See [[reference_transcription_cutting]] for the full incident history.

## Surgical word/phrase removal from a FINISHED / rendered video — the ONLY way (2026-07-18)

When the job is not take-selection but **removing a specific word or phrase from an already-finished
video** (e.g. cut the spoken "S2.1", "all of July", a stray "the"), there is exactly ONE approved
method and no other: **LLM-based cutting driven by transcription + sound waves.** Luuk: *"There should
not be another way where we possibly make the cuts. This is the only way — LLM-based with sound waves
and transcriptions — to make it perfect."* Never eyeball a timestamp, never cut on a whisper word-edge,
never use an energy-only auto-cutter.

The make-or-break is that **whisper word-ENDS miss the consonant/sibilant RELEASE.** Real example: on
"...free for developers," whisper put the word-end at 31.08; the true word — including its final voiced
"-z" — ran to **~31.42**. Cutting at 31.15 (trusting whisper) chopped it to "developer." You cannot see
that release in the transcript OR in a broadband waveform alone — you see it in the **high-pass track**.

Run this for every surgical cut:

1. **Word-level transcribe** the region (faster-whisper / Fish ASR, `word_timestamps`). Gives you the
   rough anchors and the sentence you're preserving.
2. **Two waveforms at ~10ms** around the intended cut, from the ACTUAL file being cut:
   - broadband RMS (word bodies, vowels, silence)
   - **high-pass >4kHz RMS** — this is the one that reveals the sibilant/fricative releases
     (`-s -z -st -sh -ts -f -th`, plosive bursts) that end a word 0.05–0.2s *after* the vowel.
   `ffmpeg -ss T -t D -i F -af "highpass=f=4000" -ac 1 -ar 16000 hp.wav` then per-window RMS.
3. **YOU (the LLM) read transcript + both tracks together** and find the TRUE boundaries: a word is
   over only when its high-pass energy has fallen back to the noise floor AND broadband is silent.
   Put the **cut START in the real silence AFTER the full release**; put the **cut END in the real
   silence BEFORE the next word's onset**. Keep the whole word — release included — every time.
4. **Ripple-cut audio+video together** (so lip-sync is preserved) and **size the crossfade to the seam's
   silence gap** (≤~0.08s, and only because both sides are silence — a fixed crossfade over a word fades
   the word out). Pre-split to CFR (`fps=30`) before `xfade` or it errors with "1/0 rate".
5. **VERIFY on the RENDERED OUTPUT, not the plan.** Re-transcribe the seam AND re-run the
   broadband+high-pass around it: confirm the kept word's release burst is fully present and the seam is
   clean silence. Only then is the cut done. (This is how "developers" was confirmed complete: its "-z"
   burst at 29.69–29.73 in the output, clean silence, then "make.")

Applies to intros, outros, shorts — any format. Same discipline as raw-take selection below: the ASR
and the ffmpeg are interchangeable; **reading the waveform to protect the word's release is the craft.**

**BUT: on a COMPOSITED / animated comp, cut in the SOURCE FOOTAGE via the comp, never ripple-cut the
rendered output (2026-07-18, Luuk on fish3 outro: "it's super jumpy... we should cut in the original
footage instead, and then adjust the visuals and animations based on that").** A ripple-cut of the
final render deletes frames from the WHOLE composite, so every comp-timed element — camera pan, playhead,
track clips, CTA panels, karaoke captions — jumps at the seam. Talking-head-only shorts survive it (the
frame is just the face); UI/mockup/motion comps do NOT. The fix is a comp edit: (1) add the removed
range as a footage SKIP (extra `<Sequence startFrom={SKIP_END}>` segment, like the existing take-skip);
(2) shrink the comp: `COMP_DUR -= SKIP_LEN` AND the Composition `durationInFrames` in Root.tsx (they're
separate — the comp-internal COMP_DUR drives animations, the Composition frame count drives render
length); (3) shift every downstream cue earlier by SKIP_LEN — CTA panel at/until, their laneX x-positions,
and shorten any panel that straddles the cut; (4) remap the caption word-JSON: drop words inside the skip
window, subtract SKIP_LEN from every word after it; (5) re-render → the animations now play continuously,
only the tiny footage box "skips" internally. ⚠ That skip is NOT invisible — it JUMP-CUTS the talking
head to a new pose. You MUST cross-dissolve the avatar across each seam (overlap the footage Sequences,
ramp opacity ~5 frames — the `AvaVid`/`CF` pattern in FishOutro3.tsx) or Luuk reads it as "jumpy / cut in
the rendered video" (2026-07-18, third time flagged). Then the footage still has the per-file
OffthreadVideo lag, now PER-SEGMENT (each `startFrom` adds ~more): sync each segment with its own advance
and acrossfade the joins in the skip-point silences. Verify sync per segment on the rendered output.

**WHEN THE WORDS ARE GLUED + IT'S A COMPOSITED COMP: cut the audio PRECISELY from SOURCE and MUX it
onto the comp-skip render — do NOT rely on the comp seam for audio (2026-07-18, fish3 outro).** The
comp-skip approach (above) works when the seams land in real silence. But this outro's speech was densely
glued ("developers‸free‸access‸to‸the‸S2.1‸model‸July" — inter-word gaps < 0.08s), and OffthreadVideo adds
a PER-SEGMENT audio-decode lag (~0.11s, growing with each `startFrom`) that is LARGER than those gaps. Net
effect: the comp seam can't cut the audio at a word boundary — it leaks the next word ("…developers free")
or shaves the prior word's release ("access"→"acts"). The robust fix decouples audio from the render:
(1) build the clean audio by ripple-cutting the SOURCE audio at exact waveform boundaries (ffmpeg
`-ss/-to` on source, tiny in/out `afade`, `concat`) — no OffthreadVideo, so zero lag; (2) `loudnorm` it;
(3) render the video comp with footage comp-skips at the SAME source points (so the tiny avatar stays
roughly lip-synced — invisible drift at ~210px); (4) `ffmpeg -map 0:v -map 1:a` to MUX the precise audio
over the render's (laggy) footage audio, `-t <video_stream_dur>` + `apad`. Verify the muxed OUTPUT
(transcribe + waveform). Also: a small model (base/small.en) will MISREAD a complete word ("access"→"acts"),
so when the transcript looks clipped, CONFIRM on the high-pass waveform before re-cutting — the audio may be
fine and only the transcription wrong (trust the sibilant energy, not whisper).

## The pipeline (run it exactly)

```bash
# CUT = the cut engine in your skills dir (Claude Code: ~/.claude/skills · Codex: ~/.agents/skills)
CUT=~/.claude/skills/loop-studio/core/engine/cut; [ -d ~/.agents/skills/loop-studio/core/engine/cut ] && CUT=~/.agents/skills/loop-studio/core/engine/cut
# 1. PREP — transcribe (literal) + forced-align + print the pause-grouped transcript
python3 "$CUT/cut.py" prep <RAW.mp4> <WORKDIR>
#    -> WORKDIR/words.json  + a printed transcript grouped by pauses, with timestamps

# 2. SELECT — YOU author WORKDIR/keepers.json from that transcript (rules below). THE step.

# 3. RENDER — hard-cut the chosen takes; AUTO-snaps every edge to the WAVEFORM first
python3 "$CUT/cut.py" render <RAW.mp4> <WORKDIR>/keepers.json <OUT.mp4>
#    render() calls _refine_edges(): whisper word times drift ~0.5s from the audio, so it
#    re-snaps each cs/ce to the real speech energy — head forward to the true onset (kills
#    leading silence), tail through the full release (no clipped word). LS_NO_REFINE=1 disables.

# 4. VERIFY — WORD-LEVEL re-transcribe: repeated-5-gram = hard FAIL, plus dead-air/gap warnings.
python3 "$CUT/cut.py" verify <OUT.mp4>
```

Transcription defaults to **local** (`ls_platform`: mlx-whisper on Apple Silicon,
faster-whisper elsewhere) — no API key, private, free, works for every buyer.

## ⚠️ Hard-won lessons — do these or the cut sounds rough (2026-07-17, 6-ad MKB batch)

1. **PREP must transcribe the ACTUAL audio, LITERALLY.** Never reuse a pre-made "clean"
   transcript or a de-duplicated one: whisper silently *collapses* repeated false-starts
   ("Als ondernemer, als ondernemer" → one) and its word times **drift ~0.5s** from the
   real audio. A clean transcript hides the false-starts you must drop and mis-places every
   boundary. Always `condition_on_previous_text=False`, per-region if the take is long.
2. **whisper word timestamps are NOT acoustically precise — never cut on them directly.**
   That's why `render` snaps edges to the waveform energy. If you author boundaries by hand,
   still let render refine them. At restart seams the drift can be big enough that the
   whisper-set cs lands *inside* the false-start (cs 1868.72 was mid-"…teams"; the real 2nd
   "kort" was ~1869.13) — locate such onsets from **energy speech-runs**, not timestamps.
3. **Verify is word-level for a reason.** A plain-text transcript collapses a leaked
   false-start too, so a plain 5-gram check passes a corrupt cut. Read the word-level output:
   a gap AT a take-seam is fine; a gap or stretched word INSIDE one take is a halting pause.

## Take-selection rules (this IS the quality)

You are handed the transcript grouped by pauses, each line time-stamped. Produce
`keepers.json` = `[{"cs":<start>,"ce":<end>,"label":"..."}]` in chronological order:

1. **Read the whole transcript first.** Infer the *intended script* — each intended line
   is usually re-attempted several times (those repeats are the takes).
2. **Keep EXACTLY ONE take per intended line — the LAST complete take (see R1, non-negotiable).**
   The last full attempt is the warmed-up delivery and is what Luuk wants, ALWAYS. Fall back to an
   earlier take ONLY when the last is a literal false-start / cut-off / incomplete. Do NOT pick by
   "cleanliness" over recency — a warm-up take that reads clean in the transcript still SOUNDS worse.
   Beware restart-spam after the good take (R4) and collapsed doubles (R3): "last" = last CLEAN
   COMPLETE delivery, confirmed on the waveform, not the latest tokens. Drop every other attempt,
   fragment, and false start.
3. **Keep sentences COMPLETE.** Never end a keeper mid-sentence; never stitch half of one
   take to half of another unless each half is itself clean and the join reads seamlessly.
4. **Drop standalone filler** (um, uh, and filler-"like"/"you know") and dead-air-only lines.
5. **If a line has NO clean complete take anywhere** (flub/stutter/pause in all of them),
   **DROP the line.** The video reads fine without it. NEVER force a flawed take, and
   NEVER ask the creator to re-record — cut only from what was recorded.
6. **Boundaries are auto-snapped to the waveform — you set approximate anchors, render
   refines them.** Author `cs`/`ce` near the first/last word (whisper times are fine as a
   rough anchor); `render` re-snaps them to the real speech energy (head to the true onset,
   tail through the release). So you do NOT hand-tune pads — but at a *restart* seam, still
   place `cs` in the little gap AFTER the false-start (not inside it), since the snap moves
   forward from where you put it.
7. **Prefer one continuous take** over stitching when a clean multi-sentence run exists
   (fewer joins = better flow, fewer head-position jumps).
8. **Chronological order** in keepers.json (rising `cs`). Out-of-order jumps read as errors.

## The verify gate is non-negotiable

`verify` WORD-LEVEL re-transcribes the OUTPUT: a repeated 5-gram is a hard FAIL (you kept
>1 attempt of a line — drop the extra, re-render), and it warns on internal dead-air
(word-gap > 0.6s or a stretched word). The cut is NOT done until the 5-gram check is clean
AND the only pause warnings are at take-seams (a warning INSIDE one take = a halting pause;
fix it). ⚠️ Note whisper collapses a leaked false-start even here, so if `verify` is clean
but you suspect a doubling, check the SOURCE words around that cs. Then one human listen for
nuance (a subtle wrong-word or flat delivery survives every automated gate).

## Optional: faster transcription with Fish ASR

If the creator has a Fish Audio key, `POST https://api.fish.audio/v1/asr` returns
word-level timing for a full 4-min file in ~4s (vs ~60s local). It's a drop-in transcript
source — the take-selection + render + verify steps are identical. Default stays local so
the skill works with zero setup; Fish is only a speed upgrade, never required.
