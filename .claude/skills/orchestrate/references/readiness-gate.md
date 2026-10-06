# Executor-readiness gate (Step 3.5)

Contents
- The 14 checks
- Difficulty grading
- Executor selection

A plan is ready for a cheaper executor only when **the executor never has to decide — only
do and verify**. Run `scripts/check-plan.sh <plan>` for the mechanical part (test_cmd,
executor, mutation recipe, vague phrasing), then self-check the rest.

## The 14 checks

1. **Zero open decisions.** No "choose an appropriate…", "design a…", "as needed", "pick a
   sensible…" left in any step. Every decision is made here, by you, and inlined as a fact the
   executor obeys.
   **Rider:** "made by you" means *decided and surfaced at Step 2.5* — never decided silently.
   This item closes the executor's freedom, not the owner's visibility. If a decision reached
   the plan without appearing in the checkpoint, the gate failed: go back to 2.5 with it
   before handing off.
2. **The intelligence-heavy bits are IN the plan.** If one function/algorithm/schema is the
   hard part, write that exact snippet into the plan yourself — authoring a critical snippet
   inside a plan is planning, not implementing. The executor places and wires it.
3. **Every Verify is machine-checkable.** Command + expected output, no "looks right".
4. **Subjective outputs get a rubric.** If the product is judged by taste (prose, design, a
   thumbnail), the plan must carry an explicit rubric / acceptance checklist. "Iterate until
   satisfied" is not a stop condition — the tier-3 verifier scores against the rubric, never
   general taste.
5. **No house-rule conflicts.** Check `decisions.md` (and the target folder's CLAUDE.md): a
   plan proposing an approach the owner already rejected fails the gate — the executor can't
   know the house said no.
6. **Zero-context test.** A model that has never seen this conversation could execute it from
   the plan file + repo alone.
7. **Boss frontmatter complete** — every field in [boss-frontmatter.md](boss-frontmatter.md).
8. **Cross-plan invariants get a test in the plan that INTRODUCES them.** If plan N+1 depends
   on a design property of plan N ("edit state lives in the tab store", "this module is the
   single source of X"), plan N must land a machine check for that property — prose in N+1's
   Current-state notes is where executors punt. (Bitten 2026-07-31: the board-SPA save path
   silently collected only mounted DOM tiles because the store requirement lived in the NEXT
   plan's notes; one Save from timeline mode could wipe cues.json.)
9. **Every degraded/empty state is enumerated per surface.** For each view/tab/page: what
   renders when its backing file/data is absent, and what its actions do then (usually:
   disabled + a why-title). An un-enumerated empty state gets invented behavior — often an
   enabled button that 500s.
10. **Stateful UI contracts specify the LIFECYCLE, not just the content.** A shared
    slot/store/registry contract must say who resets it and when (mount/unmount/route-change).
    Fresh-page-load checks (dump-dom smokes) cannot see in-session transitions, so lifecycle
    bugs need either an explicit unmount-cleanup instruction or an in-session probe.
11. **Prose behavior is inventable behavior.** Any encoding an executor could reinterpret (a
    color mapping, a label rule, a sort order) is inlined as a snippet or table in the STEP,
    never described in Current-state prose — and gets a Verify that would fail on a different
    encoding.
12. **Gate-integrity STOP condition in every plan that touches tests/gates:** "if a gate
    assertion fails, fix the code or the fixture; weakening, swapping, or deleting the
    assertion is a STOP." Crews reliably soften assertions to pass (LESSONS 2026-07-31,
    2026-07-24).
13. **Tests that open servers/processes must fail loudly, never hang.** Spec guaranteed
    teardown (try/finally, or a suite-level `test.after` that force-closes tracked handles) —
    an assertion that fires before cleanup otherwise leaves the runner alive forever and the
    failure invisible.
14. **The batch's LAST plan runs the gate on a FRESH checkout** (clean clone or `git clean`-ed
    worktree scope) as a Done criterion. Crews verify in worktrees carrying their own build
    artifacts, so build-order and gitignored-artifact dependencies only surface on a pristine
    tree.

## Difficulty grading

Grade each plan — `Difficulty: mechanical | standard | tricky`:

- **mechanical** — pure placement/renames/config.
- **standard** — normal feature work fully specified by the plan.
- **tricky** — still needs real judgment even with everything inlined (gnarly refactor,
  subtle concurrency, security-sensitive logic) — a cheap model here just buys fix-up rounds.

Grading honesty rider: **"port lines X–Y by reference" is NOT fully inlined.** A large port
(UI rewrite, framework migration) where the executor reads the old implementation and
re-expresses it involves continuous judgment — that is rules.md's "can't be fully inlined"
row, not the default row, even though the source is in-repo. If the user's explicit executor
choice overrides this, say so in the plan's Summary and compensate with tighter verifies
(items 8–14). (2026-07-31: the board-SPA port shipped a data-loss punt, an invented color
scheme, and UA-default controls under green gates — all judgment-gap defects.)

## Executor selection

The routing table, every executor's default model, and the riders (fully-inlined bar,
render+inspect gate on visual output, verify agy/codex by commits, never by the envelope)
live in **`tooling/boss/data/rules.md`** — read it there; this skill does not restate model
names. Boss executors: `claude-p`, `agy`, `codex`.

**Never pick the executor model unilaterally** (owner-confirmed 2026-07-12): the user's
explicit choice always wins; otherwise stamp from rules.md. Deviations are surfaced to the
owner, never a silent switch.

The `antigravity | sonnet | opus` names belong to the standalone direct-dispatch registry
([direct-dispatch.md](direct-dispatch.md)) — NOT the frontmatter boss reads.
