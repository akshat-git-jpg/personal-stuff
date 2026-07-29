# 035 · pick or propose intro + outro · [LLM] (Sonnet default; same pluggability as 030)

Author the graphics for the **intro and the conclusion only**. These two zones
are the ones the owner judges hardest, so they get their own pass, their own
rulebook, and their own numbers — nothing here is shared with the body.

- **In:** `node lib/transcript-text.mjs <slug>` output, `card-library/catalog.json`,
  and the measured zone spans from `segments.json`'s `structure` field
  (written by `lib/source-structure.mjs` from the three source recordings)
- **Out:** zone cues appended into `videos/<slug>/cues.json`, each carrying a
  `zone` field of `"intro"` or `"conclusion"` → snapshot the converged output to
  `cues.zones.llm.json` (committed, immutable) before any owner edit
- **Pre-flight:** `node lib/feedback-status.mjs` must exit 0, and
  `segments.json` must carry a `structure` block — without measured spans there
  are no zones to author and this step has nothing to do
- **Run:** paste **the prompt only** (`zone-pass-prompt.md`, placeholders filled)
  into the executor. Fill `{{CATALOG}}` with `card-library/catalog.json`,
  `{{TRANSCRIPT}}` with `node lib/transcript-text.mjs <slug>`, and
  `{{STRUCTURE}}` with the `structure` array from `segments.json`.
- **Next:** `run.sh <slug> validate`, then the 037 card-plan gate (which covers
  body and zone cues together), then 038 if anything came out NEW, then 040 syncs
  every cue — body and zone alike — into absolute times.

## Why this is its own step

The body pass (030) and this pass are deliberately separate programs reading
separate rulebooks (`lib/zone-rules.mjs` + `lib/zone-constants.mjs` here;
`lib/cue-rules.mjs` + `lib/cue-constants.mjs` there). That split is the point:
a lesson folded from an intro review changes the zone rulebook and can never
drift the body's pacing, and the reverse. Owner decision 2026-07-29 — *"i want
intro conclusion steps to be very explicit and not tied with full body.. its
rules, guildeliness, execution should be seprate"*.

Either pass can be re-run on its own. Re-running the zone pass replaces cues
carrying a `zone` field and leaves body cues untouched.

## The bar is motion, not count

The rejected test-03 intro ran **3.57 cues/min against a 2.30/min body** — it
was already denser than the body and still read flat, because 3 of its 4
fullframe cards were text slates and 20 consecutive seconds of footage
underneath never moved. So the zone rules raise the **motion** floor
(`W16 zone-motion`), tighten the **dead-patch** limit (`W15 zone-gap`), and
measure the **footage itself** (`W18 zone-still`); `W17 zone-rate` is only a
regression floor. Do not treat it as a target to pad toward.

## Fix-loop

```bash
node lib/resolve.mjs <slug> && node lib/lint-cues.mjs <slug>   # W15/W16/W17/W19
node lib/stillness.mjs <slug>                                  # W18 (reads footage)
```

Feed errors back to the same executor, ≤3 rounds; anything surviving round 3
goes to the owner. `W18` needs `screen.mp4` present — on a `base: "none"` video
it reports *not applicable* rather than passing silently.

## Cards

There is ONE shared card collection. No card is reserved for a zone and none is
forbidden in one — choose on merit. Commissioning a **new** card for a zone is
an expected outcome: name the slug you would build, describe it in a `propose`
object, and the owner approves or kills it at step 037 — step 038 then builds
what survived, before anything renders. New zone cards join the shared
collection and become available to the body too.
