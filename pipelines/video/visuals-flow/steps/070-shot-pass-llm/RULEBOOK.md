# Shot-pass rulebook (step 070)

Judgment rules for choosing full-screen avatar spans. The quantitative half is
machine-enforced by `lib/lint-shots.mjs` (constants at the top of that file are
the single source for numbers); this file owns the qualitative half. Edit this
file and `shot-pass-prompt.md` together — same convention as 020's pair.

## The model (fixed by design, don't re-litigate)

- A corner avatar over screen recording is the **baseline for the whole video**.
  A human is always on screen. This pass picks ONLY the full-screen host moments.
- Spans are planned AGAINST the approved graphics: never overlap a fullframe
  cue (lint E2). Overlay cards over a full-screen avatar are fine.
- Budget discipline comes from HeyGen 4 being metered at production
  (~$1/min): total full-screen time obeys the cap/target in lint-shots.mjs
  even while `engineMode: "test"` renders everything free on HeyGen 3 —
  a test plan must already be production-shaped.

## Where full-screen avatar goes (priority order — U-curve)

1. **Intro + pre-demo overview** — front-load; first claim on budget.
2. **Conclusion + summary framing** — back-load; land on the host.
3. **Each tool's/section's verdict** — shrinking as the video goes.
4. **Pricing / value wrap-up** — part of the back-load.
5. Still under target? Add back-loaded beats first; mid-demo beats are a last resort.

Lean demo middle: when narration walks the screen ("click", "open", "type",
"select"), the screen recording IS the shot — never claim it for the avatar.

## Anchors

- `from_anchor` = the first words of the span; `to_anchor` = the last words.
  Both verbatim from the transcript, ≥3 words, in transcript order
  (forward-cursor matching, same semantics as cue anchors).
- ASR garbles are quoted verbatim ("Heigen" stays "Heigen") — same rule as 020.
- Prefer span boundaries at sentence starts/ends — a mid-sentence camera cut
  reads as a jump.

## Output contract

- Spans in transcript order, ids `s01, s02, …`, `kind: "avatar-full"` only.
- `note` — one short line saying why this span is host-worthy (the owner reads
  it on the board).
- A span you want but can't place cleanly: `flagged: true` + note, don't force it.
- `engineMode` stays `"test"` until the owner explicitly flips it (owner gate,
  2026-07-18 — production requires heygen-web work that doesn't exist yet).

## Learnings — grows via the 060 feedback fold

| Date | What we learned | Rule / knob change |
|------|-----------------|--------------------|
| 2026-07-18 | (seed — fill from the first owner review) | — |
