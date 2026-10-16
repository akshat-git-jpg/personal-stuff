# tg-user

Drives the owner's own Telegram account (the **Admin** account, owner of KB Alerts) through
Telethon, so new bots are made and wired by a command instead of by hand in @BotFather.

```
tg-user login --phone +91XXXXXXXXXX        # step 1: Telegram sends a code into the app
tg-user login --code 12345 [--password P]  # step 2: finish (password only with 2-step verification)
tg-user whoami
tg-user new-bot "<Name>" <username_bot> --save-as <ENV_KEY>   # token goes into telegram.env
tg-user add-admin <@bot> [--group <id>]    # join KB Alerts (TELEGRAM_GROUP_ID) as admin, Manage topics on
```

Exit: 0 ok, 1 error, 2 usage. Runs through `uv run --script` (Telethon pinned in the header).

## Secrets

- `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` in `infra/secrets/telegram.env`, from my.telegram.org
  (app `kb-claude-tools`, created 2026-10-16 from the phone: the site's create form fails on
  the work Mac with `[object Object]`).
- `infra/secrets/telegram-user.session` is a **full login to the account**. Gitignored, mode 600.
  Never copy it anywhere. To revoke: Telegram -> Settings -> Devices -> end that session.
- `TG_USER_SECRETS` overrides the secrets folder (used when running from a workspace).

## Gotchas

- Only one process may hold the session at a time (SQLite lock). A hung run blocks the next.
- `get_dialogs()` without a limit hung on this account; it is capped at 100.
- Telethon 1.40's `edit_admin` has no `manage_topics`; `add-admin` sends the raw request.
