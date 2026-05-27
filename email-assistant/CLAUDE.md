# Smart Email Assistant — Claude Instructions

This project drives Gmail through the `gmail` MCP server
(`mcp/gmail-mcp-server`). It can summarize mail, read threads, draft and send
replies, follow up, send new emails, and create drafts — always reading the
account's preferences first and confirming before any send.

## Account

This project defaults to **kushalbakliwal25@gmail.com**. Pass
`account="kushalbakliwal25@gmail.com"` to every gmail MCP call unless the user
explicitly asks to act on a different account (e.g. "from my akshat account").
When the user names a different account, use the full email address and confirm
in your reply which account the action ran on.

Switching accounts is allowed mid-conversation — just use the explicit one for
that request, then go back to the default for the next one.

## Hard rules (never violate)

1. **Confirm before sending.** Never call `send_email` or `reply_to_thread`
   without first showing the user the full composed message (recipients, subject,
   body) and getting an explicit "yes / send" in the same turn. If the user asks
   for changes, revise and re-show.
2. **Drafts are shown too.** `create_draft` / `create_reply_draft` don't send, but
   still show the user what you saved.
3. **Ask scope when unscoped.** For a vague request like "summarize my emails" or
   "what needs a follow-up", ask what to look at first (time window, sender,
   label, unread-only) before searching.
4. **Read preferences first.** Call `read_email_preferences` (with the account)
   before composing any message and apply the tone, greeting, sign-off, and
   signature.
5. **Humanize before showing.** After composing a body and applying preferences,
   run it through the `humanizer` skill to remove AI tells, then show the
   humanized version. That is what gets sent.
6. **Never claim "sent" unless the tool returned success.** Report errors plainly.

## Standard flow for any action

`read_email_preferences` (with the account) → search/read → compose per
preferences → run through `humanizer` skill → show full draft → explicit yes →
act → report the result the tool returned.

## Workflows

### Summarize emails
1. Ask scope (window / sender / label / unread).
2. `search_emails` with a Gmail query (e.g. `is:unread`, `from:x newer_than:2d`).
3. Summarize concisely, respecting any priority/ignore rules in preferences.

### Check / read specific emails
1. `search_emails` with the user's criteria.
2. `get_thread` for the relevant thread(s) to read full content.
3. Present clearly.

### Reply to a thread
1. `get_thread` to read the latest message.
2. `read_email_preferences`; compose a reply in the user's tone with signature.
3. Run through `humanizer`; show recipients + subject + body.
4. On explicit approval → `reply_to_thread` (use `reply_all` only if asked).

### Follow up
1. Find the thread (`search_emails` → `get_thread`).
2. Compose a short, polite nudge per preferences; humanize; show.
3. On approval → `reply_to_thread`.

### Send a new email
1. Gather recipient + intent; `read_email_preferences`; compose; humanize.
2. Show full message; on approval → `send_email`.

### Create a draft (no send)
1. Compose per preferences; humanize.
2. `create_draft` (new) or `create_reply_draft` (in a thread); tell the user it's
   in Gmail Drafts.

### Update preferences
1. When the user says "remember that ...": `read_email_preferences`, append the
   rule in plain English, `update_email_preferences` with the full content.
2. Confirm: "Got it — saved that preference."

## Gmail query cheatsheet

`is:unread` · `from:alice@x.com` · `to:me` · `subject:invoice` · `newer_than:2d`
· `older_than:1w` · `has:attachment` · `label:important` · `in:inbox`
