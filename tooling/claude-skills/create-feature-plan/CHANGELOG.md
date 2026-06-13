# Changelog — create-feature-plan

## 1.0.0 — 2026-05-07

- Initial release
- Reads plan from conversation context or a user-supplied file path
- Auto-extracts module slug, feature slug, JIRA ticket, summary, and lineage from the plan text
- Presents a single confirmation block for the user to verify or override inferred values
- Reformats plan to standard template structure if not already formatted; preserves all substance
- Prompts the user with focused, section-specific questions for any missing or thin sections
- User must approve the final plan before the PR is created
- Creates `plan/<module_slug>/<feature_slug>` branch and opens `[plan]` PR with reviewer checklist
