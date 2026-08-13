# AI Agent System Design — learning notes

Personal study notes. Written as chapters, in the order they were learned.

**Started:** 2026-08-10
**Format:** one concept per chapter, each with a worked example from my own YouTube pipeline so it stays concrete.

---

## The one-line summary of everything here

> The model decides. The harness does. Everything you call "an AI agent" is the harness.

---

## Chapters

| # | Chapter | Core idea |
|---|---|---|
| 01 | [Model vs agent vs harness](01-model-vs-agent-vs-harness.md) | A model is a mouth. An agent is a model plus hands and a loop. |
| 02 | [The agent loop](02-the-agent-loop.md) | An agent is a `while` loop around `stop_reason`. Full wire-level walkthrough. |
| 03 | [The two channels](03-two-channels.md) | Text the model sees (persuasion) vs code it never sees (law). |
| 04 | [How the Claude Code harness works](04-claude-code-harness.md) | Fixed machine + dynamic loading. Not generated per task. |
| 05 | [Comparing harnesses (Codex vs Claude Code)](05-harness-comparison.md) | Same model, different harness = different agent. |
| 06 | [Tool surface design](06-tool-surface-design.md) | The description IS the API. Errors should teach. |
| 07 | [Orchestration topologies](07-orchestration-topologies.md) | Five shapes and how to pick. The actual "system design". |
| 08 | [Prompt injection](08-prompt-injection.md) | Unsolved. Design for containment, not prevention. |
| 09 | [Evals](09-evals.md) | Without them you're guessing. N≥5 runs or it means nothing. |
| 10 | [Memory architecture](10-memory-architecture.md) | Episodic vs semantic. You probably don't need a vector DB. |

---

## Still to cover

| Topic | The question it answers |
|---|---|
| Cost engineering | Prompt caching, model tiering, token budgets |
| Observability | Traces, spans, replay, debugging non-determinism |
| Deployment runtime | Queues, workers, long-running jobs, session resume |
| Human-in-the-loop | Where to interrupt, approval fatigue, blast radius |
| Product surface | Streaming, narration, interruption, trust |
| Context engineering | (partly covered in 03, 10 — deserves its own chapter) |

---

## The project: `mini.py`

Everything here is meant to be built, not read. One project, five levels — a deliberately crappy clone of Claude Code.

| Level | Build | Teaches | Time |
|---|---|---|---|
| 1 | Terminal agent, one tool (`read_file`) | The loop, tool calling, statelessness | 3–4 hrs |
| 2 | Add bash / write / list, system prompt, confirm gate | Multi-tool, prompt design, Channel 2 | 4–5 hrs |
| 3 | FastAPI on the VPS, SQLite conversations, streaming | Deployment, state, long requests | 5–6 hrs |
| 4 | Queue + worker + Telegram ping, cron | Async, long-running jobs | 4–5 hrs |
| 5 | Token/cost logging + a 10-case eval file | Measurement | 4 hrs |

Then the second five:

| Level | Build | Chapter |
|---|---|---|
| 6 | Redesign tool descriptions, errors that teach, bounded results | 06 |
| 7 | Break it on purpose — 6 failure modes, one fix each | — |
| 8 | Add prompt caching + model tiering, measure the cost drop | — |
| 9 | Rebuild one task as orchestrator + workers, compare | 07 |
| 10 | Red-team your own agent, defend in Channel 2 | 08 |

---

## Exercises log

Tick these off as they're done.

- [ ] L1: `mini.py` with `read_file`, watch it call the tool
- [ ] L1b: build "Harness C" (no `view_image`) and watch it lie about success
- [ ] Ch06: rewrite `read_file` with all 5 tool-design rules
- [ ] Ch06: ask it to read a missing file, check it recovers in one turn
- [ ] Ch07: implement `delegate()` — 10 lines, unlocks fan-out
- [ ] Ch07: same task as single loop vs fan-out, compare turns/tokens/wall-clock
- [ ] Ch08: red-team with 5 payloads, add defences, re-run
- [ ] Ch09: `evals/research/cases.jsonl` with 3 trap cases
- [ ] Ch10: write `memory/voice.md`

---

## How to use these notes

Read a chapter, then do its exercise the same day. The concepts don't stick from reading — every one of them has a 15–60 minute build attached, and the build is where it lands.
