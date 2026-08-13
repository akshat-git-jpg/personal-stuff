# 01 — Model vs agent vs harness

## The formula

```
agent = harness + model + tools + prompt
```

- **Model** — the brain. Text in, text out. Nothing else.
- **Harness** — the plumbing. The loop, tool execution, context assembly, permission checks, error handling. Pure code, no intelligence.
- **Agent** — the whole running system, pointed at a goal.

Car version: the harness is the chassis and steering linkage. The model is the engine. The agent is the car actually driving somewhere.

---

## The model is a stateless function

Text in → text out. No memory. No ability to touch files or the internet.

Every turn you send the **entire conversation again**. The model doesn't "remember" your last message — you re-upload it. When an agent seems to recall something from 20 messages back, it's because those 20 messages were re-sent on the current request.

Two proofs that model and agent are genuinely separate:

1. **Swap the brain.** `/model` in Claude Code switches Opus → Sonnet. Same agent, same tools, same CLAUDE.md. The harness didn't change.
2. **Take away the hands.** Call Sonnet directly via the API and it can't read a file, run a command, or remember yesterday. All the *doing* comes from the harness.

---

## Where the confusion lives: naming

"Claude" means three different things.

| Word | What it actually is |
|---|---|
| Claude | the model family (a brand) |
| Opus 5 / Sonnet 5 / Haiku | specific models — tiers within that family |
| Claude Code | the agent product — CLI, harness, tools, permissions |
| claude.ai | a different agent product, same models underneath |

Say it as: **Claude Code is the agent; Opus is the model it's currently driving.**

---

## "Agent" has a third meaning too

Same word, smaller scope — a **configured role** inside a harness:

- Claude Code's subagents (`Explore`, `general-purpose`)
- the `boss` executors in personal-stuff

Those aren't separate harnesses. Same harness, launched with a different prompt, tool subset, and model. "Spawn 3 agents" = 3 configured roles, not 3 pieces of infrastructure.

| Term | Scope | Synonyms |
|---|---|---|
| Harness | the plumbing | runtime, scaffold, framework, "the loop" |
| Agent (system) | harness + model + tools + prompt | the product |
| Agent (role) | one configured instance | subagent, worker, executor |

"Harness" is informal jargon — no standards body defines it.

---

## Interactive vs headless (`claude` vs `claude -p`)

`claude -p` runs the **exact same agent** — same loop, same tools, same permission system. The only difference: it doesn't wait for you to type again. Runs until done, prints, exits.

|  | `claude` (interactive) | `claude -p` (headless) |
|---|---|---|
| Agent loop | same | same |
| Tools | same | same |
| CLAUDE.md / skills | same | same |
| Waits for input | yes | no |
| History across runs | only with `--continue` / `--resume` | only with `--continue` / `--resume` |
| Good for | thinking together | scripts, cron, orchestrators |

**Headless mode is the agent as a subprocess.** That's what `boss` uses to dispatch executors.

### Three kinds of memory, three behaviours

1. **Within one run** — yes. Everything accumulates in one growing context window. Iteration 20 sees iteration 3.
2. **Across runs** — no, by default. Every `claude -p` is a fresh conversation. `--continue` / `--resume` opt back in. Same for interactive.
3. **File-based** — always. `CLAUDE.md`, `MEMORY.md`, skills, settings are **re-read off disk** at startup. Not remembering — re-reading.

---

## The takeaway

> The model determines how good the thinking is. The harness determines what gets done, how safely, and how much of your attention it costs.

Which is why "which model is best for coding" is the less useful question. Model quality converges. Harness design is where products actually differ — and it's the part you can build yourself.
