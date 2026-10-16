# inbox

Phone <-> Mac file drop over the **`inbox` topic in the KB Alerts group**, read by its own bot
(@KbInbox_bot). Drop a file or text in that topic from the phone and it lands in `~/Inbox`
on the Mac. Run `inbox send` on the Mac and it shows up in the same topic, ready to download.

## Commands

```
inbox setup                 # one-time: create the inbox topic in KB Alerts, save chat + thread id
inbox pull [--dir D]        # save new messages/files to ~/Inbox (or D); prints each path
inbox send <file|text>...   # files go as documents (full quality, original name); text as a message
inbox open                  # open ~/Inbox in Finder
```

Exit codes: 0 ok, 1 error, 2 usage.

## How it works

- `pull` reads the bot's `getUpdates` queue, keeps only human messages in the inbox topic, downloads
  each attachment (documents keep their name; photos save the largest size), and writes
  text and captions as `<date>_note.txt`. The offset lives in `~/.local/state/inbox/`
  and moves only after a message is saved.
- The launchd job `com.kbtg.inbox-pull` runs `pull` every 5 minutes and shows a macOS
  notification when something new lands. Log: `~/Library/Logs/inbox-pull.log`.

## Limits (Telegram Bot API)

- **Phone -> Mac: 20 MB per file.** Bigger files are reported as `SKIP` and left in the chat.
- **Mac -> phone: 50 MB per file.** Folders are refused; zip them first.
- **Telegram drops undelivered updates after 24 hours.** The 5-minute job covers this
  unless the Mac is off for a full day. Anything missed is still in the chat on the phone.

## Why a separate bot

The main bot (@KbDailyPlanner_bot) also feeds `amul-watch`, which consumes its
`getUpdates` queue. Two readers on one queue lose each other's messages, so the inbox
gets its own bot and its own queue. See decisions.md 2026-10-16.

## Setup

No BotFather by hand: `tg-user` (`tooling/cli/tg-user/`) makes and promotes the bot.

1. `tg-user new-bot "KB Inbox" KbInbox_bot --save-as TELEGRAM_INBOX_BOT_TOKEN`
2. `tg-user add-admin @KbInbox_bot` (joins KB Alerts with Manage topics)
3. `inbox setup`
4. `ln -sfn "$PWD/tooling/cli/inbox/inbox" ~/.local/bin/inbox`
5. Install the job: see `MAC-LAUNCHD.md`.

## Files

| File | Purpose |
|------|---------|
| `inbox` | The CLI (stdlib only; runs on `/usr/bin/python3` because the python.org 3.11 on PATH has no CA certs) |
| `test-inbox.py` | Self-test against a stub Bot API server, no network |
| `com.kbtg.inbox-pull.plist` | launchd job: `pull` every 5 minutes |
