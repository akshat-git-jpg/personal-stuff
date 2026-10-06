# Plan shape (Steps 0 and 3)

## Step 0 — Ensure the `plans/` contract exists

Check for `plans/WORKFLOW.md` and `plans/_TEMPLATE.md` in the repo root.

- **Present** (e.g. personal-stuff): use them as-is.
- **Absent** (a fresh repo): bootstrap the convention before planning. Create `plans/` with:
  - `WORKFLOW.md` — the orchestrator→executor contract: expensive model plans, cheaper
    model executes one plan at a time with zero context; lifecycle
    `TODO → IN PROGRESS → DONE / BLOCKED / REJECTED`; executor rules (run the drift check
    first, run every verify, honor STOP conditions, never touch out-of-scope files, don't
    push); orchestrator rules (self-contained, exact commands, a verification story per step).
  - `_TEMPLATE.md` — the plan skeleton (the shape below).
  - `README.md` — the index: an execution-order/status table + a dependency notes section.

  Reuse `tooling/maintainer/jobs/improve/references/plan-template.md` structure so the two
  stay consistent.

## Step 3 — Write the plan(s)

Record `git rev-parse --short HEAD` first — every plan stamps the commit it was written
against (the executor uses it for drift detection). Number plans in execution order and note
dependencies. Write each with `plans/_TEMPLATE.md`.

Each plan must have all of these:

- **Summary** — a to-the-point block at the very top of the file, before anything else, so a
  reader (owner or executor) gets the gist without scrolling:
  - **Problem statement** — what's broken/missing, 1–2 sentences.
  - **Goals** — bulleted, what this plan achieves.
  - **Decisions confirmed** — the Step 2.5 calls the owner made, one line each
    (`<fork> -> <chosen option>`). This is the record of what was chosen deliberately, so
    neither a later reader nor the executor re-litigates it. A plan with an empty list did
    not run the checkpoint — that is a bug.
  - **Executor proposed** — the executor AND model, one line, matching the Step 3.5
    difficulty grade.
  - **Done criteria** — tersely restated (full detail in the Done criteria section).
  - **Stop conditions** — tersely restated (full detail in the STOP conditions section).
  - **Test / verification for success** — one line naming the verify approach (unit tests,
    manual script, rubric-scored subagent, etc).
  - **Open points for plan readiness** — anything still unresolved that keeps this plan from
    being handoff-ready. Empty for a plan that passed Step 3.5 — if non-empty, say so
    plainly; don't hand this plan off yet.
- **Executor-instructions header** with a **drift check** command
  (`git diff --stat <SHA>..HEAD -- <in-scope paths>`).
- **Status block**: Priority / Effort / Risk / Depends on / Category / Planned-at SHA.
- **Why this matters** — 2–5 sentences of intent (intent is what lets the executor make a
  correct judgment call when a detail is off).
- **Current state** — the facts inlined: files with one-line roles, short code excerpts you
  read yourself, the conventions to follow with the exemplar file, any design constraints.
- **Commands you will need** — the exact recon-verified build/test/lint/run commands, with
  expected output.
- **Scope** — in-scope files (the only ones to touch) and an explicit out-of-scope list
  ("looks related, don't touch, because…").
- **Steps** — ordered, each small and independently verifiable, each ending with a
  **Verify:** command and its expected result. Order so the codebase is never broken between
  steps when possible.
- **Test plan** — new tests to write, where, following which existing test.
- **Done criteria** — machine-checkable (commands + expected results, not "works").
- **STOP conditions** — specific to this plan's real risks; "stop and report, don't
  improvise" beats guessing.
- **Maintenance notes** — what future changes interact with this; what a reviewer should
  scrutinize.

**Excerpts come from your own reads, never from a subagent's report.** Open every cited file
yourself before quoting it — a wrong excerpt becomes a wrong plan.

Then write/update `plans/README.md`: add the new plan row(s), execution order, dependencies,
status `TODO`. (In personal-stuff, `plans/README.md` is boss-owned on main: plan branches
never edit it — see `personal-stuff-change-control` Gate 1.)
