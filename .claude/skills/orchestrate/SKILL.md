---
name: orchestrate
description: Plan a NEW build (feature, tool, script, small app) as a self-contained plan in plans/ (per plans/WORKFLOW.md + _TEMPLATE.md) that a cheaper executor runs — you orchestrate, never implement; brainstorms first when requirements are fuzzy, then runs an AUTOMATED handoff loop (dispatch to Antigravity via GUI script or Sonnet subagents, wait token-free on a run-log watcher, verify cheaply, fix-up rounds). New-work sibling of `improve` (which audits EXISTING code). Triggers on "let's build X", "implement Y", "add a feature", "orchestrate this", "plan this for antigravity", "make a plan a cheaper model can build", "spec this out for an executor", "hand this off to antigravity", "run the plans", "execute the batch". Not for auditing existing code (use `improve`) or tiny one-off edits.
user-invocable: true
metadata:
  author: kbtg
  version: 2.5.0
---

# Orchestrate

You are the **orchestrator, not the implementer**. When the user wants to build
something new, your job is to turn it into a **self-contained plan a cheaper,
zero-context executor can run** — and hand it off. The expensive model does the
part where intelligence compounds (clarifying intent, reading the codebase,
specifying exactly what to do and how to verify it). A cheaper model (the user's
default executor is **Antigravity**) does the execution.

**The plan is the product.** Its quality decides whether the executor succeeds.

This is the mirror image of the `improve` skill: `improve` audits *existing* code
and emits improvement plans; `orchestrate` takes a *new* build and emits a build
plan. Both write into the same `plans/` contract (see `plans/WORKFLOW.md`), so an
executor treats their output identically.

## Hard rules

1. **Never write product code yourself.** No implementation, no "quick scaffold,"
   no "I'll just start it." The only files you create or modify are under `plans/`
   (plus, if bootstrapping, `plans/WORKFLOW.md` / `plans/_TEMPLATE.md` /
   `plans/README.md`). If the user explicitly says "just build it," you may — but
   confirm first and say you're stepping out of the orchestrator role.
2. **Never modify the superpowers framework.** Compose it: *invoke*
   `superpowers:brainstorming` when you need to clarify a fuzzy idea. Do not edit,
   fork, or reimplement any `superpowers:*` skill. Your dependency on it is
   one-directional and read-only.
3. **One plan = one reviewable unit of work.** If the build is large, split it
   into ordered plans (`001-…`, `002-…`) with explicit dependencies, exactly like
   `improve` and the migration plans do — don't write one 40-step mega-plan.
4. **Every plan is self-contained.** The executor has not seen this conversation.
   Inline the file paths, current-code excerpts, conventions, exact commands, and
   verification. "As discussed above" is a bug.
5. **Match the repo's `plans/` output contract.** Use `plans/_TEMPLATE.md` and
   follow `plans/WORKFLOW.md`. If they don't exist in this repo yet, bootstrap
   them (Step 0) before writing the first plan.

## When to use this vs. neighbors

| The user wants to… | Use |
|---|---|
| Build/implement a NEW feature, tool, component, script, or small app | **this skill** |
| Audit / improve / find bugs in EXISTING code, or "what should I build next" | `improve` |
| Just think through a fuzzy idea, no plan yet | `superpowers:brainstorming` directly |
| A trivial one-off edit you'd finish faster than writing a plan | just do it — don't over-orchestrate |

If you're unsure whether the ask is "new build" or "improve existing," ask one
question. If it's clearly new, proceed here.

## Workflow

### Step 0 — Ensure the `plans/` contract exists

Check for `plans/WORKFLOW.md` and `plans/_TEMPLATE.md` in the repo root.

- **Present** (e.g. personal-stuff): use them as-is.
- **Absent** (a fresh repo): bootstrap the convention before planning. Create
  `plans/` with:
  - `WORKFLOW.md` — the orchestrator→executor contract: expensive model plans,
    cheaper model executes one plan at a time with zero context; lifecycle
    `TODO → IN PROGRESS → DONE / BLOCKED / REJECTED`; executor rules (run the
    drift check first, run every verify, honor STOP conditions, never touch
    out-of-scope files, don't push); orchestrator rules (self-contained, exact
    commands, a verification story per step).
  - `_TEMPLATE.md` — the plan skeleton (see "Plan shape" below).
  - `README.md` — the index: an execution-order/status table + a dependency notes
    section.
  If the repo already uses `improve`, reuse its `references/plan-template.md`
  structure so the two skills stay consistent.

### Step 1 — Clarify the requirements (brainstorm if fuzzy)

Judge how well-specified the ask is.

- **Fuzzy** ("I want an app that tracks X", no concrete scope/acceptance):
  **invoke `superpowers:brainstorming`** and work through intent, requirements,
  constraints, and acceptance criteria with the user. Stop when you can name the
  scope, the tech, and what "done" means. Do not start planning mid-brainstorm.
- **Already specific** (clear feature in a known repo with obvious conventions):
  skip brainstorming; resolve remaining gaps from the codebase, and ask the user
  only the few things the code can't answer — one question at a time, each with a
  recommended default.

### Step 2 — Recon the target repo (light)

Before writing steps, learn what the executor must match:

- Read `README`, root `CLAUDE.md`/`AGENTS.md`, and the relevant folder's
  `CLAUDE.md`.
- Find the exact **build / test / lint / typecheck / run** commands — they become
  the plan's verification gates. Never guess them.
- Note the conventions to imitate (naming, error handling, state, styling) and
  pick one **exemplar file** the plan can point the executor at ("match
  `src/users/api.ts`").
- Identify the stack, package manager, and how a change is verified end-to-end.
- Read `plans/runs/LESSONS.md` (cross-run executor lessons) if it exists —
  author plans that route around known executor failure modes instead of
  rediscovering them through fix-up rounds.

Keep this proportional — a new small tool needs a lighter pass than a feature
inside a large app.

### Step 3 — Write the plan(s)

Record `git rev-parse --short HEAD` first — every plan stamps the commit it was
written against (the executor uses it for drift detection). Number plans in
execution order and note dependencies. Write each with `plans/_TEMPLATE.md`.

**Plan shape** (each plan must have all of these):

- **Summary** — a to-the-point block at the very top of the file, before
  anything else, so a reader (owner or executor) gets the gist without
  scrolling:
  - **Problem statement** — what's broken/missing, 1–2 sentences.
  - **Goals** — bulleted, what this plan achieves.
  - **Executor proposed** — the executor AND model (e.g. `agy` / Claude
    Sonnet), one line, matching Step 3.5's difficulty grading.
  - **Done criteria** — tersely restated (full detail lives in the Done
    criteria section below).
  - **Stop conditions** — tersely restated (full detail lives in the STOP
    conditions section below).
  - **Test / verification for success** — one line naming the verify
    approach (unit tests, manual script, rubric-scored subagent, etc).
  - **Open points for plan readiness** — anything still unresolved that
    keeps this plan from being handoff-ready. Empty for a plan that passed
    Step 3.5 — if non-empty, say so plainly; don't hand this plan off yet.
- **Executor-instructions header** with a **drift check** command
  (`git diff --stat <SHA>..HEAD -- <in-scope paths>`).
- **Status block**: Priority / Effort / Risk / Depends on / Category / Planned-at SHA.
- **Why this matters** — 2–5 sentences of intent (intent is what lets the
  executor make a correct judgment call when a detail is off).
- **Current state** — the facts inlined: files with one-line roles, short code
  excerpts you read yourself, the conventions to follow with the exemplar file,
  any design constraints.
- **Commands you will need** — the exact recon-verified build/test/lint/run
  commands, with expected output.
- **Scope** — in-scope files (the only ones to touch) and an explicit
  out-of-scope list ("looks related, don't touch, because…").
- **Steps** — ordered, each small and independently verifiable, each ending with
  a **Verify:** command and its expected result. Order so the codebase is never
  broken between steps when possible.
- **Test plan** — new tests to write, where, following which existing test.
- **Done criteria** — machine-checkable (commands + expected results, not "works").
- **STOP conditions** — specific to this plan's real risks; "stop and report,
  don't improvise" beats guessing.
- **Maintenance notes** — what future changes interact with this; what a reviewer
  should scrutinize.

**Excerpts come from your own reads, never from a subagent's report.** Open every
cited file yourself before quoting it — a wrong excerpt becomes a wrong plan.

Then write/update `plans/README.md`: add the new plan row(s), execution order,
dependencies, status `TODO`.

### Step 3.5 — Executor-readiness gate (before any handoff)

A plan is ready for a cheaper executor only when **the executor never has to
decide — only do and verify**. Self-check every plan:

1. **Zero open decisions.** No "choose an appropriate…", "design a…", "as
   needed", "pick a sensible…" left in any step. Every decision is made here,
   by you, and inlined as a fact the executor obeys.
2. **The intelligence-heavy bits are IN the plan.** If one function/algorithm/
   schema is the hard part, write that exact snippet into the plan yourself —
   authoring a critical snippet inside a plan is planning, not implementing.
   The executor places and wires it.
3. **Every Verify is machine-checkable.** Command + expected output, no "looks
   right".
4. **Subjective outputs get a rubric.** If the product is judged by taste
   (prose, design, a thumbnail), the plan must carry an explicit rubric /
   acceptance checklist. "Iterate until satisfied" is not a stop condition —
   the tier-3 verifier scores against the rubric, never general taste.
5. **No house-rule conflicts.** Check `decisions.md` (and the target folder's
   CLAUDE.md): a plan proposing an approach the owner already rejected fails
   the gate — the executor can't know the house said no.
6. **Zero-context test.** A model that has never seen this conversation could
   execute it from the plan file + repo alone.
7. **Boss frontmatter complete** (for any plan you'll hand to `boss` via
   `/secretary raise` — i.e. every plan in personal-stuff). Fill the plan's YAML
   frontmatter yourself now; an unfilled field is exactly what makes secretary
   raise a `gap:*` PR that boss then ignores (the root cause of "I raised it but
   boss never picked it up"):
   - **`test_cmd`** — REQUIRED. The recon-verified command whose exit 0 is the
     merge gate (boss re-runs it; this repo has no CI, so this field *is* the
     CI). Never blank, never guessed — it's the command you confirmed in Step 2.
   - **`ui`** — `true` if the plan touches a user-facing view (boss's crew brief
     then requires a screenshot); omit/false otherwise.
   - **`executor` + `model`** — stamp from the difficulty grade + `data/rules.md`
     defaults (below). secretary does NOT re-derive these; what you write is what
     boss dispatches.
   - **`deploy`** — the post-merge deploy command if the plan needs one, else blank.

Then grade each plan — `Difficulty: mechanical | standard | tricky`:

- **mechanical** — pure placement/renames/config.
- **standard** — normal feature work fully specified by the plan.
- **tricky** — still needs real judgment even with everything inlined (gnarly
  refactor, subtle concurrency, security-sensitive logic) — a cheap model here
  just buys fix-up rounds.

**Executor selection (boss taxonomy — this is what goes in the frontmatter).**
boss runs two executors: `claude-p` (backgrounded `claude -p`; models `sonnet`
or `opus`) and `agy` (headless Antigravity CLI; cheap tokens, gemini default).
The user's explicit choice always wins. If unstated, consult
`tooling/boss/data/rules.md` and default: `tricky` → `executor: claude-p` /
`model: opus`; `standard` → `claude-p` / `sonnet`; `mechanical` or `type:chore`
→ `agy` (agy default model). (The older `antigravity | sonnet | opus` naming
belongs to the standalone direct-dispatch registry in Step 4 — NOT the
frontmatter boss reads.)

### Step 4 — Hand off (optional)

Once plan(s) pass Step 3.5, ask the user how to hand off. Three routes:

- **To `boss` via secretary (recommended, and the default in personal-stuff).**
  The plan rides a GitHub PR. Invoke **`/secretary raise`** on each ready plan:
  it opens a `boss:ready` PR (or a `gap:*` PR if the frontmatter is still
  incomplete — Step 3.5 item 7 is what prevents that). boss then dispatches,
  verifies, merges, and deploys on its own schedule. **You are done once the PR
  is raised** — the dispatch/verify/merge loop is boss's, not yours, so nothing
  below this line runs. This is the current design; see
  `docs/specs/2026-07-07-boss-design.md`.
- **Manual / later**: stop here. Report each plan's path plus its Summary
  block so the user can see problem/goals/executor/done-criteria at a glance,
  and hand off whenever they choose (re-invoke this skill at Step 4, or
  `/secretary raise` by hand). Nothing below this line runs.
- **Automated now (standalone direct-dispatch).** For a repo *without* boss
  (boss is personal-stuff-only for now), continue below: you dispatch and watch
  the executor yourself via the registry loop. The governing rule: a lot of
  context flows INTO the executor; only a thin signal flows back. You never
  re-read executor diffs — verification is exit codes, structural checks, and
  one-line verdicts.

#### Executor registry

Pick the executor from each plan's `Executor:` field (ask the user if plans in
one batch disagree). Adding a future executor = one new row here + optionally
one dispatch script; the run-log, verification, and rounds are executor-agnostic.

| Executor | Dispatch | Completion signal | Death detection |
|---|---|---|---|
| `antigravity` | `scripts/ag-handoff.sh <prompt-file>` (pbcopy → focus → Cmd+V → Enter; `AG_APP` defaults to "Antigravity IDE") | `RUN DONE` in the run-log, via `scripts/watch-run.sh` | heartbeat staleness (default 10 min) — a GUI app emits no process signal |
| `sonnet` | one Agent-tool subagent **per plan**, `model: sonnet`; orchestrator checkpoints between plans | subagent returns + run-log `PLAN NNN DONE` | harness surfaces a dead subagent immediately |
| `opus` | one Agent-tool subagent **per plan**, `model: opus` — for `tricky` plans only | same as `sonnet` | same as `sonnet` |
| `agy` | background Bash per plan: `agy -p "$(cat <prompt-file>)" --dangerously-skip-permissions --add-dir "<working-tree>" --output-format json --print-timeout 180m [--model "<name>"]` with cwd = the working tree (`--add-dir` is mandatory — print mode does not bind cwd; default timeout is 5m); prompt carries the same run-log rules | process exit + run-log `PLAN NNN DONE`; JSON envelope in the captured file has `status`/`usage`/`conversation_id` (resume fix-ups via `--conversation <id>`) | `kill -0 <pid>` — a real process, exact liveness (no heartbeat guessing) |

Notes:
- **Antigravity's internal model is set in the app's own model picker** — the
  skill cannot select or verify it. Antigravity runs on its own subscription,
  so it's the cheapest choice for mechanical batches; `sonnet`/`opus` subagents
  share the Claude usage pool.
- **`agy` (added 2026-07-06)**: the Antigravity CLI — same engine and AI Pro
  subscription as the Antigravity IDE, but a real headless process: no GUI
  permission dialogs, exact death detection, parallelizes (per-worktree cwd,
  no shared IDE workspace), per-call model choice (`agy models`; includes
  Claude Sonnet/Opus 4.6 under the same sub). Prefer it over the `antigravity`
  IDE row for headless plan batches. (The gemini CLI is dead for individual
  accounts since 2026-06-18 — do not spec it.)
- **One run at a time.** Runs share one working tree and git history —
  never dispatch a second run (any executor) while one is in flight.

#### 4a — Start the run

1. Run-id: `<YYYYMMDD-HHMM>-<slug>`. Create `plans/runs/<run-id>.md` containing
   only the header line (format in `plans/WORKFLOW.md` → "Run log"). The
   executor appends everything else.
2. Build the handoff prompt and save it to `plans/runs/<run-id>.prompt.md`
   (it's the record of what was dispatched). The prompt must tell the executor to:
   - read each whole plan first (including its executor-instructions header),
   - run the **drift check** before starting,
   - work plans/steps in order and **commit per stage** (rollback granularity),
   - run every **Verify** and confirm before continuing,
   - **cap self-fix attempts at 5 per plan** — if Done criteria still fail
     after 5 fix attempts, write `BLOCKED: done criteria unreachable after 5
     attempts` and stop. Never loop indefinitely: a busy loop keeps emitting
     heartbeats, so it looks alive to the watcher while burning budget,
   - honor **STOP conditions** literally (stop and report, don't work around),
   - **write the run-log**: `PLAN NNN START` before each plan, a `HEARTBEAT`
     line at least every 3 minutes, `DONE` with verify results + changed files
     (or `BLOCKED: reason`, then STOP the whole run), and `RUN DONE` as the
     final line,
   - update each plan's `plans/README.md` row when done,
   - **not push** unless the user says so.
   Also restate the load-bearing decisions the executor must not re-litigate
   (chosen libraries, naming, scope boundaries) and any human-only
   preconditions (secrets, a decision, an SSH/push step).

#### 4b — Dispatch and wait (token-free)

**One human gate, placed here.** Before dispatching, show the user the batch in
one glance: plans, routing (executor per plan), run-id. This is the checkpoint
where a wrong direction would invalidate everything downstream — gate here,
and don't add approval gates anywhere later in the loop.

- **Antigravity**: run `scripts/ag-handoff.sh <prompt-file>`, then launch
  `scripts/watch-run.sh <run-log> [timeout-min]` as a **background** Bash task.
  The session idles at ~zero token cost (no model turns) until the watcher
  exits: `0` = RUN DONE, `2` = BLOCKED, `3` = stale/dead, `4` = never started.
  Never wait in a foreground sleep — a single blocking bash call is capped.
- **Sonnet**: dispatch the subagent for plan N with the plan path + run-log
  instructions; it self-verifies, appends its log lines, returns a thin report.
  Verify (4c) before dispatching plan N+1.

#### 4c — Wake up and verify (cheap, layered)

First run `scripts/runlog-status.sh <run-log>` — one line tells you done /
blocked / dead-at-plan. Then a **scope check**: `git diff --stat <planned-at
SHA>..HEAD` file names must be a subset of the batch's in-scope lists — catches
an executor that "helpfully" touched out-of-scope files even when tests pass.
Then verify by what each plan produces:

1. **Code** → re-run the plan's own **Done criteria** commands; read only exit
   codes + the last error line. A cheerful `DONE` line can lie; the commands
   don't.
2. **Content with no tests** → structural check only: file exists, non-empty,
   required sections present, JSON validates. Don't read and judge the prose.
3. **Subjective quality** → dispatch ONE cheap subagent to read the artifact
   and return only PASS/FAIL + up to 3 issues, **scored against the plan's
   rubric** (readiness gate item 4). The heavy read happens in the subagent's
   context, not yours.

#### 4d — Fix-up rounds (max 2)

If verification finds real gaps (failed Done criteria, verdict issues): write a
**small fix-up prompt** — the issues list + pointer back to the plan + run-log
instructions. **Append the `[HH:MM:SS] ROUND N START  fixes: <summary>` line to
the run-log YOURSELF, at dispatch time** — never delegate the marker to the
executor. The watcher and `runlog-status.sh` treat everything after the last
round marker as the run's active state, so writing it before dispatch is what
prevents them from misreading the previous round's BLOCKED/RUN DONE lines (a
live false-alarm failure mode, fixed 2026-07-05; regression fixtures in
`scripts/fixtures/round2-*.md`). Same run-log, same dispatch mechanism.
**Cap: 2 fix-up rounds**, then stop and surface to the user — an executor
failing twice on the same issue needs human eyes, not more tokens.

**Learn from the run.** After verification (pass or fail), if the run taught
something non-obvious about an executor or the loop — a recurring mistake, a
plan-shape fix that prevented one, a quirk — append ONE line per lesson to
`plans/runs/LESSONS.md` (`YYYY-MM-DD <executor> — <lesson>`). Step 2 reads this
file, so lessons compound into better plans instead of repeat fix-up rounds.
Skip the obvious; an empty run teaches nothing and gets no line.

#### 4e — On death or BLOCKED

No auto-retry, no auto-notify (deliberate — policy seam for later). Read
`runlog-status.sh` output + the last few log lines, report to the user exactly
how far it got ("001 done and verified; 002 started 10:05, died at step 2"),
and wait for their call. Everything above a `DONE` line is safe; recovery
resumes from the dead plan.

**Fallback:** if the user prefers, or `ag-handoff.sh` fails (no Accessibility
permission), stop at the plan and produce the copy-paste handoff prompt — the
prompt content is identical, only the paste is manual. The watcher + verify
loop still runs.

## Relationship to superpowers and improve (the clean composition)

```
        fuzzy idea ──▶ superpowers:brainstorming        (clarify — you INVOKE it, never edit it)
                                │  clear requirements
                                ▼
  orchestrate:  recon repo ──▶ write plan(s) in plans/   (plans/_TEMPLATE.md + WORKFLOW.md — same contract as `improve`)
                                │
                                ▼
                dispatch (ag-handoff.sh │ sonnet subagent per plan)
                                │
                                ▼
        executor implements + self-verifies ──▶ appends plans/runs/<run-id>.md
                                │                        ▲
              watch-run.sh (bg, ~0 tokens)               │ fix-up round (≤2)
                                ▼                        │
        wake ──▶ runlog-status.sh ──▶ tiered verify ──▶ gaps? ──▶ done / report
```

- **superpowers owns "how to think through a new feature."** You call
  `superpowers:brainstorming`; you never modify it (it's an externally-maintained
  framework — a fork would be clobbered on update).
- **orchestrate owns "turn clear requirements into an executor-ready plan +
  handoff."**
- **improve owns the same for existing code.** orchestrate and improve share the
  `plans/` + `WORKFLOW.md` output contract, so the executor treats both the same.

## Tone

Advising and specifying, not selling or building. Prefer a short, precise plan
over a long vague one. Flag uncertainty honestly. If the right answer is "this is
too small to orchestrate — just make the edit," say so.
