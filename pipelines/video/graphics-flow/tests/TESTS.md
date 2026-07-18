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
  4. (renumbered below)
  5. Board port clash: a stale board instance from plan-065 verification held :4322;
     my launch died EADDRINUSE while the stale one served fixture data. TODO: board
     should fail with a clear "port in use" message and/or auto-pick a free port.
  6. **Catalog under-specified array shapes — TWO broken cards on the board** (owner
     screenshots): bullet-points-highlighted rendered "undefined" per row (card wants
     items:[{label}], catalog said "array", Sonnet sent strings) and summary-table
     staircased (rows need products.length score values + a trailing reason cell;
     catalog said values:"array", Sonnet sent 5 scores, 6 cells hit a 7-col grid).
     FIXED same day at three levels: both cards normalize LLM-shaped input
     (strings→{label}; pad/trim rows + separate reason field), catalog.json array
     types now spell out exact item shapes for all 8 affected cards, and this class
     of bug feeds the auto-QC design (schema validation + frame inspection).
  7. (v1) Sonnet judgment notes: inferred one unstated score (OpenArt "Creative Ground" = 5);
     dropped a 6-item feature list (items too short for 3-word anchors); moved the CTA
     cue off the last-20s zone. All reasonable — review on board.

### v2 cue pass (2026-07-18) — new 42-card catalog + routing rules

- Re-ran step 020 (Sonnet again, for comparability) after the card batch + specificity/repetition rules.
- **27 cues, 0 flagged**: 5 stat-hit (100 models / 70 presets / 240 avatars / 140 languages / 300 actors), 3 tool-intro + 2 section dividers (cap respected via substitution), 3 step-flow, 3 credits-math, persona-match payoff (5 beats), summary-table trimmed to the 4 fully-stated factor rows, callout styles varied. The v1 monotony (5x bullet-list + 5x identical callout) is gone.
- Validation/resolver caught 5 real errors across two rounds (3 beat anchors placed at/before their cue anchor — the monotonic cursor can't reach backward; 2 fullframe overlaps from heuristic holds). Fix loop: resolver errors + transcript snippets sent back to the SAME warm subagent (one small round), plus one negative-lead fix (c06 lead -1.1 — a single card's duration is catalog-fixed, so overlap resolves from the next cue's side).
- Learnings for the rulebook (future): beat anchors must come AFTER the cue anchor; single fullframe cards squeezed against a next cue can use negative lead.
- v1 cues.json remains in git history (committed 2026-07-18 before overwrite).

## Folded lessons

- 2026-07-18 — owner: 5 stat-hits in one video read as a tic → RULEBOOK+prompt: stat-hit max 3/video, ≥90s apart, keep the most impressive numbers. (First fold via steps/060.)
- 2026-07-18 — owner: no at-a-glance view of template mix → board header now shows per-card usage chips (red when >3).
- 2026-07-18 — owner: tools should show real logos/icons, text-only names click less → OPEN, needs design decisions (asset source, which cards) before building.
- 2026-07-18 — owner: lint banner has no dismiss and stays forever → board banners now carry a ✕ (client + server-rendered).
- 2026-07-18 — session: port-walk printed the STALE port in "board at" (failed listen()'s success callback stays registered and fires first) → resolve from server.address().port, not the closure.
