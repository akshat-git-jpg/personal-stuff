# session-brief

A Claude Code mod. `/brief` toggles a side pane for the current session:

- **Needs you**: what is blocked on you. Expired logins land here by themselves.
- **Plan**: the task's steps and a progress bar. Replaces the `plan-progress` mod.
- **Drafts**: Slack/email text, with a Copy button that puts rich text (HTML + plain) on the clipboard.
- **Keep handy**: PRs, tickets, artifacts, paths. Links come from create calls (`gh pr create`,
  Jira create, artifact publish) and from links Claude writes, never from arbitrary output.

When something is pending, one line shows under Claude's answer: `brief · needs you: 1 · 2 new · /brief`.
Once per session, when the context passes 75%, the line also says `run close-session before it compacts`,
because compaction drops the detail the `close-session` skill harvests.

Design: [`docs/specs/2026-10-17-session-brief-design.md`](../../../docs/specs/2026-10-17-session-brief-design.md).

## Install

Needs Claude Code 2.1.287+ and the fullscreen TUI for the side pane (narrower terminals show it inline).

```bash
claude plugin marketplace add /Users/kbtg/codebase/personal-stuff/tooling/mods
claude plugin install session-brief@pp-mods
```

Optional: `/plugin` → session-brief → config → `linkHosts` adds hosts (comma-separated) whose links in
replies are kept, such as a company domain. Keep company hosts out of this repo.

## Develop

```bash
claude plugin validate tooling/mods/session-brief
claude plugin test tooling/mods/session-brief
```

Storage: `$.store` keyed by session id (survives `/compact` and `--resume`), last 40 sessions kept.
The rich clipboard writer is macOS (`osascript` JXA); elsewhere it falls back to plain text.
