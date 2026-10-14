# Frontmatter and description rules

Detail for [../SKILL.md](../SKILL.md). Read it when writing or editing a skill's frontmatter or description.

## Frontmatter (checked against https://code.claude.com/docs/en/skills, 2026-10-06)

Every field is optional; only `description` is recommended. Use this shape:

```yaml
---
name: <kebab-case-name>      # defaults to the folder name; keep them equal
description: <plain string>  # what + when, with explicit trigger phrases
user-invocable: true         # repo convention; the default is already true
metadata:
  author: kbtg
  version: 1.0.0             # unquoted semver, nested under metadata; new skills start at 1.0.0
---
```

- **`user-invocable` defaults to `true`.** Omitting it still gives a `/name` command. Only `user-invocable: false` changes anything: it hides the skill from the `/` menu and blocks `/name`, while Claude can still auto-invoke it. Writing `true` is a convention, not a requirement.
- **Unknown keys are ignored, not rejected.** Claude Code "ignores a field it doesn't recognize without reporting an error" (docs). So `license`, `compatibility` or a top-level `version` do not hide a skill. A misspelled real key (`user_invocable`) is silently ignored too, so spell keys exactly, hyphens included.
- **Strictness applies outside Claude Code.** claude.ai upload, the Skills API and `package_skill.py` fail hard on keys outside `allowed-tools, compatibility, description, license, metadata, name`. Keep frontmatter to those plus `user-invocable` if the skill might ship there.

## Description quality (decides auto-trigger)

A bad description means the skill never triggers and the user must call it by name. A good one has:

- **What** the skill does, in one phrase.
- **When** to use it: explicit words and phrases the user is likely to say.
- **Specificity**: broad enough to catch real prompts, narrow enough to avoid false matches.

Bad: *"A code review skill."*
Good: *"Reviews staged git changes for security issues, missing tests, and breaking API changes. Triggers on 'review my changes', 'check this PR', 'look for security issues in this diff'."*

**Token budget.** Every description loads into every session that can see the skill, so prose beyond what + triggers is a permanent token tax. Aim for 500 characters or less, hard cap about 700. Internal workings and edge-case caveats belong in the body, which loads only on invocation. When you edit any existing skill, trim its description to this budget in the same pass.
