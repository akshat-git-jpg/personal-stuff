# Boss frontmatter (readiness gate item 7)

Applies to any plan you'll hand to `boss` via `/secretary raise` — i.e. every plan in
personal-stuff. Fill the plan's YAML frontmatter yourself; an unfilled field is exactly what
makes secretary raise a `gap:*` PR that boss then ignores (the root cause of "I raised it but
boss never picked it up"). Field skeleton with inline notes: `plans/_TEMPLATE.md`.
`scripts/check-plan.sh` checks `test_cmd`, `executor` and the mutation recipe mechanically.

- **`test_cmd`** — REQUIRED. The recon-verified command whose exit 0 is the merge gate (boss
  re-runs it; this repo has no CI, so this field *is* the CI). Never blank, never guessed —
  it's the command you confirmed in Step 2.
- **`ui`** — `true` if the plan touches a user-facing view. As of 2026-08-02 this is a REAL
  merge gate again: boss rejects the branch unless it commits an image. Only set it when you
  actually want a screenshot.
- **`executor` + `model`** — stamp from the difficulty grade + `tooling/boss/data/rules.md`.
  secretary does NOT re-derive these; what you write is what boss dispatches. Executors boss
  runs: `claude-p`, `agy`, `codex` (`tooling/boss/executors/`). A blank `model:` means that
  executor's default (listed in rules.md).
- **`deploy`** — the post-merge deploy command if the plan needs one, else blank.
- **`mutation_apply` / `mutation_command` / `mutation_expect`** — REQUIRED for any plan that
  adds a **gate** (a lint code, a check, an assertion). boss runs this itself at merge: clean
  must pass → apply the mutation → the command must FAIL printing `mutation_expect` → revert →
  pass again. Optional: `mutation_cwd`, `mutation_timeout`.
  This exists because on 2026-08-02 two plans shipped gates that could not fire (one asserted
  on source TEXT so its mutation was circular; the other's code never fired at all) and
  **both passed `test_cmd`**. A gate that never fires is worse than no gate — it reads as
  coverage.
  Write the recipe against **data**, not by disabling the rule, and **dry-run it during
  recon** — plan 175's own recipe was wrong (a 14-word title tripped an earlier `max_words 7`
  rule before the gate under test ever ran), and nobody noticed because nothing executed it.
  If `check-plan.sh` flags a plan as gate-adding when it is not, add
  `mutation_waived: <reason>` to the frontmatter (boss ignores the key).
- **`needs_plans`** — `[261]` when this plan builds on another plan's landed work. `needs` is
  prose boss cannot act on; this makes boss refuse to dispatch until the dependency lands. Use
  it for every chain.
  **Write the PLAN number, in `needs_plans`.** When you author a plan its PR does not exist
  yet, so the plan number is the only number you can know — `needs_prs: [261]` meaning *plan*
  261 named a PR that did not exist and froze the whole 261-264 batch (2026-08-30). Boss now
  resolves a plan number in either key (`boss_dep_gate` in `tooling/boss/bin/boss-dispatch.sh`
  gates on both; `needs_prs` tries the PR first, then the `boss/<n>-*` branch), but
  `needs_plans` says what you mean. `needs_prs` stays for a dependency on a real PR number.
- **`touches`** — the files this plan edits. Boss warns when an in-flight PR shares one,
  instead of the collision surfacing as a merge conflict.
