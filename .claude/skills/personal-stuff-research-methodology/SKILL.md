---
name: personal-stuff-research-methodology
description: Use when a hunch (new tool, engine, migration, approach) must earn its way into personal-stuff, when tempted to build first and validate later, or when a claim/metric needs proof before it ships. Houses measurement recipes (bake-offs, budget spikes, fixture re-checks) and the evidence bar. Triggers on "should we switch", "de-risk this", "run a PoC", "benchmark this".
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

## Worked examples (all verified 2026-07-12)

| Case | Question asked | Test run | Verdict | Recorded |
|---|---|---|---|---|
| fal-lipsync | Can Kling base loop + fal LatentSync replace HeyGen's $1/min avatar? | De-risk lip-sync test on a real pose clip (~$0.30–0.40/min), passed 2026-07-11 | **Validated, DEFERRED** — HeyGen stays; no CLI, no migration until the owner revisits | `pipelines/video/heygen/fal-lipsync/`, decisions.md 2026-07-12 |
| agy capability sweep | Can Antigravity CLI safely be the headless executor lane? | Subagent-verified flag sweep (`--add-dir`, hidden `--output-format json`, `--print-timeout`); secrets-guard hook live-verified against a real agy attempt | Adopted as lane v2 defaults | decisions.md 2026-07-06 |
| gemini CLI scout | Is a gemini-headless lane viable? | Captain's first real scout run | DEAD (IneligibleTierError, Google cutoff) — lane + npm package removed the same day they were added; agy replaced it | decisions.md 2026-07-06 |
| hyperframes-vs-remotion | Which HTML→video approach for this repo? | Side-by-side experiment builds | HyperFrames path became the live tool (`video/card-library/`); experiment archived with a "don't build new work here" pointer | `pipelines/archive/hyperframes-vs-remotion/` |
| Devsplainers PoC | Can thin-kit + Antigravity produce graphics at quality? | PoC scored on four quality axes | Failed all four → "keep Antigravity out of the graphics path"; later explicitly overridden for one step with mitigation (plan 047, above) | decisions.md 2026-07-05 + 2026-07-07 |
| yt-dlp 429s | Why is YouTube blocking transcript fetches? | Root-cause hunt until one mechanism explained every observation | Self-update pre-flight + PO-token plugin; proxy named as agreed next escalation | decisions.md 2026-07-06 |
| kunchenguid stack | Adopt his agentic-workflow binaries? | Studied the working tools **in source** | **Adapt, don't adopt** — native `wt`/`greenlight`/`overnight`/`captain` builds; exactly one external piece adopted (lavish-axi transport for `/plan-review`) | plans/README.md 033–038 batch note, decisions.md 2026-07-06 |

## Where good ideas came from here

- **Studying working external stacks in source** — the whole 033–038 batch came from reading kunchenguid's tools, not their READMEs.
- **improve/audit runs** — plans/README.md's deferred + rejected findings sections are audit output; the tracker person-centric revamp (plans 014–017) came from a focused audit (decisions.md 2026-07-05).
- **Incident postmortems** — branch-guard hook from the 054/055 shared-checkout tangle (2026-07-10); enforced dirty-main check from two silently parked batches (2026-07-08); plan 057's silent-failure alerts after my-planner's refresh token failed silently for a month (decisions.md 2026-07-06).
- **Owner's operating pain** — captain v2 from hitting the 3-parallel-features wall; `tooling/cli/notify` because ntfy pushes didn't reach the owner's iPhone; the tracker pipeline engine from "had to do multiple redo" (all in decisions.md / failure-archaeology).

## When NOT to use this skill

- "Was this already tried/rejected/superseded?" → **personal-stuff-failure-archaeology**
- The video/TTS domain constraints and settled engine decisions themselves → **video-and-tts-reference**
- Gates for adopting/landing the change (plans/ file or inline, secretary raise, boss, deploy gate) → **personal-stuff-change-control**
- Verification mechanics and test culture — the verification ladder, "is this specific change done/correct?", fresh-context review → **personal-stuff-validation-and-qa**
- Evaluating an external tool/service/idea for fit against the owner's stack → the `scout` skill (verdict-first)
- The full route from idea to shipped product → **personal-stuff-idea-to-shipped**

## Provenance and maintenance

Authored 2026-07-12 from `decisions.md`, `plans/README.md` (batch notes + rejected/deferred findings sections), `pipelines/video/tts/CLAUDE.md`, `pipelines/video/heygen/CLAUDE.md` + `fal-lipsync/README.md`, and `pipelines/archive/`. Proof-and-analysis recipes + the claim evidence bar folded in 2026-07-12 (owner interview: this skill absorbed the "proof-and-analysis toolkit" and the ship-bar fragment of "external positioning"). All worked-example numbers spot-verified against those files on 2026-07-12.

Re-verify a recipe example before citing it (grep here is rtk-filtered; on "N matches in 0 files" rerun via `rtk proxy grep`):

- TTS bake-off: `rtk proxy grep -n "RTF" pipelines/video/tts/CLAUDE.md`
- fal-lipsync spike: `rtk proxy grep -n "624 frames" pipelines/video/heygen/fal-lipsync/README.md` and `rtk proxy grep -n "fal-lipsync deferred" decisions.md`
- plan-011 fixture flip: `rtk proxy grep -n "| 011 |" plans/README.md`
- Lifecycle cases: `rtk proxy grep -n "<keyword>" decisions.md` / `plans/README.md`

When a new hunch completes the lifecycle, add its row to the worked-examples table only after the decisions.md entry exists.
