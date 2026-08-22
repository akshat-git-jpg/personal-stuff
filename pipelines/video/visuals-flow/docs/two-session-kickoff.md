# Two-session kickoff — intro track + main track

Copy-paste prompts for running the `intro` and `main` tracks as two Claude
sessions after step 050. The contract these enforce (why session A never runs
git, why there is only one board) is in
[PIPELINE.md → The two tracks, run as two sessions](../PIPELINE.md#the-two-tracks-run-as-two-sessions).

## Before you split — once, in either session

Both tracks need `concept.json`, so **050 must be done** before the split. And
the slug must already exist: `vreg ensure` writes to a shared registry, so
running it in two sessions at once is a race.

```bash
cd pipelines/video/visuals-flow
bash run.sh <slug> status          # 050 done? both next: lines showing?
```

**Check the intro flow before you paste a Session A prompt.** `status` also
prints `intro flow: simple|complex` (plan 221) — the intro track's own step
numbers differ by mode, so the two Session A prompts below are NOT
interchangeable. Everything about Session B and the sequencing table stays
the same either way; only Session A's step range and gate numbers change.

Launch the board **once**, here, and leave it running. Both sessions review on
this one board — the Intro tab (`125` in `simple` mode, `120`/`150` in
`complex` mode) and the Storyboard tab (340):

```bash
bash run.sh <slug> board           # http://localhost:4322
```

Then open two Claude sessions and paste one prompt into each.

---

## Session A — the intro track

Two variants, mode-dependent (plan 221) — paste whichever `bash run.sh <slug>
status` reported as `intro flow:`. Everything else in this document
(Session B, the sequencing table, the troubleshooting notes) is the same for
both.

### Session A — `complex` mode

```
Use the yt-video-edit skill. Work on <slug>, INTRO TRACK ONLY (complex mode).

Run steps 110 → 160 (intro idea, gate, screenplay, frame review, gate, render).
Check your lane with:  bash run.sh <slug> status --track intro

Rules for this session, because the main track is running in a second session
on the same workdir right now:

1. NEVER run git. No add, no commit, no push. Everything you write lives under
   videos/<slug>/intro-film/ and the other session commits it.
2. NEVER launch a board. One is already running at http://localhost:4322 —
   just print that URL with ?video=<slug> when you need me to review.
3. NEVER touch cues.json, shots.json, card-plan.json, resolved.json or
   anything under card-library/. Those belong to the other session.
4. While a gate of yours is open on the board (120, 150), write NOTHING —
   the board is writing approvals into the same files.
5. STOP AT 160. Do not run 440 — the shipping intro encode needs the real
   avatar from 430, which the other session owns. Tell me when 160 is done
   and then stand by.

Close every -llm step in the ledger as you go (node lib/run-log.mjs <slug>
<step> done --did .. --issues .. --output ..).
```

### Session A — `simple` mode

```
Use the yt-video-edit skill. Work on <slug>, INTRO TRACK ONLY (simple mode).

Run steps 115 → 135 (author the cut list, gate, render). The cards are LOCKED
(pipelines/video/intro-kit/) — pick and fill, never design.
Check your lane with:  bash run.sh <slug> status --track intro

Rules for this session, because the main track is running in a second session
on the same workdir right now:

1. NEVER run git. No add, no commit, no push. Everything you write lives under
   videos/<slug>/intro-simple/ and the other session commits it.
2. NEVER launch a board. One is already running at http://localhost:4322 —
   just print that URL with ?video=<slug> when you need me to review.
3. NEVER touch cues.json, shots.json, card-plan.json, resolved.json or
   anything under card-library/. Those belong to the other session.
4. While your gate (125) is open on the board, write NOTHING — the board is
   writing the approval into intro-simple/cutlist.json.
5. STOP AT 135. Do not run 445 — the real-avatar re-render needs 430, which
   the other session owns. Tell me when 135 is done and then stand by.

Close every -llm step in the ledger as you go (node lib/run-log.mjs <slug>
<step> done --did .. --issues .. --output ..).
```

---

## Session B — the main track (body + conclusion)

```
Use the yt-video-edit skill. Work on <slug>, MAIN TRACK.

Run steps 210 onward (body cues, conclusion cues, cue-plan review, card plan,
build cards, sync, shot pass, storyboard, render, avatar, cut, deliver).
Check your lane with:  bash run.sh <slug> status --track main

Rules for this session, because the intro track is running in a second session
on the same workdir right now:

1. You are the ONLY session that runs git. When you commit, the intro
   session's files under videos/<slug>/intro-film/ come along — that is
   intended. Never `git checkout`/`git restore` anything under intro-film/.
2. NEVER launch a board. One is already running at http://localhost:4322.
3. NEVER touch anything under videos/<slug>/intro-film/ or
   videos/<slug>/intro-simple/. Both are the other session's lane — which one
   exists depends on the intro flow, but stay out of either.
4. While a gate of yours is open on the board (340, 420, 530), write NOTHING.
5. You will block at 510 (assemble) until the intro session's gate is approved
   (150 in complex mode, 125 in simple mode) — requireIntroApproved() enforces
   it, mode-blind. That is expected, not a bug. The real-avatar re-render is
   YOURS and runs after 430: 440 in complex mode, 445 in simple mode.

Close every -llm step in the ledger as you go.
```

---

## Sequencing the gates

The owner is the bottleneck, not compute. Both sessions blocking on a review at
the same time means zero speedup, so order it. `complex` mode:

| When | Owner does | Meanwhile |
|---|---|---|
| immediately after the split | **120** intro idea — a page of prose, ~2 min | session B starts 210 |
| the long unattended stretch | nothing | A: 130 screenplay + 140 frames · B: 210 → 330 |
| both land together | **150** intro film, **340** storyboard | — |
| after B renders | **420** avatar spend gate | A is finished at 160 |
| last | **530** final cut | — |

`simple` mode has one intro gate instead of two, so it lands with the
storyboard rather than before it:

| When | Owner does | Meanwhile |
|---|---|---|
| the long unattended stretch | nothing | A: 115 author the cut list · B: 210 → 330 |
| both land together | **125** intro (player + beat table), **340** storyboard | — |
| after B renders | **420** avatar spend gate | A is finished at 135 |
| last | **530** final cut | — |

## If something looks wrong

- **Two different board URLs (4322 and 4323).** Someone launched a second
  board. Kill the 4323 one; 4322 is where the other session's gate lives.
- **A step vanished from the Run tab.** Should no longer happen —
  `updateRunLog()` merges. If it does, re-record it and note it as a bug.
- **`git status` shows the other session's half-written file.** Expected while
  it works. Only session B commits, and only when its own step is finished.
