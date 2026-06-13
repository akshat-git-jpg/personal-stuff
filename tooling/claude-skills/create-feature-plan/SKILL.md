---
name: create-feature-plan
description: >
  Commit a finalized feature plan and open a [plan] PR in the zluri-docs repository,
  following the Zluri SDLC. Use when a plan.md is already written (in context or as a file)
  and the engineer is ready to raise the PR — triggered by "raise the plan PR", "open the
  plan PR", "push the plan", "submit the plan for review", or "create the plan PR".
  Reads the plan from context or a file path, reformats it to the standard template if
  needed, prompts the user on any missing sections, confirms metadata, then commits and
  opens the PR. Does not write the plan from scratch — that step is assumed done.
metadata:
  author: zluri
  version: 1.0.0
---

# Create Feature Plan PR

Commits a finalized `plan.md` to zluri-docs and opens a `[plan]` PR for engineering review.

**Assumes the plan content already exists.** This skill structures it, fills gaps
interactively, and raises the PR.

## When to Apply

- Plan is already written (in conversation context or as a file) and needs a PR
- User says "raise the plan PR", "open the plan PR", "push the plan", or "submit the plan"
- After an AI agent session that produced a plan and the engineer wants to ship it

## What This Skill Produces

1. `zluri-docs/features/<module_slug>/<feature_slug>/plan.md` — structured to the standard template, committed to the repo
2. A branch `plan/<module_slug>/<feature_slug>` in zluri-docs
3. A PR titled `[plan] <module_slug>/<feature_slug>` ready for tech lead + peer review

---

## Phase 1: Get the Plan

Check whether the plan content is already available.

**If the plan is in context** (the agent just wrote it, or the user pasted it):
- Use that content directly. Do not ask for a file path.

**If the plan is NOT in context**, ask:
> "I don't see a plan in our conversation. Please paste the plan content here,
> or provide the path to the file — e.g. `/Users/you/plan.md`."

If the user gives a file path, read it with the Read tool. If the file does not exist,
tell the user and wait for the correct path.

Do not proceed until you have the full plan text.

---

## Phase 2: Infer Metadata and Confirm

Parse the plan to extract as many values as possible before asking the user anything.

### What to infer from the plan

| Field | Where to look in the plan |
|-------|--------------------------|
| `MODULE_SLUG` | Header line (e.g., `**Module**: \`access-reviews\``), file path, or first heading |
| `FEATURE_SLUG` | Header line (e.g., `**Feature**: \`tag-filter-api\``), file path, or first heading |
| `JIRA_TICKET` | Header line (e.g., `**JIRA**: ZLURIV1-12345`) or any `ZLURIV1-NNNNN` pattern in the text |
| `SUMMARY` | First paragraph of the Context section (used in the PR body) |
| `IS_INCREMENTAL` | Whether the Lineage section is filled in with non-empty table rows |
| `PARENT_PLAN_PR` | Lineage → "Builds on plan" field, if present |

### What you cannot infer — always ask

- `DOCS_REPO_PATH` — the local checkout path of zluri-docs (cannot be derived from the plan)

### Present a single confirmation block

After inferring, show the user one markdown table — do not ask questions one by one.
Render it as a real table (not a code block) so it displays cleanly in Claude Code.

Use this format:

---
Here's what I extracted from the plan — please confirm or correct:

| Field | Value |
|-------|-------|
| Module slug | `<inferred>` |
| Feature slug | `<inferred>` |
| JIRA ticket | `<inferred>` or ⚠️ **NOT FOUND** — please provide (e.g. `ZLURIV1-12345`) |
| Incremental? | Yes / No — `<one-line reason>` |
| Parent plan PR | `<inferred>` or N/A |
| zluri-docs path | `<always ask>` |

Reply with any corrections or say **"looks good"**.

---

Use ⚠️ **NOT FOUND** (bold, with the emoji) only for fields that are genuinely missing — do not
use placeholder text for fields that were successfully inferred. For the zluri-docs path, if it
was mentioned earlier in the session, pre-fill it and add *(confirm if correct)* in italics.

Wait for the user's reply. Apply corrections. If a field is still "NOT FOUND" after the
reply, ask for it specifically before continuing.

---

## Phase 3: Reformat to Template and Fill Gaps

Read `assets/templates/plan-template.md` before doing anything in this phase.

This phase has two jobs:
1. **Reformat** — map the existing plan content into the standard template structure
2. **Fill gaps** — identify missing or thin sections and prompt the user to complete them

### 3a — Detect whether reformatting is needed

Compare the plan's section headings against the template sections:

```
Template sections (in order):
  Lineage                     (only required if incremental)
  Context
  Goals / Non-goals
  Architecture
  Implementation Steps        (each step must have a per-step ✓ AC)
  Alternatives Considered
  Architecture Decisions      (Decision Log + Revision History)
  Trade-offs
  Open Questions
```

If the plan already uses these exact headings and structure, it is **already formatted** —
skip to 3b without touching the content.

If the plan uses different headings, a flat structure, or is missing sections, it needs
reformatting. Map the content to the closest matching template section. Preserve all
wording — only change structure, never rewrite substance.

### 3b — Identify missing and thin sections

After reformatting (or confirming the plan is already structured), check each section:

| Section | Missing / thin if… |
|---------|-------------------|
| Lineage | Incremental change (`IS_INCREMENTAL = Yes`) but table rows are empty |
| Context | Absent or under one sentence |
| Goals / Non-goals | No explicit non-goals listed |
| Architecture | Missing request flow, or no answer to "does the DB schema change?" |
| Implementation Steps | Any step has no `✓ Done when:` AC attached |
| Alternatives Considered | Absent or placeholder text only |
| Architecture Decisions | Decision Log table has no rows |
| Trade-offs | Absent or placeholder text only |
| Open Questions | Absent (this one is optional — skip if truly none) |

### 3c — Prompt the user for each gap

For each missing or thin section, prompt the user with a focused question. Do **not** ask
about all gaps at once — group them into one message, but make each question distinct.

Use these prompts (adapt to context):

| Section | Prompt to show the user |
|---------|------------------------|
| Lineage | "This looks like an incremental change — what does it build on? Which previous plan PR or code PR laid the groundwork, and what's new vs. what already exists?" |
| Context | "The context section is thin. Who is this for, what problem does it solve, and why does it need to ship now?" |
| Goals / Non-goals | "I don't see explicit non-goals. What is intentionally out of scope for this version? Being explicit here prevents scope creep during review." |
| Architecture | "The architecture section is missing the request flow or DB schema answer. Walk me through: which files/services change, what's the call chain (route → service → DAL → DB), and does the schema change?" |
| Per-step AC | "Step [N] — '<step title>' — is missing a 'done when…' check. What's the concrete pass/fail gate an engineer can verify while building this step?" |
| Alternatives Considered | "What alternatives did you consider and rule out? Even one or two sentences helps reviewers understand why you chose this approach." |
| Architecture Decisions | "Were there any meaningful architectural choices during planning? For example: which layer owns the logic, whether to use a new table vs. an existing one, sync vs. async. Log the top decisions so reviewers don't have to re-litigate them." |
| Trade-offs | "What does this plan cost? Think about: performance at scale, added complexity, tech debt introduced, or anything a future engineer will need to know." |

After the user responds, incorporate their answers into the reformatted plan. Repeat for
any section that is still incomplete.

### 3d — Show the final plan for approval

Present the complete, reformatted plan to the user:

```
Here is the final plan.md. Review it and say "looks good" to raise the PR,
or tell me what to change.
```

Do not proceed to Phase 4 until the user explicitly approves.

---

## Phase 4: Write Plan File and Create the PR

### 4a — Write the plan file

Verify the repo path exists, then create the directory if needed:
```
<DOCS_REPO_PATH>/features/<MODULE_SLUG>/<FEATURE_SLUG>/
```

Write the final plan content to:
```
<DOCS_REPO_PATH>/features/<MODULE_SLUG>/<FEATURE_SLUG>/plan.md
```

If the file already exists, show a diff and ask: "This file already exists — overwrite, abort, or open a versioned branch?"

### 4b — Commit, push, and open PR

```bash
cd <DOCS_REPO_PATH>

git checkout main
git pull origin main

git checkout -b plan/<MODULE_SLUG>/<FEATURE_SLUG>

git add features/<MODULE_SLUG>/<FEATURE_SLUG>/plan.md

git commit -m "$(cat <<'EOF'
feat: add plan for <MODULE_SLUG>/<FEATURE_SLUG>

JIRA: <JIRA_TICKET>
EOF
)"

git push -u origin plan/<MODULE_SLUG>/<FEATURE_SLUG>

gh pr create \
  --title "[plan] <MODULE_SLUG>/<FEATURE_SLUG>" \
  --body "$(cat <<'EOF'
## Plan: <FEATURE_SLUG>

**JIRA**: https://zluri.atlassian.net/browse/<JIRA_TICKET>
<if IS_INCREMENTAL>**Builds on**: <PARENT_PLAN_PR></if>

## Summary
<SUMMARY>

## Reviewer Checklist
- [ ] **Architecture** — components fit together; all schema and contract changes are called out
- [ ] **Implementation steps** — ordering is sensible; auth, migration, rollback, and observability are addressed where relevant
- [ ] **Per-step AC** — every step carries a concrete "done when…" check
- [ ] Alternatives genuinely considered, trade-offs called out honestly
- [ ] Open questions surfaced for the team to answer

> Rule of thumb: if you can't review this plan without reading the code, the plan is incomplete. Send it back.

## What is NOT in this PR
Feature-level AC (manual + automated test cases for the whole feature) goes in a separate
`[ac] <MODULE_SLUG>/<FEATURE_SLUG>` PR opened after this plan is approved.

---
📋 `features/<MODULE_SLUG>/<FEATURE_SLUG>/plan.md`
🤖 Created with Claude Code `/create-feature-plan` skill
EOF
)" \
  --base main
```

---

## Output

```
✅ Plan PR Created

Feature: <MODULE_SLUG>/<FEATURE_SLUG>
JIRA:    <JIRA_TICKET>

File:    zluri-docs/features/<MODULE_SLUG>/<FEATURE_SLUG>/plan.md
Branch:  plan/<MODULE_SLUG>/<FEATURE_SLUG>
PR:      [plan] <MODULE_SLUG>/<FEATURE_SLUG>
🔗 <PR_URL>

Reviewers to add: tech lead + one peer in the module

Next Steps:
1. Add reviewers to the PR
2. After this plan is approved and merged, open the AC PR:
   /create-feature-ac
3. After both plan + AC are merged, open the code PR linking both

⚠️  No code PR until this plan is merged.
```

---

## Rules

- Preserve all substance when reformatting — only change structure, never rewrite wording
- Prompt for missing sections; do not silently leave them blank or fill them yourself
- Do not create the PR until the user has approved the final plan in Phase 3d
- If the plan file already exists in the repo, always show a diff and ask before overwriting
- PR title format is exactly: `[plan] <module_slug>/<feature_slug>`
- Reviewers: tech lead + one peer from the module

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Module or feature slug not found in plan | Ask: "What should the module and feature slug be?" |
| JIRA ticket not found in plan | Ask: "What is the JIRA ticket for this feature?" |
| zluri-docs not cloned locally | Ask the user to clone it: `git clone git@github.com:ZluriHQ/zluri-docs.git` |
| `features/` directory doesn't exist | Create it — this is the first plan for this module |
| plan.md already exists at target path | Show a diff and ask: "Overwrite, abort, or open a versioned branch?" |
| User says a section is intentionally empty | Accept it — add a `<!-- intentionally omitted: <reason> -->` comment in that section |
