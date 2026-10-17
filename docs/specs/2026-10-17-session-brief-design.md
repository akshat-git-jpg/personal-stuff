# Session brief: one place for what Claude hands back to me

Date: 2026-10-17. Status: approved by the owner, revised after an independent review.

## Why

The owner gives a Claude Code session a task and goes away for hours, often with several
sessions running. On return he has no context: what is blocked on him, where the PR or ticket
is, what to paste where. He scrolls up or asks again, in every session. Separately, Slack/email
drafts break when copied from the terminal, and expired logins make Claude improvise.

Shared root (from the review): Claude hands things to a person who is only around now and then
(links, blockers, logins, drafts) as prose in a transcript that scrolls away. The fix is one
per-session list, filled by code wherever possible, shown in one known place.

## What it is

A Claude Code **mod**, `session-brief`, terminal (fullscreen TUI). It keeps one brief per session
and draws it in a **side pane** toggled with **`/brief`** (owner's choice; never opens by itself).

Pane sections, top to bottom:

1. **Needs you**: logins, approvals, decisions, questions. Empty shows "Nothing".
2. **Plan**: steps with done / active / pending / failed and a bar. Replaces `plan-progress`.
3. **Drafts**: Slack/email drafts, each with a **Copy** button.
4. **Keep handy**: PRs, tickets, artifacts, docs, paths.

No "where we are" or "done" section written by Claude: the built-in session recap covers status.

Under an answer, **only when something is pending or new**, the mod shows one display-only line
(not sent to the model), for example `needs you: 1 · new PR · /brief`. Owner approved this line.
It is not a band above the prompt.

## Who fills it

| Entry | Written by | How |
|---|---|---|
| Links | the mod (code) | from results of commands that **create** things (`gh pr create`, `gh issue create`, Jira create tools, artifact publish) and from URLs Claude writes in its replies. Never from arbitrary tool output (`gh pr list`, logs, grep). Allowlisted hosts, deduped, newest first, capped. |
| Needs you: login | the mod (code) | on a failed tool call whose error matches the auth-failure patterns (same set as `work-skills/bin/hooks/auth-stop.py`). Cleared when the same tool next succeeds. |
| Needs you: other | Claude | `brief` tool, before stopping to ask the owner anything. |
| Plan | Claude | `brief` tool, ops shaped like `plan_progress` (create, next, done/active, failed). |
| Drafts | Claude | `copy_draft` tool, called by the humanizer flow once a draft is final. |

A short static `prompt.compose` section tells Claude when to call the tools. Static text only, so
the prompt cache holds.

## Clipboard (`copy_draft`)

- Converts the draft's markdown to HTML and writes **HTML + plain text** to the macOS pasteboard
  together (small JXA script via `osascript`; `pbcopy` writes plain text only). One output for
  Slack and Gmail; no mrkdwn conversion.
- Copies immediately **only when the owner is present**: the turn is short (my call: under
  2 minutes since his prompt). Otherwise it only files the draft in the pane, so parallel
  sessions never overwrite each other's clipboard. The pane's Copy button copies on demand.
- Fallback that works today: drafts also go in a fenced block, so the prismantis copy button works.

## Storage

`$.store` keyed by session id is the source of truth (survives `/compact`, which drops old tool
output, and `/resume`). Pruned to the most recent sessions. `$.state` only for drawing.

## Logins (problem 3, already shipped, extended)

`auth-stop.py` (PostToolUse/PostToolUseFailure) stays. Additions:
- Google patterns on the Bash path: `invalid_grant`, `RefreshError`,
  `Request had invalid authentication credentials`, `UNAUTHENTICATED`.
- AWS check at task start: the first AWS/EKS command in a session reads `expiresAt` from
  `~/.aws/sso/cache`; expired or under 15 minutes left, Claude asks for the login before working.
- The mod files expired logins as Needs you items (above).

## Non-goals

Auto-open, keyboard shortcut, band above the prompt, all-sessions dashboard, phone pings,
Stop-hook nudges, Claude-written status summaries, Slack mrkdwn conversion, Desktop/VS Code.

## Anti-goals

A wrong or made-up link. One session's draft landing on the clipboard while another is in use.
Noise on short turns. A real token cost increase.

## Constraints

- Claude Code 2.1.302, terminal, fullscreen. Docks beside the transcript at about 110+ columns.
- Work account first. Source lives in this public repo at `tooling/mods/session-brief/`: no Zluri
  hostnames or secrets in code; work hosts come from a user config option.
- Plain TS in the mod sandbox; the clipboard writer is macOS only and degrades to the fenced-block
  fallback elsewhere.

## Calls I made

- Present = under 2 minutes since the prompt, for immediate copy.
- AWS expiry warning at 15 minutes.
- Links capped at 12, needs-you never capped.
