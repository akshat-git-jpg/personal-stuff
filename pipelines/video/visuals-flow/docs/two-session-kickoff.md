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

Launch the board **once**, here, and leave it running. Both sessions review on
this one board — the Intro tab (120/150) and the Storyboard tab (340):

```bash
bash run.sh <slug> board           # http://localhost:4322
```

Then open two Claude sessions and paste one prompt into each.

---

## Session A — the intro track

```
Use the visuals-flow skill. Work on <slug>, INTRO TRACK ONLY.

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

---

## Session B — the main track (body + conclusion)

```
Use the visuals-flow skill. Work on <slug>, MAIN TRACK.

Run steps 210 onward (body cues, conclusion cues, cue-plan review, card plan,
build cards, sync, shot pass, storyboard, render, avatar, cut, deliver).
Check your lane with:  bash run.sh <slug> status --track main

Rules for this session, because the intro track is running in a second session
on the same workdir right now:

1. You are the ONLY session that runs git. When you commit, the intro
   session's files under videos/<slug>/intro-film/ come along — that is
   intended. Never `git checkout`/`git restore` anything under intro-film/.
2. NEVER launch a board. One is already running at http://localhost:4322.
3. NEVER touch anything under videos/<slug>/intro-film/. That is the other
   session's lane.
4. While a gate of yours is open on the board (340, 420, 530), write NOTHING.
5. You will block at 510 (assemble) until the intro session's 150 gate is
   approved — requireIntroApproved() enforces it. That is expected, not a bug.
   440 (re-render the intro with the real avatar) is YOURS, and runs after 430.

Close every -llm step in the ledger as you go.
```

---

## Sequencing the gates

The owner is the bottleneck, not compute. Both sessions blocking on a review at
the same time means zero speedup, so order it:

| When | Owner does | Meanwhile |
|---|---|---|
| immediately after the split | **120** intro idea — a page of prose, ~2 min | session B starts 210 |
| the long unattended stretch | nothing | A: 130 screenplay + 140 frames · B: 210 → 330 |
| both land together | **150** intro film, **340** storyboard | — |
| after B renders | **420** avatar spend gate | A is finished at 160 |
| last | **530** final cut | — |

## If something looks wrong

- **Two different board URLs (4322 and 4323).** Someone launched a second
  board. Kill the 4323 one; 4322 is where the other session's gate lives.
- **A step vanished from the Run tab.** Should no longer happen —
  `updateRunLog()` merges. If it does, re-record it and note it as a bug.
- **`git status` shows the other session's half-written file.** Expected while
  it works. Only session B commits, and only when its own step is finished.
