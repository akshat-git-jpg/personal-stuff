---
name: secretary
description: Bridge between the orchestrate skill and the boss orchestrator. raise = turn a finished plan in plans/ into a boss:ready GitHub PR; groom = audit open PRs and retire stale ones. Triggers on "secretary raise", "raise a boss PR", "ship this plan to boss", "secretary groom", "clean up open PRs", "audit boss PRs", "retire stale PRs", "/secretary", "secretary".
user-invocable: true
metadata:
  author: kbtg
  version: 1.2.0
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

**Never block a raise.** The PR always gets created — gaps become labels, not
stop conditions, so the PR stays visible and filterable instead of vanishing
into a "didn't raise it" limbo. Boss only ever looks at `boss:ready`, so a
gapped PR is automatically invisible to it without anyone refusing anything.

1. **Identify the plan.** Take the plan file path from the invocation (e.g.
   `plans/043-fix-widget.md`) or ask the owner which plan. Derive `NNN-slug`
   from the filename (strip `plans/` and `.md`).

2. **Check for gaps (don't stop, just record them):**
   - **`test_cmd`** — read the plan's YAML frontmatter (first `---`…`---`
     block). Missing/empty → gap `gap:test-cmd`.
   - **Open points** — read the plan's Summary block, **Open points for plan
     readiness**. Anything other than `none` → gap `gap:open-points`.

3. **Pick the type label** from the plan's `Category` field:
   - feature → `type:feature`
   - bug → `type:bug`
   - refactor → `type:refactor`
   - anything else → `type:chore`

   Ensure the label taxonomy exists (idempotent, ignore "already exists"):
   ```bash
   for l in type:feature type:bug type:refactor type:chore \
            boss:ready boss:in-progress boss:done boss:blocked \
            gap:test-cmd gap:open-points; do
     gh label create "$l" 2>/dev/null || true
   done
   ```

4. **Account.** Follow the `github-router` skill to select the right GitHub
   account for this repo before any push.

5. **Branch + commit + PR.** Readiness label depends on step 2: no gaps →
   `boss:ready`; any gap → the specific `gap:*` label(s) instead (never both —
   a gapped PR is not boss:ready by definition). Put the gap details in the PR
   body so nobody has to open the plan file to know what's missing.
   ```bash
   git checkout -b "boss/<NNN-slug>" origin/main
   git add "plans/<NNN-slug>.md"
   git commit -m "plan: <NNN-slug>"
   git push -u origin "boss/<NNN-slug>"
   gh pr create --title "<NNN-slug>: <plan title>" \
     --body "$(cat <<BODY
   Boss-ready plan. Implemented by boss when picked. See plans/<NNN-slug>.md.

   <if gaps: "**Gaps — not boss:ready yet:**" + one bullet per gap, e.g.
   "- gap:test-cmd — frontmatter has no test_cmd" / "- gap:open-points — <quoted open point text>">
   BODY
   )" \
     --label "<type-label>" --label "<boss:ready OR the gap:* label(s)>"
   ```

6. **Report** the PR URL to the owner and stop. If gaps exist, state them
   plainly and note the PR won't be picked up by boss until someone fixes the
   plan and swaps the `gap:*` label(s) for `boss:ready` (`groom`'s `update`
   action does this — see below). **Do NOT dispatch or implement** — that is
   boss's job.

## groom

An on-demand sweep of open PRs that retires the ones reality has passed by (a
plan raised days ago that no longer matches main), so boss never spends a crew
on stale work. This is a discussion sweep, not a batch delete.

### Hard boundary (the lock)

Groom ONLY touches PRs labelled `boss:ready`, `gap:test-cmd`, `gap:open-points`,
or draft PRs. It NEVER touches a PR labelled `boss:in-progress`, `boss:done`,
or `boss:blocked` — those belong to boss (boss owns everything from
`in-progress` onward). If asked to act on one, refuse and explain. This split
is what makes groom and boss non-overlapping by construction, so they can
never double-close or race a PR.

### Procedure

1. **List candidates.** Open PRs labelled `boss:ready`, `gap:test-cmd`, or
   `gap:open-points`, plus draft PRs (still being brainstormed). Show each
   with its age, title, and label, oldest first:
   ```bash
   gh pr list --state open --label boss:ready,gap:test-cmd,gap:open-points \
     --json number,title,createdAt,labels \
     -q 'sort_by(.createdAt) | .[] | "  #\(.number) \(.title)  [\(.labels|map(.name)|join(","))]  (raised \(.createdAt))"'
   gh pr list --state open --draft --json number,title,createdAt \
     -q 'sort_by(.createdAt) | .[] | "  draft #\(.number) \(.title)  (raised \(.createdAt))"'
   ```

2. **For each candidate, check staleness and discuss with the owner.** How far
   the branch is behind/ahead of main:
   ```bash
   git fetch -q origin main "<branch>"
   echo "behind: $(git rev-list --count origin/<branch>..origin/main)  ahead: $(git rev-list --count origin/main..origin/<branch>)"
   ```
   Then, per PR, offer the owner choices and act on their call:
   - **keep** — leave `boss:ready` PRs as-is.
   - **update** — edit the plan file on its branch to match current reality
     (fill `test_cmd`, resolve the open point — whatever the gap needs),
     commit + push (follow `github-router` first). Then **re-check gaps**
     (same rule as `raise` step 2): if none remain, swap every `gap:*` label
     for `boss:ready`; if a gap remains, leave the matching `gap:*` label.
   - **park** — `gh pr edit <n> --remove-label boss:ready` (drops a ready PR
     out of boss's queue without closing, for "not now"). Gap-labeled PRs are
     already parked by construction — nothing to do here for them.
   - **close** — `gh pr close <n>` with a one-line reason comment, for dead
     plans (ready or gapped).

3. **Never auto-decide.** Groom always acts on the owner's per-PR call.
