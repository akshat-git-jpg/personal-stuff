# notify

Telegram phone-ping CLI. Used by `greenlight` for phone notifications.

## Why this exists

ntfy delivery was unreliable on the owner's iPhone, so Telegram became the
primary channel. The self-hosted ntfy fallback was retired on 2026-08-30: the
server was published on port 8888 with `auth-default-access: read-write`, so
anyone on the internet could read its topics and publish to them, and it had 0
subscribers, so the fallback delivered nothing anyway. Telegram is now the only
channel. See decisions.md 2026-08-30.

## Contract

```
notify send "<message>"   # exit 0 sent, 3 undeliverable, 2 usage error
notify setup               # one-time: derive TELEGRAM_CHAT_ID
```

`notify send` never crashes the caller: a Telegram failure prints a `WARN` to
stderr and exits 3 (undeliverable), it does not raise past that.

## Delivery

1. **Telegram** — if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are both set
   in `infra/secrets/telegram.env`, POSTs to the Bot API. Success → exit 0.
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
