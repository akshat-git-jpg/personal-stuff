# 03 — The two channels

A harness reaches the model through exactly two channels.

| | **Channel 1: text the model sees** | **Channel 2: code the model never sees** |
|---|---|---|
| What it is | system prompt, tool descriptions, context files, tool results | the loop, caps, `try/except`, permission gates, truncation |
| How it works | persuasion | physics |
| Model can ignore it? | **yes** | **no — it isn't even aware of it** |

---

## The five parts of a harness

1. **Tools** — the definitions *and* the code that executes them
2. **The loop** — when to stop, max turn cap, behaviour on API error or tool crash
3. **Context assembly** — system prompt, which project files load, memory, env info
4. **Guardrails** — permission prompts, sandboxing, allowlists
5. **Context management** — compaction, truncating giant outputs, cost caps

Tools are the biggest single piece — maybe half. The other four are invisible until they bite.

---

## Proof: same tools, different harness

Take the three thumbnail tools — identical schemas, identical code behind them. Change one **non-tool** thing each time:

| Change | What happens |
|---|---|
| System prompt says *"render and report"* instead of *"look at your output and fix it"* | Model renders once, never calls `view_image`, ships the broken version. **Same tools. Never used one of them.** |
| No max-turn cap | Renders v1…v14 chasing perfection. 40 minutes, $6 burned. |
| No `try/except` around `render_html` | Chrome throws on malformed HTML, script crashes at turn 3, run lost. With handling, the error goes back as a tool result and the model fixes its HTML. |
| No brand context in the system prompt | Competent thumbnail. Wrong fonts, wrong colours, doesn't look like the channel. |
| No image-size limit on `view_image` | 4K PNG → 6,000 tokens per look → context full by turn 6, agent forgets the request. |

Five different outcomes. **Zero tool changes.**

---

## Which channel each of those is

| Change | Channel |
|---|---|
| System prompt wording | **1** — text |
| No brand context loaded | **1** — text |
| No max-turn cap | **2** — code |
| No `try/except` | **2** — code |
| No image-size limit | **2** — code |

Two are arguments. Three are laws.

---

## Why the split is the whole safety story

Channel 1:
> "Never run `rm -rf`."

A *suggestion*. Works 99% of the time. On a weird prompt, a confusing repo, or an injected instruction from a file it read — it doesn't.

Channel 2:
```python
if cmd.startswith("rm"):
    return "blocked by policy"
```

Now it's **impossible**, regardless of what the model decides, believes, or gets tricked into.

> **Anything you actually can't afford goes in Channel 2. Channel 1 is for quality; Channel 2 is for guarantees.**

Claude Code's permission prompts are Channel 2. `CLAUDE.md` is Channel 1. That's why a bad CLAUDE.md gives you sloppy work, and a bad permission config gives you a deleted directory.

---

## Channel 2 results re-enter Channel 1

The gate is invisible, but its *effect* comes back as text:

```
model: bash("rm -rf node_modules")
code:  blocked — never executes
back:  {"tool_result": "Permission denied by user", "is_error": true}
model: "Understood. Let me try a different approach."
```

A well-designed block produces graceful recovery instead of a crash. Same with truncation — cut the output silently, but append `[...truncated, 480k chars omitted]` so the model knows it's working with a partial view.

---

## The sharpest example

Two harnesses, both with a `bash` tool:

- **Harness X:** runs the command. That's it.
- **Harness Y:** allowlist check, prompts on anything destructive, runs in a container, caps output at 30k chars, retries once on failure.

Same tool name. Same model. One of them is Claude Code; the other eventually deletes something you needed.

---

## The line to keep

> **Channel 1 shapes what the model wants to do. Channel 2 decides what it's allowed to do.**
> A harness is both, plus the loop that runs them.

---

## Exercise

Add one line of Channel 2 to `mini.py` — a `MAX_TURNS = 10` counter that breaks the loop. Then ask it something open-ended and watch it get guillotined mid-task. That's Channel 2 in one edit.
