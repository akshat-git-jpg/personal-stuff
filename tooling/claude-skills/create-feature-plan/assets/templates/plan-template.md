# <Feature Name> — Plan

> **Module**: `<module_slug>` · **Feature**: `<feature_slug>` · **JIRA**: [<JIRA_TICKET>](https://zluri.atlassian.net/browse/<JIRA_TICKET>)

---

## Lineage

<!--
Fill this section ONLY for incremental changes — leave blank for greenfield work.
Captures what this plan builds on top of so reviewers understand the history
without hunting through git or old PRs.
-->

| Field | Value |
|-------|-------|
| Builds on plan | `<link to previous plan PR or plan.md, if any>` |
| Extends feature | `<feature_slug of the parent feature, if any>` |
| Related PRs | `<links to prior code PRs that laid the groundwork>` |
| Scope delta | `<one sentence — what specifically is new vs. what already exists>` |

<!--
Example for an incremental change:
  Builds on plan: ZluriHQ/zluri-docs#45 (tag-filter-api v1 plan)
  Extends feature: tag-filter-api
  Related PRs: ZluriHQ/dashboard-api#1234 (v1 implementation)
  Scope delta: Adds multi-tag AND/OR boolean queries; the single-tag filter from v1 is unchanged.

Leave the table empty (or remove this section) if this is a greenfield feature.
-->

---

## Context

<!--
Problem this feature solves, who it's for, and why it's needed now.
-->

## Goals / Non-goals

<!--
Use + for goals and − for non-goals. Be explicit — non-goals prevent scope creep.
-->

**Goals:**
- `+` ...

**Non-goals:**
- `−` ...

---

## Architecture

<!--
Components involved, request flow (e.g., route → service → DAL → DB),
layers touched, and any schema or API contract changes.
-->

**Request flow:**
```
<route file> → <service> → <DAL / executor> → <DB collection or table>
```

**Layers touched:**
- Routes: `...`
- Service: `...`
- DAL: `...`
- DB schema change: Yes / No

**Contract changes (API or event):** Yes / No — if yes, describe here.

---

## Implementation Steps

<!--
Ordered steps. Each step is one logical unit of work. Per-step AC is
the engineer's pass/fail gate while building — not a feature-level test case.
-->

1. **`<file>`: <what changes>.**
   ✓ Done when: <concrete check — e.g., "param parsed and passed through; absent param leaves call shape unchanged">

2. **`<file>`: <what changes>.**
   ✓ Done when: <concrete check>

3. **<Step description>.**
   ✓ Done when: <concrete check>

4. **Cover with unit tests.**
   ✓ Done when: all cases (<list scenarios>) are green in CI.

> Note: these are per-step checks for the engineer building the feature.
> End-to-end "is the feature done?" criteria live in the separate AC PR.

---

## Alternatives Considered

<!--
What was ruled out and why. Helps reviewers understand the decision.
-->

- `<Alternative A>`: rejected because ...
- `<Alternative B>`: deferred because ...

---

## Architecture Decisions

<!--
Record significant architectural choices made during planning or review.
Each entry captures the decision, the context that drove it, and when/why it might be revisited.
Add a new entry each time the plan is revised after reviewer feedback.
-->

### Decision Log

| # | Decision | Context / Rationale | Revisit if… |
|---|----------|---------------------|-------------|
| 1 | <short decision statement> | <why this was the right call given current constraints> | <condition that would make you reconsider> |

<!--
Example:
  | 1 | Filter in service layer, not DAL | Keeps storage decoupled from query shape; acceptable perf for <50k rows | Dataset grows past 50k rows/user |
  | 2 | Reject multi-tag queries in v1 | Adds AND/OR parsing complexity; PM agreed to defer | v2 roadmap prioritises it |
-->

### Revision History

<!--
When reviewers push back and the plan changes, log it here so the final
merged plan is self-explaining — no need to read PR comments to understand why it evolved.
-->

| Date | Revised by | What changed | Why |
|------|------------|--------------|-----|
| YYYY-MM-DD | @handle | <summary of change> | <reviewer feedback or new information> |

---

## Trade-offs

<!--
What this plan costs: performance, scalability, maintainability, or tech debt.
-->

- ...

---

## Open Questions

<!--
Questions you want reviewers or the team to weigh in on before coding starts.
-->

- [ ] ...
