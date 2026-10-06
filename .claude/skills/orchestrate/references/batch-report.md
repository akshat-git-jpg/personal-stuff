# Reporting a batch — always name the executor

Shared by `orchestrate` and `secretary` (raise and groom reports). One copy, here.

**Every plan or PR you report to the owner carries its executor and model.** Not on request —
always, in the same breath as the link. Take them from the plan's frontmatter (`executor:` /
`model:`) — never guess, never omit. A blank `model:` means that executor's default: print the
resolved name (defaults are in `tooling/boss/data/rules.md`), not a blank cell.

Owner rule (2026-08-23): *"whenever you give me summary on the PRs, I find it very annoying
that you don't share me what executor have you used for which PR. I like seeing that."*
Routing is an owner-level knob (change-control) and you never pick a model unilaterally, so the
owner has to be able to audit the routing from the summary alone, without opening five files.

**One PR** — a single line is enough:

```
#192 231-yt-script-beats-model  [agy · Gemini 3.1 Pro (High)]  boss:ready
```

**A batch** — a table, one row per PR, with these columns in this order:

| PR | Plan | Executor | Model | Difficulty | UI gate | Waits for | What it does |
|---|---|---|---|---|---|---|---|
| #192 | 231 | `agy` | Gemini 3.1 Pro (High) | standard | — | — | … |
| #193 | 232 | `claude-p` | Sonnet | standard | screenshot | #192 | … |

- `Difficulty` is the plan's Status block grade.
- `UI gate` is `ui:` from the frontmatter.
- `Waits for` comes from `needs_plans` (or `needs_prs`) — boss gates dispatch on both keys
  (`boss_dep_gate` in `tooling/boss/bin/boss-dispatch.sh`). Render it as the **PR** number once
  the batch is raised, since that is what the owner clicks. If the dependency is a plan number,
  say so: `#221 (plan 261)`.

**If a batch mixes executors, add one sentence saying why** — cite the row of
`tooling/boss/data/rules.md` you routed from. The owner reads that as the routing decision; an
unexplained mix reads as an accident.
