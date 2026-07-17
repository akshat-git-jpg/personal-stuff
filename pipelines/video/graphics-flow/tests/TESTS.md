# Graphics-flow test log

One section per test video. The working data for each test lives in
`videos/<slug>/` (text committed, media gitignored); this file records what was
tested, with what source, and what the run taught us.

## test-01 — first end-to-end dry run (2026-07-18)

- **Source**: Drive folder `1H2Ffkqw_xWMUR20EWLWQ7ydTGAQ-rZoL` (owner: khushibakliwal251) —
  3 tutorial segments: `intro.mp4` (86.7s), `BODY .mp4` (1683.0s), `conclusion.mp4` (158.0s).
- **Workdir**: `videos/test-01/` (raw segments in `src/`, gitignored).
- **vo.mp3**: audio of the 3 segments concatenated in order intro → body → conclusion;
  total 1927.6s (32:08). Segment boundaries on the VO timeline: intro 0:00.0,
  body 1:26.7, conclusion 29:29.7. `offset` left at 0 (timeline = concatenated segments).
- **Goal**: prove the full loop on real content — transcription quality (product names!),
  cue-pass anchor discipline (Sonnet), resolver hit-rate, board review usability,
  capacity limits vs real content, render + manifest.
- **Status**:
  - [x] segments downloaded, audio concatenated
  - [x] 010 transcribe — local whisper small.en, ~8 min for 32:08 audio; 6110 words
  - [x] 020 cue pass — Sonnet subagent, 21 cues, 0 flagged (~109k subagent tokens)
  - [x] 030 resolve — 21/21 cues + all beats matched FIRST TRY, zero anchor misses
  - [ ] 040 board review (owner) — board live at localhost:4322
  - [ ] 050 render + manifest
- **Findings**:
  1. **ASR garbles brand names** (HeyGen → "Heigen/Hazen/Haitian", OpenArt → "OpenARC").
     Anchors still resolved (they quote the garbled transcript verbatim — by design), but
     Sonnet copied garbled spellings into on-screen reveal text. Fixed post-hoc in display
     fields only (9 fixes). TODO: rulebook rule — reveal/variable text uses CORRECT brand
     spelling; only anchors stay transcript-verbatim; cue-pass prompt should take an
     optional product-name list from the video's dossier.
  2. **Local whisper is slow** (~8 min). FIXED same day: step 010 now tries Groq
     whisper-large-v3-turbo first (lib/transcribe-groq.mjs; 22s for this file, 6092
     words, word granularity, 25MB limit handled by 16kHz-mono downsample), local
     whisper stays as fallback. Bonus: Groq spells the brand names CORRECTLY
     (HeyGen/OpenArt/Higgsfield — zero garbles), largely dissolving finding #1 for
     future runs; timestamps agree with local within 0.77s on sampled words.
  3. Anchor discipline held: Sonnet self-verified verbatim+ordering; resolver confirmed.
  4. Sonnet judgment notes: inferred one unstated score (OpenArt "Creative Ground" = 5);
     dropped a 6-item feature list (items too short for 3-word anchors); moved the CTA
     cue off the last-20s zone. All reasonable — review on board.
