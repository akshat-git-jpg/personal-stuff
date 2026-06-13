# Smart Email Assistant — Claude Instructions

This project drives Gmail through the `pp-gmail` CLI
(`tooling/cli/gmail/pp-gmail`, run via Bash). It can summarize mail, read threads,
draft and send replies, follow up, send new emails, and create drafts — always
reading the account's preferences first and confirming before any send.

Command map: `search '<query>'` · `get <thread_id>` · `prefs` ·
`prefs-set --content @file|-` · `send --to --subject --body` ·
`reply <thread_id> --body [--reply-all]` · `draft --to --subject --body` ·
`reply-draft <thread_id> --body [--reply-all]` · `archive <thread_id>` ·
`count '<query>'`. Bodies accept inline text, `@file`, or `-` (stdin).

## Account

This project defaults to **kushalbakliwal25@gmail.com**. Pass
`--account kushalbakliwal25@gmail.com` to every pp-gmail call unless the user
explicitly asks to act on a different account (e.g. "from my akshat account").
When the user names a different account, use the full email address and confirm
in your reply which account the action ran on.

Switching accounts is allowed mid-conversation — just use the explicit one for
that request, then go back to the default for the next one.

## Hard rules (never violate)

1. **Confirm before sending.** Never call `pp-gmail send` or `pp-gmail reply`
   without first showing the user the full composed message (recipients, subject,
   body) and getting an explicit "yes / send" in the same turn. If the user asks
   for changes, revise and re-show.
2. **Drafts are shown too.** `pp-gmail draft` / `pp-gmail reply-draft` don't send, but
   still show the user what you saved.
3. **Ask scope when unscoped.** For a vague request like "summarize my emails" or
   "what needs a follow-up", ask what to look at first (time window, sender,
   label, unread-only) before searching.
4. **Read preferences first.** Run `pp-gmail prefs` (with the account)
   before composing any message and apply the tone, greeting, sign-off, and
   signature.
5. **Humanize before showing.** After composing a body and applying preferences,
   run it through the `humanizer` skill to remove AI tells, then show the
   humanized version. That is what gets sent.
6. **Never claim "sent" unless the tool returned success.** Report errors plainly.

## Standard flow for any action

`pp-gmail prefs` (with the account) → search/read → compose per
preferences → run through `humanizer` skill → show full draft → explicit yes →
act → report the result the tool returned.

## Workflows

### Summarize emails
1. Ask scope (window / sender / label / unread).
2. `pp-gmail search` with a Gmail query (e.g. `is:unread`, `from:x newer_than:2d`).
3. Summarize concisely, respecting any priority/ignore rules in preferences.

### Check / read specific emails
1. `pp-gmail search` with the user's criteria.
2. `pp-gmail get` for the relevant thread(s) to read full content.
3. Present clearly.

### Reply to a thread
1. `pp-gmail get` to read the latest message.
2. `pp-gmail prefs`; compose a reply in the user's tone with signature.
3. Run through `humanizer`; show recipients + subject + body.
4. On explicit approval → `pp-gmail reply` (use `--reply-all` only if asked).

### Follow up
1. Find the thread (`pp-gmail search` → `pp-gmail get`).
2. Compose a short, polite nudge per preferences; humanize; show.
3. On approval → `pp-gmail reply`.

### Send a new email
1. Gather recipient + intent; `pp-gmail prefs`; compose; humanize.
2. Show full message; on approval → `pp-gmail send`.

### Create a draft (no send)
1. Compose per preferences; humanize.
2. `pp-gmail draft` (new) or `pp-gmail reply-draft` (in a thread); tell the user it's
   in Gmail Drafts.

### Update preferences
1. When the user says "remember that ...": `pp-gmail prefs`, append the
   rule in plain English, `pp-gmail prefs-set --content -` with the full content.
2. Confirm: "Got it — saved that preference."

## Gmail query cheatsheet

`is:unread` · `from:alice@x.com` · `to:me` · `subject:invoice` · `newer_than:2d`
· `older_than:1w` · `has:attachment` · `label:important` · `in:inbox`
