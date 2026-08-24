---
name: yt-video-edit-feedback
description: >-
  Close the loop on owner feedback for a yt-video-edit (visuals-flow) video: ingest,
  root-cause, discuss, then ONE summary for approval before any fix. Wraps the 130
  feedback-fold step; the five phases are in the skill body. Triggers on "feedback is
  done", "I'm done with feedback", "I've finished reviewing", "fold my feedback",
  "process my feedback", "done with the final cut review", "/yt-video-edit-feedback",
  "/visuals-flow-feedback" (the old name, still accepted).
user-invocable: true
---

# yt-video-edit-feedback — the feedback conversation

Renamed from `visuals-flow-feedback` on 2026-08-20. The pipeline folder is still
`pipelines/video/visuals-flow/`.

Run everything from `pipelines/video/visuals-flow/`.

The owner reviews a cut and leaves comments. This skill turns those comments into
**durable rule changes plus a new cut**, through a conversation rather than a
silent batch. The 130 step (`steps/130-learn-from-feedback-opus/README.md`) stays the
authority on *which surface owns a lesson*; this skill owns the conversation
around it and calls that procedure as its execution phase. Never restate 130's
surface-routing table here — read it at execute time so the two cannot drift.

## Hard gates (check before anything)

1. **Opus-class only.** 130 is an Opus-class step by owner decision (2026-07-18):
   folding feedback into durable rules is judgment work. If the current session
   is not Opus-class, say so and stop.
2. **Never skip the discussion.** Phases 2–4 are the point of this skill. Do not
   jump from "feedback is done" to editing files, however obvious a fix looks.
3. **One approval gate, and it is explicit.** No file changes before the owner
   approves the Phase 4 summary. "Sounds good" on a single item is not approval
   of the batch.
4. **Never edit rule surfaces mid-run of another video.** Rule changes go through
   this fold, not through an operating session.

## Phase 1 — Ingest (all five sources, always)

Never work from the board alone; four of the five sources are silent.

| Source | How to read it | Notes |
|---|---|---|
| Board comments | `node lib/feedback-status.mjs` (exit 1 = pending items) | Primary, and it counts EVERY board surface: Final Cut (`t`-keyed), storyboard and card-plan boxes (cue-keyed `c05` / `z03`), and the 037 gate's `card-body:N` / `zone-intro:N` items. Any of them may carry an `image` (an attached screenshot — **open it**, it usually names the card). |
| Template notes | `../card-library/card-notes.json` | The gallery's per-card Notes queue. Only act on notes with `done: false`. |
| Chat feedback | this conversation | Anything the owner said directly instead of typing on the board. Easy to lose — write it into the Phase 4 summary like any other item. |
| Implicit edits | `node lib/edit-delta.mjs <slug>` | 130's rule: the SAME kind of hand-edit 3+ times is a feedback item worth folding; one-off edits are instance fixes needing no rule. |
| Run ledger | `node lib/run-log.mjs <slug>` | Each step's `issues` field: what the session hit while running, recorded at the time. This is the source nobody thinks to open, and it holds problems the owner never saw a frame of — e.g. opusclip-vs-submagic's 010 entry logged four stray script notes read aloud, each needing an editorial decision rather than a pipeline fix. Triage them like any other item. |
| Intro film review (027) | `videos/<slug>/feedback.json` → `items` keys prefixed `intro:`; each carries `t` and `context: 'intro@MM:SS'` | The owner's timestamped notes on the intro film, watched in motion. Distinct from `final-*` items: an intro note is about the authored film, not the assembled cut, and it routes to a different rulebook (below). |

Then **map every item to what it actually points at**. Which half of this you
need depends on the key, so check the key first:

- **Cue-keyed** (`c05`, `z03`) and **gate-keyed** (`card-body:2`, `zone-intro:1`)
  items already name their target. They come from the storyboard tiles and the
  037 card plan. Do NOT put them through the timestamp lookup below — read the
  cue straight out of `cues.json`. The gate-keyed ones also carry a `context`
  block with the cue and card they were written against.
- **Timestamp-keyed** items (`t`, plus the `final-*` keys) come from the Final
  Cut player and name nothing. Only these need mapping:

```bash
node -e "
const r=require('./videos/<slug>/resolved.json').resolved;
const t=<timestamp>;
console.log(r.filter(q=>t>=q.start-3&&t<=q.start+q.duration+3).map(q=>q.id+' '+q.card).join(' | ')||'(no cue)');
"
```

**Map against the version the owner was watching, not the current one.** If cards
were remapped since that render, `resolved.json` lies to you. Check what the cue
was at that version:

```bash
git show <commit-of-that-version>:pipelines/video/visuals-flow/videos/<slug>/cues.json
```

This is not hypothetical: on test-01, three "remove this template" comments looked
like they pointed at `keyword-pop` in the current file. At the version reviewed,
two of them were `arrow-label` — already deleted — and only one was really about
keyword-pop. Acting on the current file would have deleted the wrong card.

## Phase 2 — Root cause, not symptom

For each item, find the mechanism. The owner describes what they SAW; the fold
needs why it happened. Write one line of RCA per item.

**Reproduce before you believe a diagnosis** — especially one inherited from a
handoff doc. A warning that looks like a stale leftover may be a live bug: the
`whip-reg-*` "unknown id" warnings were documented as "harmless leftover from a
card removal" and were in fact every register transition being silently dropped,
on every video, because `assemble.mjs` rebuilt its context without `conceptSpans`.

Recurring root-cause shapes in this pipeline — check these before inventing a new
theory:

- **Computed on one surface, never consumed on the next.** Found four times on
  2026-07-25 alone (register transitions dropped at assemble; the audit gate, now
  050, reading `resolved.cues` when resolve writes `resolved`; `resolvedKind` computed
  for panel while avatar-render hardcodes `avatar-full`; `register` linted but
  never merged into card variables). If a field exists, grep for its *consumer*.
- **Generated artifact stale vs its source.** `cue-pass-prompt.md` is generated
  from `cue-rules.mjs`; a rule edited without `node lib/build-prompt.mjs` never
  reaches the model that needs it.
- **A gate that has never fired.** A green gate is not evidence it works. Prove
  a gate can fail before trusting that it passed.
- **Invisible-not-broken.** The frame-step buttons were reported dead; they were
  correct, but the clock was `mm:ss`, so a 1/30s step showed no change anywhere.
  Ask "could the owner SEE this work?" before rewriting logic.

## Phase 3 — Discuss

The owner often asks questions inside the feedback ("why did this happen?",
"what's the long-term fix?", "what's the criteria for showing this?"). **Answer
them directly** — those questions are part of the deliverable, not noise around it.

Then propose the solve per item and let the owner push back. Bring:

- the root cause in one sentence;
- the surface you propose to change, and why that one (130's table decides);
- anything you cannot fix and why;
- any place two owner instructions conflict — surface it, do not silently pick.

Conflicts are real and must not be resolved unilaterally. On test-01 the owner
rejected `overlay/callout`, the session built `keyword-pop` as its replacement,
and the owner then rejected that too with "no need to have this **or
alternative**" — while the session had meanwhile expanded it from 6 uses to 9.
Ask; do not infer.

## Phase 4 — Summary and approval

One message. Every item, in a table:

| # | What you said | Root cause | Fix | Surface | Durable? |
|---|---|---|---|---|---|

Then, separately and plainly:

- **Rule changes** — what future videos will do differently.
- **Instance fixes** — this video only, no rule.
- **Routed to a plan** — architectural items (see Phase 5), with the plan number.
- **Not fixing** — with the reason.
- **Open questions** — anything still blocking.

End by asking for approval to proceed. Stop. Do not edit files yet.

## Phase 5 — Execute (only after approval)

Follow `steps/130-learn-from-feedback-opus/README.md` for surface routing. On top of it:

### Mark BOTH files, or the gate lies

A fix is recorded in two places and they are not the same thing:

- `claude_status.json` (via `node lib/post-status.mjs <slug> '<json>'`) — drives
  the board's green check-offs. **Cosmetic.**
- `feedback.json` — each item needs `applied` and/or `folded`. **This is what
  `feedback-status.mjs` reads, and what gates every later LLM pass.**

Writing only the first is a split brain: the board shows 20 green ticks while the
gate stays red and blocks the next video. That is exactly what happened after
test-01 round 1 — and because the handoff said "all comments fixed", ten later
comments sat untriaged behind a green-looking board.

### Architectural items → a plan, not a heroic inline fix

**Intro items route to intro-owned rules.** A durable fix for an `intro:*` item
is written to `TASTE-INTRO.md` (a new numbered `T<N>` rule) or to
`steps/025-author-intro-film-llm/AUTHORING.md` when it changes the authoring
contract itself. It is **never** written to `lib/cue-rules.mjs`,
`lib/zone-rules.mjs`, `lib/zone-constants.mjs`, or `../card-library/DESIGN.md`.
Those govern the body and the shared brand; an intro lesson landing there
changes what every non-intro video renders, which is the same wall
`no-template-contamination.test.mjs` defends from the other side.

**And the reverse:** body or final-cut items never edit `TASTE-INTRO.md`.

**If an intro item genuinely implies a brand change** (a palette or type-scale
rule in `DESIGN.md`), that is not an intro fold — surface it to the owner as its
own decision, because it changes every card in the library.

If the honest fix is structural, do not half-build it in-session. Route it:
`orchestrate` writes a self-contained plan into `plans/`, then `/secretary raise`
opens a `boss:ready` PR. Say in the summary which items went that way.

Precedent for why: plan 145 was closed `boss:done` with one step of five
implemented, and the gaps only surfaced months later when someone tried to use
the feature. A plan that is honestly TODO beats a feature that is dishonestly
done.

### Verify data → pixels, never per-surface

`plans/runs/LESSONS.md` (2026-07-24): *"lint validated the field while the
renderer never received it. Test the full path data→pixels, not per-surface."*
A rule edit is not done when the linter accepts it — it is done when the change
reaches the frame. Extract a frame and look.

### Re-cut

Apply fixes, then land a new version on the Final Cut tab. Re-render only what
changed:

```bash
node lib/render.mjs <slug> --only <cueId>   # ~22s per card
bash run.sh <slug> assemble                 # cached segments are reused
```

Full `bash run.sh <slug> cut` re-renders every card (~20s each, no skip-if-exists)
— use it only when most cards changed. Measured on a 5-minute video: a one-card
copy fix is ~30-60s end to end; adding or removing a cue shifts the segment plan
and costs a near-full re-assemble.

### Gates before handing back

```bash
node lib/check-rulebook.mjs          # generated prompt matches its source
node lib/feedback-status.mjs         # exit 0 — every item marked
bash scripts/check.sh                # the visuals-flow gate
```

Then append to `tests/TESTS.md`: one dated line per lesson under **Folded
lessons** (feedback → which rule), and one **Convergence** metrics line for the
video. Falling `edited` and `typed` counts video-over-video is the trend that
matters.

Finally, report: the new version, what changed, and what you deliberately did not.

## Anti-patterns

- Reading the board and skipping the other three sources.
- Mapping a comment against the current `resolved.json` when it was written about
  an older version.
- Treating a repeated owner rejection as three separate one-off complaints
  instead of one standing rule.
- Marking `claude_status.json` and calling it folded.
- "Fixed" meaning a gate went green, with nobody looking at a frame.
- Deleting a card because one comment said so, without checking what that comment
  pointed at in the version under review.
