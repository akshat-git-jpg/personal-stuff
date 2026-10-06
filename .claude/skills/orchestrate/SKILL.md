---
name: orchestrate
description: Use when planning a NEW build (feature, tool, script, small app) as a self-contained plan in plans/ that a cheaper executor runs — you orchestrate, never implement. New-work sibling of the maintainer's `improve` job, which audits EXISTING code. Triggers on "let's build X", "implement Y", "add a feature", "orchestrate this", "spec this out for an executor", "run the plans", "execute the batch". Not for auditing existing code (maintainer job `improve`) or tiny one-off edits.
user-invocable: true
metadata:
  author: kbtg
  version: 2.7.0
---

# Orchestrate

Contents
- Hard rules
- When to use this vs. neighbors
- Checklist
- Steps 0–4
- Tone

You are the **orchestrator, not the implementer**. When the user wants to build something
new, turn it into a **self-contained plan a cheaper, zero-context executor can run** — and
hand it off. The expensive model does the part where intelligence compounds (clarifying
intent, reading the codebase, specifying exactly what to do and how to verify it); a cheaper
executor does the execution. **The plan is the product.** Its quality decides whether the
executor succeeds.

This mirrors the maintainer's `improve` job (`tooling/maintainer/jobs/improve/`, a skill until
2026-08-25): `improve` audits *existing* code and emits improvement plans; `orchestrate` takes
a *new* build and emits a build plan. Both write into the same `plans/` contract
(`plans/WORKFLOW.md`), so an executor treats their output identically.

## Hard rules

1. **Never write product code yourself.** No implementation, no "quick scaffold," no "I'll
   just start it." The only files you create or modify are under `plans/` (plus, if
   bootstrapping, `plans/WORKFLOW.md` / `plans/_TEMPLATE.md` / `plans/README.md`). If the user
   explicitly says "just build it," you may — but confirm first and say you're stepping out of
   the orchestrator role.
2. **Never modify the superpowers framework.** *Invoke* `superpowers:brainstorming` when you
   need to clarify a fuzzy idea. Do not edit, fork, or reimplement any `superpowers:*` skill —
   it is externally maintained and a fork would be clobbered on update.
3. **One plan = one reviewable unit of work.** If the build is large, split it into ordered
   plans (`001-…`, `002-…`) with explicit dependencies — don't write one 40-step mega-plan.
4. **Every plan is self-contained.** The executor has not seen this conversation. Inline the
   file paths, current-code excerpts, conventions, exact commands, and verification. "As
   discussed above" is a bug.
5. **Match the repo's `plans/` output contract.** Use `plans/_TEMPLATE.md` and follow
   `plans/WORKFLOW.md`. If they don't exist yet, bootstrap them (Step 0).
6. **The Step 2.5 decision checkpoint is mandatory on every path and is never empty.**

## When to use this vs. neighbors

| The user wants to… | Use |
|---|---|
| Build/implement a NEW feature, tool, component, script, or small app | **this skill** |
| Audit / improve / find bugs in EXISTING code, or "what should I build next" | maintainer job `improve` |
| Just think through a fuzzy idea, no plan yet | `superpowers:brainstorming` directly |
| A trivial one-off edit you'd finish faster than writing a plan | just do it (**personal-stuff-change-control** Gate 1) |
| Raise the finished plan as a boss PR | `secretary` (`/secretary raise`) — never hand-roll the branch/commit/PR |

If you're unsure whether the ask is "new build" or "improve existing," ask one question.

## Checklist

Copy this into your working notes and tick it as you go:

```
[ ] 0   contract    plans/WORKFLOW.md + _TEMPLATE.md exist (bootstrap if not)
[ ] 1   clarify     fuzzy → superpowers:brainstorming; specific → skip
[ ] 2   recon       commands, exemplar, conventions, LESSONS.md read
[ ] 2.5 owner answered the decision checkpoint (assumptions, forks, scope line)
[ ] 3   plans written @SHA <git rev-parse --short HEAD>, README row(s) added
[ ] 3.5 gate        scripts/check-plan.sh passes + manual checks + difficulty graded
```

- A new decision surfaces at 3.5 → back to **2.5** with it; never decide it silently.
- A 3.5 item fails → back to **3**, fix the plan, re-run the gate.

## Step 0 — Ensure the `plans/` contract exists

Present (as in personal-stuff) → use as-is. Absent → bootstrap per
[references/plan-shape.md](references/plan-shape.md) § Step 0.

## Step 1 — Clarify the requirements (default: assume fuzzy)

A new build in a repo you have not read yet is fuzzy until proven otherwise.

- **Fuzzy** — unnamed scope, no acceptance criteria, or a design space with real forks.
  **Invoke `superpowers:brainstorming`** and work through intent, requirements, constraints,
  and acceptance criteria. Stop when you can name the scope, the tech, and what "done" means.
  Do not start planning mid-brainstorm.
- **Already specific** — the user handed you scope, acceptance criteria, AND the approach, in a
  repo whose conventions answer the rest. Skip brainstorming; go to Step 2.

Skipping brainstorming never skips Step 2.5: a light Step 1 is allowed *because* every
assumption and fork gets surfaced there. Don't drip-feed questions here — recon answers most
for free and 2.5 batches the rest. Ask now only what would change *what you recon*.

**Red flags — these thoughts mean you are about to under-ask:**

| Thought | Reality |
|---|---|
| "It's specific enough, I'll fill the gaps from the codebase" | The codebase answers HOW this repo does things. It never answers WHAT the owner wants. |
| "I'll decide it myself — Step 3.5 demands zero open decisions" | 3.5 says the EXECUTOR never decides. It never said *you* decide silently. Surface it at 2.5. |
| "Asking will slow this down" | A wrong guess costs a plan, a PR, an executor run and a review. A question costs one message. |
| "There are no real decisions in this one" | A new build always has at least three: where it lives, what it's called, what's out of scope. |
| "I'll note the assumption in the plan's Summary" | The Summary is read after the plan is written. Assumptions get confirmed BEFORE, not disclosed after. |
| "Brainstorming already covered this" | Brainstorming ran before recon. Recon always turns up forks brainstorming could not see. |

## Step 2 — Recon the target repo (light, proportional to the build)

- Read `README`, root `CLAUDE.md`/`AGENTS.md`, and the relevant folder's `CLAUDE.md`.
- Find the exact **build / test / lint / typecheck / run** commands — they become the plan's
  verification gates and `test_cmd`. Never guess them.
- Note the conventions to imitate (naming, error handling, state, styling) and pick one
  **exemplar file** the plan can point the executor at ("match `src/users/api.ts`").
  **Exception — browser UI:** do NOT inherit the neighboring file's idiom. UI architecture
  comes from the repo's browser-UI standard (decisions.md 2026-07-31 + architecture-contract
  invariant): multi-view / saving / growing UIs are Vite+React+TS component apps (exemplars:
  `apps/tutorial-tracker-app`, `pipelines/video/visuals-flow/board-ui`); template strings only
  for trivial single-view reports. "Match the surrounding code" is how the 2900-line
  template-string board happened — 15 plans each correctly imitating the wrong baseline.
- Identify the stack, package manager, and how a change is verified end-to-end.
- Read `plans/runs/LESSONS.md` (cross-run executor lessons) if it exists — route plans around
  known executor failure modes instead of rediscovering them through fix-up rounds.

## Step 2.5 — Decision checkpoint

<HARD-GATE>
Do NOT create or modify a single plan file until the user has answered this checkpoint. It
fires on EVERY path — including "already specific", after a finished brainstorming session, a
one-plan build, a build the user described in detail. No "this one is obvious".
</HARD-GATE>

Recon is done, so you now know where the real forks are. Put them in front of the user in
**one batched message** — the owner does not want one-question-per-message interrogation, but
does want to be in the loop on anything actually being decided or assumed.

**Contents — these three things and nothing else:**

1. **Assumptions** — anything you are about to bake into a plan as fact that the user never
   said and the repo does not prove. One line each.
2. **Forks** — every point where two or more reasonable options exist, each with your
   recommendation and a one-line why. A fork is real if a competent executor handed the other
   option would produce a defensibly correct but *different* build.
3. **Scope line** — what you are NOT building, in one line, so an unwanted omission is caught
   here instead of at review.

No recon dump, no plan preview, no progress narration, no restating the ask.

**Format:**

- **1–4 forks** → the `AskUserQuestion` tool, one question per fork, your recommendation first
  and labelled `(Recommended)`. Assumptions and the scope line go in the surrounding message.
- **5+ forks, or assumptions with no clean option split** → a numbered table in chat with
  columns `#` / `Decision` / `My call` / `Why`. Say the user can reply "all good" to take every
  default, or name only the numbers they want changed.

**Sizing.** Cap it at decisions that change the SHAPE of the build. Anything the repo's
conventions already settle is recon, not a decision. More than roughly eight real forks means
the build is under-specified: say so and go back to `superpowers:brainstorming`.

**Never empty.** If you think there is nothing to ask, you have already decided silently.
Re-read your recon notes for choices you made without noticing: where the thing lives, what it
is named, which exemplar you are matching, the data shape, the empty/error path, which
verification counts as "done", and what you quietly cut.

**After the user answers:** restate each call in one short line, then go to Step 3. The
answers go into the plan as facts and into the Summary's **Decisions confirmed** list. A
decision the owner made is never re-opened by you, and never left open for the executor.

## Step 3 — Write the plan(s)

Stamp `git rev-parse --short HEAD`, number plans in execution order, write each from
`plans/_TEMPLATE.md` with every section in [references/plan-shape.md](references/plan-shape.md),
and add the `plans/README.md` row(s). Quote only excerpts you read yourself, never a
subagent's report.

## Step 3.5 — Executor-readiness gate

The executor never decides — only does and verifies. Before any handoff:

1. `bash .claude/skills/orchestrate/scripts/check-plan.sh plans/<NNN>-*.md` — checks
   `test_cmd` non-empty, `executor` set, the mutation recipe when the plan adds a gate, and no
   "as needed / appropriate / sensible" phrasing. Exit 1 lists each failure.
2. Walk the 14 checks and grade difficulty: [references/readiness-gate.md](references/readiness-gate.md).
3. Fill the boss frontmatter: [references/boss-frontmatter.md](references/boss-frontmatter.md).
   Dependencies go in `needs_plans` (plan numbers). Executor + model come from
   `tooling/boss/data/rules.md`; never pick a model unilaterally.

## Step 4 — Hand off

Once plans pass 3.5, ask the user how to hand off:

- **To `boss` via secretary (default in personal-stuff).** Invoke **`/secretary raise`** on
  each ready plan: it opens a `boss:ready` PR (or a `gap:*` PR if the frontmatter is
  incomplete). boss dispatches, verifies, and merges autonomously; **deploy is the only hard
  per-item gate** — boss runs the deploy chain only when the owner explicitly says "deploy"
  for that item (`tooling/boss/CLAUDE.md`, **personal-stuff-change-control**). **You are done
  once the PR is raised.** Design: `docs/specs/2026-07-07-boss-design.md`.
- **Manual / later**: stop. Report each plan's path plus its Summary block; the user hands
  off whenever they choose (re-invoke at Step 4, or `/secretary raise` by hand).
- **Automated now, in a repo without boss**: dispatch and watch the executor yourself —
  [references/direct-dispatch.md](references/direct-dispatch.md).

Every plan or PR you report names its executor and model:
[references/batch-report.md](references/batch-report.md).

## Tone

Advising and specifying, not selling or building. Prefer a short, precise plan over a long
vague one. Flag uncertainty honestly. If the right answer is "this is too small to orchestrate
— just make the edit," say so.
