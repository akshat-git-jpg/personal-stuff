# notify

Telegram-first phone-ping CLI, with [ntfy](../ntfy/README.md) as a fallback
channel. Used by `greenlight` and `overnight` for phone notifications.

## Why this exists

ntfy delivery is unreliable on the owner's iPhone. Telegram is the primary
channel now; ntfy stays wired in as a fallback — both for the window before
Telegram creds exist, and for the rare case a Telegram send itself fails.

## Contract

```
notify send "<message>"   # exit 0 sent, 3 undeliverable, 2 usage error
notify setup               # one-time: derive TELEGRAM_CHAT_ID
```

`notify send` never crashes the caller: a Telegram/ntfy failure prints a
`WARN` to stderr and exits 3 (undeliverable), it does not raise past that.

## Fallback order

1. **Telegram** — if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are both set
   in `infra/secrets/telegram.env`, POSTs to the Bot API. Success → exit 0.
2. **ntfy** — if Telegram creds are missing or the Telegram send fails, and
   `pp-ntfy` is on `PATH` and `NTFY_TOPIC` is set, falls back to
   `pp-ntfy send`.
3. **Undeliverable** — otherwise prints the message to stderr with a `WARN`
   prefix and exits 3.

## Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram, run `/newbot`,
   follow the prompts.
2. Copy `infra/secrets/telegram.env.example` to `infra/secrets/telegram.env`
   (gitignored) and paste the token into `TELEGRAM_BOT_TOKEN`.
3. Message your new bot once (any text — this is how Telegram tells you its
   chat ID).
4. Run `tooling/cli/notify/notify setup`. It calls `getUpdates`, extracts the
   chat ID from your message, and writes `TELEGRAM_CHAT_ID` into
   `telegram.env`. If it can't find a chat yet, it tells you to message the
   bot first and re-run.

`notify setup` never overwrites an existing non-empty `TELEGRAM_CHAT_ID`.

## Files

| File | Purpose |
|------|---------|
| `notify` | The CLI (bash, no deps beyond `curl` and `python3` for JSON parsing) |
| `test-notify.sh` | Self-test — stubs `curl`/`pp-ntfy`, asserts all code paths |
| `README.md` | This file |

Creds live in `infra/secrets/telegram.env` (owner-created, gitignored) — see
`infra/secrets/telegram.env.example` for the template.
