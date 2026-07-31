# Shot-pass rulebook (step 060)

Judgment rules for choosing full-screen avatar spans. The quantitative half is
machine-enforced by `lib/lint-shots.mjs`, whose constants live in
`lib/shot-constants.mjs` (the single source for numbers); this file owns the
qualitative half. Edit this file and `shot-pass-prompt.md` together — same
convention as 020's pair.

## The model (fixed by design, don't re-litigate)

- The full-screen host spans this pass plans are the video's ONLY avatar
  presence. There is no corner-bubble baseline: the owner rejected it on the
  first assembled cut ("I don't want bubble", 2026-07-31) — screen recording
  stands on its own between host moments. (The corner machinery still exists
  but is off by default everywhere.)
- **Modes**: "full" (default) cuts out the background and shows the host full-screen.
  "panel" composites them in a pip over the screen. Use "panel" for situations where
  the screen must stay visible without the avatar obscuring too much of it
  (e.g. detailed charts, complex code).
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
5. **Cadence beats** — SHORT mid-video host moments (10–30s: a one-line verdict,
   a reaction, a "here's what surprised me") so no stretch runs longer than the
   lint cadence gap (`GAP_AVATAR_MAX` in lint-shots.mjs) without the host
   full-screen. Owner rule 2026-07-18: the host returns periodically, not just
   at the ends. Keep them brief — they share the same total budget.

Lean demo middle still applies WITHIN the cadence: when narration walks the
screen ("click", "open", "type", "select"), the screen recording IS the shot —
place cadence beats at natural pauses (a verdict, a transition between tools),
never over hands-on narration.

## Anchors

- `from_anchor` = the first words of the span; `to_anchor` = the last words.
  Both verbatim from the transcript, ≥3 words, in transcript order
  (forward-cursor matching, same semantics as cue anchors).
- ASR garbles are quoted verbatim ("Heigen" stays "Heigen") — same rule as 020.
- Span boundaries sit ON sentence starts/ends — a mid-sentence camera cut reads
  as a jump. Hard rule since 2026-07-31 (owner final-v1:4, s03 shipped starting
  mid-sentence under the old "prefer"): lint E7 rejects any span whose start is
  not a sentence start or whose end is not a sentence end.

## Output contract

- Spans in transcript order, ids `s01, s02, …`, `purpose: "avatar-full"` only
  (renamed from `kind` 2026-07-31 — purpose says what the rendered file is FOR;
  `mode` says how it is laid out on screen).
  Include `mode: "full"` or `mode: "side"` for each span ("panel" validates but
  is not currently planned).
- `note` — one short line saying why this span is host-worthy (the owner reads
  it on the board).
- A span you want but can't place cleanly: `flagged: true` + note, don't force it.
- `engineMode` stays `"test"` until the owner explicitly flips it (owner gate,
  2026-07-18 — production requires heygen-web work that doesn't exist yet).

## Learnings — grows via the 060 feedback fold

| Date | What we learned | Rule / knob change |
|------|-----------------|--------------------|
| 2026-07-18 | (seed — fill from the first owner review) | — |
| 2026-07-18 | Owner: the video must not run long stretches with no full-screen host — periodic presence, not only the U-curve ends | Priority item 5 rewritten from "mid-demo = last resort" to cadence beats; `GAP_AVATAR_MAX = 300` + W4 span-cadence warning added to lint-shots.mjs |
| 2026-07-20 | Owner adopted the Youri reference RHYTHM (many short bridges, fast host↔content cycle) while keeping the cost-driven total budget | SPAN_MIN 12→10, W1 split mid 45s / zone 120s (was flat 150s), GAP_AVATAR_MAX 300→180; cap/target unchanged; prompt rules 3–4 rewritten |
