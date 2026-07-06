---
name: secretary
description: Raise a boss:ready GitHub PR from a finished orchestrate plan in plans/ (the bridge to the boss orchestrator). Use to ship a plan for implementation. Triggers on "secretary raise", "raise a boss PR", "raise the PR for this plan", "ship this plan to boss", "/secretary", "secretary".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# secretary

A skill with two modes: **raise** (this section) and **groom** (below).
Secretary is the thin bridge between the `orchestrate` skill (which writes
self-contained plans into `plans/`) and `boss` (which implements them via
PR-driven dispatch). Design: `docs/specs/2026-07-07-boss-design.md`.

## raise

Turn a finished plan file into a `boss:ready` GitHub PR. This is deliberately
mechanical — no brainstorming, no planning. The plan already exists.

### Procedure

1. **Identify the plan.** Take the plan file path from the invocation (e.g.
   `plans/043-fix-widget.md`) or ask the owner which plan. Derive `NNN-slug`
   from the filename (strip `plans/` and `.md`).

2. **Precondition — `test_cmd`.** Read the plan's YAML frontmatter (the first
   `---`…`---` block). If `test_cmd` is empty or missing, **STOP** and tell
   the owner: boss requires a `test_cmd` (one command, exit 0 = pass) — ask
   them to fill the plan's frontmatter (or offer to add it), then re-run.
   **Do NOT raise a PR without a `test_cmd`.**

3. **Pick the type label** from the plan's `Category` field:
   - feature → `type:feature`
   - bug → `type:bug`
   - refactor → `type:refactor`
   - anything else → `type:chore`

   Ensure the label taxonomy exists (idempotent, ignore "already exists"):
   ```bash
   for l in type:feature type:bug type:refactor type:chore \
            boss:ready boss:in-progress boss:done boss:blocked; do
     gh label create "$l" 2>/dev/null || true
   done
   ```

4. **Account.** Follow the `github-router` skill to select the right GitHub
   account for this repo before any push.

5. **Branch + commit + PR:**
   ```bash
   git checkout -b "boss/<NNN-slug>" origin/main
   git add "plans/<NNN-slug>.md"
   git commit -m "plan: <NNN-slug>"
   git push -u origin "boss/<NNN-slug>"
   gh pr create --title "<NNN-slug>: <plan title>" \
     --body "Boss-ready plan. Implemented by boss when picked. See plans/<NNN-slug>.md." \
     --label "<type-label>" --label "boss:ready"
   ```

6. **Report** the PR URL to the owner and stop. **Do NOT dispatch or
   implement** — that is boss's job.
