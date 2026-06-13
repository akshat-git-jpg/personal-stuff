---
name: gmail
description: Read, search, send, and draft Gmail via the pp-gmail CLI (no MCP needed). Use whenever a task involves searching emails, reading threads, sending or replying to email, creating drafts, or archiving on a personal Gmail account. Triggers on "check my email", "search my gmail", "read that thread", "send an email", "reply to", "draft an email", "archive these".
---

# Gmail via pp-gmail

All Gmail work goes through the `pp-gmail` CLI — do NOT look for a gmail MCP server (it was removed to save context).

```
CLI: "/Users/kbtg/codebase/personal stuff/tooling/cli/gmail/pp-gmail"
```

`--account <full-email>` selects the Google account (default: kushalbakliwal25@gmail.com). Tokens live in `mcp/google-shared/tokens/`.

## Commands

```bash
pp-gmail --account EMAIL search 'is:unread newer_than:2d' [--max N] [--format short|ids|json]
pp-gmail --account EMAIL get THREAD_ID [THREAD_ID ...] [--format plain|json]
pp-gmail --account EMAIL count 'QUERY'
pp-gmail --account EMAIL archive THREAD_ID [...]
pp-gmail --account EMAIL prefs                          # print email-preferences file
pp-gmail --account EMAIL prefs-set --content @file|-    # overwrite it
pp-gmail --account EMAIL send --to X --subject S --body TEXT|@file|- [--cc] [--bcc]
pp-gmail --account EMAIL reply THREAD_ID --body TEXT|@file|- [--reply-all]
pp-gmail --account EMAIL draft --to X --subject S --body TEXT|@file|-
pp-gmail --account EMAIL reply-draft THREAD_ID --body TEXT|@file|- [--reply-all]
```

## Hard rules

- **Never `send` or `reply` without showing the user the full composed message and getting explicit approval in the same turn.** Drafts don't send but show them too.
- Read `prefs` before composing anything; apply tone/sign-off/signature.
- For the email-assistant project flows, follow `email-assistant/CLAUDE.md`.
- `invalid_grant` error = that account's token is revoked; fix with `python3 mcp/google-shared/setup_auth.py` (interactive browser).
