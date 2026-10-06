---
name: personal-stuff-research-methodology
description: Sets how a hunch (new tool, engine, migration, approach) earns its way into personal-stuff: check the record, run a cheap falsifiable test, record the verdict, then adopt, defer or archive. Holds measurement recipes (bake-offs, budget spikes, fixture re-checks) and the evidence bar a claim must clear. Use when tempted to build first and validate later; triggers on "should we switch", "de-risk this", "run a PoC", "benchmark this".
---

# Research methodology — from hunch to accepted change

## Overview

How an idea earns its way into this repo. The through-line: **cheap falsifiable test first, verdict on record, adoption is a separate owner decision.** A validated finding sitting in "deferred" is the system working, not failing.

## The lifecycle

1. **Idea** — from anywhere (see "Where good ideas came from" below).
2. **Check the record first** — **personal-stuff-failure-archaeology** (was it tried?), `decisions.md` (was it decided?), and `plans/README.md` "Findings considered and rejected" + "Findings NOT turned into plans" (was it audited?). Don't re-fight settled battles; re-opening one needs new evidence + an owner decision.
3. **Cheap de-risk test** — isolate the ONE unproven assumption and pose a falsifiable question it can answer in hours, not a build. No system construction before the assumption survives.
4. **Verdict recorded** — a dated `decisions.md` line (or a plans/README batch/rejected note): what was asked, what happened, what's decided. Unrecorded verdicts get re-litigated.
5. **Disposition** — one of three, all first-class:
   - **Adopt** — route through change control: plan in `plans/` (via `orchestrate`), raised by `secretary`, landed by boss. Never straight from PoC to production.
   - **Defer** — validated but not adopted, with the revisit condition on record. **Deferral is a status, not a failure** (fal-lipsync passed its test and still waits for the owner).
   - **Archive** — superseded or concluded work moves to an `archive/` folder with a pointer to the live successor, kept for reference (`pipelines/archive/rvc-flow/`, `pipelines/archive/hyperframes-vs-remotion/`).

## The evidence bar

- **De-risk before build.** Test the one unproven assumption, not the whole system. fal-lipsync tested lip-sync quality on a real pose clip before any avatar CLI existed; the CLI is still unbuilt because adoption is deferred.
- **State expectations before running.** Where numbers exist, write the predicted number down first; a root-cause verdict must explain ALL observations before the fix ships (yt-dlp 429s: one mechanism — 153 unauthenticated fetches from one home IP on a 4-month-stale binary — accounted for everything, then the fix followed).
- **Subjective outputs need an explicit rubric** written into the plan; the verifier scores against it, never taste. "Until satisfied" is not a stop condition. (orchestrate v2.2, decisions.md 2026-07-05.)
- **Verification runs in a fresh context, not the author's.** Landing goes through greenlight's gate (deterministic verify; LLM review opt-in via `--review`), and orchestrate's verifier scores against the plan's rubric — the author never grades its own work. See **personal-stuff-validation-and-qa**.
- **Overrides of settled findings are explicit and owner-made, never silent.** Recorded with the conflict shown and a mitigation attached. Model: plan 047 knowingly overrode the "keep Antigravity out of the graphics path" verdict for explainer step 020, with mandatory render + visual inspection + a human review gate baked in (decisions.md 2026-07-07). If quality problems recur, that's the signal to revisit the override — not to route around it.

## Proof and analysis recipes — measure, don't eyeball

First-principles measurement recipes for when a decision hangs on a number. Each is a reusable method; the example is one compact illustration from this repo's history.

### Bake-off with a fixed metric before adopting an engine

- **When:** choosing among competing engines/models/tools where quality and throughput both matter, and the temptation is to pick from reputation or a single demo.
- **Method:** wire every candidate behind the SAME interface contract, feed all of them the SAME fixed input, and measure one pre-defined comparable number per candidate. Record a one-line verdict for every candidate, including the rejects — a bake-off with only the winner's row is a demo, not a bake-off. The number decides placement, not just winner/loser.
- **Example:** the TTS engine bake-off (`pipelines/video/tts/CLAUDE.md`). Four engines wired to the same `synth.py <segments.json> <out_dir>` contract, all run on the same 2.6-min sample transcript on the owner's Mac (Apple Silicon, MPS). Metric: **RTF (real-time factor) = compute time ÷ audio length; lower is better, >1 means slower than real time.** Results: IndexTTS-2 RTF 32.7 (unusable locally); OmniVoice ~1.4× realtime, human-sounding; Kokoro rejected on quality (robotic); Qwen3-TTS 1.7B ~20–30× realtime (unusable without GPU), 0.6B garbled. IndexTTS-2 was still CHOSEN — on quality + true emotion control — and its RTF 32.7 dictated *where it runs*: Modal GPU (`modal/indextts2_app.py`), with OmniVoice kept as the no-GPU fallback. The measurement didn't kill the engine; it forced the deployment decision.

### Fixed-budget validation spike with expected numbers stated up front

- **When:** a paid unknown (API quality, per-unit cost) blocks a build decision and "just build it and see" would spend real money on an unproven assumption.
- **Method:** set a hard budget. BEFORE spending, write down the expected numbers and the decision rule, including the escalation ladder if the cheap tier fails. Run the smallest test first. Record actuals vs expected and the verdict — and remember the verdict is input to a separate adoption decision, not the adoption itself.
- **Example:** the fal-lipsync spike (`pipelines/video/heygen/fal-lipsync/README.md`). Budget: $10 of fal credit. Written up front: expected spend $5–10, expected output cost ~$0.30–0.40/min vs HeyGen's $1/min, decision rule ("if LatentSync looks clean on the owner's faces, the problem is solved…") plus the escalation ladder (lipsync-2-pro, then sync-3). Actuals: ~$2.40 of the $10 spent; LatentSync stayed in sync on the stylized side-view face across 624 frames with zero face-detection failures and held the pose — the biggest risk, passed 2026-07-11. Then the owner **deferred it anyway** (decisions.md 2026-07-12: HeyGen stays; no CLI, no migration until revisited). Validation ≠ adoption — the spike's job was to make the deferral an informed one.

### Fixture-based re-verification of stale claims

- **When:** a ledger row, status field, or doc claim might be stale — it asserts a state ("TODO", "costs $2", "broken") that nobody has re-checked against reality.
- **Method:** don't trust the row and don't trust memory. Re-run the smallest artifact that would prove or refute the claim — a fixture, a smoke command, a probe — and let its output arbitrate. Then fix the record, stamping the verification date and what reproduced.
- **Example:** plan 011 (`plans/011-tutorial-pipeline-v3.md`) sat as TODO in the `plans/README.md` ledger. A 2026-07-12 fixture check reproduced the expected values — the 125 fixture emitted 1.11/1.00/flag, steps 105/125/162 were implemented, 040 emits the segment map — so the row flipped to DONE with the finding on record: "row was stale — executor never flipped it", plus the named open remnants (135 rulebook stub, 162 overlay passes pending HeyGen downloads). The fixture was the proof; the ledger row was just a claim. Same pattern in reverse: the "$2/video TTS" figure in final-workflow notes was a stale placeholder until re-checked — real number ~$0.50 (decisions.md 2026-07-12).

### What must be proven before a claim ships

The evidence bar for any statement that leaves a session — in docs, skills, `decisions.md`, or a published/monetized artifact:

- **A claim needs a runnable verification command or a dated measurement behind it.** If neither exists, it isn't a claim yet — it's a hunch, and it ships labeled as one.
- **Costs and metrics carry "as of DATE"** (or point at a dated decisions.md/manifest line). Prices, RTFs, and API behavior drift; an undated number is a future stale-claim incident.
- **Unproven things ship only as labeled open / candidate / deferred** — never phrased as fact. (fal-lipsync ships everywhere as "validated replacement, deferred", not "our avatar pipeline".)
- **"Root cause" may only be claimed when one mechanism explains ALL observations, including the negatives** — see "State expectations before running" in the evidence bar above (the yt-dlp 429 hunt is the model).
- The mechanics of HOW to verify — the verification ladder (build → tests → smoke → live probe), fresh-context review, greenlight's gate — live in **personal-stuff-validation-and-qa**. This subsection sets the bar a claim must clear; that skill supplies the rungs.

## Worked examples

The hunch-to-verdict cases (fal-lipsync, agy sweep, gemini CLI, hyperframes-vs-remotion, Devsplainers PoC, yt-dlp 429s, kunchenguid stack) live in **personal-stuff-failure-archaeology** under "Research verdicts". Add a new row there once a hunch completes the lifecycle and its decisions.md entry exists.

## Where good ideas came from here

- **Studying working external stacks in source** — the whole 033–038 batch came from reading kunchenguid's tools, not their READMEs.
- **improve/audit runs** — plans/README.md's deferred + rejected findings sections are audit output; the tracker person-centric revamp (plans 014–017) came from a focused audit (decisions.md 2026-07-05).
- **Incident postmortems** — the branch-guard hook from the 054/055 shared-checkout tangle (2026-07-10; since replaced by the `pp-work` workspace walls); enforced dirty-main check from two silently parked batches (2026-07-08); plan 057's silent-failure alerts after my-planner's refresh token failed silently for a month (decisions.md 2026-07-06).
- **Owner's operating pain** — captain v2 from hitting the 3-parallel-features wall; `tooling/cli/notify` because ntfy pushes didn't reach the owner's iPhone (ntfy retired 2026-08-30); the tracker pipeline engine from "had to do multiple redo" (all in decisions.md / failure-archaeology).

## When NOT to use this skill

- "Was this already tried/rejected/superseded?" → **personal-stuff-failure-archaeology**
- The video/TTS domain constraints and settled engine decisions themselves → `pipelines/video/CLAUDE.md`
- Gates for adopting/landing the change (plans/ file or inline, secretary raise, boss, deploy gate) → **personal-stuff-change-control**
- Verification mechanics and test culture — the verification ladder, "is this specific change done/correct?", fresh-context review → **personal-stuff-validation-and-qa**
- The full route from idea to shipped product → **personal-stuff-idea-to-shipped**
