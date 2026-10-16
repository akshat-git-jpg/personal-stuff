---
name: inbox
description: Phone <-> Mac file drop over the private KB Inbox Telegram bot. Pull what the owner sent from the phone into ~/Inbox, or send a Mac file or text to the phone. Triggers on "I sent it on Telegram", "I sent you a file from my phone", "check my inbox bot", "grab the file I sent", "send this to my phone", "put this on my phone".
---

# Inbox via the inbox CLI

```
CLI: tooling/cli/inbox/inbox      (README: tooling/cli/inbox/README.md)
```

## Commands

```bash
inbox pull              # saves new files/text to ~/Inbox, prints each path
inbox send FILE|TEXT... # files go as documents (original quality and name)
inbox open              # open ~/Inbox in Finder
```

## How to use it

- "I sent it on Telegram": run `inbox pull`, then work on the printed path. A launchd job also pulls every 5 minutes, so the file may already be in `~/Inbox`: check there if `pull` prints nothing.
- Limits: 20 MB phone -> Mac, 50 MB Mac -> phone. Zip a folder before `send`.
- Never `send` secrets, health or salary files to the phone unless the owner names that file.
- Missing `TELEGRAM_INBOX_CHAT_ID` = run `inbox setup` (setup steps in the README).
