# AI-generated video (image-to-video: GPT Image 2 → Seedance/Kling etc.)

Rules for spots built from generated stills + image-to-video. Seeded from the ROAM Bali spot
(round 1 read "cheaper / faker than the reference"). Each = what · why · how.

## Any b-roll with a visible face MUST carry the person's identity
- **A "product/detail" b-roll shot that happens to include a face needs the identity element too,
  not just the prop.** Why: generating "the ROAM hat pressed to a diver's head" with ONLY the hat
  element produced a total STRANGER's face in the middle of a spot otherwise starring Luuk ("this
  doesn't even look like me"). How: before generating any coverage shot, ask "is a face visible?"
  If yes → include the person's Soul/element. If truly no face (macro, feet, hands-only, splash,
  POV) → prop-only is fine. When unsure, frame it to exclude the face.

## Character model: trained Soul, NEVER a single-image Element
- **If a recurring person has a trained Soul, USE IT — never a one-photo Element through GPT Image 2.**
  Why: GPT Image 2 is a text/product model; its humans go waxy/uncanny, and a single-image
  Element only approximates likeness. A trained Soul (5–20 photos: Soul V2 `soul_2`+soul_id, or
  Soul Cinema) is what makes the face both faithful AND cinematic — it's what the reference video
  used (20 photos). How: ALWAYS `show_characters(status=ready)` FIRST; if a Soul exists, generate
  hero human stills with `soul_2`+soul_id (or Soul Cinema). Luuk's Soul V2 = `505cd47a-...`.
  Trade-off: Soul can't take a prop Element in the SAME still — describe the prop, and carry exact
  product detail in an element-based macro insert instead.

## Props/objects the shot introduces must be in the START frame
- **If an object needs to appear (a hat flies in, a can drops), composite it into the START
  frame — don't rely on the video prompt to invent it.** Why: image-to-video invents a
  generic version (a "straw hat" became a conical rice-farmer hat, not the branded one) and
  breaks product consistency. How: make the start still with the exact prop Element already in
  position (mid-air, entering frame), then animate the short motion; or start_image+end_image.

## Finishing pass (what ties it together into "film")
- **Do a unified grade + subtle vignette pass over the final cut.** Why: per-clip prompt
  grading drifts; a single post pass is what reads as one graded film vs a stack of AI clips. How:
  one LUT-ish curve + gentle vignette + a hair of anamorphic-style crop, applied to the whole
  timeline in the edit, not per shot.
- **NEVER blanket film-grain or sharpen over faces — it reads as skin spots/acne.** Why: `noise`
  and `unsharp` applied to the whole frame land on close-up skin as speckle/blemishes (worst in
  dim scenes) — looked like "a lot of spots on my face." The RAW generation skin was clean; the
  grade dirtied it. How: default to NO added grain on face-heavy cuts; if you want film texture,
  keep it whisper-light (`noise=alls≈2`) and never sharpen skin. A light denoise (`hqdn3d`) on the
  timeline cleans skin without going plastic. Always A/B a face crop RAW vs graded before shipping.

## The stills are not the problem — motion + edit are
- **Great stills + gentle motion = "living portrait" = the #1 cheap tell.** Why: a person
  standing and barely moving screams AI. How: NEVER prompt "gentle/subtle handheld." Direct
  MOTIVATED, aggressive camera every shot — fast push-in, low-angle, tracking-with-subject,
  whip-tilt, rack focus, dolly. Describe what the CAMERA does, shot by shot, not just the mood.

## Show the action, not two states either side of it
- **The hero action must happen ON screen.** Why: cutting problem-still → solution-still skips
  the very thing the ad is about (e.g. the hat going ON = the "save"). It reads as a slideshow.
  How: generate a mid-ACTION start frame (hands on the hat, mid-motion) and animate the beat;
  or use start_image + end_image so the model interpolates the action between them.

## One take per shot is the amateur move
- **Generate MANY takes per beat, cut the best fragments.** Why: the reference's own rule —
  "the final film is the best 3 seconds of 100 tries." One-take-per-beat = static and even.
  How: count≥2–3 per hero shot; in the edit take the single best 1–3s phase from each and
  discard the rest. Vary shot LENGTH (0.5–1s punch inserts vs 3s hero holds) — even ~3s cuts
  throughout is a monotony tell.

## Coverage variety (kills the "same medium shot" look)
- **Every scene needs mixed shot sizes.** Why: uniform medium/portrait framing is flat. How:
  for each beat also generate a WIDE (establish the action in the space) and 1–2 MACRO inserts
  (product detail, hands, feet, texture, water). Intercut them. Inserts also hide weak motion.

## THE big one: cover each MOMENT, don't cut beat→beat in a line
- **One shot per beat cut linearly = amateur, "simple & linear", and it EXPOSES the AI.** Why:
  holding a single wide clip for 1.5s lets the viewer study the fakeness; a beat that is 4–6
  intercut shots never dwells. This was the #1 note on the ROAM cuts ("feels too linear, one clip
  then next scene; the reference had b-roll zoom-ins on details"). How: build EACH story moment as
  a mini-sequence — hero/wide + macro insert (the product, hands, an object) + reaction ECU + a
  detail/texture (+ a second angle) — and INTERCUT with varied durations (0.3–0.5s insert flashes
  against 0.8–1.3s holds). The pacing carries the story AND hides per-clip AI softness. Budget
  ~4–6 shots per beat, not 1. In a pinch, a digital punch-in (crop ~1.5–1.8× + scale) fakes an
  insert from existing footage, but a truly generated angle is better. Music locks the rhythm.

## Music is not optional for an ad
- **A driving music bed + cutting ON the beat is ~half of "expensive."** Why: ambient-only with
  even pacing feels like a mood board, not a commercial. How: can't license, so get a track from
  Luuk (Epidemic search terms: mood + genre + BPM) OR let him drop one, THEN cut to its rhythm.
  Ambient stays under the music, ducked.

## Still true from universal.md (applies here too)
- No shot >~4s; open ON the action; start the trim past frame 0 (Seedance frame 0 = the static
  start image → looks like a freeze); verify freezes/levels/frames before calling it done.

## Bespoke intros for AI-footage videos: world-canvas, never overlay-on-footage (2026-07-15)
- **A hero intro built as "speaker footage + overlay cards" reads BORING/BASIC — the world-canvas
  register is the locked default.** Why: the ROAM intro v1 (slate cards + type over the talking head)
  got "not full creativity mode, pretty boring and basic; visuals super simple" — the exact repeat of the
  earlier "I miss a sense of greatness" rejection. HiggsIntro's overlay register is SUPERSEDED; don't
  copy it even as a same-series reference — carry palette/receipts language only. How: full-frame
  designed canvas, world camera flying station to station, speaker as a choreographed card, set pieces
  at world scale (type bleeding frame edges, full-frame takeovers). See video-edit/knowledge/bespoke_intro.md Part 3.
- **No dead visual stretch >~4s in an intro.** Why: v1 had nothing on screen 5–11s ("we don't pull the
  viewer in"). How: every beat needs a visual EVENT (a reveal, a move, a station arrival), not just the
  talking head holding.
- **Curate WHICH ad shots you re-use as receipts — weak AI shots poison the intro.** Why: the cliff-dive
  ("skydive") and market-run tiles read "really bad / fake" to Luuk; the wave-burst, hat macros, rain and
  reaction shots read great. How: filmstrip the ad, rank shots, and only quote the strongest; never
  re-quote a shot the owner has flagged (ROAM: avoid cliff-dive + market-sprint; favor wave burst,
  brim macros, rain brim, laugh ECU, surf feet).

## Cold-open audio: real footage carries its OWN sound, then SWITCH to score (2026-07-15)
- **When an intro cold-opens on a piece of real footage (an ad, a clip, a demo) before the designed
  intro begins, that footage should play with its OWN diegetic audio — full and present, ducked under
  the VO — and the music score should NOT be running under it.** Why: on the ROAM intro, layering the
  documentary score under the silent-ad cold open read as "two sounds going through each other, doesn't
  hit"; the ad's own soundtrack hitting first is what lands. How: (1) find the footage's real audio (the
  finished ad's mixed track, not the silent assembly — check with volumedetect; the raw comp clip was
  silent, the *_with_music master had it at -14 LUFS); (2) mux it in for the cold-open window only,
  ducked under the VO; (3) **switch the music** at the exact moment the designed intro starts — crossfade
  the footage audio OUT (~1s) while the score fades IN (~2.5s), landing on the first designed beat. The
  music switch itself signals "that was the thing, now here's the breakdown."
- **A documentary/score bed reading as "hard and loud" is fixed by level + tone, not just volume:** drop
  the mix weight (0.5→0.3), add a gentle lowpass (~8kHz) to warm it, and start the track past its loud
  entry-hit so you ride the sustained body, not the transient. Keep the score ~2-3x quieter than the
  cold-open footage audio so the footage hits and the score stays a bed. All of this is a MUX-time remix —
  never re-render the comp for an audio-level change.
