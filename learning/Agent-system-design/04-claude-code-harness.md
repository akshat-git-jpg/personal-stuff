# 04 — How the Claude Code harness works

**Question:** is the harness dynamically generated per task? Some tasks need more tools, more turns, more human verification.

**Answer: no.** Fixed machine, dynamic *loading*. The adaptiveness is real but comes from selecting and loading, never from rebuilding.

---

## Layer 1 — Frozen (identical for every task, forever)

| Component | Never changes |
|---|---|
| The agent loop | `stop_reason` handling, streaming, retries on 429/5xx |
| Core tools | Read, Write, Edit, Bash, Glob, Grep, Task, WebFetch, TodoWrite… |
| Permission engine | the code evaluating every tool call before it runs |
| Compaction | summarize-and-continue when context fills |

"Fix this typo" and "migrate the backend" run through byte-identical machinery.

---

## Layer 2 — Set once, at startup (per directory, not per ask)

Before you've said anything, it assembles:

- every `CLAUDE.md` in scope (global, project, subfolder)
- `settings.json` — permission allowlists, env vars, **hooks**
- available skills (names + one-line descriptions only)
- MCP servers
- model choice, permission mode

Same for the whole session. Ask three different things — this layer doesn't move.

---

## Layer 3 — The four dynamic mechanisms

### 1. Progressive disclosure (skills)
Only the skill **name + description** sits in context (~30 tokens each). Full body loads when triggered.

Typing `/i-have-adhd` drops a few-thousand-token instruction file into context that wasn't there before. That's the harness growing mid-conversation.

*Decided by:* the model (or you, explicitly).

### 2. Deferred tool loading
Same trick for tools. With MCP servers connected you might have 300 tools — loading all schemas would eat 50k tokens before you speak. Only names are present; schemas load on demand.

*Decided by:* the model.

### 3. Subagents
`Task` spawns a **child harness** with a narrower tool set, different system prompt, and its own fresh context window. Burns 80k tokens grepping, returns three sentences.

Closest thing to "a harness generated for the task" — but chosen from a fixed menu, not synthesized.

*Decided by:* the model.

### 4. Compaction
When context approaches the limit, code summarizes old turns and continues. Long task → fires. Short task → never.

*Decided by:* code, on a threshold. Model isn't consulted.

---

## The two specific questions

### "Some tasks need more turns"
**Nothing pre-decides a turn budget.** No `if task_is_big: max_turns = 50`. It runs until `end_turn` or a ceiling that exists regardless of task.

What scales with the task is **effort** — how much the model thinks per turn. A config knob, not a per-ask harness decision.

### "Some need more human verification"
**This one genuinely is dynamic, and it's pure Channel 2.** Every tool call is evaluated individually — against the tool *and its arguments*:

```
Bash("ls")           → matches allowlist → runs silently
Bash("git push")     → not allowed      → prompts you
Write("README.md")   → acceptEdits mode → runs silently
Write("/etc/hosts")  → outside project  → prompts you
```

Same session, same tools, different gates — because the **arguments** differ. Permission modes (plan / acceptEdits / default) shift the whole regime.

---

## The shape

```
FROZEN        loop · core tools · permission engine · compaction
                            │
CONFIGURED    CLAUDE.md · settings · hooks · MCP · model · mode
   (startup)               │
ON-DEMAND     skills load · tool schemas load · subagents spawn
   (mid-run)               │      compaction fires
                           ▼
                    what the model sees this turn
```

Nothing is *generated*. Things are **selected and loaded** from a fixed inventory.

**And that's the correct design.** A harness that rewrote its own rules per task would have no guarantees. The permission engine is only trustworthy because it's the same code every single time.

---

## Where to customise each channel

| You want | You edit | Channel |
|---|---|---|
| It to work differently | `CLAUDE.md`, skills | 1 |
| More capability | MCP servers, more skills | 1 |
| Different gating | `settings.json` permissions | 2 |
| Code to run at fixed moments | **hooks** in `settings.json` | 2 |

Hooks are the sharpest: shell commands fired before/after tool calls. You inject your own Channel 2 without touching the source. That's how "always run prettier after an edit" becomes a **law** instead of a *request in CLAUDE.md*.

---

## Building all four yourself

| Mechanism | Roughly |
|---|---|
| Progressive disclosure | skill descriptions in system prompt + a `load_skill(name)` tool | ~15 lines |
| Deferred tools | send names only + a `get_tool_schema(name)` tool | ~20 lines |
| Subagent | a `delegate(task, tools)` tool running your loop recursively with a fresh `messages` | ~10 lines |
| Compaction | count tokens; over threshold, summarise turns 1..n and replace | ~25 lines |

The subagent one is genuinely ten lines — your loop calling itself.

---

## Exercise

Open `~/.claude/settings.json` and read the `permissions` block. That file is the live Channel 2.
