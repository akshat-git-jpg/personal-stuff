# 05 — Comparing harnesses: Codex vs Claude Code

> ⚠️ **Staleness warning.** Both ship weekly. The architectural *philosophy* below is stable and is the useful part; specific defaults and flags move fast. Verify with `codex --help`, `claude --help`, `~/.codex/config.toml`, `~/.claude/settings.json`.

You can't literally run the same model in both (Codex runs OpenAI models, Claude Code runs Anthropic models). But holding the model constant is the right thought experiment — it's how you see the harness.

**One-line answer:** they made opposite bets on Channel 2, and different bets on tool granularity.

---

## Fork 1: sandbox-first vs permission-first

### Codex — put the agent in a box, then let it run
Leans on **OS-level isolation** — Apple Seatbelt on macOS, Landlock/seccomp on Linux. Writes restricted to the workspace, **network off by default**. Inside the box it acts freely.

> Channel 2 = a wall. Set once, at the boundary.

### Claude Code — agent on your real machine, gated per action
Leans on **interactive approval + allowlists**. Operates on your actual filesystem; the permission engine evaluates every tool call against the tool *and its arguments*.

> Channel 2 = a checkpoint. Consulted every action.

**Neither is safer. They fail differently:**

| | Codex model | Claude Code model |
|---|---|---|
| Failure mode | agent thrashes freely inside the box; you find out at the end | approval fatigue → you start rubber-stamping |
| Good at | long unattended runs | staying in the loop on live systems |
| Bad at | tasks needing real network/system access | 200-step autonomous work |

Both have the other's features available — this is a difference of **default posture**. But defaults are what you live with.

---

## Fork 2: how many tools

**Codex** — narrow and shell-shaped. Historically: run a shell command, apply a patch.

**Claude Code** — many typed tools: Read, Write, Edit, Glob, Grep, Bash, Task, WebFetch, TodoWrite.

Not cosmetic. A real tradeoff:

- **Bash gives the model breadth.** Anything you can type, it can do. But the harness sees an opaque string — same shape for `ls` and `curl -X POST`. It can't tell a parallel-safe read from a destructive write.
- **A dedicated tool gives the harness a hook.** With `Edit(path, old, new)` the harness can check the file hasn't changed since it was read, render a clean diff for approval, mark it unsafe-to-parallelise, audit it. `bash -c "sed -i ..."` supports none of that.

> **Fewer tools = more model freedom. More tools = more harness control.**

Same tradeoff as the sandbox fork, one layer down.

---

## Worked example: *"Add rate limiting to /api/upload"*

### Codex-shaped run
```
1  shell("rg -n 'upload' --type ts")
2  shell("cat src/routes/upload.ts")
3  shell("cat package.json")
4  shell("npm i express-rate-limit")   ← network off in sandbox → FAILS
5  shell("cat src/middleware/*.ts")     ← adapts: writes it by hand
6  apply_patch(<diff>)
7  shell("npm test")
8  apply_patch(<fix failing test>)
9  shell("npm test")  → green
   9 turns, zero prompts
```
You walked away and came back to a finished diff. It hit the network wall and routed around it.

### Claude Code-shaped run
```
1  Grep("upload")
2  Read("src/routes/upload.ts")
3  Read("package.json")
4  Bash("npm i express-rate-limit")     ← ⚠️ PROMPTS
5  Edit("src/routes/upload.ts")         ← ⚠️ PROMPTS (shows diff)
6  Bash("npm test")                      ← allowlisted, silent
7  Edit("tests/upload.test.ts")         ← ⚠️ PROMPTS
8  Bash("npm test")  → green
   8 turns, 3 prompts
```
You saw the diff before it landed.

**Same task. Same result quality. Different experience and failure surface.**

---

## The five parts, side by side

| Harness part | Codex | Claude Code |
|---|---|---|
| **Tools** | narrow: shell + patch | many typed tools + subagents |
| **Loop** | run to done, retry, compact | same |
| **Channel 1 context** | `AGENTS.md`, config.toml | `CLAUDE.md` hierarchy + **skills** |
| **Channel 2 guardrails** | **OS sandbox**, network off by default | **permission engine** on tool + args, **hooks** |
| **Extensibility** | config.toml, MCP | settings.json, MCP, hooks, skills, plugins, subagents |

Distinctive to each:
- **Codex:** real OS sandboxing as the default; cloud mode where tasks run in a container and return a PR.
- **Claude Code:** subagents (child harness, own context window), hooks (your code at lifecycle events), skills (context loaded on demand).

---

## How you'd feel the difference

| You'd notice | Because |
|---|---|
| Codex interrupts less | wall at the boundary, not checkpoints |
| Codex fails at network-dependent steps | network off by default |
| Claude Code shows diffs before they land | typed `Edit` the harness can render |
| Claude Code handles huge codebases with less bloat | subagents absorb noisy searching |
| Claude Code needs config to run unattended | permission-first defaults fight autonomy |
| Codex needs config to touch real systems | sandbox-first defaults fight access |

---

## The takeaway

> **Same model + different harness = different agent.**

Model quality converges. Harness design is where products actually differ.

---

## Exercise

Run the same task in both on a throwaway repo. Count two things: **turns**, and **times you were interrupted**. Those two numbers *are* the harness difference, measured.
