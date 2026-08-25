# Universal editing rules — true for EVERY video

Seeded from 16 review rounds on the first AI-assembled vlog. Each rule = **what · why · how**.
Apply ALL of these to the first cut. Add to this list whenever a review teaches a general lesson.

## Audio cuts (this caused ~half the rounds — get it right first time)
- **For a one-word talking-head rewrite, replace only the smallest necessary word window.**
  Why: regenerating the full sentence changes timing and creates visible lip drift even when the new
  line has the same total duration. Keep the original synced delivery everywhere else, fit the new
  word into its original slot, level-match it, then run the joined voice through one mastering chain.
- **When a replacement sentence is much longer than the original mouth movement, make the evidence the scene.**
  Why: time-compressing the new line or stretching it over the old talking head creates obvious lip drift.
  Cover the complete replacement with a full-screen, genuinely sourced proof graphic; extend the timeline;
  shift downstream footage, graphics, captions, and audio together; then resume the original synced take at
  the next intact sentence. Split caption groups at the inserted scene boundaries so words never leak across it.
- **If a cloned replacement still sounds robotic, stop mastering the mismatch and fix its source.**
  Why: EQ/compression cannot repair a clone with the wrong reference timbre, pitch contour, or
  coarticulation. Generate the complete phrase in context from the natural-reference clone at low
  temperature and compare active-speech RMS with the surrounding take. Never pitch-shift a cloned
  voice from F0 detection alone: word choice, intonation, and octave-tracking errors can make the
  measurement look mismatched while a correction makes the voice unnaturally high. Preserve the
  natural-reference take's original pitch unless Luuk explicitly asks for a tonal change. For visible talking heads, lip-sync the
  actual source-footage window to that complete phrase; never swap in a different avatar look or
  force the new word over the old mouth movement. Rebuild the music from its stem and master once.
- **Cutting a raw MULTI-TAKE talking-head take = use `loop-studio/core/engine/cut/` and NOTHING else.**
  Why: on glued footage each line is re-attempted as *overlapping fragments*, and every automatic
  "collapse duplicate sentences" rule leaks the retakes (proven in a 2026-07-15 bake-off across mlx /
  Fish / forced-align — all failed). The ONLY thing that reaches Descript-grade is **LLM take-selection**:
  YOU read the word-timed transcript and keep the ONE clean COMPLETE take per line (the LAST good take),
  drop every earlier attempt/fragment/filler, snap cuts into the gaps. How: `cut.py prep→` author
  keepers.json `→ render → verify` (fails on any repeat). The ASR model is interchangeable; the
  selection is the craft. Full rules: `core/engine/cut/METHOD.md`. Never write your own collapse logic.
- **Never cut inside a word or its release.** Why: a clipped word ("slot machine", "fish",
  "boredom") sounds broken and is the #1 thing Luuk notices. How: extend the tail to the next
  word's onset (continuous speech) or into the pause (gapped); guarantee a floor past the last
  word's end.
- **Whisper word timestamps are UNRELIABLE — trust the waveform.** Why: Whisper mistimed
  "when" by 0.7s and "boredom" by ~0.5s, so timestamp-based cuts grabbed the previous word's
  tail or sliced a word in half. How: `silencedetect` on the SOURCE clip around the cut; snap
  the start to just after the real pause; snap the end into the real pause before the next word.
- **No orphan/short/silent clips — every kept segment must be a whole spoken thought, and cuts land
  only in real silence (codified 2026-07-18, "add a rule where we don't want these very short clips").**
  Why: cutting a finished video into segments left dead trailing silence held as its own beat and
  leftover word-fragments ("...one by one" + 0.5s of nothing; a stray "a"/"and"/"here only" from the
  next dropped sentence). Luuk: "either they contain separate words or no words at all — as they are it
  makes it all messy." How: end each segment ~0.10s AFTER its last word's full release (never on a held
  pause, never catching the next dropped word), start it ~0.08s BEFORE its first word (never on the
  previous word's sibilant TAIL — "…understand thi**s**" leaks an audible "s" if you start on the "s");
  merge adjacent kept phrases into one continuous span rather than leaving a tiny fragment between them.
- **Whisper word-ENDS miss the consonant/sibilant RELEASE — leave headroom past them.** Why: "waves",
  "taste", "this" all have a release ("-ves", "-st", "-s") that extends ~0.05–0.15s past whisper's word
  end; a cut or fade placed at the word-end clips it ("waves"→"wave", "taste"→"tay"). How: treat the real
  word boundary as word_end + ~0.08s; verify by re-transcribing the RENDERED seam, not the plan.
- **When cutting a RENDERED video (baked music/SFX), size each crossfade to the seam's silence gap —
  a fixed crossfade fades whatever's at the boundary (codified 2026-07-18).** Why: a uniform 0.13s
  audio+video crossfade smooths the baked music bed at the jump, but where a word butts the cut it
  fades that word out ("waves"/"taste" got cut off). How: per-seam duration = the smaller of the
  trailing-silence (after seg A's last word) and leading-silence (before seg B's first word), capped
  ~0.12s, floored ~0.02s — so the crossfade always lands on silence, never on a spoken word; a word
  glued to the cut gets a near-hard 0.02–0.04s join. (The durable fix for baked-media cuts is to
  re-render the shortened structure from the SOURCE comp so music + transitions are continuous.)
- **Drop leading sub-word fragments.** Why: a stray "does"/"people"/"or" tail before the line
  sounds like a rough cut even when the transcript looks clean. How: a leading speech blip
  shorter than ~0.28s followed by a pause = fragment → start after that pause. But if the first
  speech run is a real word, leave it (don't eat "I think").
- **The music mix masks the VO in the final file** — verify cuts on the SOURCE audio (no music),
  not the export.
- **Micro-fades (8ms) on every splice** to kill clicks/pops.

## Audio mastering
- **`loudnorm` in SINGLE pass is a DYNAMIC normaliser — it pumps quiet passages up to speech level**
  (codified 2026-07-22, attention v2). Why: the music bed swelled to full loudness in every pause and
  LRA collapsed to 2.2 LU. How: always TWO-pass — measure with `print_format=json`, then re-apply with
  `measured_I/TP/LRA/thresh:offset:linear=true` so exactly one static gain is applied.
- **Set the music bed to an ABSOLUTE target (~-32 LUFS), never a relative trim.** Why: a `volume=-6dB`
  trim on an already-loud Epidemic Sound master (I≈-13) left the bed 1.5 dB under the voice. How:
  two-pass loudnorm the assembled bed to -32 LUFS, THEN sidechain-duck a further ~6 dB under the VO;
  verify by measuring speech vs a real pause in the final file (pauses should be 15-30 dB down).
- **Pick music by MEASUREMENT, not by title.** Compute per track: onset periodicity in the 60-160 BPM
  band (>0.45 = a real drum pulse, reject for a VO bed), build (last-third vs first-third loudness;
  >+10 dB means it will fight the voice), and mid-section flatness (std/mean; lowest = steadiest bed).
- **Do NOT "master" a talking-head voice — Luuk hears processing as robotic (codified 2026-07-22,
  attention v2 -> v3: "its too much studio sound, its robotic now").** Why: denoise (`afftdn`) smears
  consonants, a de-esser lisps, and a presence/air lift is exactly what reads as "produced". What he
  wants is HIS voice, cleaned — not a radio voice. How: the whole chain is `highpass=75` +
  a ~-1.4 dB dip at 270 Hz (proximity bump) + a gentle 1.8:1 compressor, then two-pass loudnorm.
  Nothing that touches the top end. Verify by null-testing against the raw source: the >2.5 kHz band
  should land within ~1 dB of unprocessed. Loudness and ducking are still worth doing properly —
  it is the TONE-SHAPING that he rejects, not the level control.
- **A LUT at full strength reads as "too much" even when it is the gentle LUT** (same round). Blend it
  at ~0.3-0.45 opacity over the ungraded source, and send a strength ladder (0 / .3 / .45 / .6 / 1.0)
  as one image so he picks a number instead of a re-render per guess.
- **One warm track looped can beat a three-bed structure for a personal/essay video, and Luuk prefers
  it** (codified 2026-07-23, attention). A three-section score read "too dark" because the middle bed
  (>half the runtime) was the dark one. The fix he chose: ONE track (Reset Rewind — Lars Meyer) for the
  whole film. Loop it by self-crossfading 2-3 copies; hide each seam in the track's own quietest point
  (measure per-2s RMS to find it), and VERIFY the seam lands where the VO has no pause (silencedetect
  the seam windows) so the natural quiet tail is masked by speech. "Lighter, not cheesy" search terms
  that worked: warm ambient piano / hopeful minimal piano / gentle acoustic underscore — Mood=Hopeful/
  Dreamy/Laid Back, Energy low-mid, Genre Acoustic; the middle-30s-eyes-closed test decides.
- **Grade the FOOTAGE only, never the graphics layer** — composite order is scale -> lut3d -> overlay,
  or the brand accent shifts off-brand.
- **`buildloop-FINAL.cube` is built for flat/log b-roll; on an already-contrasty talking-head it crushes
  shadows and over-warms skin. Use `buildloop-FINAL-soft.cube`** (measured: contrast up, saturation
  3.9->4.5, no clipping at either end, and it slightly DARKENS the wall so white graphics keep contrast).

## Captions
- **Sync to the ACTUAL spoken word timings**, not an even distribution. Why: linear timing
  drifts on long lines and the captions run ahead of the voice. How: transcribe the rendered
  VO per line (word timestamps) and time each card to its words.
- **Legible over motion:** heavy weight, dark outline + shadow. Balanced wrapping, **never an
  orphan word** on its own line (fit on one line, or split ~50/50).
- **Fix transcription artifacts in caption text** ("chat GPT"→"ChatGPT", brand names, "plot"→
  "Claude" where it's a mishear). Keep a small replacement map.
- Caption STYLE (font, size, uppercase, color, keyline) is a per-video config choice — ask or
  read it from config; don't assume. Luuk dislikes gimmicks he didn't ask for (removed a lime
  keyline). Default: clean and confident.

- **Before placing ANY graphic over talking-head footage, prove the safe zone from a temporal
  average of the source** (codified 2026-07-22, attention.mp4). Why: eyeballing one frame misses
  where hands travel — a crowd-of-figures sketch that looked clear on a still was cut through by
  his gesturing hand 6s later. How: `ffmpeg -vf "fps=1/6,scale=480:270,tmix=frames=70"` gives one
  image where everything that ever moves is smeared; only the regions that stay flat in that image
  are safe. Place graphics there and nowhere else, then re-check the composite at the real timecode.
- **For a footage-first LIGHT edit, render the graphics as an ALPHA overlay (ProRes 4444) and
  composite with ffmpeg** — never re-render the footage through Remotion. Why: the source stays
  bit-identical, iteration only re-renders the cheap layer, and the 4K master is a re-composite
  rather than a re-grade. How: `codec:'prores', proResProfile:'4444', pixelFormat:'yuva444p10le'`.

## B-roll / shot choice
- **No single shot longer than ~4s** unless it earns it. Why: one clip held 11s read as dead/
  monotonous. How: cap per-shot duration; if coverage falls short, cut to another distinct shot
  rather than stretch one (and never fill a gap with a freeze-frame — extend into real footage).
- **Use the ACTION moment, not the setup or aftermath.** Why: an axe clip should show the swing,
  a jump/backflip the airborne frame, a laugh the crack-up — not the wind-up or the settle. How:
  filmstrip the clip, set the in-point on the peak of the action.
- **Verify WHO is on screen from the frames, not the metadata.** Why: descriptions mislabel;
  Luuk is sensitive to being absent or to the wrong person featured. How: extract the frame and
  look before trusting a "featured" tag. Distant / back-turned / silhouette = identity-neutral,
  fine to keep.
- **Open on the speaker when they reference what's on screen** ("looking at the water") — hold
  the talking-head through the gesture/pan so the "it" is clear.
- **Two-shots for connection/"we" beats; solo hero for triumph/reflection.** Match subject to
  the line's meaning.
- If a clip is blurry, shaky, or a bad framing, swap it — don't ship a weak shot to fill time.
- **Tame overexposed shots per-shot, don't let one washed clip break the grade.** Why: a clip with
  blown sky/water (luma pushed toward 255) reads as "too bright" against neighbours. How: measure
  per-shot luma (`signalstats` YAVG); on a hot one apply a per-shot exposure fix (pull highlights via
  curves + lower brightness) BEFORE the global grade — a global grade can't fix one clip's clipping.

## Music
- **A paid-ad campaign should sound like one campaign.** Use one cohesive, energetic bed across all ad
  variants, start from an audible section at frame zero, and sidechain-duck it under every spoken line.
  Keep the voice dominant, let the bed lift in pauses, and fade the music cleanly at each ad's endpoint.
- **Start the track where it actually comes in, not at 0.** Why: many tracks open with a near-
  silent intro (this one: ~5s at -48dB) so music feels "late." How: measure per-second loudness;
  set the track's in-point where energy arrives; fade in over ~2s.
- **Duck under the voice** (sidechain) so VO is always clear; music comes forward in the gaps.
- Music is present from t=0 of the video. Level is a taste dial — expose it, don't hardcode a
  guess.
- Can't source licensed tracks — when music is wrong, give Luuk **search terms** (mood + genre)
  for his library (e.g. Epidemic Sound) and swap in the file he drops.

## Structure & story
- Voice-first: build the storyline from the monologue, keep it chronological/coherent, don't
  chop sentences to fit.
- Time claim and metric graphics to the spoken claim itself. A slide such as "80+ languages"
  should reveal on the words "80+ languages," not during the setup sentence several seconds earlier.
- Cold open in the first seconds; retention beats; climax shots (energy/laughter/celebration)
  at the peaks and the close.
- **End screen** with credits if asked (who filmed / edited / voiced), over a lively BTS clip,
  dimmed so text reads.

## Process / verification (non-negotiable)
- **"Done" means verified**, not "rendered." Check freezes (`freezedetect`), audio levels
  (`volumedetect`), the actual frames at the changed timecodes, and transcribe the VO to confirm
  boundaries — BEFORE claiming a fix landed.
- **Don't trust the plan — trust the render.** Re-scene-detect after every cut; a timecode shifts
  when durations change, so re-locate shots instead of assuming.
- Own misses plainly; never over-claim a fix you didn't verify.
- **Verify from the RENDER, not an agent's "done".** Why: on the BusinessBrain longform, agents
  reported items complete that a still disproved — people drawn silver on a WHITE bg (invisible),
  file-icons where people were asked for, a flashback replaying our own captions. How: extract a
  still at each changed timecode and LOOK; for audio, measure per-channel balance + loudness and
  transcribe the boundary. A report is a claim; the frame is the truth.

## Audio mastering (voice quality — added from the BusinessBrain longform)
- **Check L/R channel balance — a mono/one-sided recording plays out of one ear.** Why: the act
  VO files had audio only in the right channel (left −91 dB), so the whole tutorial was one-eared
  on headphones and it took a viewer to catch it. How: `astats` per channel on the final; if the
  voice sits on one side, center it (`pan=stereo|c0=c1|c1=c1` copies the live channel to both —
  safe no-op for already-centered sources).
- **Give the voice a studio chain, don't ship raw VO.** Why: raw voice sounds flat/dull; "not
  crisp" is a predictable note. How: high-pass ~80Hz · small cut ~250Hz (de-mud) · presence
  boost ~3–4kHz (crispness) · air high-shelf ~11kHz · gentle de-ess · gentle compression
  (~2.5:1). Then master the whole mix to ~−14 LUFS (YouTube) with true-peak limiting.
- **After any master step, re-verify lip-sync.** Why: loudnorm can pad/shift; a leading shift
  drifts sync for the whole video. How: transcribe a known landmark (e.g. a splice word) and
  confirm it's at the same timecode as before; a trailing pad after the picture ends is harmless.
- **Remotion `OffthreadVideo`/`Audio` can play ONE file's audio hundreds of ms late while other
  files are fine — it's file-dependent (audio codec / mp4 edit-list / priming), not global.**
  Fish2 intro: the A-roll `source.mp4` audio rendered **+610ms behind its own video** (constant,
  all windows), while the ES avatar mp4 via the same `OffthreadVideo` was only +60ms. A `<Audio>`
  split of the same file was also ~640ms late — so you CANNOT fix it inside Remotion (both audio
  paths mishandle the file). Diagnose with same-modal cross-correlation vs the source file: measure
  VIDEO placement (`render_video` vs `source_video` → should be 0ms, corr ~1.0) and AUDIO placement
  (`render_audio` vs `source_audio`, wide ±800ms search) separately; if audio ≠ video offset, that
  gap IS the lip-sync error. (Mouth-motion-vs-audio correlation is too weak to trust — <0.15; use
  same-content audio-vs-audio and video-vs-video, which give corr ~0.8–1.0.) **Fix = render with ALL
  audio muted (`<OffthreadVideo muted>`, no `<Audio>` tags) and rebuild the entire track in ffmpeg**:
  place each element (avatar audio, A-roll voice, every SFX) at its exact comp time via
  `adelay`/`itsoffset` and `amix`. ffmpeg decodes the file correctly (honors the edit list), so
  everything lands frame-accurate (verified 0ms/+7ms). This is why the pre-existing post-audio
  reconstruction existed — moving SFX/voice into the comp as `<Audio>`/`OffthreadVideo` is what
  introduced the desync. Keep audio reconstruction in ffmpeg for comps that composite recorded
  footage. Verify the rebuilt track: voice-vs-video ~0ms AND each SFX at its onset ±10ms.
- **Raw talking-head footage can have baked-in audio latency; normalizing the voice louder makes it
  audible.** Fish2 A-roll `source.mp4` had its own audio ~100ms LATE vs the lips (mic/interface
  capture offset) — inaudible while the voice sat quiet, obvious once normalized up ("audio comes
  after mouth movements"). Diagnose: crop tight to the mouth on the RAW file (big centered face, no
  overlays — the composited render's small/moving PiP won't correlate), decode gray frames, take
  per-frame `abs(diff)` as mouth-motion, correlate vs audio envelope; a clean peak on the +Nframe
  side = audio late by N frames (subtract ~1 frame of natural mouth-leads-sound). Fix in the COMP,
  not post: the voice and onset-SFX share one track, so a blanket track shift would re-break the SFX.
  Instead split the clip — `<OffthreadVideo muted>` for picture + a separate `<Audio src={sameFile}>`
  in a Sequence starting `LEAD` frames earlier (`from={f(START) - LEAD}`) — so only the voice moves
  and every SFX stays visual-locked. Make LEAD a named const for one-line tuning. Under-correct
  rather than over: audio slightly late reads far better than audio AHEAD of the picture, so never
  push past ~natural sync. (Remotion aligns `<Audio>` ~1 frame off `<OffthreadVideo>`, so effective
  shift ≈ LEAD−1 frames — verify on a pure-voice window, not one containing the unmoved SFX.)
- **The OffthreadVideo footage lag is PER-FILE, and `startFrom` adds ~100ms MORE.** Measured across the
  Fish set: fish2 intro `source.mp4` +610ms, fish3 intro `source.mp4` +243ms, fish2 outro `outro.mp4`
  +43ms (clean), fish3 outro +43ms on the `startFrom={0}` segment but **+153ms on the `startFrom={N}`
  segment**, both shorts +43ms part1 / +143–160ms part2 (after a mid-insert `startFrom` resume).
  Takeaway: (a) never assume one file's offset applies to another — measure each render vs its source
  (`render[t]` vs `source[t]`, cross-correlate; corr>0.9 = trust); (b) a clip played in two Sequences
  with different `startFrom` has TWO different lags, so a single global shift can't fix both. `<Audio>`
  elements (podcast, SFX, avatars) sit at the ~43–60ms render baseline and are effectively fine — only
  the seeked footage is badly late. Two fix recipes, both verified to 0ms: (1) FULL REBUILD (intros,
  which have SFX to preserve) — mute the footage `OffthreadVideo`, render, re-add the footage audio via
  ffmpeg `adelay` at the exact comp start, keep the render's SFX/podcast, one `loudnorm`; (2) PER-SEGMENT
  SHIFT (outros/shorts, footage-audio-only, and to preserve a delivered smooth cut) — `atrim` each
  segment and advance it by its own measured lag, `acrossfade=d=0.03` at the junction so the
  discontinuity lands exactly on the existing cut where it's masked. Always `-t <videoDur>` (never
  `-shortest`, which trims the VIDEO to the shorter audio and eats the end card) and `apad` the audio.
- **Purple/violet caption words on footage need a solid dark plate, not just a gradient.** Fish3 intro:
  "one of them doesn't exist." had white + violet words on a soft bottom-gradient over busy footage — the
  violet vanished on the light parts. Fix = wrap the whole caption in a `rgba(16,15,20,0.80)` rounded plate
  (padding + radius + shadow) AND brighten the accent word for dark-bg contrast (#7C5CFC → ~#B3A8FF). An
  accent color only reads when it sits on a controlled dark ground.
- **Timeline clip cards must be clamped to their lane, not just capped in height.** Fish3 outro's "last
  soundwave overflowing" was a Clip whose `x + w` (1750) exceeded `LANE_X1` (1740), poking its rounded
  corner past the lane; later clips started entirely beyond it. Fix = skip clips starting past the lane
  and `Math.min(cl.w, LANE_X1 - inset - cl.x)` the width. Overflow:hidden on the card doesn't help when
  it's the card overflowing its PARENT.
- **Demo / foreign-language insert clips must play COMPLETE sentences, never truncate mid-phrase.** Fish
  short2 played 2.63s of a 5.12s Spanish clip and 2.55s of a 4.44s Chinese clip → both cut mid-sentence.
  Fix = size each clip's `durationInFrames` to its sentence boundary (ES "…estés aquí." ≈ 3.1s in-clip; ZH
  first sentence ≈ 2.3s), push the next clip start + insert length to fit, accept the small runtime bump.
  Verify by transcribing the rendered insert — the foreign line should end on a clean pause.
- **"Not normalized / same volume everywhere" = a single `loudnorm` can't fix section-to-section
  level differences.** loudnorm applies ONE global gain to hit an integrated target; it does nothing
  for a mix whose sources sit at different levels. Fish2 intro: the cold-open avatar voices (ES/ZH,
  generated) measured −18/−20 LUFS while his A-roll narration was −32 to −34 — a ~14 LU jump the
  master just averaged. Diagnose first: `ffmpeg -ss T -t D -i f.mp4 -af loudnorm=print_format=summary
  -f null -` on each section and read "Input Integrated". Fix in stages: (1) static per-region gain
  to bring the loud sources DOWN to match the quiet one (avatars ×0.16–0.27), boundaries placed in
  inter-source silence gaps (no cuts → SFX never split); (2) if ONE take also drifts internally
  (his opening narration was ~6 LU softer than his mid delivery — real quiet delivery, not just
  pauses), a `dynaudnorm` RMS-target pass (`framelen=250:gausssize=15:maxgain=7:targetrms=0.68`)
  plus a static pre-lift on the soft region (boundary in a detected pause via `silencedetect`);
  (3) one final `loudnorm=I=-16:TP=-1.5` to hit target uniformly. Verify by re-measuring each section
  (goal ≤~3 LU spread across active-speech bursts) AND check pause RMS stays ≥20 dB below speech so
  the leveler isn't pumping room tone. `speechnorm` expansion pushes below-threshold speech DOWN —
  wrong tool for lifting a quiet open.
- **A stitched master MUST have video duration == audio duration, both starting at 0 — verify the
  CONTAINER, not just the content.** Why: on BusinessBrain each act's mixed audio ran 0.05–0.18s
  LONGER than its video (the per-act DUR values used for the music-bed slices exceeded the comp's
  exact frame duration = frames/fps), so the concatenated final had V=431.199 / A=431.409 with a
  21ms video start offset. The browser review player force-syncs A/V so it looked fine, but QuickTime
  played the mismatched streams at their own rates and Luuk saw "the start is out of sync, audio
  lagging." The voice was actually within 10ms (cross-correlation) — the defect was purely the
  mismatched-duration CONTAINER. How: derive each segment's TRUE length from its video frame count
  (frames/fps), extract each segment's audio trimmed/padded to EXACTLY that (`apad` + `-t`/`-shortest`),
  concat video (copy) and audio (pcm) as two matched streams, mux once (loudnorm→aac, `-shortest`,
  `+faststart`). Then confirm with ffprobe that V.duration==A.duration and both start_time==0, and
  cross-correlate the voice at start AND end vs the source renders (both ~0ms = no drift). Never trust
  a browser player to reveal A/V drift — it hides it; test the actual file in a native player's terms.
- **Watch ffmpeg filter-label reuse.** Why: consuming a labelled audio link twice (used `[voice]`
  twice) silently DROPS that audio — a spliced-in word vanished with no error. How: `asplit` the
  bus into N labels, one per consumer.
- **Music: loop from the track's SUSTAINED CORE, not its natural ends.** Why: mastered tracks
  fade in/out, so crossfading the end→start overlaps two fades = a ~1s silent dip at the loop
  seam. How: trim to an interior sustained window and crossfade THAT; place the fade-in only at
  the film's true start and fade-out only at its true end.
- **Dynamics > stingers.** Heavy whoosh/boom/riser SFX read as cheap ("awful sound effect").
  Prefer a musical swell at the key moment (a gaussian volume bump on the bed) to a hard SFX hit.
  Curated, sparse, word-synced light SFX (a soft pop on a reveal Luuk asked for) are fine.
- **"More SFX, a lot of subtle ones" = dense SOFT sounds on REAL reveals, never on noise.** Why: the
  ask is for a video that feels alive with gentle UI life, but an algorithmic accent placed on every
  tiny frame-diff (caption fades, micro-motion) is exactly the "super annoying random SFX" Luuk
  rejected. How: use soft sounds (bubbly UI blip / soft whoosh / melodic tick, each normalised to
  −1 dBFS, placed at ~0.15–0.20 gain) and gate placement on the frame-diff detector's REAL events
  above a floor. Caveat: `detect_events` magnitudes are **normalised per segment** (the busiest frame
  in each act = 1.0), so a fixed low threshold puts blips on noise in a CALM act while a busy act is
  fine — a calm act genuinely has fewer reveals, so let the density track the act's real busyness
  (act1 got 7 subtle, act3 got 22) instead of forcing an even count. Bigger reveals get the whoosh,
  small ones the blip, every 5th a tick for variety. Verify each new sound is non-silent AND lands
  audibly at its timecode in the STEM before mixing.
- **A sound lands on its TRANSIENT, not its start — check the peak offset, not just "non-silent."**
  Why: a sample with a slow attack or a pre-roll swell plays LATE. On BusinessBrain the "impact"
  sample had a 1.6s dead pre-roll before its hit, so EVERY impact in the video was landing ~1.6s off
  its beat — and it survived several versions because the stem "had energy," just at the wrong time.
  How: measure the sample in small windows to find where its peak is; if the peak isn't within
  ~0.1s of the start, TRIM to transient-first (re-normalise after) or offset the placement by the
  transient time. Then verify the peak sits at the SIG timecode in the stem, not merely that a sound exists.
- **"SFX are too loud" is fixed by lowering per-hit GAINS, not by dropping the SFX bus.** Why: the
  bus also carries the quiet ambient accents the user wants to STAY present ("there without being
  noticed"); pulling the bus down kills those first. How: pull every hit to a subtle ceiling
  (≤~0.24 on -1 dBFS samples), leave the bus; the loud offenders (a 0.5 success/ping) are the
  actual complaint, and a 0.5→0.21 is a ~7 dB drop on exactly the thing that was shouting.
- **Frame-diff event detection MISSES smooth slides/fades — the authoritative map of "logical SFX
  moments" is the scene SOURCE, not the detector.** Why: a stripe/panel that slides in, or a
  cross-fade, barely moves pixels frame-to-frame, so `detect_events` never fires there — those are
  exactly the "we missed a sound here" spots. How: read each act's source (beats are `t >= X`
  gates in seconds; element reveals are `clamp01((l-AT)/dur)`/`interpolate(t,[A,B])` — the onset is
  the sound time) and place on real reveals; use the detector only to corroborate hard cuts.
- **Never algorithmically thin HAND-AUTHORED intentional pairs.** Why: a "collapse same-sound runs"
  pass (good for de-duping an over-produced auto-list) merged the two deliberately-separate stripe
  swipes into one and silently re-broke a fix the user had just asked for. How: apply de-dup/thinning
  ONLY to machine-generated lists; carry curated placements (a fix timed to specific words) through verbatim.
- **Enumerations want a pop PER ELEMENT — don't thin them.** Why: when discrete things appear
  one-by-one (comments, list rows, event cards, funnel columns, logos flying in, day-bars filling),
  the viewer expects a sound on EACH — "pops for every comment popping up?" was the exact note. My
  arcade-fear thinning was wrong for this: a per-element run at low gain reads as satisfying life, not
  busyness. How: read each scene's staggered `.map()` (onset = base + i*step, or an explicit per-item
  `at`) and place a pop on every element; only collapse to a single swoosh when the stagger is a true
  BURST (elements <0.15s apart or >~14 of them, e.g. a 32-cell mass). Pitch/gain-jitter each pop
  (±8% pitch, ±15% gain, deterministic by index) so a rapid identical-sample run sounds organic, not
  a machine-gun. Footage bursts the source can't time (real screen-rec comments) → frame-diff peaks;
  but check the source FIRST — the "comments" turned out to be timeable overlay cards.
- **Repeated identical SFX read as "the same bleep" — vary by MEANING, not by random detune.** Why:
  a run of one sample (even with ±8% random pitch jitter) still habituates and Luuk clocks it as
  identical/mechanical ("everything was the exact same bleep at 2:12"). Random *different* samples per
  element is the opposite failure — chaos. How: two coherent mechanisms. (1) **Melodic contour within a
  run** — same timbre pitched along a gentle arpeggio that MATCHES the on-screen meaning: things
  accumulating RISE, things lost/passing FALL, a steady counter barely wobbles (a "regular tick").
  Resample the sample by semitone (2^(n/12)); a rising major-third motif that drifts up per cycle
  (`[0,2,4]+i//3`) keeps a long run climbing without getting shrill. (2) **Timbre by meaning across
  runs** — comments / data-rows / counters / money-events get DIFFERENT samples, and adjacent runs
  never share a timbre (enforce it). Verify it landed by FFT: consecutive pops in an "up" run must
  show rising dominant frequency in the rendered stem (a "down" run falling, "steady" ~flat). Keep the
  palette small (~4 related timbres) and the pitch range tight (±~6 semitones) — enough to feel alive,
  not so much it sounds like a broken synth.
- **A sample that isn't normalised makes its gain a LIE — level-check every kit sound, not just es_.**
  Why: `card-pop.wav` sat at −27 dBFS while the imported es_ sounds were −1 dBFS, so `('pop',0.11)`
  played ~26 dB quieter than `('blip',0.11)` — every 'pop' cue (incl. the comments and 7 badge hits)
  was effectively silent, and it survived versions because gains "looked" subtle. How: measure
  max_volume of EVERY sound the map uses; normalise the outliers to −1 dBFS so gain == level, OR only
  ever author gains against a known peak. Verify the placed sound is audible in the STEM at its time.

## On-screen graphics / motion-explainer (added from the BusinessBrain longform)
- **CONTRAST is the #1 recurring visual note.** On a DARK bg never use dark-grey/BODY-grey text,
  dark tags, or thin dark-outlined shapes — use silver or a lime plate. On a LIGHT/white register
  never use lime/yellow for text, fills, outlines, or the little swatch-before-a-label — use dark
  raisin ink. Silver figures/text vanish on white; lime vanishes on white; grey vanishes on dark.
- **Nothing overlaps.** A caption must never sit on a shape's outline, a logo, a counter, or
  another label; two event tags must never stack; a big number must never cross body text. Give
  every element clear space; if a beat is crowded, cut elements, don't cram.
- **One clear focal point per beat; delete redundant text.** Cut any caption that repeats a label
  already on screen (e.g. don't caption "recipes/truth" when the file and DB are already labelled).
- **Real brand marks in their REAL colour, consistently.** A hand-drawn logo, or the right logo in
  the wrong colour (white Claude vs the actual clay-orange), reads as "off" and inconsistent with
  where the same mark appears correctly. Use the official mark in the official colour everywhere.
- **No gimmicks the viewer didn't ask for** — scattered icon pop-ups, glows, stray connector
  lines, decorative flourishes. They read as "messy/annoying." When unsure, cleaner.
- **Enactment over labels; show real things.** People building → draw actual people (high-contrast
  silhouettes), not more file icons. "Everyone's doing this" → show the MASS. A funnel of events →
  many columns converging. A US stat → a filled US map with dots, not a rectangular blob.
- **Flashback/insert footage must be RAW source, not the edited export.** Why: reusing the
  graphics-laden export replays our own captions/logos inside the "memory." How: composite the
  clean graded camera clip; add the flashback look (desaturate, grain, vignette, REC) on top.
- **Timing is locked to the baked VO — restyle inside the existing window, never move a beat or
  change durationInFrames.** Place an insert on the EXACT words (transcribe to align: a "back to
  the start" flashback belongs on "back to the start", not 4s later).
- **Full-screen-footage beats: overlays that must appear ON the footage go AFTER the footage layer
  in the DOM** (a graphics-world div renders UNDER the footage and the overlay is invisible).
- **AI-product hook: make "talking to the AI" unmistakable** — the real logo + the product NAME +
  a listening/response cue, one clean group, so a scroller instantly gets who you're asking.
- **Don't spell the mechanism out as a literal typed LABEL** — an icon + a short descriptive caption
  reads cleaner and still lands the concept. A keyboard icon + "you type every event by hand" beats a
  big "MANUAL STEP" wordmark. Show the idea, don't name it.
- **Comparisons = ONE clean panel, not scattered cards.** Show the actual content being compared (the
  coaches' generic advice, not just "COACH #1 €2,500"), STRIKE the losers and LIGHT the winner. Never
  dim a card to near-invisibility to signal "secondary" — that reads as messy; keep it legible but struck.
- **A real screen-recording payoff is stronger FRAMED than screen-blended.** A ghosted mix-blend of a
  Claude/terminal session is unreadable; put it in a clean window (title bar + product logo + a live
  "working" dot), full-opacity, with a slow push-in, so the REAL session reads as authentic and catchy.
- **A product's OUTPUT must look like the REAL product UI, not a stylized abstraction.** Why: Luuk
  flagged Claude's answer rendered as an icon-and-checkmark "receipt" (and again as a lime-bordered
  graphic) — "doesn't look like an actual output that comes from Claude." A scroller reads a stylized
  card as a made-up graphic, not the product actually answering. How: find the canonical realistic
  product window ALREADY in the video (here: the Claude chat window — dark chrome bar, 3 dots, the
  clay-orange claude.svg, a "claude" label) and render every instance of that product's output the
  same way — a real chat reply with markdown-style text (lead line + bold values), a real dashboard,
  etc. Match the reference; don't invent a second visual language for the same product.
- **Wiring/flow diagrams must be semantically consistent — the source→target must make sense.** Why:
  in a loops viz, a "payment loop" fired a job card into the JOBS list ("payment loops pushing to
  jobs, which doesn't make sense"). Even mid-drumroll, viewers track type→destination. How: every
  animated route maps a typed source to its matching output (payments→revenue, messages→messages);
  never let a fast/decorative sequence break the mapping just because it's brief.
- **Don't leave a dead empty gap in the middle of a "mass/crowd" visual — fill it.** And drop a headline
  label once the visual already says it (a grid of people building .md files doesn't need "A FOLDER OF
  TEXT FILES" over it). "Clean and visualizing" = the picture carries the point, minimal text on top.

## The review loop (how this longform was run)
- Ship a version, review it in the `video-feedback` tool, batch the notes per version, re-render
  ONLY the changed acts, keep every version in the dropdown for A/B. One reviewer per project;
  never hand-edit a project's `review.html` — edit the skill template and regenerate.

## Reusing a piece made elsewhere — grab the SOURCE, never the render (locked 2026-07-15)
When a section (e.g. an intro) was built in another session/chat, **import its Remotion comp into the
engine and re-render it — do NOT bolt on the exported MP4.** A dropped-in render is a black box: it
can't be edited, its cuts may differ, and it carries its OWN sound/music. Steps: find the comp
(`src/<Name>.tsx` + its Root), register it in the main `Root.tsx`, render via `render-film.mjs`, then
apply feedback to the SOURCE. Luuk: *"you should have grabbed the actual Remotion code… so we can
really integrate that and be able to edit it."* This IS "every video is a Loop Studio project" — it
extends to every reused piece.

## One music bed across the WHOLE video — a foreign intro bed reads as "two videos" (locked 2026-07-15)
If a bolted-on intro keeps its own music and the body has another, the seam sounds like two separate
videos even when the visuals match. Fix: **render the intro comp WITHOUT music (vo+sfx only), drop its
own bed, and run the project's single bed (same track) continuously from 0 to the end**, ducked under
the combined voice, one −14 master. Continuity by construction beats phase-matching two beds.

## Motivate a smaller face when a corrected phrase still has weak lip-sync (locked 2026-07-21)
Do not hide residual mismatch with an arbitrary crop. Turn the sentence into a purposeful proof, demo,
or diagram register. If concealment is the goal, do not leave the face as a large central card: reduce it
to a small supporting “live source” monitor and make a bespoke enacted visual the clear hero. Let that
visual carry the claim, transition during a natural pause, and return to the full-size face immediately
after the corrected beat.

## Frame-exact per-segment audio or lip-sync drifts (locked 2026-07-15)
A comp's baked `<Audio>` is often 10–60 ms longer/shorter than its video frame count; concatenating
raw segment audios accumulates that into audible lip-sync drift over a 10-min cut. **Pad/trim each
segment's audio to its EXACT frame length before concat** (`aresample=48000,apad,atrim=end_sample=frames*1600`
at 48 k/30 fps), rebuild video and voice from the same frame boundaries, and verify `V.frames == A.samples/1600`.

## Intro-beat craft (from the loopstudio intro v2→v3 notes)
- **"Final cut" must SHOW an edit**, not an empty player: burned captions, a lower-third, a b-roll PiP,
  a chapter scrubber, over PACKED video/caption/music tracks. An empty play button "says nothing."
- **Numbers get enacted cinematically**, not written flat: "$2,000/mo" is a TOWER of cash that stacks,
  gets slashed, and topples to a $0 plate — keep the real numbers inside the enactment.
- **A retention teaser must MEAN something**: not a bare "?" — shrink the small thing ("what I save")
  and reveal a glowing LOCKED bigger prize ("THE REAL OPPORTUNITY · revealed by the end →").
- **Visuals react to the spoken cadence** — never hold one static graphic under changing narration;
  each clause gets its own beat (on "never open an editor" a no-entry stamps; on "never touch a
  timeline" the timeline is struck).
- **No harsh full-screen white strobe** to close — a soft lime bloom behind the closing plate reads
  clean; a white flash reads cheap.
- **A stylized "living room" must read as one**: bound it (side walls, a warm lamp) so it feels
  intimate, and put a believable couch + a person on it — an infinite floor grid reads as a vast hall.

## Show, don't label — the strongest recurring Luuk preference (locked 2026-07-15, full-video round)
Across a 33-note round the through-line was one rule: **"I prefer cleaner designs and not having text
for every point I make — making it more VISUAL is the goal."** Apply everywhere:
- **Delete headline/label text that just restates the narration.** If he says it, don't also write it.
  Keep at most ONE short lime Marker word per beat. Enact the idea; a mono label under a graphic that
  names what the graphic already shows is noise ("A FILTER", "SOUND STATION", "cut parameter" → cut them).
- **Show the real thing, not the word or a sketch.** "a human" → composite the real footage head;
  "a map of the US" → a real 1:1 US-map SVG, not a rough blob; "multiple niches" → three fine-tuned
  niche cards (fitness/finance/cooking), not the word "niches".
- **Real logos in real colour whenever a brand/platform is named** — Claude/"cloud" clay-orange
  `claude.svg #D97757`, YouTube red, YouTube Shorts, Instagram gradient, TikTok. A named brand with no
  mark on screen is a miss.
- **Not code-ish / fake.** Editor timelines, fake "parameter" panels, fake code that means nothing read
  as cheap. To show a *product/outcome*, show the real published result: "fully edited video" = a premium
  PUBLISHED piece (graded frame + burned captions + lower-third + views), NOT editor track-lanes. To show
  "it writes the code", show the real Claude mark writing into a real editor — that specific case IS the point.
- **Premium framing for the product/offer** — the thing they buy (Loop Studio, the $97 offer) gets a
  premium lockup (real logo, glass/3D card, scarcity pill), never a cheap line-art doodle.

## Cutting content from an assembled film — trim the rendered segment at a clean boundary (locked 2026-07-15)
Removing a retake (screenshare) or a talked-out section (an act) does NOT require re-baking the VO. Trim
the RENDERED segment at a clean **word boundary** (screenshare: end on the last clean word via word-level
timestamps) or **beat boundary** (act: the design-spec beat start/end), then re-stitch frame-exact. Verify
the seam by transcribing across it — the sentence before must complete and the next must start cleanly.

## Music: duck HARDER under tutorial / screenshare stretches (locked 2026-07-15)
A bed at a fine level over talking-head can still feel "too loud" over a screen-share tutorial (the viewer
is concentrating on the demo). Add an EXTRA dip (≈×0.5 on top of the voice-sidechain) across each
screenshare's time range, not just the global duck. If he still says "too loud" after that, drop the BASE
bed (≈0.5→0.4) and harden the sidechain (lower threshold, higher ratio) so the voice always wins.

## Text placement LAW — eyebrows OUT, headlines BOTTOM-MIDDLE, everywhere (locked 2026-07-15)
Luuk's firm, repeated rule across a whole video: **(1) DELETE every little "eyebrow"/kicker label** — the
small mono spaced-caps tags (often with a lime square), e.g. "THE BEST PART", "STATION 01", "I USED TO PAY".
**(2) MOVE every headline to BOTTOM-MIDDLE**, centered, NOT top-left. Use ONE identical placement so every
scene matches: `left:50%; top:88%; transform:translate(-50%,-50%)`, centered, SANS 800 uppercase, keep the
one lime Marker word, `textShadow:"0 2px 18px rgba(0,0,0,0.7)"` for legibility over footage. Apply it via the
comp's headline helper (change the helper once → every beat updates) — don't hand-place per beat, they drift.
KEEP diegetic labels that carry unique meaning (file names, timecodes, real UI titles, state chips, concept
chips) — those aren't kickers. **Watch for collisions:** a bottom-middle headline at 88% collides with any
hero card/element that idles at bottom-center — move that element UP (and anything choreographed to it).

## A "comparison" must be SIDE-BY-SIDE and visual, not sequential (locked 2026-07-15)
"$2,000/mo → $0" that collapses one then shows the other is a transition, not a comparison. Show BOTH at
once with contrasting visual weight — a heavy cash stack ($2,000, struck/greyed) VS a light lime $0 plate,
held together with a "vs". The eye compares magnitudes directly.

## A "finished video" viz uses the REAL footage, not a drawn fake (locked 2026-07-15)
When showing "the edited/finished video" in-scene, play the ACTUAL footage clip (OffthreadVideo of the real
source, graded) inside the player — a hand-drawn gradient "scene" reads as fake. And when an overlay panel
would sit on top of the talking-head and clash, HIDE the footage for that beat (SKF dim→1) so the panel owns
the frame — don't overlap graphics on the face.

## Captions/headlines may NEVER overlap an item — the bottom-middle rule creates overlaps (locked 2026-07-15)
Moving every headline to bottom-middle (88%) then collides with anything that lives low in a beat — a couch,
an NLE timeline, a chip, a docked card. Luuk: "we can NEVER have captions overlay items." So the placement
rule has a partner rule: **audit EVERY beat; the ~84–92% centered band must be clear.** Where an item sits
there, raise the item above ~82% (and anything choreographed to it); where the whole bottom is occupied
(TV-room couch), give that ONE beat a top-band headline instead. Verify on render — geometry reasoning misses it.

## Right-channel-only voice → recenter (recurring audio gotcha, locked 2026-07-15)
A VO recording can come in with the voice ONLY in the right channel (L ≈ −90 dB, R ≈ −24 dB) → "only in my
right ear." Fix the source: `pan=stereo|c0=c1|c1=c1` (right → both, centered, no level loss), then re-render/
re-mux. Check per-channel RMS (`pan=mono|c0=c0` vs `c0=c1`) whenever a stem might be one-sided.

## Removing a filling graphic leaves a bare beat — refill it (locked 2026-07-15)
When you delete a graphic that OWNED a beat (e.g. a grid the reviewer cut), that beat can render blank
(especially if the footage was hidden behind it). Don't ship a ~blank worksheet — refill with the talking
head (unhide the footage: SKF dim→~0, fr→1, matching neighbouring beats) so the beat still reads.

## Documentary multi-track score — map songs to STRUCTURAL sections (locked 2026-07-15)
One looped track across a 10-min video "gets annoying." Use several tracks in a given order, each on a
structural section at scene boundaries (e.g. Particle Emission→intro+Act1, Long Ride→Act2 block, Cold
Conclusion→Act3, Melting Glass→ss3+Act4). loudnorm each to a common target so levels match, loop-from-core
or trim each to its section length, seam with short fades. Real stats need real sources (Cisco VNI: 82% of
internet traffic is video by 2022) and the graph must plot the actual series, not a decorative curve.

## Sound effects (SFX) — timing (added 2026-07-17, Fish intros)
- **Fire the SFX on the ONSET of the visual change, not when it finishes.** Why: Luuk's ear
  expects the tick/whoosh the *instant* a thing starts moving/appearing — a cue that lands when
  the element has already settled reads as late, and one placed at a hand-guessed script time
  (not the real element onset) reads as "before or after, something structural." It IS structural:
  each SFX must be keyed to the exact frame its element's animation begins (the `at`/`from`/pan-start),
  never to the settle and never to an approximate script beat. How: derive every SFX time from the
  element's actual onset frame; a whoosh/slide → the frame the camera or element STARTS travelling;
  a tick/pop → the frame the element STARTS its ease-in. If you can't key it exactly, cut the SFX
  rather than ship it mistimed (a clean no-SFX beat beats a mistimed one).
- **Bind the SFX `from` to the element's OWN timing variable, never a hand-typed offset.** The Fish2
  regression: the comp's `<Audio from={f(T(6.65))}>` was a guessed offset next to a station at
  `at={f(T(6.3))}` — every cue ran ~0.35s late ("completely off again") the moment we re-rendered
  from the comp instead of the approved post-mix. Fix = write the SFX `from` as the *identical
  expression* as the visual (`from={f(T(6.3))}` for the station at `T(6.3)`; strike hits at the same
  `s1/s2/s3` props; fan ticks at `fanAt + i*stagger`). If the number in the SFX line isn't a
  copy of a number already driving a visual on screen, it's wrong. This makes drift impossible and
  survives re-renders. Corollary: prefer keeping SFX inside the comp (frame-locked) over adding them
  in a post ffmpeg pass (which silently desyncs the next time the comp is re-rendered).

## One focal object per beat; iterations must transform it (locked 2026-07-18, AI comparison intro)
- **Give each short beat one full-scale focal object.** Do not stack nested windows, browser chrome, or
  duplicate footage players merely to suggest “editing” or “two models.” If the narration is not asking
  viewers to compare two finished outputs side-by-side, keep one shared footage canvas and let the model
  selection, crop, grade, or graphic action happen on that canvas. Creativity should deepen the one idea,
  not multiply containers around it.
- **An iteration must visibly mutate the same outcome.** Numbered cards or boxes changing colour do not
  communicate progress. Hold on one output and make each pass materially legible: for example pass 1 changes
  crop/grade, pass 2 adds story typography, pass 3 adds final polish. The viewer should understand what improved
  with the labels hidden; labels may confirm the changes, never substitute for them.

## Clean the hierarchy, not the cinematic idea (locked 2026-07-18, AI comparison intro)
- **“Clean” does not mean reducing a loved cinematic system to a bare diagram.** Why: removing the orbiting
  footage rig solved clutter but also removed the authored depth and motion Luuk liked, making the next cut
  feel too simple. How: identify the one high-value motif the reviewer responds to and preserve it; remove the
  competing chrome, duplicate canvases, explanatory copy, and secondary panels around it.
- **Coordinated layers may count as one focal idea when they behave as one system.** An orbit can contain
  rings, footage fragments, and a scan point without becoming “multiple focal points” if all of them enact the
  same edit-rig concept. Make the hierarchy explicit with layout contracts: reserve a face keep-out, a top band
  for identity badges, and a bottom band for the single headline; use opacity, masking, and z-order so the motif
  passes behind the subject and never draws through text or facial detail. Solve collisions spatially before
  deleting the creative engine.

## AI is the subject, not the visual style — never default to “techy” (locked 2026-07-18)
- **Keep the speaker present through long full-screen graphic runs, but never duplicate them.** When a
  phone-first talking-head ad fully hides the camera behind diagrams, preserve a clean circular live crop
  in an unused corner. Remove that crop the instant the main camera returns, including on a CTA that already
  shows the speaker full-screen.
- **In phone-first ads, visualise the spoken noun literally and at a glance.** A six-week promise becomes a
  six-week calendar, employees using AI become employee cards with recognisable tools, and implementation
  becomes a few large, readable setup cards. Use fewer elements, make them larger, and clear the previous
  visual before introducing the next idea.
- **An AI topic does not authorize HUDs, dashboards, neon circuits, grids, status chips, browser chrome,
  glowing rails, or generic software panels.** Why: even a clean execution of that language can read like
  a gaming/crypto promo—cold, familiar, and unprofessional—rather than authored motion design. The topic
  tells us what the film is about; it does not choose the aesthetic.
- **Derive the motion language from the video's real domain.** For an AI *editing* comparison, use cinema:
  film strips, contact sheets, crop mattes, colour gels, printed proofs, projection light, physical card
  flips, and edit-rhythm choreography. For another AI subject, find that subject's own material vocabulary.
  Full creativity = one domain-native world built with premium typography, composition, depth, and match
  cuts—not more technological decoration.
- **Professional polish comes from material hierarchy and choreography.** Prefer cast shadows, believable
  weight, restrained colour, negative space, oversized editorial type, motivated camera movement, and
  physical transformations. If a still could be mistaken for SaaS onboarding, an esports graphic, or a
  crypto ad, the concept is wrong even when the animation is technically smooth.
# Exact split-screen boundaries

- In a two-sided comparison, the colored fields must meet exactly at the visible divider. The divider is the boundary, not decoration over overlapping layers.
- Keep each hero inside its own side unless crossing the line is an unmistakable, momentary story event. A background color leaking across the seam reads as a compositing bug.

## Put the signature accent into the opening idea

- The first two seconds should already carry the brand accent strongly enough to survive a small autoplay feed preview. If the accent only arrives at a later impact, the hook reads flatter and less identifiable than the rest of the film.
- Make the accent do conceptual work, such as a signal selecting, transforming, or connecting the hero object. Prefer one meaningful accent system over scattered decorative color.
- Do not tint the whole live-action environment with an ambient brand-color projector or wash just to add color. Keep the photographed room and skin natural, then place the accent on motivated editorial objects such as selection states, approval marks, playheads, or transformation edges.
