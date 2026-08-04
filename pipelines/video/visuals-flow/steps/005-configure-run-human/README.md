# 005 · configure the run · [OWNER]

The owner's kickoff choices for this video, made ONCE at the start and recorded
in `videos/<slug>/run-config.json`. Everything downstream reads this file — the
owner never has to restate the choices mid-flow, and a session never has to
guess them.

- **In:** the owner's answers to two questions (below)
- **Out:** `videos/<slug>/run-config.json`
- **Skip when:** the owner starts the flow without stating preferences AND
  doesn't answer when asked — then no file is written and the defaults apply
  (heygen3 + full review), which is exactly the pre-005 behavior.
- **Next:** `run.sh <slug> transcribe` (step 010)

## The two questions

Ask the owner at kickoff (or read the answers straight out of their opening
message — "run it till final cut on heygen 3" answers both):

1. **Engine** — `heygen3` (Avatar III, free unlimited; the default) or
   `heygen4` (Avatar IV, METERED against the monthly second-pool).
   Writing `heygen4` here IS the owner's explicit authorization for this
   video's avatar batches — sessions don't re-ask per submit. Before any
   heygen4 batch still check `heygen-web limits` covers the span total.
2. **Review mode** — `full` (every owner gate stops the flow: 037 card plan,
   080 storyboard, 120 final cut; the default) or `express` (the flow runs
   unattended to the final cut).

```bash
bash run.sh <slug> configure --engine heygen4 --review express   # set
bash run.sh <slug> configure                                     # show
```

## What express does and does NOT skip

Express waives exactly two board approvals — the code gates read the config
(`lib/run-config.mjs` `gateWaived()`), print a note, and proceed:

| Gate | full | express |
|---|---|---|
| 037 card plan approval (render refuses) | stops | **waived** |
| 080 storyboard approval, cues + shots (render/avatar/assemble refuse) | stops | **waived** |
| **New-card look-preview** (Gemini/Flow prompts → owner verdict BEFORE building any new card — DESIGN.md checklist item 0) | stops | **STOPS — never waived** |
| 120 final cut approval (full-res final refuses) | stops | **stops — never waived** |

The look-preview exception is the owner's standing rule (2026-08-01, restated
from 2026-07-31): *"even if I say run till final cut, if you are making new
motion graphics I still want the prompt so I can review and approve."* It is a
conversation gate, not a board gate — express changes nothing about it. A
session in express mode that reaches 038 with `status: "new"` cards MUST stop,
hand the owner the preview prompts, and wait for the verdict before writing
any card code.

## Engine consistency

`shots.json`'s `engineMode` is the mechanical spelling of the engine choice
(`heygen3` ⇔ `"test"`, `heygen4` ⇔ `"production"`). The session sets it from
run-config when authoring shots at 060. avatar-render refuses to submit when
the two disagree, so drift is caught before any metered spend.

## Changing your mind mid-flow

Re-run `configure` with the new value any time. Engine changes after avatar
submission mean re-submitting spans (and re-spending, if heygen4) — the
`--engine` flag on `lib/avatar-render.mjs` overrides a single submit run
without touching the config.
